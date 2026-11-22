// MA-NOV-BOND.OFFER2 — offline offering dry run over the whole cached corpus. Reads state/ only; writes only --out. 0 SEC requests, 0 D1.
//
//   node offer-dryrun.mjs --out=<file.json> --ingested-at=<ISO time>
//
// Corpus (spec v2 §2): the final filings (status `debt`) of the 15 Oct snapshot (state/dryrun-2026-10-15.json), each from state/cache,
// re-parsed with the parser at HEAD (bonds-1.3.1, the reliability release that BOND.APPLY1 writes) and paired with its same-deal term
// sheets as the runner does (sameDealFwps, the discovery FWP list in state/discovery-dev.json; a term sheet not in the cache counts as
// unavailable). A filing that is no longer debt at 1.3.1 gets no offering facts. The output is the input of offer-build.mjs.
// Not in this corpus: the 5 Wells Fargo callable notes of the 16 Oct live run (final in D1). Their pricing-supplement layout was not
// measured by the spec, so they get no offering rows ("Not read yet") until a packet reads that layout (OFFER2 report §7).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFiling, PARSER_VERSION } from '../bonds-parse.mjs';
import { sameDealFwps } from '../bonds-ingest.mjs';
import { extractOffering, OFFERING_VERSION } from '../bonds-offering.mjs';

const arg = Object.fromEntries(process.argv.slice(2).map(s => s.match(/^--([a-z0-9-]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2]]));
for (const k of ['out', 'ingested-at']) if (!arg[k]) throw new Error(`--${k}= is required`);
const S = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'state');
const sha = s => createHash('sha256').update(s).digest('hex');
const cp = u => path.join(S, 'cache', sha(u).slice(0, 32) + '.gz');
const load = u => (existsSync(cp(u)) ? gunzipSync(readFileSync(cp(u))).toString('utf8') : null);
const snapFile = path.join(S, 'dryrun-2026-10-15.json'), discFile = path.join(S, 'discovery-dev.json');
const snap = JSON.parse(readFileSync(snapFile, 'utf8'));
const disc = JSON.parse(readFileSync(discFile, 'utf8'));
const meta = new Map(), fwpList = [];
for (const i of disc) { for (const f of i.filings) meta.set(f.accessionNumber, f); for (const f of i.fwpList || []) fwpList.push(f); }
const AT = arg['ingested-at'];
const out = { generated: new Date().toISOString(), ingested_at: AT, parser_version: PARSER_VERSION, offering_version: OFFERING_VERSION,
  inputs: { snapshot: { file: 'state/dryrun-2026-10-15.json', sha256: sha(readFileSync(snapFile)) }, discovery: { file: 'state/discovery-dev.json', sha256: sha(readFileSync(discFile)) } },
  filings: [] };
for (const s of snap.filings.filter(f => f.status === 'debt')) {
  const m = meta.get(s.accession) || {};
  const filing = { accessionNumber: s.accession, form: s.form, filingDate: s.filing_date, cik: s.row_cik || s.cik, url: s.url, fileNumber: s.file_number || m.fileNumber };
  const html = load(s.url);
  if (!html) { out.filings.push({ accession: s.accession, missing: true }); continue; }
  const pair = sameDealFwps(filing, fwpList.filter(x => x.cik === s.cik || !x.cik));
  const fwps = pair.map(x => ({ accessionNumber: x.accessionNumber, url: x.url, html: load(x.url) })).filter(x => x.html);
  const parsed = parseFiling(filing, html, { fwps, ingestedAt: AT });
  if (parsed.status !== 'debt') { out.filings.push({ accession: s.accession, cik: s.cik, issuer: s.issuer, status: parsed.status, reason: parsed.reason }); continue; }
  const r = extractOffering({ filing, html, parsed, fwps, fwpsUnavailable: pair.length - fwps.length, ingestedAt: AT });
  out.filings.push({ accession: s.accession, cik: s.cik, issuer: s.issuer, form: s.form, filing_date: s.filing_date, url: s.url, status: 'debt', family: r.family,
    tranches: r.stats.tranches, fwps: fwps.map(f => f.accessionNumber), fwpsUnavailable: pair.length - fwps.length,
    rows: parsed.rows.filter(x => x.filing_status === 'final' && x.tranche_seq > 0).map(x => ({ tranche_seq: x.tranche_seq, maturity_date: x.maturity_date, principal_amount: x.principal_amount,
      currency: x.currency, rate_type: x.rate_type, coupon_rate: x.coupon_rate, spread_bps: x.spread_bps, cusip: x.cusip, isin: x.isin, tranche_label: x.tranche_label })),
    facts: r.facts, parties: r.parties, checks: r.checks, notes: r.notes });
}
writeFileSync(arg.out, JSON.stringify(out));
const d = out.filings.filter(f => f.status === 'debt');
console.log(JSON.stringify({ debt: d.length, missing: out.filings.filter(f => f.missing).length, not_debt: out.filings.filter(f => f.status && f.status !== 'debt').length,
  tranches: d.reduce((a, f) => a + f.tranches, 0), facts: d.reduce((a, f) => a + f.facts.length, 0), parties: d.reduce((a, f) => a + f.parties.length, 0) }));
