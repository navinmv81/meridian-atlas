#!/usr/bin/env node
// MA-OCT-008 R-3 (DIL14 RB-2) — filer-list re-scan. For every final filing, read the filing's own EDGAR
// index (filer list) and report any filing whose cover names another filer as the issuer while its rows are
// stored under a different CIK (a co-registrant left under its parent, like P-1 PepsiCo Singapore).
//
// Report only: no D1 access, no fix. Input is a JSON list of { accession_number, cik } (the final filings,
// read by the operator); output is a JSON report. SEC: the runner's secClient (SEC_USER_AGENT, ≥ 200 ms
// between requests, own cap, request ledger), index pages only.
//   SEC_USER_AGENT="<name> <e-mail>" node bonds-filer-scan.mjs --filings=<in.json> --links=<links.json> --out=<report.json>
//        [--docs-cache=<bonds/state/cache>] [--max=400]

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { secClient, ensureDir } from './bonds-lib.mjs';
import { parseFilingIndex, indexUrl } from './bonds-ingest.mjs';
import { htmlToText, normName } from './bonds-parse.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COVER_CHARS = 4000;

// A filer other than the storing CIK is a co-registrant candidate when its name is on the cover and the
// storing CIK's own name is not stated there as the issuer. Every candidate is listed for a human ruling.
export function classify({ accession, storedCik, filers, coverText, links }) {
  const others = filers.filter(f => f.cik !== storedCik);
  if (!others.length) return { accession, storedCik, filers: filers.length, verdict: 'single_filer' };
  const cover = normName(coverText);
  const onCover = others.filter(f => cover.includes(normName(f.name)));
  const own = links[storedCik];
  const ownIsCoReg = !!own && /^co-registrant \(L8-12\)/.test(own.note || '');
  if (!onCover.length) return { accession, storedCik, filers: filers.length, verdict: 'other_filers_not_on_cover', others };
  if (ownIsCoReg) return { accession, storedCik, filers: filers.length, verdict: 'stored_under_coregistrant', others: onCover };
  return { accession, storedCik, filers: filers.length, verdict: 'CANDIDATE', others: onCover };
}

async function main(args) {
  const filings = JSON.parse(readFileSync(args.filings, 'utf8'));
  const links = Object.fromEntries(JSON.parse(readFileSync(args.links, 'utf8')).map(l => [l.cik, l]));
  const state = path.join(HERE, 'state'); ensureDir(state);
  const sec = secClient({ userAgent: process.env.SEC_USER_AGENT, minIntervalMs: 200, maxRequests: Number(args.max || 400),
    ledgerFile: path.join(state, 'r3-sec-requests.jsonl'), cacheDir: path.join(state, 'cache-r3') });
  const docs = args['docs-cache'] || path.join(state, 'cache');
  const doc = url => { const p = path.join(docs, createHash('sha256').update(url).digest('hex').slice(0, 32) + '.gz');
    return existsSync(p) ? htmlToText(gunzipSync(readFileSync(p)).toString('utf8')).slice(0, COVER_CHARS) : null; };
  const out = [];
  for (const f of filings) {
    const r = await sec.get(indexUrl(f.cik, f.accession_number));
    if (r.status !== 200 || !r.text) { out.push({ accession: f.accession_number, storedCik: f.cik, verdict: 'index_unavailable', status: r.status }); continue; }
    const filers = parseFilingIndex(r.text);
    const coverText = f.source_url ? doc(f.source_url) : null;
    if (filers.length > 1 && coverText === null) { out.push({ accession: f.accession_number, storedCik: f.cik, verdict: 'cover_not_cached', filers }); continue; }
    out.push(classify({ accession: f.accession_number, storedCik: f.cik, filers, coverText: coverText || '', links }));
  }
  const counts = out.reduce((a, x) => ((a[x.verdict] = (a[x.verdict] || 0) + 1), a), {});
  const report = { generated_at: new Date().toISOString(), filings: filings.length, sec_requests: sec.count, counts,
    candidates: out.filter(x => x.verdict === 'CANDIDATE'), multi_filer: out.filter(x => x.filers > 1), unavailable: out.filter(x => /unavailable|not_cached/.test(x.verdict)) };
  writeFileSync(args.out, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ filings: report.filings, sec_requests: report.sec_requests, counts }));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
  main(args).catch(e => { console.error(`bonds-filer-scan: ${e.message}`); process.exit(1); });
}
