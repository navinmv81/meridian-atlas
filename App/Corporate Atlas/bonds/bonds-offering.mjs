// bonds-offering.mjs — MA-NOV-BOND.OFFER1: offering facts part 1 (spec MA-NOV-BOND v2 §3 fields 1–13, §4 parties,
// §5 source references, §6.1 automatic checks, BOND-08 levels, BOND-09 states). Pure: no I/O, no network, no D1.
//
//   extractOffering({ filing, html, parsed, fwps, fwpsUnavailable, ingestedAt }) → { family, facts, parties, checks, notes, stats }
//   (fwpsUnavailable: same-deal term sheets known to exist but not supplied; a missing identifier is then "not read yet")
//
// Input: one final 424B (its filing metadata + HTML), the parser's parseFiling() result for it, and the same-deal term
// sheets (FWPs: { accessionNumber, url, html }). Output rows are shaped exactly as the BOND-CR2 tables
// (migrations/ma-nov-bond-cr2.sql): bond_offering_fact and bond_offering_party. Nothing here writes anything.
//
// Rules (spec v2):
//   • Only short extracted values are stored: dates, numbers, codes, names, a ≤ 300-character JSON for "interest paid".
//     No sentence of the filing is stored (§8). The source location (part, heading, anchor, page, char offset) says
//     where the value is printed (§5).
//   • States (BOND-09): 'disclosed' (value found) · 'not_disclosed' ("Not stated in the filing") · 'not_applicable'.
//     No row = "Not read yet". Nothing is inferred: a value that cannot be read is no row, never a guess.
//   • Levels (BOND-08): tranche_seq 0 = whole offering; 1..n = the parser's (= bond_issuance's) tranche.
//   • §6.1 checks run on every fact; a failing fact is not returned and the failure is listed in `checks`.
//   • Field 1 (issuer) is the existing bond_issuer_link: no row here. Fields 5–8 (amount, currency, interest rate,
//     maturity) repeat the bond_issuance values with their printed source location, so BOND-10 can link them.
//   • Fields 14–28 are OFFER2. The bank fee and proceeds % are read here only to check the price (§6.1), not returned.

import { htmlToText, toIsoDate, findIdentifiers, cusipValid, isinValid, couponRe } from './bonds-parse.mjs';

export const OFFERING_VERSION = 'bonds-offering-1.0.0';

export const FACT_COLS = ['accession_number', 'tranche_seq', 'field', 'state', 'value_text', 'value_num', 'value_date', 'source_doc',
  'source_url', 'source_part', 'source_heading', 'source_anchor', 'source_page', 'char_offset', 'parser_version', 'ingested_at'];
export const PARTY_COLS = ['accession_number', 'party_seq', 'tranche_seq', 'party_name', 'role', 'role_printed', 'source_doc',
  'source_url', 'source_part', 'source_page', 'parser_version', 'ingested_at'];

// Field closed list for OFFER1 (spec v2 §3 #2–13; #2 is the guarantor party). O = offering level, T = per tranche.
export const FIELDS = Object.freeze({
  document_date: 'O', identifier: 'T', amount: 'T', currency: 'T', interest_rate: 'T', maturity: 'T',
  issue_price_pct: 'T', interest_paid: 'T', day_count: 'T', priced_on: 'O', issue_date: 'O'
});
export const ROLES = Object.freeze(['bookrunner', 'co_manager', 'underwriter', 'agent', 'trustee', 'guarantor', 'other']);
export const INTERMEDIARY = new Set(['bookrunner', 'co_manager', 'underwriter', 'agent']);
export const SOURCE_PARTS = Object.freeze(['cover', 'cover table', 'summary', 'description of the notes', 'optional redemption',
  'use of proceeds', 'underwriting', 'pricing terms', 'retail table', 'term sheet']);
export const STATES = Object.freeze(['disclosed', 'not_disclosed', 'not_applicable']);
export const VALUE_TEXT_MAX = 300;

// ── Dates ────────────────────────────────────────────────────────────────

const MONTH_RE = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';
const MON3 = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const DATE = `${MONTH_RE}\\s+\\d{1,2}\\s*,\\s*\\d{4}`;
const WEEKDAY = '(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\\s+)?';
const isoOf = s => toIsoDate(String(s).replace(/\s+/g, ' '));
const monthNum = s => MON3[String(s).slice(0, 3).toLowerCase()];
const pad = n => String(n).padStart(2, '0');
function bizDaysBetween(a, b) {               // weekdays after a, up to and including b (a ≤ b)
  let n = 0;
  const d = new Date(a + 'T00:00:00Z'), end = new Date(b + 'T00:00:00Z');
  while (d < end) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}

// ── Decoded text with section anchors (BOND-10) ──────────────────────────
// The filing's own table-of-contents links (href="#x") name the sections; their targets are marked in the HTML before
// decoding, so each target gets a position in exactly the text htmlToText() gives (checked; on any mismatch no anchors).

const S0 = '\uE000', S1 = '\uE001';
// htmlToText() turns named accent entities it does not know ("&eacute;") into a space, which garbles bank names
// ("Soci t G n rale"). They are rewritten as the numeric references it does decode. The offsets of this module are in
// this text (identical to htmlToText() wherever a filing has no such entity).
const ACCENT = { eacute: 233, Eacute: 201, egrave: 232, Egrave: 200, ecirc: 234, euml: 235, aacute: 225, Aacute: 193, agrave: 224, acirc: 226,
  auml: 228, Auml: 196, aring: 229, atilde: 227, iacute: 237, igrave: 236, icirc: 238, iuml: 239, oacute: 243, Oacute: 211, ograve: 242, ocirc: 244,
  ouml: 246, Ouml: 214, otilde: 245, oslash: 248, uacute: 250, ugrave: 249, ucirc: 251, uuml: 252, Uuml: 220, ccedil: 231, Ccedil: 199, ntilde: 241, szlig: 223 };
const accents = html => String(html).replace(/&([A-Za-z]+);/g, (m, n) => (ACCENT[n] ? `&#${ACCENT[n]};` : m));
export const decodedText = html => htmlToText(accents(html));
export function decode(rawHtml) {
  const html = accents(rawHtml);
  const text = htmlToText(html);
  const links = new Map();
  for (const m of String(html).matchAll(/<a\b[^>]*?\bhref\s*=\s*["']#([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi)) {
    const label = htmlToText(m[2]).replace(/\s+/g, ' ').trim();
    if (!label || /^(?:P?S-\s?[\divx]+|[\divx]+|Page|Table of Contents)$/i.test(label)) { if (!links.has(m[1])) links.set(m[1], null); continue; }
    if (!links.get(m[1])) links.set(m[1], label.slice(0, 80));
  }
  const names = [];
  let marked = String(html);
  if (links.size) {
    marked = marked.replace(/<([a-z][a-z0-9]*)\b[^>]*?\b(?:name|id)\s*=\s*["']([^"']+)["'][^>]*>/gi, (m, tag, n) => {
      if (!links.has(n)) return m;
      names.push(n);
      return `${m}${S0}${names.length - 1}${S1}`;
    });
  }
  const anchors = [];
  if (names.length) {
    const t2 = htmlToText(marked);
    let out = '';
    for (let i = 0; i < t2.length; i++) {
      if (t2[i] !== S0) { out += t2[i]; continue; }
      const j = t2.indexOf(S1, i);
      const idx = Number(t2.slice(i + 1, j));
      i = j;
      if (out.endsWith(' ') && t2[i + 1] === ' ') i++;            // the marker sat between two spaces
      else if (!out.length && t2[i + 1] === ' ') i++;
      anchors.push({ name: names[idx], heading: links.get(names[idx]) || null, at: out.length });
    }
    if (out.trimEnd() !== text) anchors.length = 0;                // positions must be in htmlToText's own text
  }
  return { text, anchors: anchors.filter(a => a.heading).sort((a, b) => a.at - b.at) };
}

// Printed page markers "S-12" / "PS-3": a run that counts up in order, one per page (≥ 400 characters apart).
// Cross-references ("on page S-5") and table-of-contents entries do not form such a run.
export function pageMarkers(text) {
  const cand = [];
  for (const m of text.matchAll(/(?<![\w-])(P?S)-\s?(\d{1,3}|[ivx]{1,6})(?![\w-])/g)) {
    if (/\b(?:pages?|see|Form|on\s+page)\s*$/i.test(text.slice(Math.max(0, m.index - 14), m.index))) continue;
    const roman = /^[ivx]+$/.test(m[2]);
    cand.push({ at: m.index, end: m.index + m[0].length, label: `${m[1]}-${m[2]}`, prefix: m[1], n: roman ? romanVal(m[2]) : Number(m[2]), roman });
  }
  const chain = list => {
    const best = list.map(() => ({ len: 1, prev: -1 }));
    for (let i = 0; i < list.length; i++)
      for (let j = 0; j < i; j++)
        if (list[j].prefix === list[i].prefix && list[i].n > list[j].n && list[i].n - list[j].n <= 3 && list[i].at - list[j].at >= 400 * (list[i].n - list[j].n) && best[j].len + 1 > best[i].len) best[i] = { len: best[j].len + 1, prev: j };
    let k = -1;
    for (let i = 0; i < list.length; i++) if (k < 0 || best[i].len > best[k].len) k = i;
    const out = [];
    while (k >= 0) { out.unshift(list[k]); k = best[k].prev; }
    return out;
  };
  const arabic = chain(cand.filter(c => !c.roman));
  const roman = chain(cand.filter(c => c.roman));
  const ok = arabic.length >= 3 && arabic[0].n <= 3;
  return ok ? [...(roman.length >= 2 ? roman : []), ...arabic].sort((a, b) => a.at - b.at) : [];
}
function romanVal(s) { const v = { i: 1, v: 5, x: 10 }; let n = 0; for (let i = 0; i < s.length; i++) { const a = v[s[i]], b = v[s[i + 1]] || 0; n += a < b ? -a : a; } return n; }

// ── Banks: a lexicon of the names printed in bank lists ──────────────────
// Cover blocks print names with no separator ("BofA Securities Barclays Citigroup J.P. Morgan"), in mixed case, all
// capitals or with accents ("Société Générale Corporate & Investment Banking"). A name is read by the longest lexicon
// entry at that place, then any legal-form suffix printed after it. The lexicon only splits a list; the printed form is
// kept (spec v2 §4.2 rule 5). `key` says which entries are one bank, so the underwriting table adds only banks that are
// not already on the cover.

const BANKS = [
  ['bofa', 'BofA Securities', 'BofA Merrill Lynch', 'Merrill Lynch, Pierce, Fenner & Smith', 'Merrill Lynch', 'Banc of America Securities'],
  ['barclays', 'Barclays Capital', 'Barclays Bank', 'Barclays'],
  ['citi', 'Citigroup Global Markets', 'Citigroup', 'Citi'],
  ['jpm', 'J.P. Morgan Securities', 'J. P. Morgan Securities', 'J.P. Morgan', 'J. P. Morgan', 'JP Morgan'],
  ['ms', 'Morgan Stanley & Co.', 'Morgan Stanley'],
  ['gs', 'Goldman Sachs & Co.', 'Goldman, Sachs & Co.', 'Goldman Sachs'],
  ['wells', 'Wells Fargo Securities', 'Wells Fargo Advisors', 'Wells Fargo Clearing Services'],
  ['mufg', 'MUFG Securities Americas', 'MUFG Securities EMEA', 'MUFG'],
  ['mizuho', 'Mizuho Securities USA', 'Mizuho Securities', 'Mizuho International', 'Mizuho'],
  ['rbc', 'RBC Capital Markets', 'RBC Europe', 'RBC'],
  ['td', 'TD Securities (USA)', 'TD Securities', 'TD Global Finance'],
  ['scotia', 'Scotia Capital (USA)', 'Scotia Capital', 'Scotiabank'],
  ['bmo', 'BMO Capital Markets', 'BMO'],
  ['cibc', 'CIBC Capital Markets', 'CIBC World Markets', 'CIBC'],
  ['smbc', 'SMBC Nikko Securities America', 'SMBC Nikko Capital Markets', 'SMBC Nikko', 'SMBC'],
  ['hsbc', 'HSBC Securities (USA)', 'HSBC Bank plc', 'HSBC Continental Europe', 'HSBC'],
  ['bnp', 'BNP Paribas Securities', 'BNP PARIBAS', 'BNP Paribas'],
  ['socgen', 'Société Générale Corporate & Investment Banking', 'Societe Generale Corporate & Investment Banking', 'SOCIETE GENERALE',
    'Société Générale', 'Societe Generale', 'SG Americas Securities', 'SG CIB'],
  ['ca', 'Crédit Agricole Corporate and Investment Bank', 'Credit Agricole Corporate and Investment Bank', 'Crédit Agricole CIB', 'Credit Agricole CIB',
    'Credit Agricole Securities (USA)', 'Crédit Agricole Securities (USA)', 'Credit Agricole Securities', 'Crédit Agricole', 'Credit Agricole'],
  ['db', 'Deutsche Bank Securities', 'Deutsche Bank AG, London Branch', 'Deutsche Bank AG', 'Deutsche Bank'],
  ['natwest', 'NatWest Markets Securities', 'NatWest Markets', 'NatWest Capital Markets', 'NatWest'],
  ['lloyds', 'Lloyds Bank Corporate Markets', 'Lloyds Securities', 'Lloyds'],
  ['santander', 'Santander US Capital Markets', 'Santander Investment Securities', 'Banco Santander', 'Santander'],
  ['bbva', 'BBVA Securities', 'Banco Bilbao Vizcaya Argentaria', 'BBVA'],
  ['ing', 'ING Financial Markets', 'ING Bank', 'ING'],
  ['intesa', 'IMI — Intesa Sanpaolo', 'IMI – Intesa Sanpaolo', 'IMI - Intesa Sanpaolo', 'IMI-Intesa Sanpaolo', 'Intesa Sanpaolo', 'Banca IMI'],
  ['unicredit', 'UniCredit Capital Markets', 'UniCredit Bank', 'UniCredit'],
  ['commerz', 'Commerz Markets', 'Commerzbank', 'COMMERZBANK'],
  ['natixis', 'Natixis Securities Americas', 'Natixis'],
  ['rabo', 'Rabo Securities USA', 'Rabo Securities', 'Rabobank'],
  ['anz', 'ANZ Securities', 'ANZ'],
  ['westpac', 'Westpac Capital Markets', 'Westpac Banking Corporation', 'Westpac'],
  ['nab', 'National Australia Bank', 'NAB'],
  ['cba', 'Commonwealth Bank of Australia'],
  ['stanchart', 'Standard Chartered Bank', 'Standard Chartered'],
  ['icbc', 'ICBC Standard Bank', 'ICBC'],
  ['boc', 'Bank of China'],
  ['nomura', 'Nomura Securities International', 'Nomura'],
  ['daiwa', 'Daiwa Capital Markets America', 'Daiwa Capital Markets', 'Daiwa'],
  ['truist', 'Truist Securities', 'SunTrust Robinson Humphrey'],
  ['usb', 'U.S. Bancorp Investments', 'US Bancorp', 'U.S. Bancorp'],
  ['pnc', 'PNC Capital Markets', 'P NC Capital Markets'],
  ['keybanc', 'KeyBanc Capital Markets'],
  ['fifth', 'Fifth Third Securities'],
  ['regions', 'Regions Securities'],
  ['huntington', 'Huntington Capital Markets', 'Huntington Securities'],
  ['citizens', 'Citizens JMP Securities', 'Citizens Capital Markets', 'Citizens'],
  ['mt', 'M&T Securities'],
  ['bny', 'BNY Mellon Capital Markets', 'BNY Capital Markets'],
  ['capone', 'Capital One Securities'],
  ['comerica', 'Comerica Securities'],
  ['ubs', 'UBS Investment Bank', 'UBS Securities', 'UBS'],
  ['jefferies', 'Jefferies'],
  ['academy', 'Academy Securities'],
  ['blaylock', 'Blaylock Van', 'Blaylock Robert Van'],
  ['castleoak', 'CastleOak Securities'],
  ['drexel', 'Drexel Hamilton'],
  ['loop', 'Loop Capital Markets'],
  ['mischler', 'Mischler Financial Group'],
  ['ramirez', 'Samuel A. Ramirez & Company', 'Samuel A. Ramirez & Co.', 'Ramirez & Co.'],
  ['seelaus', 'R. Seelaus & Co.'],
  ['siebert', 'Siebert Williams Shank & Co.', 'Siebert Williams Shank', 'Siebert Cisneros Shank'],
  ['independence', 'Independence Point Securities'],
  ['bancroft', 'Bancroft Capital'],
  ['tigress', 'Tigress Financial Partners'],
  ['mfr', 'MFR Securities'],
  ['cabrera', 'Cabrera Capital Markets'],
  ['bradesco', 'Bradesco BBI'],
  ['allen', 'Allen & Company'],
  ['waubank', 'WauBank Securities'],
  ['amerivet', 'AmeriVet Securities'],
  ['clking', 'C.L. King & Associates'],
  ['penserra', 'Penserra Securities'],
  ['roberts', 'Roberts & Ryan'],
  ['stern', 'Stern Brothers & Co.', 'Stern Brothers'],
  ['telsey', 'Telsey Advisory Group'],
  ['guzman', 'Guzman & Company'],
  ['multibank', 'Multi-Bank Securities'],
  ['tribal', 'Tribal Capital Markets'],
  ['hilltop', 'HilltopSecurities', 'Hilltop Securities'],
  ['raymond', 'Raymond James & Associates', 'Raymond James'],
  ['stifel', 'Stifel, Nicolaus & Company', 'Stifel'],
  ['janney', 'Janney Montgomery Scott'],
  ['piper', 'Piper Sandler & Co.', 'Piper Sandler'],
  ['desjardins', 'Desjardins Securities', 'Desjardins Capital Markets', 'Desjardins'],
  ['nbc', 'National Bank of Canada Financial', 'National Bank Financial', 'National Bank of Canada'],
  ['danske', 'Danske Bank'],
  ['nordea', 'Nordea Bank', 'Nordea'],
  ['seb', 'Skandinaviska Enskilda Banken', 'SEB'],
  ['dnb', 'DNB Markets', 'DNB Bank'],
  ['abn', 'ABN AMRO Securities (USA)', 'ABN AMRO Securities', 'ABN AMRO'],
  ['caixa', 'CaixaBank'],
  ['kbc', 'KBC Bank', 'KBC'],
  ['erste', 'Erste Group'],
  ['lbbw', 'Landesbank Baden-Württemberg', 'LBBW'],
  ['dz', 'DZ Financial Markets', 'DZ BANK AG', 'DZ BANK'],
  ['helaba', 'Helaba'],
  ['mediobanca', 'Mediobanca'],
  ['akros', 'Banca Akros'],
  ['bpost', 'La Banque Postale'],
  ['macquarie', 'Macquarie Capital (USA)', 'Macquarie Capital'],
  ['inspereX', 'InspereX', 'Incapital'],
  ['tfss', 'Toyota Financial Services Securities USA Corporation'],
  ['greatpacific', 'Great Pacific Securities'],
  ['moelis', 'Moelis & Company', 'Moelis'],
  ['synovus', 'Synovus Securities'],
  ['hancock', 'Hancock Whitney Investment Services'],
  ['itau', 'Itau BBA USA Securities', 'Itau BBA', 'Itaú BBA'],
  ['wolfe', 'Wolfe Capital Markets and Advisory'],
  ['cavu', 'CAVU Securities'],
  ['fhn', 'FHN Financial Securities'],
  ['fnb', 'FNB America Securities'],
  ['americanveterans', 'American Veterans Group'],
  ['carnegie', 'DNB Carnegie'],
  ['imisec', 'IMI Securities'],
  ['sumitomo', 'Sumitomo Mitsui Banking Corporation'],
  ['bofi', 'Bank of America'],
  ['wfb_dealer', 'Wells Fargo Bank']
];
const LEGAL = /^,?\s*(?:(?:&\s*Co\.?,?\s*)?(?:L\.L\.C\.|LLC|Inc\.|INC\.|Incorporated|L\.P\.|LP|Ltd\.?|Limited|LIMITED|plc|PLC|Plc|Corp\.|CORP\.|Corporation|N\.A\.|N\.V\.|S\.A\.|SA|AG|GmbH|PBC|S\.p\.A\.)(?![\w])(?:,\s*(?:London|New York|Paris|Milan|Madrid) Branch)?)/;
const fold = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BANK_RE = BANKS.flatMap(([key, ...names]) => names.map(n => {
  const caps = /^[A-Z&]{2,5}$/.test(n);                                     // short acronyms must be printed in capitals
  const body = esc(fold(n)).replace(/\\\./g, '\\.?').replace(/ /g, '\\s?').replace(/\\s\?&\\s\?/g, '\\s?&\\s?').replace(/[–—-]/g, '[–—-]?');
  return { key, len: n.length, re: new RegExp(`(?<![\\w&])${body}(?![\\w])`, caps ? 'y' : 'iy') };
})).sort((a, b) => b.len - a.len);
// Badly decoded accents ("Soci t G n rale") and split letters seen in the corpus.
BANK_RE.unshift({ key: 'socgen', len: 99, re: /(?<![\w&])Soci[^\sa-z]{0,2}\s*t[^\sa-z]{0,2}\s*G[^\sa-z]{0,2}\s*n[^\sa-z]{0,2}\s*rale(?:\s*Corporate\s*&\s*Investment\s*Banking)?(?![\w])/iy },
  { key: 'ca', len: 98, re: /(?<![\w&])Cr[^\sa-z]{0,2}\s*dit\s+Agricole(?:\s+CIB|\s+Corporate and Investment Bank|\s+Securities(?:\s+\(USA\))?)?(?![\w])/iy },
  { key: 'nab', len: 97, re: /(?<![\w&])nabSecurities(?![\w])/y });

export function bankKey(name) {
  const f = fold(name).replace(/\s+/g, ' ').trim();
  for (const b of BANK_RE) { b.re.lastIndex = 0; const m = b.re.exec(f); if (m && m.index === 0) return b.key; }
  return null;
}

const LEGAL_WORDS = "Abp|L\\.L\\.C\\.|LLC|Inc\\.|INC\\.|Incorporated|L\\.P\\.|LP|Ltd\\.?|Limited|LIMITED|plc|PLC|Plc|Corp\\.|CORP\\.|Corporation|N\\.A\\.|N\\.V\\.|S\\.A\\.|SA|AG|GmbH|PBC|S\\.p\\.A\\.|B\\.V\\.";
const EXTEND = new RegExp(`^((?:,?\\s+(?:\\(?[A-Z][\\w.&'’()-]*\\)?|&|of|de|y)){0,5}?)(,?\\s*(?:&\\s*Co\\.?,?\\s*)?(?:${LEGAL_WORDS}))(?![\\w])(?:,\\s*(?:London|New York|Paris|Milan|Madrid|Singapore|Hong Kong) Branch)?`);
const lexAt = (s, i) => { for (const b of BANK_RE) { b.re.lastIndex = i; const m = b.re.exec(s); if (m) return { key: b.key, end: i + m[0].length }; } return null; };
const CONNECT = /^(?:and|of|de|du|la|y|&|the)$/;
const nameLike = n => !/^(?:Total|Totals|Name|Names|Underwriters?|Agents?|Principal Amount|Inc\.?|a division of)$/i.test(n) && n.length <= 80 && n.split(/\s+/).length <= 9 && n.split(/\s+/).every(w => /^[A-Z0-9&(“"]/.test(w) || CONNECT.test(w) || /^(?:LLC|Inc\.|plc|L\.P\.)/.test(w));

// Split one list segment into names. Returns [{ name, at, qualifier, key, known }]; `at` is relative to the segment.
// A lexicon hit is extended through the words that follow it up to a legal-form suffix ("Mizuho International plc",
// "RBC Dominion Securities Inc."), unless another bank's name starts in between. Unknown runs are split after legal-form
// suffixes; a run that does not look like a name (lower-case words, too long) is dropped and counted.
export function splitBankList(seg, stats = { dropped: [] }) {
  const s = fold(seg);                                                   // same length as seg for the Latin text we read
  const out = [];
  let unknown = null, i = 0;
  const flush = () => {
    if (!unknown) return;
    const raw = seg.slice(unknown.at, unknown.end).replace(/^[\s,;]+|[\s,;]+$/g, '');
    if (raw && /[A-Za-z]/.test(raw) && !/^(?:and|&)$/i.test(raw)) {
      const parts = raw.split(new RegExp(`(?<=(?:${LEGAL_WORDS}))\\s*,?\\s+(?=[A-Z])`));
      let off = seg.indexOf(raw, unknown.at);
      for (const p of parts) {
        const at = seg.indexOf(p, off); off = at + p.length;
        const n = p.trim().replace(/^and\s+/i, '');
        if (nameLike(n) && n.length > 2) out.push({ name: n, at, qualifier: null, key: null, known: false });
        else stats.dropped.push(n.slice(0, 80));
      }
    }
    unknown = null;
  };
  while (i < s.length) {
    const ch = s[i];
    if (/[\s,;]/.test(ch)) { i++; continue; }
    if (/^and\s/i.test(s.slice(i, i + 4)) && !unknown) { i += 4; continue; }
    if (ch === '(') {                                                       // "(for the 2036 notes)", "( All Notes )"
      const j = s.indexOf(')', i);
      if (j > i && j - i < 120 && !/^\((?:USA|Europe|Canada)\)/.test(s.slice(i, j + 1))) {
        const q = seg.slice(i + 1, j).replace(/\s+/g, ' ').trim();
        flush();
        if (out.length && !/^["“]/.test(q) && !/^\d+(?:\.\d+)?%$/.test(q)) out[out.length - 1].qualifier = q;
        i = j + 1; continue;
      }
    }
    const hit = lexAt(s, i);
    if (hit) {
      flush();
      let end = hit.end;
      const ext = s.slice(end).match(EXTEND);
      if (ext) {
        const words = ext[1];
        let blocked = false;
        for (const w of words.matchAll(/\S+/g)) if (lexAt(s, end + w.index)) { blocked = true; break; }
        if (!blocked) end += ext[0].length;
        else { const lm = s.slice(end).match(LEGAL); if (lm) end += lm[0].length; }
      } else { const lm = s.slice(end).match(LEGAL); if (lm) end += lm[0].length; }
      out.push({ name: seg.slice(i, end).replace(/\s+/g, ' ').trim(), at: i, qualifier: null, key: hit.key, known: true });
      i = end; continue;
    }
    const w = s.slice(i).match(/^\S+/)[0];
    if (!unknown) unknown = { at: i, end: i + w.length }; else unknown.end = i + w.length;
    i += w.length;
  }
  flush();
  return out;
}

// ── Trustees (closed list, spec v2 §4.4) ─────────────────────────────────

const TRUSTEES = [
  ['bnymtc', /The Bank of New York Mellon Trust Company,?\s*(?:N\.\s?A\.|National Association)/],
  ['bnym', /The Bank of New York Mellon(?!\s+Trust)/],
  ['usbtc', /U\.\s?S\.\s?Bank Trust Company,?\s*(?:National Association|N\.A\.)/],
  ['usbtna', /U\.\s?S\.\s?Bank Trust National Association/],
  ['usbna', /U\.\s?S\.\s?Bank National Association/],
  ['cts', /Computershare Trust Company,?\s*(?:N\.\s?A\.|National Association)/],
  ['dbtca', /Deutsche Bank Trust Company Americas/],
  ['wfb', /Wells Fargo Bank,?\s*(?:N\.\s?A\.|National Association)/],
  ['citibank', /Citibank,?\s*N\.\s?A\./],
  ['regions', /Regions Bank/],
  ['truist', /Truist Bank/],
  ['hsbcusa', /HSBC Bank USA,?\s*(?:N\.\s?A\.|National Association)/]
];
export const trusteeKey = name => (TRUSTEES.find(([, re]) => re.test(name)) || [])[0] || null;

// ── Families (spec v2 §2) ────────────────────────────────────────────────

const COVER_HEAD = /(Joint Book[- ]Running Managers?|JOINT BOOK[- ]RUNNING MANAGERS?|Book[- ]Running Managers?|BOOK[- ]RUNNING MANAGERS?|Joint Bookrunners?|Joint Lead Bookrunners?|Joint Lead Managers?(?: (?:and|&) (?:Joint )?Bookrunners)?|Lead Managers?|Co-Lead Managers?|CO-LEAD MANAGERS?|Senior Co-Managers?|SENIOR CO-MANAGERS?|Junior Co-Managers?|JUNIOR CO-MANAGERS?|Co-Managers?|CO-MANAGERS?|Passive Bookrunners?|Lead Agents?|Agents|AGENTS|Underwriters|UNDERWRITERS|Underwriter|Lead Underwriter|Structuring Agents?|Green Structuring Agents?|Sustainability Structuring Agents?)(?!\s*[:’'])(?=\s+[A-Z])/g;
const COVER_END = new RegExp(`(?:Prospectus Supplement|Pricing Supplement)\\s*(?:No\\.\\s*\\d+\\s*)?(?:,\\s*)?(?:dated|Dated|-)?\\s*${WEEKDAY}${DATE}|The date of this (?:prospectus|pricing) supplement|Table of Contents|TABLE OF CONTENTS|${DATE}|We have not|You should rely|No dealer|Neither we nor|We are responsible|This prospectus supplement|You should read|ABOUT THIS`, 'g');

function roleOf(printed, family) {
  const p = printed.toLowerCase();
  if (/structuring/.test(p)) return 'other';
  if (/passive bookrunner|co-lead|co-manager/.test(p)) return 'co_manager';
  if (/book[- ]?run|bookrunner|lead manager/.test(p)) return 'bookrunner';
  if (/underwriter/.test(p)) return 'underwriter';
  if (/agent/.test(p)) return 'agent';
  return null;
}

function familyOf(text, parsed) {
  if (/ \/ retail$/.test(parsed?.rule || '')) return 'C';
  const head = text.slice(0, 1500);
  if (/Pricing Supplement/i.test(head)) {
    COVER_HEAD.lastIndex = 0;
    return COVER_HEAD.test(text.slice(1000, 14000)) && /(?:Public Offering Price|Price to (?:the )?Public)[^:]/i.test(text.slice(0, 14000)) ? 'A' : 'B';
  }
  return 'A';
}

// ── Tranche references ───────────────────────────────────────────────────

function trancheInfo(rows) {
  return rows.map(r => {
    const year = r.maturity_date ? Number(r.maturity_date.slice(0, 4)) : Number((String(r.tranche_label || '').match(/\b(20\d\d|19\d\d)\b(?!.*\b20\d\d\b)/) || [])[1]) || null;
    const series = (String(r.tranche_label || '').match(/\bSeries\s+([A-Z0-9]{1,5})\b(?!\s+due)/i) || [])[1] || null;
    return { seq: r.tranche_seq, year, rate: r.rate_type, coupon: r.coupon_rate, series, row: r };
  });
}
// The tranches a piece of text names ("the 2029 notes", "Notes due 2033", "4.650% Notes", "Floating Rate Notes").
export function namedTranches(seg, tr) {
  const hit = new Set();
  const NOTE = '(?:Medium-Term\\s+)?(?:Notes?|Debentures?|Bonds?|Securities)';
  for (const t of tr) {
    const sameYear = tr.filter(u => u.year === t.year);
    const floats = tr.filter(u => u.rate === 'floating');
    if (t.year) {
      const y = t.year;
      const yearPhrase = new RegExp(`\\b${y}\\s+(?:(?:Fixed|Floating|Senior|Subordinated|Junior|Fixed[- ]to[- ]Floating|Rate|Reset|Series\\s+\\w+)\\s+){0,4}${NOTE}\\b|\\b${NOTE}\\s*,?\\s*(?:Series\\s+\\w+\\s+)?due\\s+(?:${MONTH_RE}\\s+\\d{1,2},\\s*)?${y}\\b`, 'i');
      if (sameYear.length === 1 && yearPhrase.test(seg)) hit.add(t.seq);
      else if (sameYear.length > 1) {
        const rw = t.rate === 'floating' ? 'Floating Rate' : t.rate === 'fixed' ? 'Fixed Rate' : 'Fixed[- ]to[- ]Floating Rate';
        const yr = new RegExp(`\\b${y}\\s+${rw}\\s+${NOTE}|\\b${rw}\\s+${NOTE}\\s+due\\s+(?:${MONTH_RE}\\s+\\d{1,2},\\s*)?${y}\\b`, 'i');
        if (sameYear.filter(u => u.rate === t.rate).length === 1 && yr.test(seg)) hit.add(t.seq);
        // A plain "2026 Notes" next to "Floating Rate Notes due 2026" is the one fixed-rate tranche of that year (the issuer's defined term).
        const plain = new RegExp(`\\b${y}\\s+(?:Senior\\s+)?${NOTE}\\b`, 'i');
        if (t.rate !== 'floating' && sameYear.filter(u => u.rate !== 'floating').length === 1 && plain.test(seg)) hit.add(t.seq);
      }
    }
    if (t.rate === 'floating' && floats.length === 1 && /(?<!to[- ])\bFloating Rate (?:Medium-Term )?(?:Notes?|Debentures?|Securities)\b/i.test(seg) && !tr.some(u => u !== t && u.year === t.year && new RegExp(`\\b${t.year}\\s+Floating`, 'i').test(seg))) hit.add(t.seq);
    if (t.coupon != null && tr.filter(u => u.coupon === t.coupon).length === 1 && new RegExp(`(?<![\\d.])${couponRe(t.coupon)}\\s+(?:(?:Fixed Rate|Senior|Subordinated|Global|Medium-Term|Notes|Debentures)\\s*){1,3}`, 'i').test(seg)) hit.add(t.seq);
    if (t.series && tr.filter(u => u.series === t.series).length === 1 && new RegExp(`\\bSeries\\s+${esc(t.series)}\\b`).test(seg)) hit.add(t.seq);
  }
  return hit;
}

// ── The extractor ────────────────────────────────────────────────────────

export function extractOffering({ filing, html, parsed, fwps = [], fwpsUnavailable = 0, ingestedAt = new Date().toISOString(), version = OFFERING_VERSION }) {
  const { text, anchors } = decode(html);
  const family = familyOf(text, parsed);
  const acc = filing.accessionNumber, url = filing.url;
  const rows = (parsed?.rows || []).filter(r => r.filing_status === 'final' && r.tranche_seq > 0);
  const tr = trancheInfo(rows);
  const single = tr.length === 1;
  const notes = [], checks = [];
  const fail = (field, tranche_seq, check, detail) => checks.push({ accession_number: acc, field, tranche_seq, check, detail });

  // Section, heading and page for a position (BOND-10).
  const pages = family === 'A' ? pageMarkers(text) : [];
  const bankBlock = family !== 'C' ? coverBankBlock(text) : null;
  const coverEnd = bankBlock ? bankBlock.end : (() => { const m = text.slice(1500).search(/Table of Contents|TABLE OF CONTENTS/); return m >= 0 ? m + 1500 : 0; })();
  const tocHeads = anchors.length ? [] : tocHeadings(text);
  const sectionAt = at => {
    let s = null;
    for (const a of anchors) { if (a.at <= at) s = a; else break; }
    if (s && s.at >= coverEnd - 50) return { heading: s.heading, anchor: s.name };
    let h = null;
    for (const x of tocHeads) { if (x.at <= at) h = x; else break; }
    return h && h.at >= coverEnd ? { heading: h.heading, anchor: null } : { heading: null, anchor: null };
  };
  const pageAt = at => {
    if (!pages.length || at == null) return null;
    if (at < coverEnd) return 'cover';
    const p = pages.find(x => x.at >= at);
    return p ? p.label : null;
  };
  const partOf = (at, dflt) => {
    if (family === 'B') return 'pricing terms';
    if (family === 'C') return 'retail table';
    if (at < coverEnd) return dflt === 'cover table' ? 'cover table' : 'cover';
    const h = (sectionAt(at).heading || '').toLowerCase();
    if (/summary|the offering/.test(h)) return 'summary';
    if (/underwriting|plan of distribution/.test(h)) return 'underwriting';
    if (/description/.test(h)) return 'description of the notes';
    return dflt || 'description of the notes';
  };
  const src = (at, { part = null, heading = null, doc = '424b', srcUrl = url } = {}) => {
    if (doc === 'fwp') return { source_doc: 'fwp', source_url: srcUrl, source_part: 'term sheet', source_heading: heading, source_anchor: null, source_page: null, char_offset: at };
    const p = part || partOf(at);
    const sec = at != null && p !== 'cover' && p !== 'cover table' && family === 'A' ? sectionAt(at) : { heading: null, anchor: null };
    return { source_doc: '424b', source_url: srcUrl, source_part: p, source_heading: (heading || sec.heading || (p === 'cover' || p === 'cover table' ? 'Cover page' : null))?.slice(0, 80) ?? null,
             source_anchor: sec.anchor, source_page: pages.length && (p === 'cover' || p === 'cover table') ? 'cover' : pageAt(at), char_offset: at };
  };
  const base = { accession_number: acc, parser_version: version, ingested_at: ingestedAt };
  const facts = [];
  const put = (tranche_seq, field, state, v, s) => {
    const row = { ...base, tranche_seq, field, state, value_text: v.text ?? null, value_num: v.num ?? null, value_date: v.date ?? null, ...s };
    facts.push(Object.fromEntries(FACT_COLS.map(c => [c, row[c] ?? null])));
  };
  const absent = (tranche_seq, field, state, part = null) =>
    put(tranche_seq, field, state, {}, { source_doc: '424b', source_url: url, source_part: part || (family === 'B' ? 'pricing terms' : family === 'C' ? 'retail table' : 'cover'),
      source_heading: null, source_anchor: null, source_page: null, char_offset: null });

  const fwpDocs = fwps.filter(f => f && f.html).map(f => ({ ...f, text: decodedText(f.html) }));

  // #3 Date of this document (O).
  let docDate = documentDate(text);
  if (!docDate && bankBlock) {                                      // the date printed under the bank names on the cover
    const m = new RegExp(`^\\s*(${DATE})`).exec(text.slice(bankBlock.end, bankBlock.end + 40));
    if (m && isoOf(m[1])) docDate = { iso: isoOf(m[1]), at: bankBlock.end + m[0].indexOf(m[1]) };
  }
  if (docDate) put(0, 'document_date', 'disclosed', { date: docDate.iso }, src(docDate.at, { part: 'cover', heading: 'Cover page' }));

  // #13 Issue date (O): a labelled date, else the cover's "on or about" delivery date.
  let issue = labelledDate(text.slice(0, 30000), ISSUE_LABEL);
  if (issue) issue.how = 'labelled';
  else {
    // The cover's delivery sentence: "… expect to deliver the notes … against payment … on or about <date>".
    for (const m of text.slice(0, 20000).matchAll(new RegExp(`on or about\\s+${WEEKDAY}(${DATE})`, 'gi'))) {
      const before = text.slice(Math.max(0, m.index - 650), m.index);
      const d = Math.max(before.search(/deliver(?![\s\S]*deliver)/i), before.search(/delivery(?![\s\S]*delivery)/i), before.search(/against payment(?![\s\S]*against payment)/i), before.search(/settle(?![\s\S]*settle)/i));
      const x = before.search(/complet|consummat|closing|acquisition will/i);
      if (d < 0 || (x >= 0 && before.slice(x).search(/deliver|against payment|settle/i) < 0)) continue;
      issue = { iso: isoOf(m[1]), at: m.index + m[0].indexOf(m[1]), label: null, how: 'on or about' };
      break;
    }
  }
  // #12 Priced on (O): only a labelled trade or pricing date, from the 424B or the same-deal term sheet. Never derived.
  let priced = labelledDate(text.slice(0, 30000), PRICED_LABEL);
  if (priced) priced.doc = '424b';
  const fwpPriced = fwpDocs.map(f => ({ f, d: labelledDate(f.text.slice(0, 20000), PRICED_LABEL) })).filter(x => x.d);
  const fwpPricedVals = [...new Set(fwpPriced.map(x => x.d.iso))];
  if (fwpPricedVals.length > 1) { notes.push(`priced on: term sheets disagree (${fwpPricedVals.join(', ')})`); }
  if (priced && fwpPricedVals.length === 1 && fwpPricedVals[0] !== priced.iso) {
    fail('priced_on', 0, 'fwp_conflict', `424B ${priced.iso} vs term sheet ${fwpPricedVals[0]}`); priced = null; priced = { conflict: true };
  } else if (!priced && fwpPricedVals.length === 1) {
    const x = fwpPriced[0];
    priced = { iso: x.d.iso, at: x.d.at, label: x.d.label, doc: 'fwp', url: x.f.url, acc: x.f.accessionNumber };
  }
  // Term sheet vs filing: issue date (§6.1).
  const fwpIssue = [...new Set(fwpDocs.map(f => labelledDate(f.text.slice(0, 20000), ISSUE_LABEL)?.iso).filter(Boolean))];
  if (issue && fwpIssue.length === 1 && fwpIssue[0] !== issue.iso) { fail('issue_date', 0, 'fwp_conflict', `424B ${issue.iso} vs term sheet ${fwpIssue[0]}`); issue = { conflict: true }; }

  // §6.1 dates: document date ≤ issue date ≤ maturity; priced on ≤ issue date; issue 1–15 business days after the document.
  const maturities = rows.map(r => r.maturity_date).filter(Boolean);
  if (issue?.iso) {
    const why = [];
    if (docDate && issue.iso < docDate.iso) why.push(`before the document date ${docDate.iso}`);
    if (maturities.some(m => issue.iso > m)) why.push('after a maturity');
    if (docDate && issue.iso >= docDate.iso) { const n = bizDaysBetween(docDate.iso, issue.iso); if (n < 1 || n > 15) why.push(`${n} business days after the document date`); }
    if (why.length) { fail('issue_date', 0, 'dates', `${issue.iso}: ${why.join('; ')}`); issue = null; }
  }
  if (priced?.iso && issue?.iso && priced.iso > issue.iso) { fail('priced_on', 0, 'dates', `${priced.iso} after the issue date ${issue.iso}`); priced = null; }
  if (docDate && maturities.some(m => docDate.iso > m)) { fail('document_date', 0, 'dates', `${docDate.iso} after a maturity`); const k = facts.findIndex(f => f.field === 'document_date'); if (k >= 0) facts.splice(k, 1); }

  if (issue?.iso) put(0, 'issue_date', 'disclosed', { date: issue.iso, text: issue.how === 'on or about' ? 'on or about' : null },
    src(issue.at, { heading: issue.label || (family === 'A' && issue.at < coverEnd ? 'Cover page' : null) }));
  if (priced?.iso) put(0, 'priced_on', 'disclosed', { date: priced.iso },
    priced.doc === 'fwp' ? src(priced.at, { doc: 'fwp', srcUrl: priced.url, heading: priced.label }) : src(priced.at, { heading: priced.label }));
  else if (!priced) absent(0, 'priced_on', 'not_disclosed');

  // #4–8 Identifier, amount, currency, interest rate, maturity (T): the bond_issuance values with their printed place.
  const ids424 = findIdentifiers(text);
  const idsFwp = fwpDocs.map(f => ({ f, ids: findIdentifiers(f.text) }));
  const seenIds = new Map();
  for (const t of tr) {
    const r = t.row;
    if (r.cusip || r.isin) {
      const v = [r.cusip && `CUSIP ${r.cusip}`, r.isin && `ISIN ${r.isin}`].filter(Boolean).join('; ');
      const okDigits = (!r.cusip || cusipValid(r.cusip)) && (!r.isin || isinValid(r.isin));
      const dup = [r.cusip, r.isin].filter(Boolean).find(x => seenIds.has(x));
      if (!okDigits || dup) fail('identifier', t.seq, 'identifiers', !okDigits ? 'check digit' : `also on tranche ${seenIds.get(dup)}`);
      else {
        [r.cusip, r.isin].filter(Boolean).forEach(x => seenIds.set(x, t.seq));
        const fromFwp = /^fwp (\S+)/.exec(r.id_source || '');
        const hit424 = ids424.find(x => x.value === r.cusip || x.value === r.isin);
        if (hit424 && !fromFwp) put(t.seq, 'identifier', 'disclosed', { text: v }, src(hit424.at, { heading: family === 'B' ? 'CUSIP' : null }));
        else {
          const f = idsFwp.find(x => (!fromFwp || x.f.accessionNumber === fromFwp[1]) && x.ids.some(y => y.value === r.cusip || y.value === r.isin));
          const at = f ? f.ids.find(y => y.value === r.cusip || y.value === r.isin).at : null;
          if (f) put(t.seq, 'identifier', 'disclosed', { text: v }, src(at, { doc: 'fwp', srcUrl: f.f.url, heading: 'CUSIP / ISIN' }));
          else if (hit424) put(t.seq, 'identifier', 'disclosed', { text: v }, src(hit424.at));
          else fail('identifier', t.seq, 'source', 'identifier not found in the 424B or a paired term sheet');
        }
      }
    } else if (!ids424.length && !idsFwp.some(x => x.ids.length) && !fwpsUnavailable) absent(t.seq, 'identifier', 'not_disclosed');
    // else: printed but not assigned to this tranche → no row ("Not read yet").

    const loc = locateTerms(text, r, t, tr);
    if (r.principal_amount > 0 && loc.amount != null) {
      put(t.seq, 'amount', 'disclosed', { num: r.principal_amount }, src(loc.amount, { part: family === 'A' && loc.amount < coverEnd ? 'cover' : null }));
      put(t.seq, 'currency', 'disclosed', { text: r.currency }, src(loc.amount, { part: family === 'A' && loc.amount < coverEnd ? 'cover' : null }));
    } else if (r.principal_amount > 0) fail('amount', t.seq, 'source', 'amount not found in the text');
    if (loc.rate != null) {
      const v = r.rate_type === 'floating' ? { text: `${r.benchmark || 'benchmark'} + ${r.spread_bps} bps`, num: r.spread_bps } : { num: r.coupon_rate, text: r.rate_type === 'fixed' ? null : `fixed ${r.coupon_rate}% then floating` };
      if (r.rate_type === 'floating' ? r.spread_bps != null : r.coupon_rate != null) put(t.seq, 'interest_rate', 'disclosed', v, src(loc.rate, { part: family === 'A' && loc.rate < coverEnd ? 'cover' : null }));
    } else if (r.rate_type === 'floating' ? r.spread_bps != null : r.coupon_rate != null) fail('interest_rate', t.seq, 'source', 'rate not found in the text');
    if (r.maturity_date && loc.maturity != null) put(t.seq, 'maturity', 'disclosed', { date: r.maturity_date }, src(loc.maturity, { part: family === 'A' && loc.maturity < coverEnd ? 'cover' : null }));
    else if (r.maturity_date) fail('maturity', t.seq, 'source', 'maturity not found in the text');
  }

  // #9 Price to investors (T), checked against the bank fee and proceeds where the cover prints all three.
  const prices = issuePrices(text, family, tr, single, fail);
  const fwpPrice = single ? fwpDocs.map(f => termPct(f.text.slice(0, 20000), PRICE_LABEL)).find(Boolean) : null;
  for (const t of tr) {
    const p = prices.get(t.seq);
    if (!p) continue;
    if (p.value < 90 || p.value > 101) { fail('issue_price_pct', t.seq, 'range', `${p.value}`); continue; }
    if (fwpPrice && Math.abs(fwpPrice.value - p.value) > 0.0005) { fail('issue_price_pct', t.seq, 'fwp_conflict', `424B ${p.value} vs term sheet ${fwpPrice.value}`); continue; }
    put(t.seq, 'issue_price_pct', 'disclosed', { num: p.value }, src(p.at, { part: p.part, heading: p.heading }));
  }

  // #10 Interest paid (T) and #11 How interest is counted (T).
  const paid = interestPaid(text, family, tr, single);
  for (const t of tr) {
    const p = paid.get(t.seq);
    if (!p) continue;
    const n = { 'semi-annual': 2, quarterly: 4, annual: 1, monthly: 12 }[p.value.f];
    if (p.value.f && p.value.on && p.value.on.length && n !== p.value.on.length) { fail('interest_paid', t.seq, 'frequency', `${p.value.f} with ${p.value.on.length} dates`); continue; }
    if (p.value.first && p.value.on && p.value.on.length && !p.value.on.includes(p.value.first.slice(5))) { fail('interest_paid', t.seq, 'first_date', `${p.value.first} not on ${p.value.on.join(',')}`); continue; }
    if (p.value.first && t.row.maturity_date && p.value.first > t.row.maturity_date) { fail('interest_paid', t.seq, 'first_date', 'after maturity'); continue; }
    const vt = JSON.stringify(p.value);
    if (vt.length > VALUE_TEXT_MAX) { fail('interest_paid', t.seq, 'length', `${vt.length}`); continue; }
    put(t.seq, 'interest_paid', 'disclosed', { text: vt, date: p.value.first || null }, src(p.at, { heading: p.heading }));
  }
  const dc = dayCounts(text, family, tr);
  for (const t of tr) {
    const d = dc.get(t.seq);
    if (d) put(t.seq, 'day_count', 'disclosed', { text: d.value }, src(d.at, { heading: d.heading }));
    else if (family === 'C') absent(t.seq, 'day_count', 'not_disclosed', 'retail table');
    else if (family === 'B' && !dc.size) absent(t.seq, 'day_count', 'not_disclosed', 'pricing terms');   // no "Day Count" term printed
  }

  // §4 Parties.
  const arabicPages = pages.filter(p => /^S-\d/.test(p.label));
  const supplementEnd = arabicPages.length ? arabicPages[arabicPages.length - 1].end : null;   // last printed S-page of the prospectus supplement
  const pr = readParties({ text, family, tr, bankBlock, fwpDocs, issuerHint: parsed?.coIssuers || [], supplementEnd });
  notes.push(...pr.notes);
  let parties = [];
  const roleState = new Map();
  if (pr.clash) { fail('parties', 0, 'clash', pr.clash); }
  else {
    let seq = 0;
    for (const p of pr.parties) {
      const s = p.doc === 'fwp' ? { source_doc: 'fwp', source_url: p.url, source_part: 'term sheet', source_page: null }
        : { source_doc: '424b', source_url: url, source_part: p.part, source_page: pageAt(p.at) };
      const row = { ...base, party_seq: ++seq, tranche_seq: p.tranche_seq, party_name: p.name, role: p.role, role_printed: p.role_printed, ...s };
      parties.push(Object.fromEntries(PARTY_COLS.map(c => [c, row[c] ?? null])));
    }
    for (const [role, st] of pr.states) roleState.set(role, st);
    for (const [role, st] of roleState) {
      const first = pr.parties.find(p => p.role === role);
      if (st === 'disclosed' && first) put(0, `parties.${role}`, 'disclosed', { num: pr.parties.filter(p => p.role === role).length },
        first.doc === 'fwp' ? src(first.at, { doc: 'fwp', srcUrl: first.url }) : src(first.at, { part: first.part, heading: first.heading }));
      else if (st !== 'disclosed') absent(0, `parties.${role}`, st, first?.part || null);
    }
  }

  // §6.1 every fact: a source part and, for a shown value, a char offset; value_text ≤ 300.
  for (const f of facts) {
    if (!f.source_part || (f.state === 'disclosed' && f.char_offset == null)) fail(f.field, f.tranche_seq, 'source', 'no source location');
    if (f.value_text && f.value_text.length > VALUE_TEXT_MAX) fail(f.field, f.tranche_seq, 'length', `${f.value_text.length}`);
  }
  const bad = new Set(checks.filter(c => c.check === 'source' || c.check === 'length').map(c => `${c.field}|${c.tranche_seq}`));
  const kept = facts.filter(f => !bad.has(`${f.field}|${f.tranche_seq}`) || f.state !== 'disclosed');

  return { family, facts: kept, parties, checks, notes,
    stats: { tranches: tr.length, pages: pages.length, anchors: anchors.length, bankBlock: !!bankBlock, unknownBanks: pr.unknown, droppedRuns: pr.dropped || [] } };
}

// ── Field readers ────────────────────────────────────────────────────────

function documentDate(text) {
  const head = text.slice(0, 16000);
  // Deere prints a two-column header, "PROSPECTUS and PRICING SUPPLEMENT NO. n | PROSPECTUS SUPPLEMENT, each Dated <d1> Dated <d2>", and the
  // decoded text gives the two dates in either column order. The pricing supplement is the later of the two (it is never dated
  // before the prospectus supplement it supplements).
  const each = new RegExp(`Pricing\\s+Supplement(?:\\s+No\\.\\s*\\d+)?[^.]{0,60}?\\beach\\s+Dated\\s+(${DATE})\\s+Dated\\s+(${DATE})`, 'i').exec(head);
  if (each && isoOf(each[1]) && isoOf(each[2])) {
    const k = isoOf(each[1]) >= isoOf(each[2]) ? 1 : 2;
    return { iso: isoOf(each[k]), at: each.index + (k === 1 ? each[0].indexOf(each[1]) : each[0].lastIndexOf(each[2])) };
  }
  const res = [
    new RegExp(`(?:Prospectus|Pricing)\\s+Supplement(?:\\s+No\\.\\s*\\d+)?[^.]{0,40}?(?:dated|Dated|DATED|-)\\s+${WEEKDAY}(${DATE})`, 'gi'),
    new RegExp(`(?:Prospectus|Pricing)\\s+Supplement\\s+(${DATE})`, 'gi'),
    new RegExp(`The date of this (?:prospectus|pricing) supplement is\\s+(${DATE})`, 'gi')
  ];
  const hits = [];
  for (const re of res) for (const m of head.matchAll(re)) {
    const before = head.slice(Math.max(0, m.index - 22), m.index);
    if (/(?:\bto|\bTo|\bTO|\band|\bAND|\(|supplemented by|Amending the|amending the|accompanying|base)\s*(?:the\s+)?$/.test(before)) continue;
    if (/^(?:Prospectus|Pricing)\s+Supplement[^.]{0,40}?\b(?:to|and)\s+(?:the\s+)?(?:Prospectus|Pricing)/i.test(m[0])) continue;
    const iso = isoOf(m[1]);
    if (iso) hits.push({ iso, at: m.index + m[0].lastIndexOf(m[1]) });
  }
  hits.sort((a, b) => a.at - b.at);
  return hits[0] || null;
}

const ISSUE_LABEL = '(?:Settlement Date(?:\\s*\\((?:Original Issue Date|T\\+\\d)\\))?|Original Issue Date|Date of Issue|Issue Date|Settlement Date and Time|Expected Settlement Date)';
const PRICED_LABEL = '(?:Initial Trade Date|Trade Date(?:\\s*\\/\\s*Pricing Effective Time)?|Pricing Date)';
function labelledDate(text, label) {
  const re = new RegExp(`(?<![\\w-])(${label})\\s*(?::|\\s)\\s*${WEEKDAY}(${DATE})`, 'g');
  const vals = [];
  for (const m of text.matchAll(re)) {
    if (!/:/.test(text.slice(m.index, m.index + m[0].length - m[2].length))) {   // no colon: only a table-style label at a field start
      if (!/(?:^|[.;:]\s|\s{2})$/.test(text.slice(Math.max(0, m.index - 3), m.index)) && !/^[A-Z]/.test(m[1])) continue;
    }
    const iso = isoOf(m[2]);
    if (iso) vals.push({ iso, at: m.index + m[0].lastIndexOf(m[2]), label: m[1].replace(/\s+/g, ' ').slice(0, 80) });
  }
  const distinct = [...new Set(vals.map(v => v.iso))];
  return distinct.length === 1 ? vals[0] : null;   // two different labelled dates → not read (tranche-level dates are rare; noted)
}

// Where the bond_issuance terms are printed (first place they appear; the cover line for cover tranches).
function locateTerms(text, r, t, tr) {
  const head = text.slice(0, 40000);
  const out = { amount: null, rate: null, maturity: null };
  if (r.principal_amount > 0) {
    const n = r.principal_amount, whole = Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    const forms = [whole.replace(/,/g, ',\\s?'), n % 1e6 === 0 ? `${n / 1e6}\\s+million` : null, n % 1e9 === 0 ? `${n / 1e9}\\s+billion` : null].filter(Boolean);
    // Two tranches can share an amount: prefer the place where this tranche's coupon or maturity follows the amount.
    const near = r.rate_type !== 'floating' && r.coupon_rate != null ? new RegExp(`^[^$€£]{0,60}?(?<![\\d.])${couponRe(r.coupon_rate)}`) : t.year ? new RegExp(`^[^$€£]{0,140}?\\b${t.year}\\b`) : null;
    for (const f of forms) {
      const all = [...head.matchAll(new RegExp(`(?<![\\d,.])${f}(?![\\d])`, 'g'))];
      const best = (near && all.find(m => near.test(head.slice(m.index + m[0].length, m.index + m[0].length + 200)))) || all[0];
      if (best) { out.amount = best.index; break; }
    }
  }
  if (r.rate_type !== 'floating' && r.coupon_rate != null) { const m = new RegExp(`(?<![\\d.])${couponRe(r.coupon_rate)}`).exec(head); if (m) out.rate = m.index; }
  if (r.rate_type === 'floating' && r.spread_bps != null) {
    const m = new RegExp(`(?<![\\d.])(?:\\+\\s?)?${r.spread_bps}(?:\\.0+)?\\s*(?:basis points|bps|bp)\\b|(?<![\\d.])${(r.spread_bps / 100).toFixed(3).replace(/0+$/, '').replace('.', '\\.')}\\d*\\s?%`, 'i').exec(head);
    if (m) out.rate = m.index;
  }
  if (r.maturity_date) {
    const [y, mo, d] = r.maturity_date.split('-').map(Number);
    const long = `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][mo - 1]}\\s+0?${d}\\s*,\\s*${y}`;
    const m = new RegExp(long, 'i').exec(head) || new RegExp(`\\b0?${mo}\\/0?${d}\\/${y}\\b`).exec(head);
    if (m) out.maturity = m.index;
  }
  return out;
}

// Cover table (A): per-tranche price, fee and proceeds; rows per tranche (UNH) or columns per tranche (ICE).
const PRICE_HDR = /(?:Initial\s+)?(?:Public\s+Offering\s+Price|Price\s+to\s+(?:the\s+)?Public|Offering\s+Price|Price\s+to\s+Investors|Issue\s+Price)/i;
const FEE_HDR = /Underwriting\s+Discounts?(?:\s+and\s+Commissions)?|Underwriters['’]?\s+Discounts?|Underwriting\s+Commissions?|Agents['’]?\s+(?:Discounts?|Commissions?)|Selling\s+Agents?['’]?\s+Commissions?|Discounts?\s+and\s+Commissions/i;
const PROC_HDR = /Proceeds,?\s*(?:before\s+expenses,?\s*)?to\s+(?:us|the\s+Company|the\s+Issuer|[A-Z][\w&.’'-]*(?:\s+[A-Z][\w&.’'-]*){0,3})(?:\s*\(?before\s+expenses\)?)?|Proceeds\s+to\s+Issuer|Net\s+Proceeds/i;
const PCT = /(?<![\d.])(\d{1,3}(?:\.\d{1,6})?)\s?%/g;
const PRICE_LABEL = '(?:Issue Price|Price to Public(?:\\s*\\(Issue Price\\))?|Initial (?:Public )?Offering Price|Public Offering Price|Offering Price|Price to Investors)';
function termPct(text, label) {
  const m = new RegExp(`(?<![\\w-])(${label})\\s*:\\s*(\\d{1,3}(?:\\.\\d{1,6})?)\\s?%`, 'i').exec(text);
  return m ? { value: Number(m[2]), at: m.index + m[0].lastIndexOf(m[2]), label: m[1] } : null;
}

function issuePrices(text, family, tr, single, fail) {
  const out = new Map();
  if (family === 'C') {
    for (const t of tr) {
      if (!t.row.cusip) continue;
      const m = new RegExp(`\\b${t.row.cusip}\\s+(?:\\$\\s?[\\d,]+(?:\\.\\d+)?\\s+)?(\\d{1,3}(?:\\.\\d{1,6})?)\\s?%\\s+(\\d{1,2}(?:\\.\\d{1,6})?)\\s?%`).exec(text.slice(0, 30000));
      if (m) out.set(t.seq, { value: Number(m[1]), at: m.index + m[0].indexOf(m[1] + (m[0].includes(m[1] + ' %') ? ' %' : '%')), part: 'retail table', heading: 'Selling Price' });
    }
    return out;
  }
  if (family === 'B') {
    if (!single) return out;
    const p = termPct(text.slice(0, 25000), PRICE_LABEL);
    if (p) out.set(tr[0].seq, { value: p.value, at: p.at, part: 'pricing terms', heading: p.label });
    return out;
  }
  // A: the cover table.
  const head = text.slice(0, 22000);
  PCT.lastIndex = 0;
  const pm = PRICE_HDR.exec(head);
  if (!pm) return out;
  const start = Math.max(0, pm.index - 600);
  let region = head.slice(start, pm.index + 2600);
  const p0 = pm.index - start;
  const cut = region.slice(p0).search(/\(1\)\s+Plus|Plus accrued|The underwriters expect|We expect to deliver|will be ready for delivery|Delivery of the notes|Neither the Securities/i);
  if (cut >= 0) region = region.slice(0, p0 + cut);
  const lab = (re, from) => { const r = new RegExp(re.source, 'gi'); r.lastIndex = from; const m = r.exec(region); return m ? { at: m.index, end: m.index + m[0].length } : null; };
  const P = lab(PRICE_HDR, p0), F = P && lab(FEE_HDR, P.at), R = P && lab(PROC_HDR, P.at);
  const pcts = [...region.matchAll(PCT)].filter(m => P && m.index > P.at).map(m => ({ v: Number(m[1]), at: m.index }));
  if (!P || !pcts.length) return out;
  const metrics = [['price', P], ['fee', F], ['proceeds', R]].filter(x => x[1]).sort((a, b) => a[1].at - b[1].at);
  const abs = at => start + at;
  const lastHdr = Math.max(...metrics.map(x => x[1].end));
  const rowsOut = [];
  if (pcts[0].at > lastHdr) {
    // Header layout: each table row is [label] p1 p2 p3 (in header order).
    const k = metrics.length;
    let prevEnd = lastHdr;
    for (let i = 0; i + k <= pcts.length; i += k) {
      let seg = region.slice(prevEnd, pcts[i].at);
      const lt = seg.search(/\btotals?\b(?![\s\S]*\btotals?\b)/i);
      if (lt >= 0 && /\bPer\b/.test(seg.slice(lt))) seg = seg.slice(seg.slice(lt).search(/\bPer\b/) + lt);
      else if (lt >= 0 && i > 0) seg = seg.slice(lt + 5);
      const label = seg.replace(/\$\s?[\d,.]+|€\s?[\d,.]+|£\s?[\d,.]+|[\d,]{5,}/g, ' ').replace(/[….]{2,}/g, ' ');
      const vals = Object.fromEntries(metrics.map((x, j) => [x[0], pcts[i + j]]));
      rowsOut.push({ label, vals });
      prevEnd = pcts[i + k - 1].at + 4;
      if (/Total/i.test(region.slice(prevEnd, prevEnd + 30)) && !/%/.test(region.slice(prevEnd, prevEnd + 40))) break;
    }
  } else {
    // Metric-row layout: each metric label is followed by one % per tranche column.
    const desc = region.slice(0, P.at);
    const cols = [...desc.matchAll(/\bPer\s+((?:(?!Per\b)[^%$]){0,60}?)\s?(?:Notes?|Debentures?|Bonds?|Security|Securities)\b/g)].map(m => m[1]);
    const byMetric = {};
    for (let j = 0; j < metrics.length; j++) {
      const to = j + 1 < metrics.length ? metrics[j + 1][1].at : region.length;
      byMetric[metrics[j][0]] = pcts.filter(p => p.at > metrics[j][1].end && p.at < to);
    }
    const n = byMetric.price.length;
    // Column descriptors: "Per 2029 Note" (one per tranche), or tranche titles printed above the table ("Floating Rate Notes 2026 Fixed Rate Notes …").
    let colLabels = cols.filter(c => c.trim() && !/^(?:Note|Total)$/i.test(c.trim())).slice(-n);
    if (colLabels.length !== n && n > 1) {
      const titles = [...desc.matchAll(/((?:\d{4}\s+)?(?:Fixed|Floating)[- ]Rate\s+Notes|\d{4}\s+Notes|Notes\s+due\s+\d{4})/gi)].map(m => m[1]);
      if (titles.length >= n) colLabels = titles.slice(-n);
    }
    for (let c = 0; c < n; c++) {
      const label = n === 1 ? 'Per Note' : (colLabels.length === n ? colLabels[c] : null);
      rowsOut.push({ label, vals: Object.fromEntries(metrics.map(x => [x[0], byMetric[x[0]][c]])) });
    }
  }
  for (const r of rowsOut) {
    if (!r.vals.price || r.label == null) continue;
    let seqs = [...namedTranches(r.label + ' Notes', tr)];
    if (!seqs.length && /\b(?:19|20)\d\d\b/.test(r.label)) {
      // In a price table "Per 2028 Note" next to "Per Floating Rate Note" is the fixed-rate 2028 tranche.
      const y = Number(r.label.match(/\b((?:19|20)\d\d)\b/)[1]);
      const fl = /floating/i.test(r.label), f2f = /fixed[- ]to[- ]floating/i.test(r.label);
      const ys = tr.filter(t => t.year === y && (f2f ? t.rate !== 'fixed' && t.rate !== 'floating' : fl ? t.rate === 'floating' : t.rate !== 'floating'));
      if (ys.length === 1) seqs = [ys[0].seq];
    }
    if (!seqs.length) {                                              // "Per sterling note", "Per euro note"
      const cur = /sterling|£/i.test(r.label) ? 'GBP' : /euro|€/i.test(r.label) ? 'EUR' : /Canadian|C\$/i.test(r.label) ? 'CAD' : null;
      const cs = cur ? tr.filter(t => t.row.currency === cur) : [];
      if (cs.length === 1) seqs = [cs[0].seq];
    }
    if (!seqs.length && /fixed[- ]to[- ]floating/i.test(r.label)) { const fs = tr.filter(t => t.rate !== 'fixed' && t.rate !== 'floating'); if (fs.length === 1) seqs = [fs[0].seq]; }
    if (!seqs.length && /floating/i.test(r.label) && !/fixed[- ]to/i.test(r.label)) { const fs = tr.filter(t => t.rate === 'floating'); if (fs.length === 1) seqs = [fs[0].seq]; }
    if (!seqs.length && single && rowsOut.filter(x => x.vals.price).length === 1) seqs = [tr[0].seq];
    if (seqs.length !== 1) continue;
    const seq = seqs[0];
    const { price, fee, proceeds } = r.vals;
    if (price && fee && proceeds && Math.abs(price.v - fee.v - proceeds.v) > 0.01) { fail('issue_price_pct', seq, 'price_fee_proceeds', `${price.v} − ${fee.v} ≠ ${proceeds.v}`); out.set(seq, null); continue; }
    if (out.has(seq)) { if (out.get(seq) && out.get(seq).value !== price.v) { fail('issue_price_pct', seq, 'one_value', `${out.get(seq).value} and ${price.v}`); out.set(seq, null); } continue; }
    out.set(seq, { value: price.v, at: abs(price.at), part: 'cover table', heading: 'Cover page' });
  }
  for (const [k, v] of out) if (!v) out.delete(k);
  return out;
}

// Interest paid: frequency word + day/month list + first payment date, from the sentence that names the tranche.
const FREQ = s => (/semi-?\s?annual/i.test(s) ? 'semi-annual' : /quarterly/i.test(s) ? 'quarterly' : /monthly/i.test(s) ? 'monthly' : /(?<!semi-?\s?)\bannual(?:ly)?\b/i.test(s) ? 'annual' : null);
function dayMonths(s) {
  const out = [];
  for (const m of s.matchAll(new RegExp(`(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\s*,?\\s*\\d{4})(?![\\d])`, 'g'))) out.push(`${pad(monthNum(m[1]))}-${pad(m[2])}`);
  for (const m of s.matchAll(new RegExp(`(\\d{1,2})\\s?(?:st|nd|rd|th)?\\s+(?:day\\s+)?of\\s+((?:${MONTH_RE}(?:\\s*,\\s*and\\s+|\\s+and\\s+|\\s*,\\s*)?)+)`, 'g')))
    for (const mm of m[2].matchAll(new RegExp(MONTH_RE, 'g'))) out.push(`${pad(monthNum(mm[0]))}-${pad(m[1])}`);
  for (const m of s.matchAll(new RegExp(`(?<![\\d/])(\\d{1,2})\\s+(${MONTH_RE})(?!\\s+\\d{1,2},)(?!\\s+\\d{4})`, 'g'))) out.push(`${pad(monthNum(m[2]))}-${pad(m[1])}`);
  return [...new Set(out)].sort();
}
const FIRST_RE = new RegExp(`(?:beginning|commencing|starting|first\\s+(?:such\\s+)?(?:interest\\s+)?payment(?:\\s+date)?[^.]{0,80}?(?:on|be|is))\\s+(?:on\\s+)?${WEEKDAY}(${DATE})`, 'i');

function interestPaid(text, family, tr, single) {
  const out = new Map();
  if (family === 'C') {
    for (const t of tr) {
      if (!t.row.cusip) continue;
      const m = new RegExp(`\\b${t.row.cusip}\\b[^\\n]{0,200}?(Monthly|Quarterly|Semi[- ]?Annual(?:ly)?|Annual(?:ly)?)\\s+(\\d{1,2}\\/\\d{1,2}\\/\\d{4})\\s+(\\d{1,2}\\/\\d{1,2}\\/\\d{4})`).exec(text.slice(0, 30000));
      if (m) out.set(t.seq, { value: { f: FREQ(m[1]), first: toIsoDate(m[3]) }, at: m.index + m[0].indexOf(m[1]), heading: 'Coupon Frequency' });
    }
    return out;
  }
  const cands = [];
  if (family === 'B') {
    for (const m of text.slice(0, 25000).matchAll(/(?<![\w-])(Interest Payment Dates?)\s*:\s*/g)) {
      const rest = text.slice(m.index + m[0].length, m.index + m[0].length + 400);
      const stop = rest.search(/\s(?:[A-Z][A-Za-z'’/() -]{2,50}):\s/);
      cands.push({ s: stop >= 0 ? rest.slice(0, stop) : rest, at: m.index + m[0].length, heading: m[1], after: '' });
    }
  }
  const body = text.slice(0, family === 'B' ? 25000 : 60000);
  // Sentences that say when interest is paid: "interest" + "pay/payable/paid" + a day and month or a frequency word.
  for (const m of body.matchAll(/[^.]*?\b(?:interest\b[^.]*?\b(?:pay|payable|paid)|pays?\s+interest)\b[^.]*?(?:\.(?=\s+[A-Z(“"])|$)/gi)) {
    const s = m[0];
    if (!dayMonths(s).length && !FREQ(s)) continue;
    if (/redemption (?:date|price)|redeemed|change of control|make-whole|Treasury Rate|accrued and unpaid interest (?:to|on)|defer|deferral|Extension Period|record date|regular record/i.test(s) && !/payable (?:semi|quarter|month|annual|on)|pay interest (?:semi|quarter|month|annual|on)/i.test(s)) continue;
    cands.push({ s, at: m.index, heading: null, after: body.slice(m.index + s.length, m.index + s.length + 700) });
  }
  const classOf = cl => {                                          // "the fixed rate notes", "the floating rate notes", "each series of notes"
    if (/\beach series of (?:the )?notes\b|\ball (?:series of )?(?:the )?notes\b/i.test(cl)) return tr.map(t => t.seq);
    if (/\bfixed rate notes\b/i.test(cl) && !/fixed[- ]to[- ]floating/i.test(cl)) return tr.filter(t => t.rate === 'fixed').map(t => t.seq);
    if (/(?<!to[- ])\bfloating rate notes\b/i.test(cl) && !/\b(?:19|20)\d\d\s+floating/i.test(cl)) return tr.filter(t => t.rate === 'floating').map(t => t.seq);
    if (/fixed[- ]to[- ]floating rate notes\b/i.test(cl)) return tr.filter(t => t.rate === 'fixed_to_floating').map(t => t.seq);
    return [];
  };
  for (const c of cands) {
    const f0 = FREQ(c.s);
    // Clauses: "…, and interest on the notes due 2036 …", "… and we will pay interest on the Series B …", "in the case of …".
    let groups = [];
    const pieces = c.s.split(/\bin the case of\b/i);
    if (pieces.length > 1 && dayMonths(pieces[0]).length) {
      // Post-positioned: "<dates>, in the case of the Series A Notes, and <dates>, in the case of the Series B Notes".
      for (let i = 0; i + 1 < pieces.length; i++) {
        const namesPart = pieces[i + 1].split(/,\s*(?:and\s+)?|\s+and\s+on\b/)[0];
        const datesPart = i === 0 ? pieces[0] : pieces[i].slice(pieces[i].split(/,\s*(?:and\s+)?|\s+and\s+on\b/)[0].length);
        groups.push({ names: namesPart, dates: datesPart });
      }
    } else {
      const parts = c.s.split(/(?=\bin the case of\b)|,?\s*and\s+(?=interest on the\b)|,?\s*and\s+(?=(?:we|the issuer|[A-Z][\w.&]*(?:\s+[A-Z][\w.&]*){0,3})\s+will pay interest\b)|;\s+/i);
      groups = parts.map(p => ({ names: p, dates: p }));
    }
    const sentNames = namedTranches(c.s, tr);
    for (const g of groups) {
      let names = namedTranches(g.names, tr);
      if (!names.size) names = new Set(classOf(g.names));
      if (!names.size && groups.length === 1) names = sentNames;
      if (!names.size) {
        if (sentNames.size && groups.length > 1) continue;
        if (!/\bthe (?:notes|debentures|securities)\b/i.test(g.names) && !single) continue;
        names = new Set(tr.map(t => t.seq));
      }
      for (const seq of names) {
        if (out.has(seq)) continue;
        const t = tr.find(x => x.seq === seq);
        let dtext = g.dates;
        const rd = dtext.search(/\bto (?:the )?(?:persons?|holders?)(?: of record)? in whose names?|\bclose of business\b|\brecord dates?\b|\bregular record\b/i);
        if (rd >= 0) dtext = dtext.slice(0, rd);                   // record dates are not payment dates
        let period = null;
        if (t.rate === 'fixed_to_floating') {                       // the fixed-rate period's schedule only
          const k = dtext.search(/\(ii\)|and quarterly during|during the floating rate period|floating rate period/i);
          if (k > 0) { dtext = dtext.slice(0, k); period = 'fixed rate period'; }
        }
        const on = dayMonths(dtext.replace(FIRST_RE, ' '));
        const f = FREQ(dtext) || (period ? null : f0);
        let first = (dtext.match(FIRST_RE) || [])[1];
        if (!first && c.after && !period) {
          for (const part of c.after.split(/[.;]\s|,\s*(?=(?:and\s+)?the first)/i)) {
            const fm = part.match(FIRST_RE) || part.match(new RegExp(`first[^.]{0,60}?(${DATE})`, 'i'));
            if (!fm) continue;
            const pn = namedTranches(part, tr);
            const pc = new Set(classOf(part));
            if ((pn.size && pn.has(seq) && pn.size === 1) || (!pn.size && pc.has(seq)) || (!pn.size && !pc.size && (single || names.size === tr.length) && !/the first such payment on the/i.test(part))) { first = fm[1]; break; }
          }
        }
        if (!on.length && !f) continue;
        const value = { f, on: on.length ? on : null, first: first ? isoOf(first) : null, p: period };
        out.set(seq, { value: Object.fromEntries(Object.entries(value).filter(([, v]) => v != null)), at: c.at + Math.max(0, c.s.indexOf(g.dates)), heading: c.heading });
      }
    }
  }
  return out;
}

// How interest is counted: closed list 30/360 · Actual/360 · Actual/365 · Actual/Actual.
function dayCounts(text, family, tr) {
  const out = new Map();
  if (family === 'C') return out;
  const body = text.slice(0, family === 'B' ? 25000 : 120000);
  const found = [];
  const add = (v, at, heading) => found.push({ value: v, at, heading });
  for (const m of body.matchAll(/(?<![\w-])(Day Count(?: Convention| Fraction| Basis)?)\s*:\s*([^:]{0,60})/g)) {
    const ticked = m[2].match(/\[\s?[Xx]\s?\]\s*([^\[]{2,20})/);            // "[ ] 30/360 [X] Actual/360 [ ] Actual/Actual"
    const v = /\[\s?\]/.test(m[2]) ? (ticked ? dcCode(ticked[1]) : null) : dcCode(m[2]);
    if (v) add(v, m.index + m[0].length - m[2].length, m[1]);
  }
  for (const m of body.matchAll(/360-day year,?\s*(?:consisting|composed|comprised|made up)?\s*of (?:twelve 30-day months|12 months of 30 days)|\b30\/360\b|actual number of days[^.]{0,160}?(?:divided by|\/|year of|over a|over)\s*(?:a\s+)?(360|365)(?:-day)?|360-day year and the actual number of days|\bActual\s*\/\s*(360|365|Actual)\b|\(ICMA\)/gi)) {
    if (/assum|discount|present value|Treasury|redemption price/i.test(body.slice(Math.max(0, m.index - 200), m.index))) continue;
    if (/\[\s?\]\s*$/.test(body.slice(Math.max(0, m.index - 6), m.index))) continue;     // an unticked box "[ ] 30/360"
    const v = /30-day|30 days|30\/360/i.test(m[0]) ? '30/360' : /ICMA|Actual\s*\/\s*Actual/i.test(m[0]) ? 'Actual/Actual' : /365/.test(m[0]) ? 'Actual/365' : 'Actual/360';
    add(v, m.index, null);
  }
  if (!found.length) return out;
  const vals = [...new Set(found.map(f => f.value))];
  if (vals.length === 1) { for (const t of tr) out.set(t.seq, found[0]); return out; }
  // Different conventions in one filing: fixed tranches take 30/360 (or the one said of fixed-rate notes), floating ones
  // the Actual convention said of floating-rate notes. Otherwise not read.
  const near = (f, re) => re.test(body.slice(Math.max(0, f.at - 400), f.at + 200));
  for (const t of tr) {
    if (t.rate === 'fixed_to_floating') continue;                // two conventions (fixed then floating period): not read
    const want = t.rate === 'floating' ? found.filter(f => f.value !== '30/360' && near(f, /floating/i)) : found.filter(f => near(f, /fixed/i) || f.value === '30/360');
    const wv = [...new Set(want.map(f => f.value))];
    if (wv.length === 1) out.set(t.seq, want[0]);
  }
  return out;
}
const dcCode = s => (/30\s*\/\s*360|30\/360/i.test(s) ? '30/360' : /Actual\s*\/\s*360|ACT\s*\/\s*360/i.test(s) ? 'Actual/360' : /Actual\s*\/\s*365|ACT\s*\/\s*365/i.test(s) ? 'Actual/365' : /Actual\s*\/\s*Actual|ACT\s*\/\s*ACT/i.test(s) ? 'Actual/Actual' : null);

// ── Parties (spec v2 §4) ─────────────────────────────────────────────────

export function coverBankBlock(text) {
  const c = text.slice(0, 16000);
  const dl = c.search(/(?:expects?|will be ready|ready for delivery)[^.]{0,200}?deliver|ready for delivery|on or about/i);
  const from = dl >= 0 ? dl : 800;
  COVER_HEAD.lastIndex = from;
  const h = COVER_HEAD.exec(c);
  if (!h) return null;
  COVER_END.lastIndex = h.index + h[0].length;
  const e = COVER_END.exec(c);
  const end = Math.min(e ? e.index : h.index + 1500, h.index + 2200);
  return { start: h.index, end };
}

function readParties({ text, family, tr, bankBlock, fwpDocs, issuerHint, supplementEnd = null }) {
  const parties = [], notes = [], states = new Map();
  const dropStats = { dropped: [] };
  let unknown = 0;
  const add = (p) => {
    const dupe = parties.find(x => x.name === p.name && x.role === p.role && x.tranche_seq === p.tranche_seq);
    if (!dupe) parties.push(p);
  };
  const qualifierTranches = q => {
    if (!q || /^all\b/i.test(q)) return [0];
    const years = [...q.matchAll(/\b(20\d\d|19\d\d)\b/g)].map(m => Number(m[1]));
    const fl = /floating/i.test(q);
    const seqs = new Set();
    let ok = true;
    for (const y of years) { const ys = tr.filter(t => t.year === y && (!fl || years.length > 1 || t.rate === 'floating')); if (ys.length === 1) seqs.add(ys[0].seq); else ok = false; }
    if (fl) { const fs = tr.filter(t => t.rate === 'floating'); if (fs.length === 1) seqs.add(fs[0].seq); else if (!years.length) ok = false; }
    return ok && seqs.size ? [...seqs] : null;
  };
  const pushNames = (names, role, printed, part, segAt, doc, f) => {
    for (const n of names) {
      if (!n.known) unknown++;
      const seqs = qualifierTranches(n.qualifier);
      const rp = n.qualifier ? `${printed} (${n.qualifier})`.slice(0, 120) : printed;
      for (const s of seqs || [0]) add({ name: n.name.slice(0, 160), role, role_printed: rp, tranche_seq: s, part, at: segAt + n.at, doc, url: f?.url, acc: f?.accessionNumber, key: n.key });
    }
  };
  let sawBankHeads = new Set(), sawLabels = new Set();

  // 1. Cover block (A).
  if (family === 'A' && bankBlock) {
    const blk = text.slice(bankBlock.start, bankBlock.end);
    const heads = [...blk.matchAll(new RegExp(COVER_HEAD.source, 'g'))];
    for (let i = 0; i < heads.length; i++) {
      const h = heads[i], role = roleOf(h[1], family);
      const segStart = h.index + h[0].length, segEnd = i + 1 < heads.length ? heads[i + 1].index : blk.length;
      const names = splitBankList(blk.slice(segStart, segEnd), dropStats);
      sawBankHeads.add(role);
      pushNames(names, role, h[1].replace(/\s+/g, ' '), 'cover', bankBlock.start + segStart, '424b');
    }
  }
  // 2. Labels (B and C): "Agent:", "Agents:", "Purchasing Agent:", "Joint Lead Managers & Bookrunners:", "Co-Managers:",
  //    and Deere's "Plan of Distribution: Name … " list (role underwriter, spec v2 §4.1).
  if (family !== 'A') {
    const LBL = /(?<![\w'’-])((?:Joint Lead Managers?\s*(?:&|and)\s*(?:Joint\s+)?Bookrunners?|Joint Book[- ]Running Managers?|Book[- ]Running Managers?|Senior Co-Managers?|Junior Co-Managers?|Co-Managers?|Lead Agents?|Purchasing Agents?|Agents?|Underwriters?|Plan of Distribution|Billing and Delivery Agent|Calculation Agent|Exchange Rate Agent|Paying Agent|Registrar|Transfer Agent))\s*:\s*/g;
    const body = text.slice(0, 25000);
    const marks = [...body.matchAll(LBL)].filter(m => !/(?:Rate|Calculation|Paying|Transfer|Delivery|Exchange|Billing and|Fiscal|Authenticating)\s$/.test(body.slice(Math.max(0, m.index - 14), m.index)) || /^(?:Calculation|Exchange|Paying|Billing|Transfer)/.test(m[1]));
    for (let i = 0; i < marks.length; i++) {
      const m = marks[i];
      const printed = m[1].replace(/\s+/g, ' ');
      let role = /Plan of Distribution/.test(printed) ? 'underwriter' : /Billing|Calculation|Exchange Rate|Paying|Registrar|Transfer/.test(printed) ? 'other' : roleOf(printed, family);
      const start = m.index + m[0].length;
      let seg = body.slice(start, Math.min(start + 1600, i + 1 < marks.length ? marks[i + 1].index : Infinity));
      // The list ends at the next term label ("Trustee:", "CUSIP:", "Agent's Capacity:") or at the first sentence after it.
      const stop = seg.search(/\s(?:Trustee|Calculation Agent|Paying Agent|Registrar|Transfer Agent|Exchange Rate Agent|Billing and Delivery Agent|CUSIP(?:\s*(?:Number|No\.)s?)?|ISIN|Common Code|Day Count[\w ]{0,20}|Business Days?[\w ]{0,25}|Specified Currency|(?:Minimum |Authorized )?Denominations?|Redemption[\w ]{0,25}|Repayment[\w ]{0,25}|Interest[\w ]{0,30}|Form of Notes?|Settlement[\w ()]{0,30}|(?:Initial )?Trade Date|Other Terms|Original Issue[\w ]{0,20}|Issue Price|Net Proceeds[\w ]{0,20}|Plan of Distribution|Use of Proceeds[\w ]{0,20}|[A-Z][\w.]*['’]s\s+(?:Discount|Capacity|Commission)[\w ]{0,30}|Agents?['’]s?\s+(?:Discount|Capacity|Commission)[\w ]{0,30}|Joint Lead Managers?[\w &]{0,30}|(?:Senior |Junior )?Co-Managers?|Lead Agents?|Purchasing Agents?|Agents?|Underwriters?|RISK FACTORS)\s*\*?:|\s(?:The above Agents?|Total\s+\$|Except for|If the maturity|RISK FACTORS|Notes offered|The Agents?|Dealers purchasing|We may|In the opinion|Legal Matters|SUPPLEMENTAL PLAN|PLAN OF DISTRIBUTION|It is expected|Under Rule|The Notes|The notes)\b/);
      if (stop >= 0) seg = seg.slice(0, stop);
      if (role === 'underwriter') seg = seg.replace(/^Name\s+Principal Amount\s+(?:Of|of)\s+Notes\s+/, m2 => ' '.repeat(m2.length));
      const clean = seg.replace(/\(\s*\d+(?:\.\d+)?\s*%\s*\)/g, s => ' '.repeat(s.length)).replace(/\$\s?[\d,]+(?:\.\d+)?/g, s => ' '.repeat(s.length))
        .replace(/\(["“][^)]{1,40}["”]\)/g, s => ' '.repeat(s.length)).replace(/-\s\d\s-/g, '     ');
      if (role === 'other') {
        // One entity per label: a trustee-list institution, else the text up to its legal-form suffix.
        const ti = TRUSTEES.map(([, re]) => re.exec(clean)).filter(Boolean).sort((x, y) => x.index - y.index)[0];
        const lm = new RegExp(`^\\s*([A-Z][^:;]{1,80}?,?\\s(?:${LEGAL_WORDS}))(?![\\w])`).exec(clean);
        const nm = ti && ti.index < 5 ? { name: ti[0].replace(/\s+/g, ' ').trim(), at: ti.index } : lm ? { name: lm[1].trim(), at: lm.index + lm[0].indexOf(lm[1]) } : null;
        if (nm && nameLike(nm.name)) {
          const k = bankKey(nm.name);
          if (!parties.some(p => (p.key && p.key === k && INTERMEDIARY.has(p.role)) || p.name === nm.name)) pushNames([{ ...nm, qualifier: null, key: k, known: true }], role, printed, family === 'C' ? 'retail table' : 'pricing terms', start, '424b');
        }
        continue;
      }
      const names = splitBankList(clean, dropStats).filter(n => !trusteeKey(n.name));
      sawLabels.add(role);
      pushNames(names, role, printed, family === 'C' ? 'retail table' : 'pricing terms', start, '424b');
    }
  }
  // 3. Underwriting section (A): banks named there with a legal-form suffix and not already on the cover → underwriter.
  if (family === 'A') {
    const uw = underwritingTable(text, bankBlock ? bankBlock.end : 0);
    if (uw) {
      const have = new Set(parties.map(p => p.key).filter(Boolean));
      const haveNames = parties.map(p => fold(p.name).toLowerCase().replace(/[.,]/g, ''));
      for (const n of splitBankList(uw.seg, dropStats)) {
        if (!/(?:LLC|L\.L\.C\.|Inc\.|INC\.|L\.P\.|Ltd\.|Limited|plc|PLC|Corp\.|Corporation|N\.A\.|AG|GmbH|Incorporated)$/.test(n.name) && !n.known) continue;
        if (n.key && have.has(n.key)) continue;
        const f = fold(n.name).toLowerCase().replace(/[.,]/g, '');
        if (haveNames.some(h => f.startsWith(h) || h.startsWith(f))) continue;
        if (trusteeKey(n.name)) continue;
        if (!n.known) unknown++;
        add({ name: n.name, role: 'underwriter', role_printed: 'Underwriter', tranche_seq: 0, part: 'underwriting', at: uw.at + n.at, doc: '424b', key: n.key, heading: uw.heading });
        if (n.key) have.add(n.key);
      }
    }
  }
  // 4. Same-deal term sheet: only when the 424B has no bank block or label.
  if (!parties.some(p => INTERMEDIARY.has(p.role))) {
    for (const f of fwpDocs) {
      const r = readParties({ text: f.text, family: 'B', tr, bankBlock: null, fwpDocs: [], issuerHint });
      const banks = r.parties.filter(p => INTERMEDIARY.has(p.role));
      if (!banks.length) continue;
      for (const p of banks) add({ ...p, doc: 'fwp', url: f.url, acc: f.accessionNumber, part: 'term sheet' });
      unknown += r.unknown;
      notes.push(`banks from term sheet ${f.accessionNumber}`);
      break;
    }
  }

  // Trustee: from the closed list, within a sentence that says "as trustee" (or a "Trustee:" label). D9: two or more
  // trustee institutions → only the one stated as successor; else not read.
  const tz = trustees(text, supplementEnd);
  if (tz.length === 1 || tz.current) {
    const t = tz.current || tz[0];
    add({ name: t.name, role: 'trustee', role_printed: t.printed, tranche_seq: 0, part: partForTrustee(family, t.at, bankBlock), at: t.at, doc: '424b' });
    states.set('trustee', 'disclosed');
  } else if (tz.baseOnly) notes.push('trustee: named only in the accompanying base prospectus → not read');
  else if (!tz.length) states.set('trustee', 'not_disclosed');
  else notes.push(`trustee: ${tz.length} trustee institutions named, none stated as the current trustee (D9) → not read`);

  // Guarantor (#2): the guarantee phrase on the cover, or a "Guarantor:" label.
  const g = guarantor(text);
  if (g?.phrase) notes.push('guarantor: a guarantee is stated on the cover but the guarantor is not named there → not read');
  else if (g) { add({ name: g.name, role: 'guarantor', role_printed: g.printed, tranche_seq: 0, part: family === 'A' ? 'cover' : family === 'C' ? 'retail table' : 'pricing terms', at: g.at, doc: '424b' }); states.set('guarantor', 'disclosed'); }
  if (!g) states.set('guarantor', 'not_disclosed');

  // Role-group states (spec v2 §4.3).
  const has = role => parties.some(p => p.role === role);
  const agentNamed = has('agent');
  const bookBlock = sawBankHeads.has('bookrunner');
  for (const role of ['bookrunner', 'co_manager', 'underwriter', 'agent', 'other']) {
    if (has(role)) { states.set(role, 'disclosed'); continue; }
    if (family !== 'A' && agentNamed && (role === 'bookrunner' || role === 'co_manager')) states.set(role, 'not_applicable');
    else if (family === 'A' && bookBlock && role === 'agent') states.set(role, 'not_applicable');
    else if (family === 'A' && bookBlock && role === 'co_manager') states.set(role, 'not_disclosed');
    else if (role === 'underwriter' && parties.some(p => INTERMEDIARY.has(p.role))) states.set(role, 'not_applicable');
  }

  // BOND-11: a trustee or guarantor is never also a selling bank in the same filing; no intermediary is a trustee institution.
  const norm = s => fold(s).toLowerCase().replace(/[.,'’]/g, '').replace(/\s+/g, ' ').trim();
  const protectors = parties.filter(p => p.role === 'trustee' || p.role === 'guarantor').map(p => norm(p.name));
  const issuers = (issuerHint || []).map(norm);
  let clash = null;
  for (const p of parties.filter(p => INTERMEDIARY.has(p.role))) {
    if (protectors.includes(norm(p.name))) { clash = `${p.name} is both ${p.role} and trustee/guarantor`; break; }
    if (trusteeKey(p.name)) { clash = `${p.name} (a trustee institution) read as ${p.role}`; break; }
    if (issuers.includes(norm(p.name))) { clash = `${p.name} (the issuer) read as ${p.role}`; break; }
  }
  for (const p of parties) if (p.tranche_seq && !tr.some(t => t.seq === p.tranche_seq)) { clash = `tranche ${p.tranche_seq} does not exist`; break; }
  if (dropStats.dropped.length) notes.push(`bank lists: ${dropStats.dropped.length} text run(s) not read as names`);
  return { parties, states, notes, unknown, clash, dropped: dropStats.dropped };
}

function partForTrustee(family, at, bankBlock) { return family === 'B' ? 'pricing terms' : family === 'C' ? 'retail table' : at < (bankBlock?.end ?? 0) ? 'cover' : 'description of the notes'; }

function trustees(text, supplementEnd = null) {
  // Each "as trustee" statement names the institution printed just before it (within 260 characters, after any
  // "formerly known as …" / "(\"BONY\")" between them). A "Trustee:" label names the institution after it.
  const found = [];
  const inst = (win, base) => {
    let best = null;
    for (const [key, tre] of TRUSTEES) for (const tm of win.matchAll(new RegExp(tre.source, 'g'))) if (!best || tm.index > best.at - base) best = { key, name: tm[0].replace(/\s+/g, ' ').trim(), at: base + tm.index };
    return best;
  };
  for (const m of text.matchAll(/\b(?:as|its)\s+(successor\s+)?(?:indenture\s+)?trustee\b|,\s*(?:as\s+)?(successor\s+)trustee\b/gi)) {
    const from = Math.max(0, m.index - 260);
    let win = text.slice(from, m.index);
    const prior = win.search(/\b(?:as|its)\s+(?:successor\s+)?(?:indenture\s+)?trustee\b(?![\s\S]*\b(?:as|its)\s+(?:successor\s+)?(?:indenture\s+)?trustee\b)/i);
    const cut = prior >= 0 ? prior + 10 : 0;
    const hit = inst(win.slice(cut), from + cut);
    if (hit) found.push({ ...hit, printed: m[1] || m[2] ? 'Successor trustee' : 'Trustee', successor: !!(m[1] || m[2]) });
  }
  // "Trustee:" labels, and summary-table rows printed without a colon ("Trustee Computershare Trust Company, …").
  for (const m of text.matchAll(/(?<![\w-])(Trustee(?:,\s*Registrar(?:,)?\s*(?:and\s+)?Paying Agent)?)\s*:?\s+(?=(?:The\s+Bank|U\.\s?S\.|Computershare|Deutsche|Wells|Citibank|Regions|Truist|HSBC)|\S)/g)) {
    if (!/:/.test(m[0]) && !/^\s*(?:The\s+Bank of New York|U\.\s?S\.\s?Bank|Computershare|Deutsche Bank Trust|Wells Fargo Bank|Citibank|Regions Bank|Truist Bank|HSBC Bank USA)/.test(text.slice(m.index + m[0].length - 1, m.index + m[0].length + 40))) continue;
    const hit = inst(text.slice(m.index + m[0].length, m.index + m[0].length + 120), m.index + m[0].length);
    if (hit && hit.at - (m.index + m[0].length) < 10) found.push({ ...hit, printed: m[1].replace(/\s+/g, ' '), successor: false });
  }
  const merge = list => {
    const byKey = new Map();
    for (const f of list) { const k = f.key === 'bnym' ? 'bnymtc' : f.key === 'usbna' ? 'usbtc' : f.key; if (!byKey.has(k) || (byKey.get(k).key !== k && f.key === k)) byKey.set(k, { ...f, successor: f.successor || byKey.get(k)?.successor }); else if (f.successor) byKey.get(k).successor = true; }
    // "The Bank of New York Mellon" and "… Trust Company, N.A." (or U.S. Bank N.A. and … Trust Company) are one trustee only when both are named.
    if (byKey.has('bnymtc') && !list.some(f => f.key === 'bnymtc')) byKey.get('bnymtc').key = 'bnym';
    if (byKey.has('usbtc') && !list.some(f => f.key === 'usbtc')) byKey.get('usbtc').key = 'usbna';
    return [...byKey.values()];
  };
  let out = merge(found);
  if (supplementEnd && out.length) {
    // A prospectus supplement (printed S-pages): only its own statements about these notes count. The accompanying base
    // prospectus names trustees of other indentures ("NEE … between NEE and …, as trustee"), so a trustee named only there
    // is not read (out.baseOnly).
    const sup = merge(found.filter(f => f.at < supplementEnd));
    if (sup.length === 1) { const r = [sup[0]]; r.current = sup[0]; r.all = out.length; return r; }
    if (!sup.length) { const r = []; r.baseOnly = out.length; return r; }
    out = sup;
  }
  const succ = out.filter(t => t.successor);
  if (out.length > 1 && succ.length === 1) out.current = succ[0];
  return out;
}

function guarantor(text) {
  // Returns { name, at, printed } · { phrase: true } (a guarantee is stated but its guarantor is not named here) · null.
  const head = text.slice(0, 9000);
  const NAME = "((?:The\\s+)?[A-Z][\\w.&'’-]*(?:\\s+(?:[A-Z][\\w.&'’-]*|&|of|and|de))*?,?\\s(?:Inc\\.|Corporation|Company|N\\.V\\.|B\\.V\\.|plc|PLC|LLC|L\\.P\\.|Ltd\\.|Limited|AG|S\\.A\\.|Co\\.))";
  const SHORT = "([A-Z][\\w&'’-]+(?:\\s+[A-Z][\\w&'’-]+){0,3})(?=\\s*[.,;(]|\\s+(?:and|The|the|on|as)\\b)";
  const PHRASE = "(?:(?:Fully\\s+and\\s+)?(?:Unconditionally|Irrevocably)(?:\\s+and\\s+(?:Unconditionally|Irrevocably))?\\s+)?Guaranteed(?:\\s+on\\s+a\\s+(?:senior|subordinated|junior subordinated)\\s+(?:unsecured\\s+)?basis)?\\s+(?:as\\s+to\\s+[^.]{0,60}?\\s+)?by";
  const not = s => /Federal Deposit Insurance|FDIC|governmental|government agency|any other/i.test(s);
  let m = new RegExp(`${PHRASE}\\s+${NAME}`, 'i').exec(head) || new RegExp(`(?<![\\w-])Guarantor\\s*:\\s*${NAME}`).exec(head);
  if (m && !not(m[1])) return { name: m[1].replace(/\s+/g, ' ').trim(), at: m.index + m[0].lastIndexOf(m[1]), printed: /Guarantor\s*:/.test(m[0]) ? 'Guarantor' : 'Guaranteed by' };
  m = new RegExp(`${PHRASE}\\s+${SHORT}`, 'i').exec(head);
  if (m && !not(m[1]) && !/^(?:Us|Our|We|Each|Certain|Any|All|One|Its|Their)\b/i.test(m[1])) return { name: m[1].trim(), at: m.index + m[0].lastIndexOf(m[1]), printed: 'Guaranteed by' };
  const ph = new RegExp(PHRASE, 'gi');
  for (const x of head.matchAll(ph)) if (!not(head.slice(x.index, x.index + 160))) return { phrase: true };
  return null;
}

function underwritingTable(text, from) {
  const re = /(?<![\w-])(Underwriters?|UNDERWRITERS?|Name)\s+(?:Principal Amount|Aggregate Principal Amount)/g;
  re.lastIndex = Math.max(from, 0);
  const m = re.exec(text);
  if (!m) return null;
  const start = m.index + m[0].length;
  const tail = text.slice(start, start + 4000);
  const end = tail.search(/\bTotal\b/);
  if (end < 0) return null;
  const seg = tail.slice(0, end).replace(/\$\s?[\d,]+(?:\.\d+)?|€\s?[\d,]+(?:\.\d+)?|£\s?[\d,]+(?:\.\d+)?|of\s+(?:the\s+)?(?:\d{4}\s+)?(?:[\w-]+\s+){0,4}Notes|\b20\d\d\s+Notes\b|Floating Rate Notes|Fixed Rate Notes|Notes\b|\b\d{1,3}(?:,\d{3})+\b/g, s => ' '.repeat(s.length));
  return { seg, at: start, heading: 'Underwriting' };
}

// Table-of-contents headings for filings without anchors: "USE OF PROCEEDS S-11" → the heading's first later position.
function tocHeadings(text) {
  const t = text.search(/TABLE OF CONTENTS|Table of Contents/);
  if (t < 0) return [];
  const toc = text.slice(t, t + 4000);
  const heads = [...toc.matchAll(/([A-Z][A-Z,.'’&\- ]{3,79}?)\s+(?:S|PS)-\s?(?:\d{1,3}|[ivx]{1,5})(?=\s)/g)].map(m => m[1].trim()).filter(h => h.length > 3 && !/^PAGE$/.test(h));
  const out = [];
  let after = t + 600;
  for (const h of [...new Set(heads)]) {
    const i = text.indexOf(h, t + toc.length * 0.25 > after ? after : t + 1);
    const j = text.indexOf(h, t + 4000);
    const at = j >= 0 ? j : i;
    if (at > t) out.push({ heading: h.slice(0, 80), at });
  }
  return out.sort((a, b) => a.at - b.at);
}

// ── §6.1 check against the stored bond_issuance rows (run with a read-only SELECT of D1) ──

export function checkAgainstIssuance(facts, issuanceRows) {
  const byKey = new Map(issuanceRows.map(r => [`${r.accession_number}|${r.tranche_seq}`, r]));
  const out = [];
  for (const f of facts) {
    if (!['amount', 'currency', 'interest_rate', 'maturity'].includes(f.field)) continue;
    const r = byKey.get(`${f.accession_number}|${f.tranche_seq}`);
    if (!r) { out.push({ ...pick(f), check: 'issuance', detail: 'no bond_issuance row' }); continue; }
    const eq = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(Number(a) - Number(b)) < 1e-6);
    const bad = f.field === 'amount' ? !eq(f.value_num, r.principal_amount) : f.field === 'currency' ? f.value_text !== r.currency
      : f.field === 'maturity' ? f.value_date !== r.maturity_date : r.rate_type === 'floating' || r.coupon_rate == null ? !eq(f.value_num, r.spread_bps) : !eq(f.value_num, r.coupon_rate);
    if (bad) out.push({ ...pick(f), check: 'issuance', detail: `${f.field}: offering ${f.value_num ?? f.value_text ?? f.value_date} vs bond_issuance ${f.field === 'amount' ? r.principal_amount : f.field === 'currency' ? r.currency : f.field === 'maturity' ? r.maturity_date : (r.coupon_rate ?? r.spread_bps)}` });
  }
  return out;
}
const pick = f => ({ accession_number: f.accession_number, field: f.field, tranche_seq: f.tranche_seq });
