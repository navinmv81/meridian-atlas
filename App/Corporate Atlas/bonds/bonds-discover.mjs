// bonds-discover.mjs — MA-OCT-008 discovery (spec rev 1.2 §7.1). Pure over an
// injected SEC client: no D1, no file writes except through the client's cache.

import { archiveUrl, submissionsUrl } from './bonds-lib.mjs';

const COLS = ['accessionNumber', 'filingDate', 'form', 'fileNumber', 'primaryDocument', 'primaryDocDescription'];

// Column-oriented SEC block → rows.
export function rowsOf(block) {
  const n = block?.accessionNumber?.length || 0;
  const out = [];
  for (let i = 0; i < n; i++) out.push(Object.fromEntries(COLS.map(c => [c, block[c]?.[i] ?? null])));
  return out;
}

// Selects the filings to examine for one issuer from its submissions rows.
//   lookback  'YYYY-MM-DD' (initial: cfg.lookback)
//   cap       { form, n } (L8-1: Wells Fargo, the n most recent of that form) or undefined
// Returns { filings (424B, newest first), fwps (FWP, any date ≥ lookback − window) }.
export function selectFilings(rows, { forms, lookback, cap, fwpWindowDays = 3 }) {
  const f424 = rows.filter(r => forms.includes(r.form) && r.form !== 'FWP' && r.filingDate >= lookback);
  let filings = f424.sort((a, b) => (b.filingDate.localeCompare(a.filingDate) || b.accessionNumber.localeCompare(a.accessionNumber)));
  if (cap) filings = filings.filter(r => r.form === cap.form).slice(0, cap.n);
  const oldest = filings.length ? filings[filings.length - 1].filingDate : lookback;
  const fwpFrom = new Date(Date.parse(oldest + 'T00:00:00Z') - fwpWindowDays * 86400000).toISOString().slice(0, 10);
  const fwps = forms.includes('FWP') ? rows.filter(r => r.form === 'FWP' && r.filingDate >= fwpFrom) : [];
  return { filings, fwps };
}

// Fetches submissions (+ files[] pages when `recent` does not reach the lookback
// and the issuer is not capped) and returns the selected filings.
export async function discoverIssuer(sec, issuer, { forms, lookback, fwpWindowDays }) {
  const r = await sec.get(submissionsUrl(issuer.cik), { kind: 'submissions' });
  if (r.status !== 200) return { ok: false, error: r.error || `HTTP ${r.status}`, pages: 1 };
  const j = JSON.parse(r.text);
  let rows = rowsOf(j.filings?.recent);
  let pages = 1;
  const oldestRecent = rows.length ? rows[rows.length - 1].filingDate : '9999-12-31';
  if (!issuer.cap_recent && oldestRecent > lookback) {
    for (const f of j.filings?.files || []) {
      if (f.filingTo && f.filingTo < lookback) continue;
      const p = await sec.get(`https://data.sec.gov/submissions/${f.name}`, { kind: 'submissions' });
      pages++;
      if (p.status !== 200) return { ok: false, error: `files page ${f.name}: ${p.error || p.status}`, pages };
      rows = rows.concat(rowsOf(JSON.parse(p.text)));
    }
  }
  const sel = selectFilings(rows, { forms, lookback, cap: issuer.cap_recent, fwpWindowDays });
  const withUrl = x => ({ ...x, cik: issuer.cik, url: archiveUrl(issuer.cik, x.accessionNumber, x.primaryDocument) });
  return { ok: true, secName: j.name, pages, oldestRecent, filings: sel.filings.map(withUrl), fwps: sel.fwps.map(withUrl) };
}
