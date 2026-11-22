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
//   • Fields 14–28 (MA-NOV-BOND.OFFER2): ranking, secured, early repayment, change-of-control buy-back, special mandatory
//     redemption, survivor's option, use of proceeds (closed list of categories), bank fee, proceeds % and total, risks,
//     selling restrictions, conflicts of interest, listing. Risks, selling restrictions and conflicts are a section link with
//     a one-line heading only (§8). Fields 23–24 (banks, trustee) are the parties below.

import { htmlToText, toIsoDate, findIdentifiers, cusipValid, isinValid, couponRe } from './bonds-parse.mjs';

export const OFFERING_VERSION = 'bonds-offering-1.1.0';   // 1.1.0: OFFER2 fields 14–28 · 1.0.0: OFFER1 fields 1–13 + parties

export const FACT_COLS = ['accession_number', 'tranche_seq', 'field', 'state', 'value_text', 'value_num', 'value_date', 'source_doc',
  'source_url', 'source_part', 'source_heading', 'source_anchor', 'source_page', 'char_offset', 'parser_version', 'ingested_at'];
export const PARTY_COLS = ['accession_number', 'party_seq', 'tranche_seq', 'party_name', 'role', 'role_printed', 'source_doc',
  'source_url', 'source_part', 'source_page', 'parser_version', 'ingested_at'];

// Field closed list for OFFER1 (spec v2 §3 #2–13; #2 is the guarantor party). O = offering level, T = per tranche.
export const FIELDS = Object.freeze({
  document_date: 'O', identifier: 'T', amount: 'T', currency: 'T', interest_rate: 'T', maturity: 'T',
  issue_price_pct: 'T', interest_paid: 'T', day_count: 'T', priced_on: 'O', issue_date: 'O',
  // OFFER2 (#14–22, #25–28)
  ranking: 'T', secured: 'T', early_repayment: 'T', change_of_control: 'O', special_mandatory_redemption: 'T', survivors_option: 'T',
  use_of_proceeds: 'O', bank_fee_pct: 'T', proceeds_pct: 'T', proceeds_amount: 'T', proceeds_total: 'O',
  risk_factors: 'O', selling_restrictions: 'O', conflicts_of_interest: 'O', listing: 'O'
});
// Use-of-proceeds categories (spec v2 §3 #20): a closed list, never the filing's wording.
export const PROCEEDS_CATEGORIES = Object.freeze(['general corporate purposes', 'repay or refinance debt', 'fund an acquisition', 'working capital',
  'capital spending', 'share buybacks', 'eligible green or social projects', 'other']);
export const ROLES = Object.freeze(['bookrunner', 'co_manager', 'underwriter', 'agent', 'trustee', 'guarantor', 'other']);
export const INTERMEDIARY = new Set(['bookrunner', 'co_manager', 'underwriter', 'agent']);
export const SOURCE_PARTS = Object.freeze(['cover', 'cover table', 'summary', 'description of the notes', 'optional redemption',
  'use of proceeds', 'underwriting', 'pricing terms', 'retail table', 'term sheet', 'risk factors']);
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
    if (!p || p.value == null) continue;
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

  // Fields 14–28 (OFFER2).
  part2({ text, family, tr, single, rows, coverEnd, supEnd: supplementEnd ?? text.length, anchors, docDate, prices, src, put, absent, fail, notes,
    pageAt, priceKept: new Set(facts.filter(f => f.field === 'issue_price_pct').map(f => f.tranche_seq)) });
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
const CUR = { '$': 'USD', 'US$': 'USD', 'C$': 'CAD', '€': 'EUR', '£': 'GBP' };
const FEE_LABEL = "(?:Agent(?:s|['’]s|s['’])?\\s+(?:Discount or Commission|Discounts? and Commissions?|Commission|Discount)|Dealer(?:s|['’]s|s['’])?\\s+(?:Commission|Discount)|Underwriting (?:Discount|Commission)|Selling Concession)";
const PROC_LABEL = '(?:Net Proceeds to (?:the )?(?:Issuer|Company)|Proceeds to (?:the )?(?:Issuer|Company)|All-in-price|All-in Price)';
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
      const m = new RegExp(`\\b${t.row.cusip}\\s+(?:\\$\\s?[\\d,]+(?:\\.\\d+)?\\s+)?(\\d{1,3}(?:\\.\\d{1,6})?)\\s?%\\s+(\\d{1,2}(?:\\.\\d{1,6})?)\\s?%(?:\\s+\\$\\s?([\\d,]+(?:\\.\\d+)?))?`).exec(text.slice(0, 30000));
      if (m) {
        const pAt = m.index + m[0].indexOf(m[1] + (m[0].includes(m[1] + ' %') ? ' %' : '%'));
        const fAt = m.index + m[0].indexOf(m[2], pAt - m.index + m[1].length);
        out.set(t.seq, { value: Number(m[1]), at: pAt, part: 'retail table', heading: 'Selling Price',
          fee: { v: Number(m[2]), at: fAt, heading: 'Gross Concession' },
          amount: m[3] ? { v: Number(m[3].replace(/,/g, '')), at: m.index + m[0].lastIndexOf(m[3]), cur: t.row.currency || 'USD', heading: 'Net Proceeds' } : null });
      }
    }
    return out;
  }
  if (family === 'B') {
    if (!single) return out;
    const head = text.slice(0, 25000);
    const p = termPct(head, PRICE_LABEL);
    const fee = termPct(head, FEE_LABEL);
    let proc = termPct(head, PROC_LABEL);
    if (!proc) {                                                     // Deere: "The above Agents have severally agreed to purchase … at a price of 99.739%"
      const d = /agreed to purchase[^.]{0,160}?at a price of\s+(\d{1,3}(?:\.\d{1,6})?)\s?%/i.exec(head);
      if (d) proc = { value: Number(d[1]), at: d.index + d[0].lastIndexOf(d[1]), label: 'Plan of Distribution' };
    }
    const am = new RegExp(`(?<![\\w-])(${PROC_LABEL})\\s*:\\s*(US\\$|C\\$|\\$|€|£)\\s?([\\d,]+(?:\\.\\d+)?)(?!\\s?%)`, 'i').exec(head);
    const e = { fee: fee && { v: fee.value, at: fee.at, heading: fee.label }, proceeds: proc && { v: proc.value, at: proc.at, heading: proc.label },
      total: am ? { v: Number(am[3].replace(/,/g, '')), at: am.index + am[0].lastIndexOf(am[3]), cur: CUR[am[2]] || null, heading: am[1] } : null };
    out.set(tr[0].seq, p ? { value: p.value, at: p.at, part: 'pricing terms', heading: p.label, ...e } : { value: null, ...e });
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
    // "Total $ 2,989,487,500 $ 14,000,000 $ 2,975,487,500": one amount per metric, in header order. One Total row for the deal, or one
    // after each tranche's "Per … Note" row (Union Pacific, Amazon): then each is that tranche's total and there is no deal total.
    const TOT = new RegExp(`\\b(Combined\\s+)?Totals?\\s+((?:(?:US\\$|C\\$|\\$|€|£)\\s?[\\d,]+(?:\\.\\d+)?\\s*){${k}})(?![\\d%])`, 'gi');
    const tots = [...region.slice(lastHdr).matchAll(TOT)].map(tm => {
      const amts = [...tm[2].matchAll(/(US\$|C\$|\$|€|£)\s?([\d,]+(?:\.\d+)?)/g)];
      const j = metrics.findIndex(x => x[0] === 'proceeds');
      if (j < 0 || amts.length !== k) return null;
      return { v: Number(amts[j][2].replace(/,/g, '')), at: abs(lastHdr + tm.index + tm[0].indexOf(amts[j][0]) + amts[j][0].indexOf(amts[j][2])), cur: CUR[amts[j][1]] || null, heading: 'Cover page', combined: !!tm[1], rel: lastHdr + tm.index };
    }).filter(Boolean);
    if (tots.length > 1 && tots.length === rowsOut.length && !tots.some(t => t.combined)) rowsOut.forEach((r, i) => { r.total = tots[i]; });
    else if (tots.length === 1 && rowsOut.length > 1) out.total = tots[0];
    else if (tots.some(t => t.combined)) out.total = tots.find(t => t.combined);
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
    // The amount printed right after a % in the same table cell row is that tranche's total for the metric ("99.704 % $ 498,520,000").
    const amtAfter = x => { if (!x) return null; const m = /^\s?%?\s*(US\$|C\$|\$|€|£)\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?)/.exec(region.slice(x.at).replace(/^\d{1,3}(?:\.\d{1,6})?/, '')); return m ? { v: Number(m[2].replace(/,/g, '')), at: abs(x.at) + region.slice(x.at).indexOf(m[2]), cur: CUR[m[1]] || null } : null; };
    out.set(seq, { value: price.v, at: abs(price.at), part: 'cover table', heading: 'Cover page',
      fee: fee ? { v: fee.v, at: abs(fee.at), heading: 'Cover page' } : null, proceeds: proceeds ? { v: proceeds.v, at: abs(proceeds.at), heading: 'Cover page' } : null,
      amount: (proceeds ? amtAfter(proceeds) : null) || r.total || null });
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

// ── OFFER2: fields 14–22 and 25–28 (spec v2 §3.4–3.6) ───────────────────
// Every reader returns a short value and the position it was read at; part2() turns them into rows with their source (§5)
// and runs the §6.1 checks. On a prospectus supplement (A) only the supplement's own pages are read (up to its last printed
// S-page): the accompanying base prospectus describes debt securities in general, not these notes.

const DATE_G = new RegExp(DATE, 'g');
const monthsBefore = (d, m) => (Date.parse(m) - Date.parse(d)) / (30.44 * 86400000);
const sentenceAt = (text, at, max = 700) => {
  const a = Math.max(0, text.lastIndexOf('. ', at) + 2, at - max);
  let b = text.indexOf('. ', at); if (b < 0 || b - at > max) b = Math.min(text.length, at + max);
  return { s: text.slice(a, b + 1), at: a };
};
// "the fixed rate notes", "the floating rate notes", "each series of notes" → tranche seqs (as interestPaid's classOf).
function classTranches(cl, tr) {
  if (/\beach series of (?:the )?notes\b|\ball (?:series of )?(?:the )?notes\b/i.test(cl)) return tr.map(t => t.seq);
  if (/\bfixed rate notes\b/i.test(cl) && !/fixed[- ]to[- ]floating/i.test(cl)) return tr.filter(t => t.rate === 'fixed').map(t => t.seq);
  if (/(?<!to[- ])\bfloating rate notes\b/i.test(cl) && !/\b(?:19|20)\d\d\s+floating/i.test(cl)) return tr.filter(t => t.rate === 'floating').map(t => t.seq);
  return [];
}
const scopeOf = (seg, tr) => { const n = namedTranches(seg, tr); return n.size ? [...n] : classTranches(seg, tr); };

// A printed section heading after the cover: the filing's own anchor (from its table of contents), else the heading printed in
// capitals, else in title case. A cross-reference ("See “Use of Proceeds”") is not a heading.
function findHeading(text, { anchors, from, to, caps, title, anchorRe }) {
  // An anchor marks the top of a page, which can hold two sections ("Risk Factors" and "Use of Proceeds" on S-8): it is used only
  // when its heading is printed within 1,500 characters after it, and the position is the printed heading.
  for (const a of anchors.filter(x => x.at >= from && x.at < to && anchorRe && anchorRe.test(x.heading))) {
    const k = text.slice(a.at, a.at + 1500).search(new RegExp(esc(a.heading).replace(/ /g, '\\s+'), 'i'));
    if (k >= 0) return { at: a.at + k, heading: a.heading, anchor: a.name };
  }
  for (const re of [caps, title].filter(Boolean)) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    g.lastIndex = from;
    let m;
    while ((m = g.exec(text)) && m.index < to) {
      if (/[“"'‘]\s*$|\bsee\s*$|\bunder\s*$|\bin\s*$|—\s*$/i.test(text.slice(Math.max(0, m.index - 12), m.index))) continue;
      if (/^\s*[”"’]/.test(text.slice(m.index + m[0].length, m.index + m[0].length + 3))) continue;
      if (/^\s+(?:(?:S-|PS-|page)\s?\d|\d{1,3}\s|[ivx]{1,4}\s)/.test(text.slice(m.index + m[0].length, m.index + m[0].length + 10))) continue;   // a contents line
      return { at: m.index, heading: m[0].replace(/\s+/g, ' ').trim().slice(0, 80), anchor: null };
    }
  }
  return null;
}
const sectionText = (text, at, max = 3000) => {
  const t = text.slice(at, at + max);
  const k = t.slice(40).search(/\s(?:[A-Z][A-Z,'’&()-]+\s){2,}[A-Z]/);                 // the next heading in capitals
  return k >= 0 ? t.slice(0, k + 40) : t;
};

function rankingSecurity({ text, family, tr, supEnd }) {
  const rank = new Map(), sec = new Map();
  const rk = q => (/junior\s+subordinated/i.test(q) ? 'Junior subordinated' : /(?<!un)subordinated/i.test(q) ? 'Subordinated' : /senior|unsubordinated/i.test(q) ? 'Senior' : null);
  const sc = q => (/\bunsecured\b/i.test(q) ? 'unsecured' : /\bsecured\b/i.test(q) ? 'secured' : null);
  if (family === 'C') {
    for (const t of tr) {
      if (!t.row.cusip) continue;
      const i = text.indexOf(t.row.cusip); if (i < 0) continue;
      const row = text.slice(i, i + 400).split(/\b[0-9]{3}[0-9A-Z]{5}[0-9]\b/)[1] ?? text.slice(i + 9, i + 400);
      const m = /\b(Junior Subordinated|Subordinated|Senior)\s+(Unsecured|Secured)\s+Notes\b/.exec(text.slice(i, i + 400));
      if (m) { const at = i + m.index; rank.set(t.seq, { v: rk(m[1]), at, heading: 'Product Ranking' }); sec.set(t.seq, { v: sc(m[2]), at: at + m[0].indexOf(m[2]), heading: 'Product Ranking' }); }
      void row;
    }
    return { rank, sec };
  }
  // The title on the cover: "4.500% Fixed Rate Senior Notes Due …", "Junior Subordinated Debentures, Series 2025A".
  const head = text.slice(0, Math.min(family === 'B' ? 2500 : 3500, supEnd));
  const titles = [...head.matchAll(/\b(Junior Subordinated|Subordinated|Senior)\s+(?:Unsecured\s+)?(?:(?:Medium-Term|Fixed Rate|Floating Rate|Reset)\s+)*(?:Notes|Debentures|Securities)\b/g)];
  const kinds = [...new Set(titles.map(m => rk(m[1])))];
  if (kinds.length === 1) for (const t of tr) rank.set(t.seq, { v: kinds[0], at: titles[0].index, heading: 'Cover page', part: 'cover' });
  else if (kinds.length > 1) for (const m of titles) for (const seq of namedTranches(head.slice(Math.max(0, m.index - 120), m.index + m[0].length + 60), tr)) if (!rank.has(seq)) rank.set(seq, { v: rk(m[1]), at: m.index, heading: 'Cover page', part: 'cover' });
  if (family === 'B') return { rank, sec };
  // "The notes will be our senior unsecured obligations …" — the words between "will be" and "obligations" only.
  // Also "are direct, unsecured and unsubordinated obligations", "will be Verizon Communications Inc.’s general unsecured subordinated
  // obligations", and "are unsecured and unsubordinated and rank equally …" (no noun).
  const QUAL = /\b(?:(?:will|shall)\s+(?:be|constitute|rank as)|are|constitute)\s+(?:(?:[A-Z][\w.&’',-]*\s+){0,4}[A-Z][\w.&]*[’']s\s+)?((?:(?:our|its|the|direct|general|senior|subordinated|junior|unsecured|secured|unsubordinated|and|,)\s*)+)(?:(?:obligations|debt|indebtedness|securities)\b|(?<=\b(?:unsubordinated|subordinated|unsecured|secured)\s)(?=and\s+(?:will\s+)?rank))/gi;
  for (const m of text.slice(0, supEnd).matchAll(QUAL)) {
    const q = m[1];
    if (!rk(q) && !sc(q)) continue;
    const subj = text.slice(Math.max(0, m.index - 160), m.index);
    const subjS = subj.slice(subj.lastIndexOf('. ') + 1);
    if (/guarantee|guarantor|subsidiar|debt securities|preferred|common stock|units?\b/i.test(subjS) && !/\bnotes?\b|debentures/i.test(subjS)) continue;
    let scope = scopeOf(subjS, tr);
    if (!scope.length) { if (!/\b(?:notes|debentures|bonds|securities)\b/i.test(subjS)) continue; scope = tr.map(t => t.seq); }
    for (const seq of scope) {
      if (rk(q) && !rank.has(seq)) rank.set(seq, { v: rk(q), at: m.index + m[0].indexOf(q) });
      if (sc(q) && !sec.has(seq)) sec.set(seq, { v: sc(q), at: m.index + m[0].indexOf(q) });
    }
  }
  return { rank, sec };
}

function earlyRepayment({ text, family, tr, single, supEnd, coverEnd, docDate }) {
  const out = new Map();
  const iso = s => isoOf(s);
  if (family === 'C') {
    for (const t of tr) {
      if (!t.row.cusip) continue;
      const i = text.indexOf(t.row.cusip); if (i < 0) continue;
      const nx = text.slice(i + 9, i + 1500).search(/\b[0-9]{3}[0-9A-Z]{5}[0-9]\b|Offering Dates?:/);
      const row = text.slice(i, nx >= 0 ? i + 9 + nx : i + 1500);
      const m = /Redemption Information:\s*(Non[- ]?Callable|None|Callable at (\d{1,3}(?:\.\d+)?)%\s+on\s+(\d{1,2}\/\d{1,2}\/\d{4}))/i.exec(row);
      if (!m) continue;
      const at = i + m.index + m[0].indexOf(m[1]);
      if (!m[2]) out.set(t.seq, { value: { can: 'no' }, at, heading: 'Redemption Information' });
      else out.set(t.seq, { value: { can: 'yes', from: toIsoDate(m[3]), price: Number(m[2]) === 100 ? 'par' : `${m[2]}%` }, at, heading: 'Redemption Information' });
    }
    return out;
  }
  const body = family === 'B' ? text.slice(0, 25000) : text.slice(0, supEnd);
  const tax = /Redemption\s+(?:Upon|for|Due to|in the Event of|on the Occurrence of)\s+(?:a\s+|Certain\s+)?(?:Tax|Changes? in Tax)|Tax Redemption|redeem[^.]{0,160}(?:changes? in (?:U\.S\. )?tax|tax laws?|taxing jurisdiction|Additional Amounts)/i.test(body);
  // Par-call dates: a date shortly before a tranche's maturity, printed next to "Par Call Date" (or "on or after <date> … 100%").
  const par = new Map();
  const anchorsPC = [...body.matchAll(/[Pp]ar [Cc]all [Dd]ate|on or after\s+(?:the\s+)?(?=(?:January|February|March|April|May|June|July|August|September|October|November|December))/g)];
  for (const a of anchorsPC) {
    const w0 = Math.max(0, a.index - 900), w = body.slice(w0, a.index + 1100);
    for (const d of w.matchAll(DATE_G)) {
      const dIso = iso(d[0]); if (!dIso || (docDate && dIso <= docDate.iso)) continue;
      let cand = tr.filter(t => t.row.maturity_date && dIso < t.row.maturity_date && monthsBefore(dIso, t.row.maturity_date) <= 12.5);
      if (/on or after/.test(a[0]) && !/100%/.test(body.slice(a.index, a.index + 500))) continue;
      if (cand.length > 1) {
        const near = body.slice(w0 + d.index - 140, w0 + d.index + d[0].length + 160);
        const nm = scopeOf(near, tr);
        cand = cand.filter(t => nm.includes(t.seq));
      }
      if (cand.length !== 1) continue;
      const s0 = cand[0].seq;
      // Fixed-to-floating notes print two par dates (the reset date and 30 days before maturity): the earlier is "from".
      if (!par.has(s0) || dIso < par.get(s0).iso) par.set(s0, { iso: dIso, at: w0 + d.index });
    }
  }
  if (family === 'B') {
    const m = /(?<![\w-])(Redemption(?: Provisions)?|Optional Redemption|Redemption Terms)\s*:\s*/.exec(body);
    if (!m || !single) return out;
    const rest = body.slice(m.index + m[0].length, m.index + m[0].length + 700);
    const stop = rest.search(/\s(?:[A-Z][A-Za-z'’/() -]{2,50}):\s/);
    const v = stop >= 0 ? rest.slice(0, stop) : rest;
    const at = m.index + m[0].length, t = tr[0];
    if (/^(?:None|N\/A|Not\s+Applicable|Not\s+redeemable)\b/i.test(rest) || /^The\s+Notes\s+(?:are|will)\s+not\s+(?:be\s+)?(?:subject\s+to\s+(?:optional\s+)?redemption|redeemable)/i.test(v)) { out.set(t.seq, { value: { can: 'no' }, at, heading: m[1] }); return out; }
    const mw = /greater of/i.test(v) || (/Optional Redemption/.test(v) && /greater of[\s\S]{0,600}?present values?/i.test(body.slice(at)));
    const rd = /(?<![\w-])(?:Redemption Dates?|First Redemption Date|Redemption Commencement Date)\s*:\s*[^:]{0,200}?(?:commencing on|on or after|beginning on)?\s*(?:\(and including\)\s*)?(DATE_)/.source.replace('DATE_', DATE);
    const r1 = new RegExp(rd).exec(body);
    const from = (r1 && iso(r1[1])) || par.get(t.seq)?.iso || null;
    const value = { can: 'yes', ...(from ? { from } : {}), price: mw ? (from ? 'make-whole, then par' : 'make-whole') : /100%/.test(v) || from ? 'par' : undefined, ...(tax ? { tax: true } : {}) };
    out.set(t.seq, { value: JSON.parse(JSON.stringify(value)), at, heading: m[1] });
    return out;
  }
  // A: the "Optional Redemption" section of the supplement.
  const orH = findHeading(text, { anchors: [], from: coverEnd, to: supEnd, caps: /OPTIONAL REDEMPTION/, title: /Optional Redemption(?:\s+of\s+the\s+Notes)?(?=\s+[A-Z(])/ });
  const no = new Set();
  let noAll = false;
  for (const m of body.matchAll(/[^.]*\b(?:will not be redeemable|are not redeemable|is not redeemable|not be subject to (?:optional )?redemption|may not redeem|will not have the (?:right|option) to redeem|not be redeemable (?:at our option )?(?:prior to|before) (?:their )?maturity|will not be subject to redemption)[^.]*\./gi)) {
    if (/except|other than|unless|tax|change of control|special mandatory/i.test(m[0])) continue;
    // Scope by the sentence's subject only ("Optional Redemption of Fixed Rate Notes The floating rate notes are not redeemable …").
    // "We may not redeem the Floating Rate Notes …": the object after the verb.
    const k = m[0].search(/\b(?:will not|are not|is not|not be|may not)\b/i);
    let subj;
    if (/^may not redeem/i.test(m[0].slice(k))) subj = m[0].slice(k + 14, k + 160).split(/\b(?:prior to|before|at any time)\b/i)[0];
    else { subj = m[0].slice(Math.max(0, k - 160), k); const f0 = subj.search(/\b(?:The|Each|Our|No)\s/); if (f0 >= 0) subj = subj.slice(f0); }
    const sc = scopeOf(subj, tr);
    if (sc.length) sc.forEach(x => no.add(x)); else if (/\bthe (?:notes|debentures)\b/i.test(m[0])) noAll = true;
  }
  const may = /\b(?:we|the Issuer|the Company|[A-Z]{2,}[a-z]*)\s+may(?:,?\s+at (?:our|its) option,?)?\s+redeem|\bmay be redeemed\b|redeemable[^.]{0,60}at (?:our|its|the Issuer['’]s) option|will be redeemable[^.]{0,40}at our option/i.exec(body.slice(coverEnd > 0 ? 0 : 0));
  // Make-whole: the "greater of … present values" sentence, scoped to the tranches it names (else all).
  const mwScope = new Set();
  // The scope is read from the words before "greater of" only; a floating-rate tranche gets it only when that part names it.
  for (const g of body.matchAll(/\bgreater of\b(?=[^.]{0,700}?(?:present values?|Canada Yield Price|Make-Whole Amount|make-whole (?:amount|premium|redemption price)))/gi)) {
    let head = body.slice(Math.max(body.lastIndexOf('. ', g.index) + 2, g.index - 1500), g.index);
    for (let i = 0; i < 3; i++) head = head.replace(/\([^()]*\)/g, ' ');                                   // asides, nested ones too
    const sc = [...new Set([...namedTranches(head, tr), ...classTranches(head.replace(/\beach series of (?=fixed|floating)/i, ''), tr)])];   // "each series of Fixed Rate Notes other than the 2028 Notes, or … the 2028 Notes"
    (sc.length ? sc : tr.filter(t => t.rate !== 'floating').map(t => t.seq)).forEach(x => mwScope.add(x));
  }
  if (/make[- ]whole/i.test(body) && !mwScope.size) tr.filter(t => t.rate !== 'floating').forEach(t => mwScope.add(t.seq));
  const at = orH ? orH.at : may ? may.index : null;
  for (const t of tr) {
    if (no.has(t.seq) || (noAll && !may)) { const m = at ?? body.search(/not be redeemable|not redeemable|may not redeem/i); out.set(t.seq, { value: { can: 'no' }, at: m >= 0 ? m : null, heading: orH?.heading || null }); continue; }
    if (!may || at == null) continue;
    const p = par.get(t.seq), mw = mwScope.has(t.seq);
    const value = { can: 'yes', ...(p ? { from: p.iso } : {}), ...(p || mw ? { price: p ? (mw ? 'make-whole, then par' : 'par') : 'make-whole' } : {}), ...(tax ? { tax: true } : {}) };
    out.set(t.seq, { value, at: p ? p.at : at, heading: orH?.heading || null });
  }
  return out;
}

const PLACES = [['EEA', /^(?:the\s+)?(?:European Economic Area|EEA)\b/], ['UK', /^(?:the\s+)?(?:United Kingdom|UK)\b/], ['Switzerland', /^Switzerland\b/], ['Canada', /^Canada\b/],
  ['Hong Kong', /^Hong Kong\b/], ['Japan', /^Japan\b/], ['Singapore', /^Singapore\b/], ['Australia', /^Australia\b/], ['Taiwan', /^(?:the\s+)?(?:Republic of China \(?Taiwan|Taiwan)\b/],
  ['South Korea', /^(?:the\s+)?(?:Republic of )?(?:South )?Korea\b/], ['UAE', /^(?:the\s+)?United Arab Emirates\b/], ['Dubai (DIFC)', /^(?:the\s+)?(?:Dubai International Financial Centre|DIFC)\b/],
  ['Qatar', /^(?:the\s+)?(?:State of )?Qatar\b/], ['Saudi Arabia', /^(?:the\s+)?(?:Kingdom of )?Saudi Arabia\b/], ['Kuwait', /^Kuwait\b/], ['Bahrain', /^Bahrain\b/], ['Israel', /^Israel\b/],
  ['China', /^(?:the\s+)?(?:People['’]s Republic of China|PRC|China)\b/], ['Chile', /^Chile\b/], ['Brazil', /^Brazil\b/], ['Mexico', /^Mexico\b/], ['Peru', /^Peru\b/], ['Colombia', /^Colombia\b/],
  ['Uruguay', /^Uruguay\b/], ['Argentina', /^Argentina\b/], ['Norway', /^Norway\b/], ['France', /^France\b/], ['Italy', /^(?:the\s+)?(?:Republic of )?Italy\b/], ['Netherlands', /^(?:the\s+)?Netherlands\b/],
  ['Belgium', /^Belgium\b/], ['Spain', /^Spain\b/], ['Germany', /^Germany\b/], ['Malaysia', /^Malaysia\b/], ['India', /^India\b/], ['New Zealand', /^New Zealand\b/], ['South Africa', /^South Africa\b/],
  ['Indonesia', /^Indonesia\b/], ['Philippines', /^(?:the\s+)?Philippines\b/], ['Thailand', /^Thailand\b/], ['Macau', /^Mac(?:au|ao)\b/], ['Bermuda', /^Bermuda\b/], ['Cayman Islands', /^(?:the\s+)?Cayman Islands\b/]];
const placeAt = s => (PLACES.find(([, re]) => re.test(s)) || [])[0] || null;

function sellingRestrictions(text, from, to) {
  const MARK = /Notice to (?:Prospective )?(?:Investors|Purchasers) in\s+|NOTICE TO (?:PROSPECTIVE )?(?:INVESTORS|PURCHASERS) IN\s+|Prohibition of [Ss]ales? to\s+|PROHIBITION OF SALES? TO\s+|Selling Restrictions\s+|SELLING RESTRICTIONS\s+/g;
  MARK.lastIndex = from;
  const places = [];
  let first = null, m;
  while ((m = MARK.exec(text)) && m.index < to) {
    if (/[“"]\s*$/.test(text.slice(Math.max(0, m.index - 3), m.index))) continue;
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 80);
    const p = placeAt(after) || placeAt(after.replace(/^(?:EEA|UK|United Kingdom)\s+Retail Investors/i, x => x));
    const pp = /^(?:Prohibition|PROHIBITION)/.test(m[0]) ? (/^(?:the\s+)?(?:EEA|European Economic Area)/i.test(after) ? 'EEA' : /^(?:the\s+)?(?:UK|United Kingdom)/i.test(after) ? 'UK' : null) : p;
    if (!pp && !/Selling Restrictions|SELLING RESTRICTIONS/.test(m[0])) continue;
    if (!first && /Selling Restrictions|SELLING RESTRICTIONS/.test(m[0])) first = { at: m.index, heading: m[0].trim() };
    if (!first) first = { at: m.index, heading: (m[0] + (pp ? after.slice(0, (after.match(PLACES.find(([n]) => n === pp)?.[1] || /^$/) || [''])[0].length) : '')).replace(/\s+/g, ' ').trim().slice(0, 80) };
    if (pp && !places.includes(pp)) places.push(pp);
    // Headings printed under "Selling Restrictions": "Canada The notes may be sold only …".
    if (/Selling Restrictions|SELLING RESTRICTIONS/.test(m[0])) {
      const reg = text.slice(m.index, Math.min(to, m.index + 15000));
      for (const h of reg.matchAll(/(?:^|[.”")]\s{1,3}|Restrictions\s+)((?:the\s+)?[A-Z][A-Za-z’' ()]{2,40}?)\s+(?=(?:The|This|Each|No|Neither|In|Any|An|Notes|We|Prospective|Purchasers|Investors|Offers|Under|Please|If)\b)/g)) {
        const q = placeAt(h[1]); if (q && !places.includes(q)) places.push(q);
      }
    }
  }
  // A place printed as a bare heading in the underwriting section ("European Economic Area The notes are not intended to be offered …"),
  // accepted only when the text after it restricts offers or sales.
  const BARE = /(?:[.”")]\s{1,3}|TABLE OF CONTENTS\s+|S-\d{1,3}\s+)((?:the\s+)?[A-Z][A-Za-z’' ()]{1,45}?)\s+(?=(?:The|This|Each|No|Neither|In|Any|An|Notes|We|Prospective|Purchasers|Investors|Offers|Under|Please|If|Each)\b)/g;
  const uw = text.slice(from, to).search(/\b(?:UNDERWRITING|Underwriting|PLAN OF DISTRIBUTION|Plan of Distribution)(?:\s*\((?:CONFLICTS?|Conflicts?) [^)]{0,20}\))?\s+(?=[A-Z])/);
  if (uw >= 0) {
    BARE.lastIndex = from + uw;
    let b;
    while ((b = BARE.exec(text)) && b.index < to) {
      const q = placeAt(b[1]);
      if (!q || q.length > 20 && !/\(/.test(q)) continue;
      if (placeAt(b[1]) && b[1].replace(/^the\s+/, '').length > 40) continue;
      const after = text.slice(b.index + b[0].length, b.index + b[0].length + 500);
      if (!/retail investor|(?:not|only) (?:be )?(?:offered|sold)|offered,? sold|offer or sell|distribut|prospectus (?:supplement )?(?:has not|is not|will not)|securities laws?|exempt/i.test(after)) continue;
      const at = b.index + b[0].indexOf(b[1]);
      if (!first || at < first.at) first = { at, heading: b[1].replace(/\s+/g, ' ').trim().slice(0, 80) };
      if (!places.includes(q)) places.push(q);
    }
  }
  return first ? { ...first, places } : null;
}

function useOfProceeds(sect) {
  const s = sect.replace(/\s+/g, ' ');
  const c = [];
  if (/general corporate purposes/i.test(s)) c.push('general corporate purposes');
  if (/\b(?:repay|repayment|refinanc|redeem|redemption of|repurchase(?:s)? of (?:our |certain |outstanding )?(?:\S+ )?(?:notes|debt|debentures|senior|indebtedness)|retire|commercial paper|outstanding (?:indebtedness|borrowings)|discharge|tender offer)/i.test(s)) c.push('repay or refinance debt');
  if (/\b(?:acquisition|merger|consideration for the|to fund (?:a portion of )?the (?:cash )?(?:purchase price|consideration))\b/i.test(s)) c.push('fund an acquisition');
  if (/working capital/i.test(s)) c.push('working capital');
  if (/capital expenditures?|capital spending|capital investments?/i.test(s)) c.push('capital spending');
  if (/(?:repurchases?|buybacks?) of (?:our )?(?:common )?(?:stock|shares)|share repurchases?|stock repurchases?/i.test(s)) c.push('share buybacks');
  if (/Eligible (?:Green|Social|Sustainab)|green (?:projects|bonds?|financing)|eligible projects|sustainability|social projects/i.test(s)) c.push('eligible green or social projects');
  let acq = null;
  if (c.includes('fund an acquisition')) {
    const m = /\b(?:acquisition of|merger with|acquire)\s+((?:[A-Z][\w.&’'-]*)(?:\s+(?:[A-Z][\w.&’'-]*|&|of))*)/.exec(s) || /\b(?:the|pending|proposed)\s+((?:[A-Z][\w&’'-]+)(?:\s+[A-Z][\w&’'-]+){0,2})\s+(?:Acquisition|Merger|Transactions?)\b/.exec(s);
    if (m && !/^(?:The|Our|Pending|Proposed|Such|Any|Each|Acquisition|Merger|Company|Issuer)$/.test(m[1]) && m[1].length <= 60) acq = m[1].replace(/[,.]$/, '');
  }
  return { c, acq };
}

function part2({ text, family, tr, single, rows, coverEnd, supEnd, anchors, docDate, prices, src, put, absent, fail, notes, priceKept }) {
  const sup = family === 'A' ? supEnd : Math.min(text.length, 25000);
  const tdef = { 'A': 'description of the notes', 'B': 'pricing terms', 'C': 'retail table' }[family];
  const vt = v => JSON.stringify(v);

  // #14 Ranking, #15 Secured (T).
  const { rank, sec } = rankingSecurity({ text, family, tr, supEnd: sup });
  for (const t of tr) {
    const r = rank.get(t.seq), x = sec.get(t.seq);
    if (r) put(t.seq, 'ranking', 'disclosed', { text: r.v }, src(r.at, { part: r.part || (family === 'A' ? null : tdef), heading: r.heading || null }));
    else if (family === 'B') absent(t.seq, 'ranking', 'not_disclosed', 'pricing terms');
    if (x) put(t.seq, 'secured', 'disclosed', { text: x.v }, src(x.at, { part: x.part || (family === 'A' ? null : tdef), heading: x.heading || null }));
    else if (family === 'B') absent(t.seq, 'secured', 'not_disclosed', 'pricing terms');
  }

  // #16 Early repayment by the issuer (T).
  const er = earlyRepayment({ text, family, tr, single, supEnd: sup, coverEnd, docDate });
  for (const t of tr) {
    const e = er.get(t.seq);
    if (!e) continue;
    if (e.value.from && t.row.maturity_date && e.value.from >= t.row.maturity_date) { fail('early_repayment', t.seq, 'par_call', `${e.value.from} not before maturity ${t.row.maturity_date}`); continue; }
    if (e.value.from && docDate && e.value.from <= docDate.iso) { fail('early_repayment', t.seq, 'par_call', `${e.value.from} not after the document date`); continue; }
    if (e.at == null) { fail('early_repayment', t.seq, 'source', 'no position'); continue; }
    put(t.seq, 'early_repayment', 'disclosed', { text: vt(e.value), date: e.value.from || null }, src(e.at, { part: family === 'A' ? 'optional redemption' : tdef, heading: e.heading }));
  }

  // #17 Buy-back if control changes (O), #18 Special mandatory redemption (T). A only; show where found.
  if (family === 'A') {
    const body = text.slice(0, sup);
    // Every mention in the supplement; the price is the first "101% of … principal" printed within 1,500 characters after one.
    let pm = null;
    for (const c of body.matchAll(/change of control/gi)) {
      const w = body.slice(c.index, c.index + 1500);
      const m = /(10[01](?:\.\d+)?)\s?%\s+of\s+(?:the|their|its|such)?\s*(?:aggregate\s+)?principal/i.exec(w);
      if (m) { pm = { v: Number(m[1]), at: c.index + m.index }; break; }
    }
    if (pm) {
      const excl = [...body.matchAll(/[^.]*\b(?:will not|shall not|do not|does not)\s+(?:be\s+)?(?:subject to|have|apply|entitled to)[^.]{0,80}change of control[^.]*\./gi)].filter(m => !/no protection|unless we state otherwise/i.test(m[0]));
      if (!excl.length) put(0, 'change_of_control', 'disclosed', { num: pm.v }, src(pm.at, { heading: null }));
      else notes.push('change of control: applies to only some tranches → not read');
    }
    const smr = /Special Mandatory Redemption/i.exec(body);
    if (smr) {
      const all = [...body.matchAll(/Special Mandatory Redemption/gi)];
      let pm = null, by = null;
      for (const a of all) {
        const w = body.slice(a.index, a.index + 1600);
        pm = pm || /(10[01](?:\.\d+)?)\s?%\s+of\s+(?:the|their)?\s*(?:aggregate\s+)?principal/i.exec(w) && { v: Number(/(10[01](?:\.\d+)?)\s?%\s+of/.exec(w)[1]), at: a.index + w.search(/10[01](?:\.\d+)?\s?%\s+of/) };
        const bm = new RegExp(`(?:on or (?:prior to|before)|by|not consummated[^.]{0,60}?(?:on or (?:prior to|before)|by))\\s+(${DATE})`, 'i').exec(w);
        if (!by && bm && iso2(bm[1])) by = iso2(bm[1]);
      }
      const ex = new Set();
      let exUnmapped = false;
      for (const m of body.matchAll(/[^.]*\b(?:will not be (?:subject to|entitled to)|not be subject to|will not have)[^.]{0,60}special mandatory redemption[^.]*\.?/gi)) {
        const sc = scopeOf(m[0], tr); if (sc.length) sc.forEach(x => ex.add(x)); else exUnmapped = true;
      }
      for (const m of body.matchAll(/[^.]{0,300}\(\s*(?:collectively,?\s+)?the\s+[“"]non-SMR notes[”"]\s*\)/gi)) { const sc = scopeOf(m[0], tr); sc.forEach(x => ex.add(x)); if (!sc.length) exUnmapped = true; }
      // A restatement that uses only the defined term ("the non-SMR notes will not …") is unmapped; it is ignored once a sentence names them.
      if (pm && (!exUnmapped || ex.size)) {
        for (const t of tr) if (!ex.has(t.seq)) put(t.seq, 'special_mandatory_redemption', 'disclosed', { num: pm.v, date: by }, src(pm.at, { heading: null }));
      } else if (pm) notes.push('special mandatory redemption: the tranches it applies to could not be read → not read');
    }
  }

  // #19 Repayment on the holder's death (T): retail tables only.
  if (family === 'C') for (const t of tr) {
    if (!t.row.cusip) continue;
    const i = text.indexOf(t.row.cusip); if (i < 0) continue;
    const m = /\b(Yes|No)\s+(?:Junior Subordinated|Subordinated|Senior)\s+(?:Unsecured|Secured)\s+Notes\b/.exec(text.slice(i, i + 400));
    if (m) put(t.seq, 'survivors_option', 'disclosed', { text: m[1].toLowerCase() }, src(i + m.index, { part: 'retail table', heading: "Survivor's Option" }));
  }

  // #20 What the money is for (O): closed list of categories + the section link.
  let upSect = null;
  if (family !== 'C') {
    const h = family === 'A' ? findHeading(text, { anchors, from: coverEnd, to: sup, anchorRe: /^use of proceeds$/i, caps: /USE OF PROCEEDS/, title: /Use of Proceeds(?=\s+(?:We|The|Our)\b|\s+[A-Z][\w,.’'-]*(?:\s+[\w,.’'-]+){0,4}\s+(?:intends?|expects?|will|estimates?|plans?)\b)/ })
      : findHeading(text, { anchors: [], from: 0, to: sup, caps: /USE OF PROCEEDS(?: AND HEDGING)?/, title: /Use of Proceeds(?: and Hedging)?(?=\s+[A-Z])/ });
    if (h) {
      const st = sectionText(text, h.at + h.heading.length, 2600);
      upSect = { ...h, text: st };
      const u = useOfProceeds(st);
      if (u.c.length) put(0, 'use_of_proceeds', 'disclosed', { text: vt(u.acq ? { c: u.c, acq: u.acq } : { c: u.c }) }, { ...src(h.at, { part: 'use of proceeds', heading: 'Use of Proceeds' }), source_anchor: h.anchor ?? src(h.at, { part: 'use of proceeds' }).source_anchor });
      else if (/accompanying (?:base )?prospectus|prospectus supplement/i.test(st)) absent(0, 'use_of_proceeds', 'not_disclosed', 'use of proceeds');
      else put(0, 'use_of_proceeds', 'disclosed', { text: vt({ c: ['other'] }) }, src(h.at, { part: 'use of proceeds', heading: 'Use of Proceeds' }));
    } else if (family === 'B') absent(0, 'use_of_proceeds', 'not_disclosed', 'pricing terms');
    else if (!/\buse of proceeds\b/i.test(text.slice(coverEnd, sup).replace(/Use of Proceeds\s+(?:S-|PS-)?\d{1,3}\b/gi, ''))) absent(0, 'use_of_proceeds', 'not_disclosed', 'use of proceeds');
  } else absent(0, 'use_of_proceeds', 'not_disclosed', 'retail table');

  // #21 Bank fee, #22 Proceeds to the issuer before expenses (T % and amount; O total).
  let sum = 0, sumOk = tr.length > 0, cur = null;
  for (const t of tr) {
    const p = prices.get(t.seq);
    const part = family === 'A' ? 'cover table' : tdef;
    if (!p || (family === 'A' && !priceKept.has(t.seq))) { if (family === 'B' && single) { absent(t.seq, 'bank_fee_pct', 'not_disclosed', part); absent(t.seq, 'proceeds_pct', 'not_disclosed', part); } sumOk = false; continue; }
    let fee = p.fee, pro = p.proceeds;
    if (fee && !(fee.v > 0 && fee.v < 5)) { fail('bank_fee_pct', t.seq, 'range', `${fee.v}`); fee = null; }
    if (pro && !(pro.v > 85 && pro.v <= 101)) { fail('proceeds_pct', t.seq, 'range', `${pro.v}`); pro = null; }
    if (fee && pro && p.value != null && Math.abs(p.value - fee.v - pro.v) > 0.01) { fail('proceeds_pct', t.seq, 'price_fee_proceeds', `${p.value} − ${fee.v} ≠ ${pro.v}`); fee = null; pro = null; }
    if (fee) put(t.seq, 'bank_fee_pct', 'disclosed', { num: fee.v }, src(fee.at, { part, heading: fee.heading }));
    else if (family !== 'A' && !p.fee) absent(t.seq, 'bank_fee_pct', 'not_disclosed', part);
    if (pro) put(t.seq, 'proceeds_pct', 'disclosed', { num: pro.v }, src(pro.at, { part, heading: pro.heading }));
    else if (family !== 'A' && !p.proceeds && family !== 'C') absent(t.seq, 'proceeds_pct', 'not_disclosed', part);
    const pct = pro ? pro.v : (fee && p.value != null ? p.value - fee.v : null);
    if (pct == null || !(t.row.principal_amount > 0)) sumOk = false; else { sum += t.row.principal_amount * pct / 100; cur = cur ?? t.row.currency; if (cur !== t.row.currency) sumOk = false; }
    const a = p.amount;
    if (a && !single) {
      if (pct != null && t.row.principal_amount > 0 && Math.abs(a.v - t.row.principal_amount * pct / 100) > 0.005 * a.v) fail('proceeds_amount', t.seq, 'proceeds_total', `${a.v} vs ${t.row.principal_amount} × ${pct}%`);
      else if (a.cur && a.cur !== t.row.currency) fail('proceeds_amount', t.seq, 'currency', `${a.cur} vs ${t.row.currency}`);
      else put(t.seq, 'proceeds_amount', 'disclosed', { num: a.v, text: `${t.row.currency} · before expenses` }, src(a.at, { part, heading: a.heading || p.heading }));
    }
  }
  // Offering total: the cover table's Total row (A), the label (B), the single tranche's amount, else "net proceeds … approximately".
  let tot = prices.total || (single && tr.length ? (prices.get(tr[0].seq)?.total || prices.get(tr[0].seq)?.amount) : null);
  if (tot && family === 'A' && single && !priceKept.has(tr[0].seq)) tot = null;
  let basis = 'before expenses';
  if (!tot && upSect) {
    const m = /net proceeds[^.]{0,220}?approximately\s+(US\$|C\$|\$|€|£)\s?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(million|billion)?/i.exec(upSect.text);
    if (m) {
      const n = Number(m[2].replace(/,/g, '')) * (m[3] === 'billion' ? 1e9 : m[3] === 'million' ? 1e6 : 1);
      const sent = upSect.text.slice(m.index, m.index + m[0].length + 200);
      basis = /after deducting|net of/i.test(sent) ? 'approximately, after expenses' : 'approximately';
      tot = { v: n, at: upSect.at + upSect.heading.length + m.index + m[0].indexOf(m[2]), cur: CUR[m[1]] || null, heading: 'Use of Proceeds', part: 'use of proceeds' };
    }
  }
  if (tot) {
    const curT = tot.cur || (tr[0]?.row.currency ?? null);
    const lo = basis === 'before expenses' ? 0.995 : 0.95, hi = 1.005;
    if (sumOk && sum > 0 && (tot.v < sum * lo || tot.v > sum * hi)) fail('proceeds_total', 0, 'proceeds_total', `${tot.v} vs Σ principal × proceeds % ${Math.round(sum)}`);
    else if (cur && curT && curT !== cur) fail('proceeds_total', 0, 'currency', `${curT} vs ${cur}`);
    else put(0, 'proceeds_total', 'disclosed', { num: tot.v, text: `${curT || cur || 'USD'} · ${basis}` }, src(tot.at, { part: tot.part || (family === 'A' ? 'cover table' : tdef), heading: tot.heading || null }));
  } else if (family === 'B' && single && !prices.get(tr[0]?.seq)?.proceeds) absent(0, 'proceeds_total', 'not_disclosed', 'pricing terms');

  // #25 Risks (O): the section's link and heading only.
  if (family === 'A') {
    const h = findHeading(text, { anchors, from: coverEnd, to: sup, anchorRe: /^risk factors$/i, caps: /RISK FACTORS/, title: /Risk Factors(?=\s+(?:An|Investing|Your|You|Before|In addition|The|Our|We)\b)/ });
    if (h) put(0, 'risk_factors', 'disclosed', {}, { ...src(h.at, { part: 'risk factors', heading: 'Risk Factors' }), source_anchor: h.anchor ?? src(h.at, { part: 'risk factors' }).source_anchor });
    else absent(0, 'risk_factors', 'not_disclosed', 'risk factors');
  } else if (family === 'B') {
    const h = findHeading(text, { anchors: [], from: 0, to: sup, caps: /RISK FACTORS/ });
    if (h) put(0, 'risk_factors', 'disclosed', {}, src(h.at, { part: 'risk factors', heading: 'Risk Factors' }));
    else absent(0, 'risk_factors', 'not_disclosed', 'pricing terms');
  } else absent(0, 'risk_factors', 'not_disclosed', 'retail table');

  // #26 Where the notes may not be sold (O): section link + the places named in its headings.
  if (family === 'A') {
    const r = sellingRestrictions(text, coverEnd, sup);
    if (r) put(0, 'selling_restrictions', 'disclosed', { text: vt(r.places) }, src(r.at, { part: 'underwriting', heading: r.heading }));
    else absent(0, 'selling_restrictions', 'not_disclosed', 'underwriting');
  } else absent(0, 'selling_restrictions', 'not_disclosed', tdef);

  // #27 Conflicts of interest (O): the heading and its link; show where found.
  if (family === 'A') {
    const h = findHeading(text, { anchors: [], from: coverEnd, to: sup, caps: /\(?CONFLICTS? OF INTERESTS?\)?/, title: /\(?Conflicts? of Interests?\)?(?=\s+[A-Z(])/ });
    if (h) put(0, 'conflicts_of_interest', 'disclosed', { text: h.heading.replace(/[()]/g, '').trim().replace(/^CONFLICTS?/, w => w[0] + w.slice(1).toLowerCase()).replace(/ OF INTERESTS?$/, ' of Interest') }, src(h.at, { part: 'underwriting', heading: h.heading.replace(/[()]/g, '').trim() }));
  }

  // #28 Listing (O): exchange name or "Not listed"; show where found.
  {
    const body = text.slice(0, sup);
    const yes = /(?:intends?|expects?) to apply (?:to list|for (?:the )?listing of)[^.]{0,120}?on (?:the )?(New York Stock Exchange|NYSE|Nasdaq Bond Exchange|Nasdaq Global Market|NASDAQ Global Market|The Nasdaq Stock Market|Nasdaq|NASDAQ|London Stock Exchange|Euronext Dublin|Irish Stock Exchange|Luxembourg Stock Exchange)/i.exec(body);
    const not = /\b(?:will not be listed|(?:do|does) not (?:currently )?intend to (?:apply (?:to list|for (?:the )?listing of)|list)|have not applied and do not intend to apply|(?:do|does) not intend to apply for (?:the )?listing|We will not list|will not apply to list)\b/i.exec(body);
    const EX = { NYSE: 'New York Stock Exchange', NASDAQ: 'Nasdaq', 'NASDAQ Global Market': 'Nasdaq Global Market', 'The Nasdaq Stock Market': 'Nasdaq' };
    const pick = yes && (!not || yes.index < not.index) ? { v: EX[yes[1]] || yes[1], at: yes.index + yes[0].lastIndexOf(yes[1]) } : not ? { v: 'Not listed', at: not.index } : null;
    if (pick) put(0, 'listing', 'disclosed', { text: pick.v }, src(pick.at, { part: family === 'A' ? null : tdef, heading: null }));
  }
}
const iso2 = s => isoOf(s);

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
