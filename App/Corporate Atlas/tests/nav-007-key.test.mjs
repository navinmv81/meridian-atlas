// MA-OCT-007 Phase 1 — T1 (spec rev 1.4 §14.1): data_instrumentKey (App/ma-data.js)
// must equal deriveInstrumentKey (gate1-instrument-seed.js) on every fixture.
// Both functions are loaded from their real source files. Run: node tests/nav-007-key.test.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const seedSrc = readFileSync(path.join(HERE, '../gate1-instrument-seed.js'), 'utf8');
const m = seedSrc.match(/function deriveInstrumentKey\(row\) \{[\s\S]*?\n\}/);
if (!m) throw new Error('deriveInstrumentKey not found in gate1-instrument-seed.js');
const deriveInstrumentKey = vm.runInNewContext(`(${m[0]})`);

const ctx = { window: {}, fetch: () => { throw new Error('no network in T1'); }, AbortSignal, console };
vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(HERE, '../../ma-data.js'), 'utf8'), ctx);
const data_instrumentKey = ctx.window.data_instrumentKey;
if (typeof data_instrumentKey !== 'function') throw new Error('window.data_instrumentKey not exported');

// [isin, cusip, ticker, name]
const F = [
  ['US5949181045', '594918104', 'MSFT', 'MICROSOFT CORP'],         // 12-char ISIN wins
  [' US5949181045 ', null, null, 'Microsoft'],                    // padded ISIN is trimmed
  ['us5949181045', null, null, 'lower isin'],                     // ISIN not uppercased
  ['US594918104', '594918104', null, 'MSFT 11-char ISIN'],        // 11 chars → CUSIP
  ['US59491810451', '594918104', null, '13-char ISIN'],           // 13 chars → CUSIP
  ['', '594918104', 'MSFT', 'empty isin'],
  [null, '594918104', null, '9-char CUSIP'],
  [null, '59491810', null, '8-char CUSIP'],
  [null, '594918', null, '6-char CUSIP'],
  [null, '59491', 'MSFT', '5-char CUSIP → ticker'],
  [null, ' 594918AB0 ', null, 'padded CUSIP'],
  [null, '594918ab0', null, 'lower CUSIP not uppercased'],
  [null, '000000000', null, 'placeholder CUSIP (R7-2)'],
  [null, '000000', null, 'placeholder 6-zero CUSIP'],
  [null, null, 'msft', 'ticker uppercased'],
  [null, null, ' brk.b ', 'ticker trimmed + upper'],
  [null, null, '   ', 'blank ticker → name'],
  [null, '', '', 'Empty Strings Co'],
  [null, null, null, 'MICROSOFT CORP'],
  [null, null, null, '  Spaced   Out   Name  '],
  [null, null, null, 'Tab\tand\nnewline name'],
  [null, null, null, 'x'.repeat(120)],                            // > 80 chars sliced
  [null, null, null, 'A B '.repeat(30)],                          // long spaced name
  [null, null, null, 'N/A'],                                      // placeholder name
  [null, null, null, 'na'],
  [null, null, null, 'None'],
  [null, null, null, 'Société Générale S.A.'],                    // non-ASCII
  [null, null, null, 'ŞİRKET ışık'],                              // locale-sensitive upper
  [null, null, null, ''],                                         // empty name
  ['DE000A2H7N08', null, null, 'KI 22.17 ISIN'],
  ['XS1234567890', 'ABC123', 'TICK', 'all present'],
  [null, 'CUSIP12345', null, '10-char cusip'],
  [null, null, 'TICKER:ODD', 'ticker with colon'],
];

let pass = 0, fail = 0;
for (const [isin, cusip, ticker, name] of F) {
  const seed = deriveInstrumentKey({ isin, cusip, security_ticker: ticker, security_name: name });
  const port = data_instrumentKey({ isin, cusip, ticker, name });
  if (seed === port) pass++;
  else { fail++; console.log('FAIL', JSON.stringify({ isin, cusip, ticker, name }), JSON.stringify(seed), '!=', JSON.stringify(port)); }
}
// The port returns null where the seed would throw (no identifier and no name).
let seedThrows = false;
try { deriveInstrumentKey({ isin: null, cusip: null, security_ticker: null, security_name: null }); } catch { seedThrows = true; }
if (seedThrows && data_instrumentKey({}) === null) pass++; else { fail++; console.log('FAIL null-name case'); }

console.log(`nav-007-key (T1): ${pass}/${pass + fail} passed (${F.length} fixtures + null case)`);
process.exit(fail ? 1 : 0);
