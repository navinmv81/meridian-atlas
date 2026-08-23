// meridian-firds — ZIP + streaming XML record extractor.
//
// Pure Web APIs only (fetch/Response/ReadableStream/DecompressionStream/
// TextDecoderStream/DataView) — no Node core-module dependency, per this
// packet's Architecture constraints.
//
// Why a minimal hand-rolled ZIP reader instead of a library: ESMA's FULINS
// files are written in "streamed" mode (general-purpose bit flag 3 set) —
// the local file header's compressed/uncompressed size fields are zero;
// real sizes only exist in the End Of Central Directory (EOCD) + Central
// Directory records at the end of the file.
//
// EARLIER APPROACH (revised 2026-08-20, live-tested and reverted): feeding
// raw-inflate everything after the local header through to EOF —
// compressed data plus the trailing data descriptor and central directory
// bytes, unseparated — worked perfectly against Node's zlib.inflateRawSync
// (verified byte-for-byte against a real file), which silently ignores
// trailing bytes after the deflate end marker. It did NOT work against the
// actual Cloudflare Workers DecompressionStream implementation, which
// throws "Trailing bytes after end of compressed data" once it receives
// bytes past the real stream end — caught during live /run testing, not
// caught by the (much more lenient) local Node testing beforehand. Since
// the compressed file is small (~3.6MB for the real FULINS_C file), the
// robust fix is to buffer it whole and read the *real* Central Directory to
// get the exact compressed length, then feed the decompressor precisely
// that slice — no trailing bytes fed in at all, so the discrepancy between
// runtimes stops mattering.

function readEocd(buf, dv) {
  const EOCD_SIG = 0x06054b50;
  // EOCD is the last 22 bytes plus up to a 65535-byte comment field.
  const searchStart = Math.max(0, buf.length - 22 - 65557);
  for (let i = buf.length - 22; i >= searchStart; i--) {
    if (dv.getUint32(i, true) === EOCD_SIG) return i;
  }
  throw new Error('Zip End Of Central Directory record not found');
}

// Returns { offset, length } of the compressed data for the zip's first
// entry, read via the real Central Directory (accurate even when the local
// header's size fields are zeroed out by streamed/data-descriptor mode).
function findCompressedEntry(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const eocdOffset = readEocd(buf, dv);
  const cdOffset = dv.getUint32(eocdOffset + 16, true);

  const CD_SIG = 0x02014b50;
  const cdSig = dv.getUint32(cdOffset, true);
  if (cdSig !== CD_SIG) throw new Error(`Bad central directory signature 0x${cdSig.toString(16)}`);

  const method = dv.getUint16(cdOffset + 10, true);
  if (method !== 8) throw new Error(`Unsupported zip compression method ${method} (expected 8=deflate)`);

  const compSize = dv.getUint32(cdOffset + 20, true);
  const localHeaderOffset = dv.getUint32(cdOffset + 42, true);

  const LOCAL_HEADER_SIG = 0x04034b50;
  const lhSig = dv.getUint32(localHeaderOffset, true);
  if (lhSig !== LOCAL_HEADER_SIG) throw new Error(`Bad local file header signature 0x${lhSig.toString(16)}`);
  const lhNameLen = dv.getUint16(localHeaderOffset + 26, true);
  const lhExtraLen = dv.getUint16(localHeaderOffset + 28, true);
  const dataStart = localHeaderOffset + 30 + lhNameLen + lhExtraLen;

  return { offset: dataStart, length: compSize };
}

// Given the zip's full bytes (ArrayBuffer or Uint8Array — small enough to
// buffer whole, ~3.6MB for the real FULINS_C file), returns a
// ReadableStream<string> of decompressed FIRDS XML text chunks.
export function decompressFirdsZip(zipBytes) {
  const buf = zipBytes instanceof Uint8Array ? zipBytes : new Uint8Array(zipBytes);
  const { offset, length } = findCompressedEntry(buf);
  const compressedSlice = buf.subarray(offset, offset + length);

  const compressedStream = new ReadableStream({
    start(controller) {
      controller.enqueue(compressedSlice);
      controller.close();
    }
  });
  const decompressed = compressedStream.pipeThrough(new DecompressionStream('deflate-raw'));
  return decompressed.pipeThrough(new TextDecoderStream());
}

// ── Streaming record scanner ────────────────────────────────────────────
//
// Walks decompressed XML text chunk-by-chunk, splitting on <RefData> record
// boundaries without ever materializing the whole ~87MB string. Records with
// ordinal index < startIndex are skip-scanned (boundary detection only, no
// field extraction — cheap). The next `limit` records are field-extracted
// and returned, deduped by ISIN (first-seen-in-file wins — matches
// firds_instrument_reference's INSERT OR IGNORE semantics and the spec's
// "first/primary venue only in v1" note for trading_venue_mic). Stops
// consuming the stream as soon as the chunk is filled, so a resume deep in
// the file doesn't pay to decompress records past what this invocation
// needs — it still pays to decompress (and skip-scan) everything *before*
// its resume point, which is why later invocations cost more than earlier
// ones. That's an inherent cost of not persisting decompressed state
// between invocations, not a bug — flagged in the Build Brief's outputs.

const REF_DATA_OPEN = '<RefData>';
const REF_DATA_CLOSE = '</RefData>';

function extractField(chunk, tag) {
  const m = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(chunk);
  return m ? m[1] : null;
}

function extractPublicationDate(text) {
  const m = /<RptgPrd><Dt>([^<]+)<\/Dt>/.exec(text);
  return m ? m[1] : null;
}

function parseRecord(recordXml) {
  const genAttrsMatch = /<FinInstrmGnlAttrbts>([\s\S]*?)<\/FinInstrmGnlAttrbts>/.exec(recordXml);
  const genAttrs = genAttrsMatch ? genAttrsMatch[1] : '';
  const isin = extractField(genAttrs, 'Id');
  if (!isin) return null;

  const cfi = extractField(genAttrs, 'ClssfctnTp');
  const fullName = extractField(genAttrs, 'FullNm');
  const shortName = extractField(genAttrs, 'ShrtNm');
  const currency = extractField(genAttrs, 'NtnlCcy');
  const lei = extractField(recordXml, 'Issr');

  const tradgMatch = /<TradgVnRltdAttrbts>([\s\S]*?)<\/TradgVnRltdAttrbts>/.exec(recordXml);
  const tradgAttrs = tradgMatch ? tradgMatch[1] : '';
  const mic = extractField(tradgAttrs, 'Id');
  const firstTradeDateRaw = extractField(tradgAttrs, 'FrstTradDt');
  const firstTradeDate = firstTradeDateRaw ? firstTradeDateRaw.slice(0, 10) : null;

  return { isin, lei, cfi, fullName, shortName, currency, mic, firstTradeDate };
}

// maxWallMs is a defensive safety net, NOT a CPU-time proxy — fetch/stream
// I/O wait counts against wall time but not against Workers' actual CPU-time
// limit, so this alone doesn't guarantee staying under the platform's real
// cap. The real tuning knob is `limit` (records/invocation), to be
// calibrated against observed behavior during live /run testing.
export async function scanFirdsChunk(textStream, { startIndex, limit, maxWallMs = 8000 }) {
  const reader = textStream.getReader();
  let buffer = '';
  let recordIndex = 0;
  let publicationDate = null;
  const seenIsins = new Set();
  const records = [];
  const startedAt = Date.now();
  let done = false;

  try {
    while (true) {
      if (records.length >= limit) break;
      if (Date.now() - startedAt > maxWallMs) break;

      const { done: streamDone, value } = await reader.read();
      if (streamDone) { done = true; break; }
      buffer += value;

      if (publicationDate === null) {
        publicationDate = extractPublicationDate(buffer);
      }

      let searchFrom = 0;
      while (true) {
        const openIdx = buffer.indexOf(REF_DATA_OPEN, searchFrom);
        if (openIdx === -1) break;
        const closeIdx = buffer.indexOf(REF_DATA_CLOSE, openIdx);
        if (closeIdx === -1) break; // record not fully buffered yet

        const thisIndex = recordIndex;
        recordIndex++;
        const recordEnd = closeIdx + REF_DATA_CLOSE.length;

        if (thisIndex >= startIndex) {
          const recordXml = buffer.slice(openIdx, recordEnd);
          const parsed = parseRecord(recordXml);
          if (parsed && !seenIsins.has(parsed.isin)) {
            seenIsins.add(parsed.isin);
            records.push(parsed);
          }
          if (records.length >= limit) {
            searchFrom = recordEnd;
            break;
          }
        }
        searchFrom = recordEnd;
      }

      buffer = buffer.slice(searchFrom);
    }
  } finally {
    try { await reader.cancel(); } catch { /* stream may already be closed */ }
  }

  return {
    records,
    // recordIndex counts every boundary seen (skipped or extracted), so
    // it's already the correct resume point for the next invocation.
    nextIndex: recordIndex,
    done,
    publicationDate
  };
}
