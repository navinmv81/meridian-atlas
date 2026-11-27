// MA-NOV-PATCH.REL — checks for the ETF NO_NPORT set, the generate-docs dry-run target, and the release stamp.
import { readFileSync, existsSync, readdirSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const ROOT = new URL('../../../', import.meta.url);
let pass = 0, fail = 0;
const check = (name, ok, info) => { if (ok) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, info ?? ''); } };

// 1. NO_NPORT: SPY, QQQ, DIA removed; everything else unchanged.
const etf = readFileSync(new URL('App/ma-etf.js', ROOT), 'utf8');
const m = etf.match(/const NO_NPORT = new Set\(\[([\s\S]*?)\]\);/);
const set = m ? [...m[1].matchAll(/"([A-Z]+)"/g)].map(x => x[1]) : [];
check('NO_NPORT set found', !!m);
check('NO_NPORT no longer holds SPY, QQQ, DIA', !['SPY', 'QQQ', 'DIA'].some(t => set.includes(t)), set);
const EXPECT = ['GLD','SLV','IAU','SGOL','PHYS','PSLV','USO','UNG','DBO','PDBC','IBIT','FBTC','BITB','EZBC','ETHA','FETH','GDX','GDXJ','OIH','MSOS'];
check('NO_NPORT keeps the other 20 tickers exactly', set.join() === EXPECT.join(), set);

// 3. generate-docs --dry-run writes under os.tmpdir(), not into the repo.
const before = existsSync(new URL('.docs-dry-run/', ROOT)) ? readdirSync(new URL('.docs-dry-run/', ROOT)).length : null;
const out = execFileSync(process.execPath, [fileURLToPath(new URL('generate-docs.mjs', ROOT)), '--dry-run'], { encoding: 'utf8' });
const dir = (out.match(/Dry-run output is at (\S+)/) || [])[1];
check('dry-run prints its output path', !!dir, out);
check('dry-run path is under os.tmpdir()', !!dir && dir.startsWith(tmpdir()), dir);
check('dry-run path holds the 11 files', !!dir && existsSync(dir) && readdirSync(dir).length === 11, dir && existsSync(dir) ? readdirSync(dir) : null);
const after = existsSync(new URL('.docs-dry-run/', ROOT)) ? readdirSync(new URL('.docs-dry-run/', ROOT)).length : null;
check('dry-run did not write into the repo .docs-dry-run/', before === after);
if (dir && dir.startsWith(tmpdir())) rmSync(dir, { recursive: true, force: true });

// 4. Stamps.
const html = readFileSync(new URL('App/index.html', ROOT), 'utf8');
const stamps = [...html.matchAll(/<script src="(?!https?:)[^"]+\?v=([^"]+)"/g)].map(x => x[1]);
check('all 9 local script tags carry ?v=rel-20261127', stamps.length === 9 && stamps.every(s => s === 'rel-20261127'), stamps);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
