// bonds-parse.mjs — MA-OCT-008 pure parser (spec rev 1.2 §7.2–§7.4, §8.2, §14.1).
// No I/O. Input: one SEC document (HTML) plus its filing metadata. Output: the
// classification and the bond_issuance rows it would write.
//
// Rules implemented exactly as specced: R1 (visible text), R2 (424B-only
// preliminary markers), R3 / A8-3 security-title gate with precedence
// other → structured → non-debt → debt, A8-4 per-tranche parse_failed, §14.1
// confidence. Data-Identity Lead rulings (claude/MA-OCT-008_AC17_Signoff.md,
// 15 Oct; named in the code where applied):
//   R2b    424B: "Preliminary Pricing Supplement" in the first 2,000 visible chars → preliminary (B-1).
//   B-1b   a retail-note table with placeholder amount cells → preliminary.
//   L8-14  a row is final only with principal_amount > 0; otherwise per-tranche parse_failed.
//   B-2    rule 1 "other" also matches "offers? to exchange" / "exchange offers?" (title scope).
//   B-3    debt rule 4 also accepts (a) "Notes/Debentures/Bonds, Series [X] due" and (b) a retail
//          CUSIP table under a pricing-supplement header; each row records its path (7.3-4, B-3a, B-3b);
//          a B-3b row also needs a coupon or a floating benchmark and a full maturity.
//   B-4    currencies USD EUR GBP CHF JPY + CAD, AUD; prefixed symbols (C$, A$, US$) before a bare $;
//          from the tranche title / cover line only; numeric refs &#128;–&#159; decoded as cp1252 (HTML5).
//   Rule 5 only when no debt title is found: demand notes / merger and consent documents →
//          skipped_other; stock-plan supplements → skipped_non_debt.
//   N-3    the audit title prefers the cover's offering line and drops EDGAR header tokens.
//   L8-12  co-registrant issuers are resolved by the runner (coverIssuers() below names them).
// MA-NOV-BOND.FIX1 (spec MA-NOV-BOND v1 §4, parser 1.3.0):
//   F1  a 424B draft passes the other → structured → non-debt title gate before it is called
//       preliminary; a structured / non-debt draft is skipped with reason draft_structured / draft_not_debt.
//   F2  a draft reports its cover tranche-line count (draftLines); the runner does the deal-level match.
//   FIX2 (1.3.1): F6 term-sheet identifiers (fwpTermSheet: labelled / columns / sections / single), pricing date and
//       banks captured from the term sheet (offering, not written); F5 FWP reader: Series A/B titles kept apart and a
//       public + trust allocation summed; F2b draftTranches (cover-line rate type and year) for the subset link.
//   F3  rule 5 (iv): an MTN / term-note programme supplement with no priced terms → skipped_other, program_supplement.
//   F4  maturity wordings "will mature as to principal on"; a year-only tranche named as "the <year> Notes";
//       disagreeing maturity statements resolved only by the labelled "Maturity Date(s)" statement (noted).
//   F7  a cover that says the notes are being remarketed → skipped_other, remarketing (R-4 made reproducible).
//   F8  every non-final row carries status_reason (spec v1 §5 codes); a partial final carries
//       status_reason 'partial' + missing[]. Run log / dry-run record only — not a D1 column (BOND-CR1).

export const PARSER_VERSION = 'bonds-1.3.1';   // 1.3.1: MA-NOV-BOND.FIX2 F6, F5, F2b · 1.3.0: MA-NOV-BOND.FIX1 F1–F4, F7, F8 · 1.2.0: DIL14 R-2 floating-spread wordings (MA-OCT-THU29.ENG8)

// ── Visible text (R1) ────────────────────────────────────────────────────

const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"',
  ndash: '–', mdash: '—', euro: '€', pound: '£', yen: '¥', cent: '¢', reg: '®', trade: '™', copy: '©', sect: '§', bull: '•',
  middot: '·', hellip: '…', frac12: '½', frac14: '¼', frac34: '¾', deg: '°', para: '¶', times: '×', shy: '', zwsp: '' };

// Numeric references 128–159 are Windows-1252 code points in many EDGAR filings
// (AT&T's agent writes the euro sign as &#128;).
const CP1252 = { 128: '€', 130: '‚', 131: 'ƒ', 132: '„', 133: '…', 134: '†', 135: '‡', 136: 'ˆ', 137: '‰', 138: 'Š', 139: '‹', 140: 'Œ', 142: 'Ž',
  145: "'", 146: "'", 147: '"', 148: '"', 149: '•', 150: '–', 151: '—', 152: '˜', 153: '™', 154: 'š', 155: '›', 156: 'œ', 158: 'ž', 159: 'Ÿ' };
const cp = n => CP1252[n] ?? (n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ' ');

export function htmlToText(html) {
  return String(html)
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);?/gi, (m, h) => cp(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (m, d) => cp(Number(d)))
    .replace(/&([a-z][a-z0-9]*);/gi, (m, n) => (ENT[n.toLowerCase()] ?? ' '))
    .replace(/[​-‍⁠﻿­]/g, '')
    .replace(/[‐-‒−]/g, '-')
    .replace(/[\s  -   　]+/g, ' ')
    .trim();
}

// ── Preliminary detection (§7.2, R2; B-1) ────────────────────────────────

const R2 = [/SUBJECT\s+TO\s+COMPLETION/i, /is\s+not\s+complete\s+and\s+may\s+be\s+changed/i];
const R2B = /\bPreliminary\s+Pricing\s+Supplement\b/i;

export function preliminaryRule(form, text) {
  if (!/^424B/.test(form)) return null;                    // R2: never on FWP
  const head = text.slice(0, 2000);
  if (R2.some(r => r.test(head))) return 'R2';
  if (R2B.test(head)) return 'R2b';
  // B-1b: a retail-note table whose amount cells are still "[ ]" placeholders is
  // unpriced, whatever its heading says (GM Term Notes "Pricing Supplement No. 5",
  // 3 Mar 2025, was filed this way a week before the priced No. 5).
  RETAIL_ROW.lastIndex = 0;
  let m;
  const t6 = text.slice(0, 6000);
  while ((m = RETAIL_ROW.exec(t6))) if (/\[\s*[•●]?\s*\]/.test(m[2])) return 'B-1b';
  return null;
}

// ── Security title (§7.3, A8-3) ──────────────────────────────────────────

// The cover's offering lines run until the first prose sentence.
const PROSE = /\b(We are (?:offering|selling|issuing)|We will pay|We may (?:offer|sell)|We have entered|This is (?:a|an) (?:public )?offering|This prospectus supplement|Th(?:e|is) (?:information|filing)|is offering|are offering|Interest on the|Capitalized terms|Beginning [A-Z][a-z]+ \d|Unlike ordinary|Investing in|Dear |To the (?:holders|Stockholders|Shareholders)|Redemption Information|The (?:[A-Z][\w-]*,? ){0,5}(?:Notes|Debentures|Securities|notes|debentures|securities) (?:offered|will|are|bear)|The (?:Series|Debentures|Securities|notes|debentures|securities) (?:will|are|offered)|Subject Final Pricing Details|The Date of)/;
const HEADER_MAX = 1600;

export function extractTitle(text) {
  const t6 = text.slice(0, 6000);
  const startAt = Math.max(0, t6.search(/PROSPECTUS SUPPLEMENT|PRICING SUPPLEMENT|Pricing Supplement|Prospectus Supplement|PROSPECTUS\b|Prospectus\b/));
  const rest = t6.slice(startAt);
  const m = rest.slice(40).search(PROSE);
  const header = rest.slice(0, m >= 0 ? Math.min(40 + m, HEADER_MAX) : HEADER_MAX);
  const terms = [];
  const re = /Title of (?:the )?(?:Notes|Securities|Debentures|Series)\s*:?\s*(.{0,220}?)(?=\s[A-Z][A-Za-z/()'’ -]{2,48}:\s|$)/g;
  let x;
  while ((x = re.exec(t6))) terms.push(x[1]);
  return { header, terms, title: [header, ...terms].join(' || ') };
}

const OTHER = /\b(exchange\s+offers?|offers?\s+to\s+exchange|remarketing|selling (?:security\s*)?holders|resale prospectus)\b/i;   // B-2
const STRUCT_WORDS = /\b(Market[- ]Linked|Autocallable|Auto[- ]Callable|Buffered|Contingent (?:Coupon|Interest)|Leveraged|Accelerated Return|Principal at Risk|Index[- ]Linked|Equity[- ]Linked|Absolute Return|Digital|Barrier)\b/i;
const UNDERLIER = /\b(index|indices|basket|stock|shares|ETF|fund|commodity|currency)\b/i;
const BENCHMARK_ONLY = /\b(?:linked to|based on)\s+(?:the\s+)?(?:Compounded SOFR|Term SOFR|SOFR|EFFR|Treasury|Prime|Fed Funds|CMT)\b/i;
const NON_DEBT = /\b(Equity Units|Common Stock|Depositary Shares|Preferred Stock|Warrants|Units)\b/i;
const DEBT = /\b(Notes?|Debentures?|Bonds?)\s+due\b/i;                                                     // 7.3-4
// B-3a. The ruling's pattern needs a designator; NextEra's "Debentures, Series due 2031", which the
// ruling names as covered, has none, so the designator is optional here.
const DEBT_SERIES = /\b(Notes?|Debentures?|Bonds?),?\s*Series(?:\s+[A-Z0-9-]{1,5})?\s+due\b/i;
const MTN = /Medium[- ]Term Notes/i;
const PRICING_HDR = /Pricing Supplement/i;
const RETAIL_ROW = /\b(\d{3}[0-9A-Z]{5}\d)\s+(.{0,160}?)\b(Fixed|Floating|Step[- ]?Up|Variable)\s+(\d{1,2}\.\d{1,4})\s?%\s+(Monthly|Quarterly|Semi[- ]?Annual(?:ly)?|Annual(?:ly)?)\s+(\d{1,2}\/\d{1,2}\/\d{4})/g;

function structured(title) {
  if (STRUCT_WORDS.test(title)) return true;
  for (const sentence of title.split(/(?<=[.;■•|])\s+|\s\|\|\s/)) {
    if (!/\blinked to\b/i.test(sentence)) continue;
    const s = sentence.replace(new RegExp(BENCHMARK_ONLY.source, 'gi'), ' ');
    if (/\blinked to\b/i.test(s) && UNDERLIER.test(s)) return true;
  }
  return false;
}

// Rule 5 (AC17 sign-off): runs only when rules 1–4 found no title, so it can
// never skip a filing that would parse.
const DEMAND_NOTE = /\bVariable\s+Denomination\s+Floating\s+Rate\s+Demand\s+Notes?\b|PowerInvestment|IncomeDriver|\bRight\s+Notes\b|PremierNotes|Reliability\s+Investment/i;
// (ii) also "TRANSACTION PROPOSED" and "joint proxy statement/prospectus": Union Pacific's cover
// prints "MERGER" as an image (0001193125-25-226560, pre-signed as a merger document).
const MERGER_DOC = /MERGER\s+PROPOSED|TRANSACTION\s+PROPOSED|NOTICE\s+OF\s+ACTION\s+BY\s+WRITTEN\s+CONSENT|information\s+statement\s*\/\s*prospectus|joint\s+proxy\s+statement\s*\/\s*prospectus/i;
const STOCK_PLAN = /direct\s+stock\s+purchase|dividend\s+reinvestment/i;
// F3 rule 5 (iv): the programme's own prospectus supplement ("we plan to offer and sell notes with various
// terms", "Medium-Term Notes … With Maturities of 9 Months or More", "Term Notes due from Nine Months to 30
// Years"). Read from the first 3,000 characters; it skips a filing only when it priced no tranche.
const PROGRAM = /plan\s+to\s+offer\s+and\s+sell\s+notes\s+with\s+various\s+terms|(?:With\s+Maturities\s+of|Due|due\s+from)\s+(?:9|Nine)\s+Months\s+(?:or\s+More|to\s+\d{1,2}\s+Years)\s+from\s+(?:the\s+)?Date\s+of\s+Issue/i;
// F7: the cover says the notes offered are existing notes being remarketed (NextEra Series M, Jul 2025).
const REMARKETED = /\bThis\s+is\s+a\s+remarketing\s+of\b|\b(?:is|are)\s+being\s+remarketed\b/i;
const otherReason = w => (/remarket/i.test(w) ? 'remarketing' : /exchange/i.test(w) ? 'exchange_offer' : 'resale');

// Returns { status, rule, reason? } where status ∈ skipped_other | skipped_structured |
// skipped_non_debt | debt | parse_failed (no title found).
export function classifyTitle(title, text) {
  const o = title.match(OTHER);
  if (o) return { status: 'skipped_other', rule: '7.3-1', reason: otherReason(o[1]) };
  if (REMARKETED.test(text.slice(0, 3000))) return { status: 'skipped_other', rule: '7.3-1 F7', reason: 'remarketing' };   // F7
  if (structured(title)) return { status: 'skipped_structured', rule: '7.3-2', reason: 'structured' };
  if (NON_DEBT.test(title)) return { status: 'skipped_non_debt', rule: '7.3-3', reason: 'equity' };
  if (DEBT.test(title)) return { status: 'debt', rule: '7.3-4' };
  if (DEBT_SERIES.test(title)) return { status: 'debt', rule: 'B-3a' };
  const pricing = PRICING_HDR.test(text.slice(0, 2500));
  if (MTN.test(title) && pricing) return { status: 'debt', rule: '7.3-4 MTN' };
  RETAIL_ROW.lastIndex = 0;
  if (pricing && RETAIL_ROW.test(text.slice(0, 6000))) return { status: 'debt', rule: 'B-3b' };
  const t6 = text.slice(0, 6000);
  if (DEMAND_NOTE.test(t6)) return { status: 'skipped_other', rule: '7.3-5i', reason: 'demand_note' };
  if (MERGER_DOC.test(t6)) return { status: 'skipped_other', rule: '7.3-5ii', reason: 'merger_document' };
  if (STOCK_PLAN.test(t6)) return { status: 'skipped_non_debt', rule: '7.3-5iii', reason: 'stock_plan' };
  if (PROGRAM.test(text.slice(0, 3000))) return { status: 'skipped_other', rule: '7.3-5iv', reason: 'program_supplement' };   // F3
  return { status: 'parse_failed', rule: '7.3 no title', reason: 'no_tranche' };
}

// ── Field helpers ────────────────────────────────────────────────────────

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_RE = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';
const DATE_RE = `${MONTH_RE}\\s+\\d{1,2}\\s*,\\s*\\d{4}`;
const pad = n => String(n).padStart(2, '0');

export function toIsoDate(s) {
  if (!s) return null;
  let m = String(s).match(new RegExp(`(${MONTH_RE})\\s+(\\d{1,2})\\s*,\\s*(\\d{4})`, 'i'));
  if (m) return validDate(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]);
  m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return validDate(+m[3], +m[1], +m[2]);
  return null;
}
function validDate(y, mo, d) {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? `${y}-${pad(mo)}-${pad(d)}` : null;
}

export function parseAmount(numText, unit) {
  const n = Number(String(numText).replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = (unit || '').toLowerCase();
  return u === 'billion' ? n * 1e9 : u === 'million' ? n * 1e6 : n;
}

// §7.4 + B-4. Called with the tranche title / cover line only (B-4 condition 2).
// Prefixed dollar symbols are matched before anything else; a bare $ stays USD.
export function currencyOf(s) {
  if (/\bC\$|CA\$|\bCAD\b|Canadian dollars?/i.test(s)) return 'CAD';
  if (/\bA\$|\bAUD\b|Australian dollars?/i.test(s)) return 'AUD';
  if (/\bUS\$|U\.S\.\s?\$/.test(s)) return 'USD';
  if (/€|\bEUR\b|\beuros?\b/i.test(s)) return 'EUR';
  if (/£|\bGBP\b|sterling/i.test(s)) return 'GBP';
  if (/\bCHF\b|Swiss francs?/i.test(s)) return 'CHF';
  if (/¥|\bJPY\b|\byen\b/i.test(s)) return 'JPY';
  return 'USD';
}

// CUSIP check digit (modulus 10 "double-add-double"); ISIN (Luhn over expanded digits).
export function cusipValid(c) {
  if (!/^[0-9A-Z*@#]{8}\d$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const ch = c[i];
    let v = /\d/.test(ch) ? Number(ch) : /[A-Z]/.test(ch) ? ch.charCodeAt(0) - 55 : ch === '*' ? 36 : ch === '@' ? 37 : 38;
    if (i % 2 === 1) v *= 2;
    sum += Math.floor(v / 10) + (v % 10);
  }
  return (10 - (sum % 10)) % 10 === Number(c[8]);
}
export function isinValid(s) {
  if (!/^[A-Z]{2}[0-9A-Z]{9}\d$/.test(s)) return false;
  const digits = s.split('').map(ch => (/\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55))).join('');
  let sum = 0, dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d; dbl = !dbl;
  }
  return sum % 10 === 0;
}

// All valid identifiers in `text` with their positions. CUSIPs printed with a
// space ("91324P FS6") are accepted.
export function findIdentifiers(text) {
  const out = [];
  const isinRe = /\b([A-Z]{2}[0-9A-Z]{9}\d)\b/g;
  let m;
  while ((m = isinRe.exec(text))) if (isinValid(m[1])) out.push({ kind: 'isin', value: m[1], at: m.index });
  const cusipRe = /\b(\d{3}[0-9A-Z]{3})\s?([0-9A-Z]{2}\d)\b/g;
  while ((m = cusipRe.exec(text))) {
    const v = m[1] + m[2];
    if (/^\d+$/.test(v) && !/CUSIP/i.test(text.slice(Math.max(0, m.index - 60), m.index))) continue;   // a bare 9-digit number needs a CUSIP label nearby
    if (cusipValid(v)) out.push({ kind: 'cusip', value: v, at: m.index });
  }
  return out.sort((a, b) => a.at - b.at);
}

const instrumentKey = (isin, cusip) => (isin && isin.length === 12 ? isin : cusip ? `CUSIP:${cusip}` : null);   // 007 E8

// ── Tranche discovery ────────────────────────────────────────────────────

const MONEY = /(U\.S\.\s?\$|US\$|CAD\$|CA\$|C\$|A\$|\$|€|£|¥|CHF\s?|EUR\s?|GBP\s?)?\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s*(million|billion))?/g;
const INSTR = new RegExp(`\\b(Notes?|Debentures?|Bonds?)(,?\\s*Series(?:\\s+[A-Z0-9-]{1,5})?)?\\s+due\\s+(${DATE_RE}|\\d{4})\\b`, 'gi');

function moneyTokens(seg) {
  const out = [];
  MONEY.lastIndex = 0;
  let m;
  while ((m = MONEY.exec(seg))) {
    const cur = (m[1] || '').trim();
    const amt = parseAmount(m[2], m[3]);
    // A principal: currency-marked, comma-grouped, or "million/billion"; never a percentage.
    if (!amt || seg[m.index + m[0].length] === '%' || /^\s*%/.test(seg.slice(m.index + m[0].length))) continue;
    if (!cur && !m[3] && !/,\d{3}/.test(m[2])) continue;
    if (amt < 1000) continue;
    out.push({ amount: amt, cur, at: m.index, end: m.index + m[0].length, raw: m[0] });
  }
  return out;
}

function rateTypeOf(phrase) {
  if (/Fixed[- ]to[- ]Floating|Fixed\s*\/\s*Floating|Fixed Rate\s*\/\s*Floating Rate/i.test(phrase)) return 'fixed_to_floating';
  if (/Floating/i.test(phrase)) return 'floating';
  return 'fixed';
}
function seniorityOf(phrase) {
  if (/Junior Subordinated/i.test(phrase)) return 'junior_subordinated';
  if (/Subordinated/i.test(phrase)) return 'subordinated';
  if (/\bSenior\b/i.test(phrase)) return 'senior';
  return null;
}
// A coupon of 3.75 matches "3.75%", "3.750%" and "3.750 %".
export const couponRe = c => `${String(c).replace('.', '\\.')}${String(c).includes('.') ? '' : '(?:\\.0+)?'}0*\\s?%`;
const namesCoupon = (ctx, c) => c !== null && c !== undefined && new RegExp(`(?<![\\d.])${couponRe(c)}`).test(ctx);
const classOf = w => (/^Deb/i.test(w) ? 'debentures' : /^Bond/i.test(w) ? 'bonds' : 'notes');

// Cover lines: "$500,000,000 4.400% Notes due June 15, 2028" (one per tranche).
export function coverTranches(header) {
  const tr = [];
  INSTR.lastIndex = 0;
  let m, prevEnd = 0;
  while ((m = INSTR.exec(header))) {
    const seg = header.slice(prevEnd, m.index + m[0].length);
    const phraseStart = Math.max(0, m.index - 160);
    const tokens = moneyTokens(seg);
    const last = tokens[tokens.length - 1];
    const phrase = header.slice(last ? prevEnd + last.end : Math.max(prevEnd, phraseStart), m.index + m[0].length).trim();
    const coupon = (phrase.match(/(\d{1,2}(?:\.\d{1,4})?)\s?%/g) || []).pop();
    tr.push({
      label: phrase.replace(/^[\s,;:]+/, '').slice(0, 200),
      principal: last ? last.amount : null, principalCur: last ? last.cur : '', principalAt: last ? prevEnd + last.at : null,
      coupon: coupon ? Number(coupon.replace(/[%\s]/g, '')) : null,
      rateType: rateTypeOf(phrase), seniority: seniorityOf(phrase), securityClass: classOf(m[1]),
      maturityText: m[3], maturity: toIsoDate(m[3]), maturityYear: Number((m[3].match(/\d{4}$/) || [])[0]),
      currency: currencyOf((last ? last.raw : '') + ' ' + phrase), source: 'cover', amountsInSeg: tokens.length,
      path: m[2] ? 'B-3a' : '7.3-4'
    });
    prevEnd = m.index + m[0].length;
  }
  // Home Depot shape: deal total once, tranche lines without amounts → the first
  // "principal" is the deal total; drop it and use the offering sentence instead.
  const out = dedupeTranches(tr);
  if (out.length > 1 && out.slice(1).every(t => t.principal === null) && out[0].principal !== null) out[0].principal = null;
  return out;
}

// The same cover line can repeat (title + offering sentence); keep the first of each.
function dedupeTranches(tr) {
  const seen = new Set();
  return tr.filter(t => {
    const series = (t.label.match(/\bSeries\s+[A-Z0-9]{1,5}\b/i) || [''])[0].toLowerCase();
    const k = `${t.coupon}|${t.rateType}|${t.maturityText.toLowerCase()}|${t.seniority}|${series}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).filter((t, i, all) => {
    // A later mention without amount or series ("The Junior Subordinated
    // Debentures due …") repeats an earlier tranche; it is not a tranche of its own.
    if (t.principal !== null || !all.some(u => u.principal !== null)) return true;
    return !all.slice(0, i).some(u => u.maturityText.toLowerCase() === t.maturityText.toLowerCase() && u.seniority === t.seniority
                                      && u.rateType === t.rateType);
  });
}

// Retail-note tables (B-3): one row per CUSIP.
export function retailTranches(text) {
  const tr = [];
  RETAIL_ROW.lastIndex = 0;
  let m;
  const head = text.slice(0, 20000);
  while ((m = RETAIL_ROW.exec(head))) {
    const amounts = moneyTokens(m[2]).filter(t => t.cur.includes('$')).map(t => t.amount);
    const after = head.slice(m.index + m[0].length, m.index + m[0].length + 160);
    const type = m[3].toLowerCase();
    tr.push({
      label: `${m[4]}% ${/Senior/i.test(after) ? 'Senior ' : ''}Notes due ${m[6]}`,
      principal: amounts.length ? Math.max(...amounts) : null, principalCur: '$', coupon: Number(m[4]),
      rateType: type === 'floating' || type === 'variable' ? 'floating' : 'fixed', seniority: seniorityOf(after.slice(0, 80)),
      securityClass: 'notes', maturityText: m[6], maturity: toIsoDate(m[6]), maturityYear: Number(m[6].slice(-4)),
      currency: 'USD', cusip: cusipValid(m[1]) ? m[1] : null, source: 'retail', path: 'B-3b'
    });
  }
  return tr;
}

// Key:value term sheets (MTN pricing supplements; also fills single-tranche deals).
export function termValue(text, keyRe, valueRe, span = 260) {
  const re = new RegExp(`(?:${keyRe})\\s*:?\\s*`, 'gi');
  let m;
  while ((m = re.exec(text))) {
    const win = text.slice(m.index + m[0].length, m.index + m[0].length + span);
    const v = win.match(valueRe);
    if (v && v.index < 40) return { m: v, at: m.index };
  }
  return null;
}

function termSheet(text) {
  const t = text.slice(0, 25000);
  const prin = termValue(t, '(?:Aggregate )?Principal Amount(?: \\(in Specified Currency\\))?(?: of (?:the )?Notes)?', /(U\.S\.\s?\$|US\$|C\$|\$|€|£)?\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?)/);
  const mat = termValue(t, '(?:Stated )?Maturity Date', new RegExp(DATE_RE, 'i'));
  const cpn = termValue(t, 'Interest Rate|Coupon(?: Rate)?|Fixed Interest Rate', /(\d{1,2}\.\d{1,4})\s?%/);
  const title = termValue(t, 'Title of (?:the )?(?:Notes|Securities)', /.{5,160}?(?=\s[A-Z][A-Za-z/()' -]{2,40}:|$)/);
  const basis = termValue(t, 'Interest Rate Basis|Base Rate|Benchmark|Floating Rate Basis', /(Compounded SOFR|SOFR|Term SOFR|Treasury|Fed Funds|Prime|EURIBOR|SONIA)/i);
  return {
    principal: prin ? parseAmount(prin.m[2]) : null, principalCur: prin ? (prin.m[1] || '') : '',
    maturity: mat ? toIsoDate(mat.m[0]) : null, coupon: cpn ? Number(cpn.m[1]) : null,
    title: title ? title.m[0].trim() : null, benchmark: basis ? benchmarkOf(basis.m[1]) : null
  };
}

const benchmarkOf = s => (/SOFR/i.test(s) ? 'SOFR' : /Treasury/i.test(s) ? 'Treasury' : /EURIBOR/i.test(s) ? 'EURIBOR' : /SONIA/i.test(s) ? 'SONIA' : /Fed Funds|EFFR/i.test(s) ? 'EFFR' : /Prime/i.test(s) ? 'Prime' : null);

// Spread for a floating / fixed-to-floating tranche, searched near its own mentions.
// Multi-tranche deals give each tranche its own spread, so the window starts at
// a mention of this tranche (a plain "Floating Rate Notes" mention for a floater,
// its coupon for a fixed-to-floating tranche) and stops at the next other tranche.
function findSpread(body, t, single) {
  const anchors = [];
  let re;
  if (single) re = /Floating Rate|Fixed[- ]to[- ]Floating|Spread/gi;
  else if (t.rateType === 'floating') re = /(?<!to[- ])Floating Rate (?:Notes|Debentures|Senior Notes|Global Notes|Medium-Term Notes)/gi;
  else re = new RegExp(`(?<![\\d.])${couponRe(t.coupon)}`, 'g');
  let m;
  while ((m = re.exec(body)) && anchors.length < 150) anchors.push(m.index);   // R-2 (1.2.0): was 60; Home Depot's own mention is the 74th
  if (!anchors.length && single) anchors.push(0);
  // R-2 (1.2.0): a rate preceded by "plus" / "Spread of" is this tranche's own spread, never the next tranche's coupon.
  const NOT_SPREAD = '(?<!(?:plus|\\+|[Ss]pread of)\\s{0,3})';
  const stop = single ? null : t.rateType === 'floating' ? new RegExp(`Fixed[- ]to[- ]Floating|Fixed Rate Notes|${NOT_SPREAD}\\d\\.\\d{2,4}\\s?% (?:Fixed|Senior|Notes)`, 'i')
    : new RegExp(`(?<!to[- ])Floating Rate (?:Notes|Debentures)|${NOT_SPREAD}\\d\\.\\d{2,4}\\s?%`);
  const pats = [
    /(?:Compounded SOFR|SOFR(?: Index)?|Term SOFR|EURIBOR|SONIA|benchmark rate|base rate)[^.%]{0,120}?(?:plus|\+)\s*(?:a spread of\s*)?(\d{1,2}\.\d{1,4})\s?%/i,   // R-2: + "base rate" (Capital One)
    /(?:plus|\+)\s*(?:a spread of\s*)?(\d{1,3}(?:\.\d+)?)\s*basis points/i,
    /Spread(?:\s*\([^)]{0,20}\))?\s*:?\s*(?:plus|\+)?\s*(\d{1,3}(?:\.\d+)?)\s*basis points/i,
    /Spread(?:\s*\([^)]{0,20}\))?\s*:?\s*(?:plus|\+)\s*(\d{1,2}\.\d{1,4})\s?%/i
  ];
  // R-2 (1.2.0): the labelled term-sheet field ("Spread: +65 basis points", Toyota MTN) may sit further from
  // the tranche anchor than prose does; it alone is searched in a wider window, still cut at the next tranche.
  const FIELD = /Spread\s*:\s*(?:plus|\+)?\s*(\d{1,3}(?:\.\d+)?)\s*basis points/i;
  for (const wide of [false, true]) for (const a of anchors) {
    let win = body.slice(a, a + (wide ? 3000 : 1200));
    if (stop) {
      const skip = t.rateType === 'floating' ? 20 : couponRe(t.coupon).length;   // past the anchor itself
      const s = win.slice(skip).search(stop);
      if (s >= 0) win = win.slice(0, skip + s);
    }
    for (const [i, p] of (wide ? [[2, FIELD]] : pats.entries())) {
      const x = win.match(p);
      if (x) {
        const v = Number(x[1]);
        const bps = (i === 0 || i === 3) ? Math.round(v * 100) : Math.round(v);
        if (bps > 0 && bps < 1000) return { bps, benchmark: benchmarkOf(win) || 'SOFR' };
      }
    }
  }
  return null;
}

// Full maturity date for a year-only tranche (§7.4): dates of that year stated
// as a maturity ("will mature on …", "Maturity Date: …"). One distinct date →
// taken; several → the one whose lead-in names this tranche (its coupon, "the
// <year> notes", or "Floating Rate"); otherwise unresolved → parse_failed.
// F4 (1.3.0): + "will mature as to principal on" (Duke junior subordinated, Aug 2024).
const MATURES = new RegExp(`(?:(?:will\\s+)?matur(?:e|es|ing)(?:\\s+as\\s+to\\s+principal)?\\s+on|maturity date (?:of|is|will be)|Maturity Dates?\\s*:?|Stated Maturity(?: Date)?\\s*:?)\\s*(?:the\\s+)?(${DATE_RE})`, 'gi');

function findMaturity(body, t) {
  const cands = new Map();
  MATURES.lastIndex = 0;
  let m;
  while ((m = MATURES.exec(body))) {
    const iso = toIsoDate(m[1]);
    if (!iso || Number(iso.slice(0, 4)) !== t.maturityYear) continue;
    if (!cands.has(iso)) cands.set(iso, []);
    const lead = body.slice(Math.max(0, m.index - 160), m.index);
    cands.get(iso).push({ ctx: lead + m[0], lead, labelled: /^(?:Stated\s+)?Maturity/i.test(m[0]) || /Maturity Dates?\b[^.]{0,80}$/i.test(lead) });
  }
  if (cands.size === 1) return { iso: [...cands.keys()][0] };
  if (cands.size > 1) {
    const names = ({ ctx }) => (t.rateType === 'floating' ? /Floating Rate/i.test(ctx.slice(-200)) && !/Fixed Rate Notes/i.test(ctx.slice(-120))
                                                          : namesCoupon(ctx, t.coupon));
    const hits = [...cands.entries()].filter(([, occ]) => occ.some(names));
    if (hits.length === 1) return { iso: hits[0][0] };
    // F4 (1.3.0), only where the 1.2.0 rule found no single date: the lead-in may name the tranche as
    // "the <year> Notes" (GM, May 2025). If those statements still disagree, only a labelled
    // "Maturity Date(s)" statement decides, and the disagreement is noted for the source check.
    const yr = new RegExp(`\\b${t.maturityYear}\\s+(?:Notes|Debentures|Bonds)\\b[^.]{0,20}$`, 'i');
    const named = [...cands.entries()].filter(([, occ]) => occ.some(o => names(o) || yr.test(o.lead)));
    if (named.length === 1) return { iso: named[0][0] };
    const lab = named.filter(([, occ]) => occ.some(o => o.labelled && (names(o) || yr.test(o.lead))));
    if (named.length > 1 && lab.length === 1) return { iso: lab[0][0], note: `maturity statements disagree (${named.map(([d]) => d).join(' / ')}); labelled "Maturity Date" statement taken (${lab[0][0]})` };
  }
  return null;
}

// Offering-sentence principal ("$500,000,000 aggregate principal amount of our 4.400% notes due 2028").
function findPrincipal(body, t) {
  const c = t.coupon !== null ? couponRe(t.coupon) : 'Floating Rate';
  const re = new RegExp(`(U\\.S\\.\\s?\\$|US\\$|C\\$|\\$|€|£)\\s?(\\d{1,3}(?:,\\d{3})+)(?:\\s+(?:initial\\s+)?aggregate principal amount)?\\s+of\\s+(?:our\\s+|the\\s+|its\\s+)?${c}[^.]{0,80}?${t.maturityYear || ''}`, 'i');
  const m = body.slice(0, 30000).match(re);
  return m ? { amount: parseAmount(m[2]), cur: m[1] } : null;
}

// Coupon not on the cover (junior subordinated / reset-rate deals): the first
// "bear interest … x%" statement that names this tranche's series label; for a
// single-tranche deal any such statement in the summary.
function findCoupon(body, t, single) {
  const s = (t.label || '').match(/\b(?:(20\d\d) )?Series ([A-Z]{1,3}|\d{4}[A-Z]?)\b/);
  const head = body.slice(0, 40000);
  // The initial rate, never a reset spread ("… Treasury Rate plus 1.993%").
  const RATE = '(?:bear interest|interest rate|annual rate|rate of)(?:(?!plus|\\+|spread)[^.%]){0,160}?(\\d{1,2}\\.\\d{1,4})\\s?%';
  if (s) {
    const lab = `${s[1] ? s[1] + ' ' : ''}Series ${s[2]}`.replace(/ /g, '\\s+');
    const m = head.match(new RegExp(`${lab}\\b(?:(?!Series\\s+(?!${s[2]}\\b)[A-Z0-9])[^.]){0,250}?${RATE}`, 'i'));   // never across another series' clause
    if (m) return Number(m[1]);
  }
  if (single) { const m = head.match(new RegExp(RATE, 'i')); if (m) return Number(m[1]); }
  return null;
}

// Identifiers per tranche: a CUSIP/ISIN whose preceding 250 chars name the
// tranche (its maturity year or coupon) — assigned only when unambiguous.
function assignIdentifiers(body, tranches) {
  const ids = findIdentifiers(body.slice(0, 120000));
  if (!ids.length) return;
  const single = tranches.length === 1;
  const byCusip = new Map();
  for (const id of ids) {
    const cusip = id.kind === 'isin' ? (id.value.startsWith('US') ? id.value.slice(2, 11) : null) : id.value;
    const key = cusip || id.value;
    if (!byCusip.has(key)) byCusip.set(key, { cusip, isin: null, at: id.at });
    if (id.kind === 'isin') byCusip.get(key).isin = id.value;
  }
  const groups = [...byCusip.values()];
  if (single) {
    if (groups.length === 1 || new Set(groups.map(g => g.cusip)).size === 1) { tranches[0].cusip ??= groups[0].cusip; tranches[0].isin ??= groups[0].isin; }
    return;
  }
  for (const g of groups) {
    const ctx = body.slice(Math.max(0, g.at - 250), g.at);
    const matches = tranches.filter(t => {
      const yr = t.maturityYear && ctx.includes(String(t.maturityYear));
      const cp = namesCoupon(ctx, t.coupon);
      const fl = t.rateType === 'floating' && /Floating Rate/i.test(ctx.slice(-120));
      return yr || cp || fl;
    });
    // Nearest label wins when several tranches are named in the window.
    let pick = null;
    if (matches.length === 1) pick = matches[0];
    else if (matches.length > 1) {
      const scored = matches.map(t => {
        const keys = [t.coupon !== null ? couponRe(t.coupon) : null, t.maturityYear ? String(t.maturityYear) : null].filter(Boolean);
        const lastAt = src => { const re = new RegExp(src, 'g'); let m, i = -1; while ((m = re.exec(ctx))) i = m.index; return i; };
        return { t, d: Math.min(...keys.map(k => { const i = lastAt(k); return i < 0 ? 1e9 : ctx.length - i; })) };
      }).sort((a, b) => a.d - b.d);
      if (scored[0].d < scored[1].d) pick = scored[0].t;
    }
    if (pick && !pick.cusip && !pick.isin) { pick.cusip = g.cusip; pick.isin = g.isin; }
  }
}

// ── FWP term sheets (§7.4 identifiers, §14.1 cross-check) ────────────────

// Two term-sheet layouts are read; anything else returns [] (no enrichment, no
// cross-check), because a mis-read FWP would wrongly fail a good tranche.
//   columnar: one sheet, values tagged per tranche ("$500,000,000 (2028 Notes)")
//   single:   one tranche per sheet ("Principal Amount: …", "Maturity Date: …")
const FWP_TITLE = new RegExp(`((?:Floating Rate |Fixed[- ]to[- ]Floating Rate |Fixed Rate )?(?:\\d{1,2}\\.\\d{1,4}\\s?% )?(?:Senior |Subordinated |Junior Subordinated |Global )?(?:Floating Rate |Fixed Rate )?(?:Medium-Term )?(?:Notes?|Debentures?)(?:,\\s*Series(?:\\s+[A-Z0-9-]{1,5})?)?\\s+due\\s+(?:${DATE_RE}|\\d{4}))`, 'gi');
const FWP_TAG = /\((?:the\s+)?["“]?(\d{4})?\s*(Fixed Rate |Floating Rate |Fixed-to-Floating Rate )?(?:Notes|Debentures)["”]?\)/g;

export function parseFwp(html) {
  const text = htmlToText(html);
  const head = text.slice(0, 4000);
  const titles = [];
  for (const m of head.matchAll(FWP_TITLE)) {
    const title = m[1];
    const lead = head.slice(Math.max(0, m.index - 40), m.index);
    // F5 (FIX2): "2025 Series A … Notes due 2056" and "2025 Series B … Notes due 2056" are two tranches, not one.
    const series = ((lead.match(/\bSeries\s+([A-Z0-9]{1,3})\s*$/) || [])[1]) || null;
    if (titles.some(t => t.title.toLowerCase() === title.toLowerCase() && t.series === series)) continue;
    const cur = /(?:U\.S\.\s?\$|US\$|C\$|A\$|\$|€|£|¥)\s?\d[\d,]*\s*$/.test(lead) ? currencyOf(lead.match(/(?:U\.S\.\s?\$|US\$|C\$|A\$|\$|€|£|¥)\s?\d[\d,]*\s*$/)[0]) : null;
    titles.push({ title, series, currency: cur, coupon: Number((title.match(/(\d{1,2}\.\d{1,4})\s?%/) || [])[1]) || null,
      year: Number((title.match(/(\d{4})$/) || [])[1]), rateType: rateTypeOf(title) });
  }
  if (!titles.length) return [];
  const out = titles.map(t => ({ ...t, principal: null, maturity: null, cusip: null, isin: null }));

  if (titles.length === 1) {
    const prin = termValue(text, '(?:Aggregate )?Principal Amount(?: Offered)?|Size', /(U\.S\.\s?\$|US\$|\$|€|£)\s?(\d{1,3}(?:,\d{3})+)/);
    const mat = termValue(text, 'Maturity(?: Date)?', new RegExp(DATE_RE, 'i'));
    const ids = findIdentifiers(text.slice(0, 20000));
    const cus = [...new Set(ids.map(x => (x.kind === 'cusip' ? x.value : x.value.startsWith('US') ? x.value.slice(2, 11) : x.value)))];
    out[0].principal = prin ? parseAmount(prin.m[2]) : null;
    // F5 (FIX2): "Aggregate Principal Amount Offered: $1,687,500,000 (to the public) $562,500,000 (to Verizon for
    // redelivery to the … trust)" — one series split by allocation; the deal size is the sum of the parts.
    if (prin) {
      const seg = text.slice(prin.at, prin.at + 400);
      const parts = [...seg.matchAll(/(?:U\.S\.\s?\$|US\$|\$)\s?(\d{1,3}(?:,\d{3})+)\s*\(to\s+[^)]{2,120}\)/g)];
      if (parts.length >= 2 && /\(to\s+the\s+public\)/i.test(parts[0][0])) { out[0].principal = parts.reduce((a, x) => a + parseAmount(x[1]), 0); out[0].principalSplit = parts.length; }
    }
    out[0].maturity = mat ? toIsoDate(mat.m[0]) : null;
    if (cus.length === 1) { out[0].cusip = ids.find(x => x.kind === 'cusip')?.value || null; out[0].isin = ids.find(x => x.kind === 'isin')?.value || null; }
    return out;
  }

  // Columnar: a tag names its tranche by year (and "Floating Rate" when two share a year).
  const tagged = [...text.matchAll(FWP_TAG)].map(m => ({ at: m.index, end: m.index + m[0].length, year: m[1] ? Number(m[1]) : null, floating: /Floating/i.test(m[2] || '') && !/Fixed-to/i.test(m[2] || '') }));
  if (tagged.filter(t => t.year).length < titles.length) return [];
  const pick = tg => {
    const c = out.filter(t => (tg.year ? t.year === tg.year : true) && (tg.floating ? t.rateType === 'floating' : true));
    if (c.length === 1) return c[0];
    const nf = c.filter(t => (tg.floating ? t.rateType === 'floating' : t.rateType !== 'floating'));
    return nf.length === 1 ? nf[0] : null;
  };
  const tagAfter = (pos, within) => tagged.find(t => t.at >= pos && t.at - pos <= within);
  for (const id of findIdentifiers(text.slice(0, 30000))) {
    const tg = tagAfter(id.at, 90);
    const t = tg && pick(tg);
    if (!t) continue;
    if (id.kind === 'cusip' && !t.cusip) t.cusip = id.value;
    if (id.kind === 'isin' && !t.isin) t.isin = id.value;
  }
  const lab = (re, span) => { const i = text.search(re); return i < 0 ? '' : text.slice(i, i + span); };
  const money = /(?:U\.S\.\s?\$|US\$|\$|€|£)\s?(\d{1,3}(?:,\d{3})+)\s*(?=\()/g;
  const pSeg = lab(/Principal Amount(?: Offered)?\s*:/i, 600);
  for (const m of pSeg.matchAll(money)) { const tg = tagAfter(text.indexOf(pSeg) + m.index + m[0].length, 4); const t = tg && pick(tg); if (t && !t.principal) t.principal = parseAmount(m[1]); }
  const mSeg = lab(/Maturity Dates?\s*:/i, 600);
  for (const m of mSeg.matchAll(new RegExp(`(${DATE_RE})\\s*(?=\\()`, 'gi'))) { const tg = tagAfter(text.indexOf(mSeg) + m.index + m[0].length, 4); const t = tg && pick(tg); if (t && !t.maturity) t.maturity = toIsoDate(m[1]); }
  return out;
}

function fwpMatch(t, fwpSections) {
  const yr = t.maturity ? Number(t.maturity.slice(0, 4)) : t.maturityYear;
  // A section in another currency is another deal on the same shelf (AT&T USD vs EUR floaters, Aug 2026).
  const c = fwpSections.filter(s => s.year === yr && s.rateType === t.rateType && (t.rateType === 'floating' ? true : s.coupon === t.coupon)
                                    && (!s.currency || s.currency === (t.currency || 'USD')));
  return c.length === 1 ? c[0] : null;
}

// ── F6 (MA-NOV-BOND.FIX2): identifiers, pricing date and banks from same-deal term sheets ──
// Four layouts seen on the cached corpus (FIX2 report §2):
//   labelled  "CUSIP / ISIN: 2028 Notes: 45865V AA8 / US45865VAA89 2031 Notes: …", "CUSIP: Notes due 2033: …"
//   columns   one value per tranche, in the order of the term sheet's title row ("CUSIP / ISIN / Common Code: a / b / c  d / e / f")
//   sections  one block per tranche, headed by its title, each with its own "CUSIP/ISIN:" line
//   single    one tranche per term sheet (MTN drawdowns)
// Each identifier group is keyed by maturity year (+ coupon, rate type where printed) and must match exactly one
// 424B tranche; an identifier that lands on two tranches, or a tranche that gets two identifiers, is dropped.
const TS_TITLE = new RegExp(`\\b(?:Notes?|Debentures?)(?:,?\\s*Series(?:\\s+[A-Z0-9-]{1,5})?)?\\s+due\\s+(${DATE_RE}|\\d{4})\\b`, 'gi');
const TS_LBL_DUE = new RegExp(`(?:(\\d{1,2}\\.\\d{1,4})\\s?%\\s+)?(?:(Fixed[- ]to[- ]Floating Rate|Floating Rate|Fixed Rate)\\s+)?(?:(?:Senior|Global|Subordinated)\\s+)?(?:Notes|Debentures)\\s+due\\s+(${DATE_RE}|\\d{4})\\s*:\\s*$`, 'i');
const TS_LBL_YEAR = /(?:^|[\s:;,(])(\d{4})\s+(?:(Fixed[- ]to[- ]Floating Rate|Floating Rate|Fixed Rate)\s+)?(?:Senior\s+)?(?:Notes|Debentures)\s*:\s*$/i;
const TS_LBL_RATE = /(?:^|[\s:;,(])(Floating Rate|Fixed Rate|Fixed[- ]to[- ]Floating Rate)\s+(?:Senior\s+)?Notes\s*:\s*$/i;
const TS_SEP = /^[\s/,;|]*$/;
const yearOf = s => Number((String(s).match(/(\d{4})\s*$/) || [])[1]) || null;

function tsTitles(text) {
  const out = [];
  TS_TITLE.lastIndex = 0;
  let m, prev = 0;
  while ((m = TS_TITLE.exec(text))) {
    let phrase = text.slice(Math.max(prev, m.index - 90), m.index);
    const cut = Math.max(phrase.search(/[:;](?![^:;]*[:;])/), phrase.search(/\.\s(?!.*\.\s)/));   // last label colon or sentence end
    if (cut >= 0) phrase = phrase.slice(cut + 1);
    const cps = phrase.match(/(\d{1,2}\.\d{1,4})\s?%/g) || [];
    out.push({ at: m.index, end: m.index + m[0].length, year: yearOf(m[1]), coupon: cps.length ? Number(cps.pop().replace(/[%\s]/g, '')) : null,
               rate: rateTypeOf(phrase + ' ' + m[0]) });
    prev = m.index + m[0].length;
  }
  return out;
}

export function fwpTermSheet(html) {
  const text = htmlToText(html).slice(0, 60000);
  // Identifier groups: a CUSIP and its ISIN printed together ("45865V AA8 / US45865VAA89") are one group.
  const ids = findIdentifiers(text).filter(id => !(id.kind === 'cusip' && /^\d{9}$/.test(id.value) && /Common Code/i.test(text.slice(Math.max(0, id.at - 160), id.at))));
  // Title row: the tranche titles at the top of the sheet, in order — first 4,000 characters and before the first
  // identifier (a later "concurrently offering … Notes due …" sentence is another deal, not a column).
  const head = [];
  for (const t of tsTitles(text.slice(0, Math.min(4000, ids.length ? ids[0].at : 4000)))) if (!head.some(h => h.year === t.year && h.coupon === t.coupon && h.rate === t.rate)) head.push(t);
  const groups = [];
  let prevEnd = 0;
  for (const id of ids) {
    const end = id.at + (text.startsWith(id.value, id.at) ? id.value.length : id.value.length + 1);   // "45865V AA8" is printed with a space
    const gap = text.slice(prevEnd, id.at).replace(/\b\d{9}\b/g, '');   // Common Codes between groups are separators
    const g = groups[groups.length - 1];
    if (g && TS_SEP.test(gap) && !g[id.kind] && g.n < 2) { g[id.kind] = id.value; g.end = end; g.n++; }
    else groups.push({ cusip: id.kind === 'cusip' ? id.value : null, isin: id.kind === 'isin' ? id.value : null, at: id.at, end, n: 1,
                       gap: text.slice(Math.max(prevEnd, id.at - 160), id.at), sepBefore: !!g && TS_SEP.test(gap) });
    prevEnd = end;
  }
  const keyed = [];
  const distinct = new Set(groups.map(g => g.cusip || (g.isin?.startsWith('US') ? g.isin.slice(2, 11) : g.isin))).size;
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (g.isin && g.cusip && g.isin.startsWith('US') && g.isin.slice(2, 11) !== g.cusip) continue;
    const lbl = g.gap.trimEnd();
    let m;
    if ((m = lbl.match(TS_LBL_DUE))) keyed.push({ ...g, year: yearOf(m[3]), coupon: m[1] ? Number(m[1]) : null, rate: m[2] ? rateTypeOf(m[2]) : null, layout: 'labelled' });
    else if ((m = lbl.match(TS_LBL_YEAR))) keyed.push({ ...g, year: Number(m[1]), coupon: null, rate: m[2] ? rateTypeOf(m[2]) : null, layout: 'labelled' });
    else if ((m = lbl.match(TS_LBL_RATE))) keyed.push({ ...g, year: null, coupon: null, rate: rateTypeOf(m[1]), layout: 'labelled' });
    else {
      // An unlabelled run of k groups separated only by "/" or spaces: one column per title, in title-row order.
      let j = i; while (j + 1 < groups.length && groups[j + 1].sepBefore) j++;
      const run = groups.slice(i, j + 1);
      if (run.length >= 2) {
        if (run.length === head.length) run.forEach((r, k) => keyed.push({ ...r, year: head[k].year, coupon: head[k].coupon, rate: head[k].rate, layout: 'columns' }));
        i = j; continue;
      }
      if (head.length === 1 && distinct === 1) { keyed.push({ ...g, year: head[0].year, coupon: head[0].coupon, rate: head[0].rate, layout: 'single' }); continue; }
      // Sections: the nearest tranche title before this identifier heads its block. With a title row of several
      // tranches, only a title printed after that row counts (the row's last title is not the first block's header).
      const headEnd = head.length > 1 ? head[head.length - 1].end : 0;
      const sec = tsTitles(text.slice(0, g.at)).filter(t => t.at >= headEnd).pop();
      if (sec) keyed.push({ ...g, year: sec.year, coupon: sec.coupon, rate: sec.rate, layout: 'sections' });
    }
  }
  // A labelled year-only key takes coupon / rate from the title row when one title has that year.
  for (const k of keyed) if (k.year && k.coupon === null && k.rate === null) {
    const h = head.filter(t => t.year === k.year);
    if (h.length === 1) { k.coupon = h[0].coupon; k.rate = h[0].rate; }
  }
  // Guards (FIX2 dry run: a USD floater's sheet on the same shelf as a EUR floater due the same year): the sheet's currency,
  // when its title block uses one currency only, and — for a one-tranche sheet — its labelled maturity date.
  const curs = new Set([...text.slice(0, Math.min(4000, ids.length ? ids[0].at : 4000)).matchAll(/(U\.S\.\s?\$|US\$|C\$|A\$|€|£|¥|\$)\s?\d/g)].map(m => currencyOf(m[1])));
  const currency = curs.size === 1 ? [...curs][0] : null;
  const mat = termValue(text, '(?:Stated |Final )?Maturity(?: Date)?', new RegExp(DATE_RE, 'i'));
  for (const k of keyed) { k.currency = currency; k.maturity = k.layout === 'single' && mat ? toIsoDate(mat.m[0]) : null; }
  const priced = termValue(text, 'Trade Date|Pricing Date|Date of Pricing', new RegExp(DATE_RE, 'i'));
  return { ids: keyed.map(({ cusip, isin, year, coupon, rate, layout, currency, maturity }) => ({ cusip, isin, year, coupon, rate, layout, currency, maturity })),
           pricedOn: priced ? toIsoDate(priced.m[0]) : null, banks: fwpBanks(text) };
}

// Spec v2 §4 (captured for OFFER1, not written): printed bank roles on a term sheet, names as printed.
const BANK_ROLE = /(Joint Book[- ]Running Managers?|Book[- ]Running Managers?|Joint Lead Managers?(?: and (?:Joint )?Bookrunners)?|Lead Managers?|Senior Co-Managers?|Junior Co-Managers?|Co-Managers?|Passive Bookrunners?|Underwriters?|Purchasing Agents?|Lead Agents?|Agents?)\s*:/gi;
// A name ends at its legal-form suffix ("Goldman Sachs & Co. LLC", "BofA Securities, Inc.", "ICBC Standard Bank Plc").
const BANK_NAME = /[A-Z][^:;]{1,80}?(?:,?\s(?:Inc\.|INC\.|LLC|L\.L\.C\.|L\.P\.|Plc|plc|PLC|Limited|LIMITED|Ltd\.|Corp\.|CORP\.|Corporation|Incorporated|N\.A\.|N\.V\.|S\.A\.|AG|GmbH|PBC))(?=[\s,;*]|$)/g;
function fwpBanks(text) {
  const out = [];
  BANK_ROLE.lastIndex = 0;
  const marks = [...text.matchAll(BANK_ROLE)];
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i];
    const start = m.index + m[0].length;
    const stop = Math.min(start + 900, i + 1 < marks.length ? marks[i + 1].index : Infinity);
    let seg = text.slice(start, stop);
    const nx = seg.search(/\s[A-Z][A-Za-z'’/() -]{2,40}\*?:/);   // next "Label:" ends the block
    if (nx >= 0) seg = seg.slice(0, nx);
    const names = [...new Set((seg.match(BANK_NAME) || []).map(s => s.replace(/\s+/g, ' ').replace(/^[^(]*\)\s*(?=[A-Z])/, '').replace(/^(?:and|,)\s+/i, '').trim())
      .filter(s => s.length > 3 && !/\b(?:Notes?|Debentures?)\b/.test(s)))].slice(0, 40);
    if (names.length) out.push({ role_printed: m[1].replace(/\s+/g, ' '), names });
  }
  return out;
}

// Assign term-sheet identifiers to tranches still without one (unique both ways; check digits re-checked).
function assignTermSheetIds(tranches, sheets, { only = new Set(tranches), taken: extra = [] } = {}) {
  const want = new Map();   // tranche index → { cusip, isin, from, layout }
  const bad = new Set();
  const taken = new Set([...tranches.map(t => t.cusip), ...tranches.map(t => t.isin?.startsWith('US') ? t.isin.slice(2, 11) : null), ...extra].filter(Boolean));
  for (const s of sheets) for (const k of s.ids) {
    const cusip = k.cusip && cusipValid(k.cusip) ? k.cusip : k.isin && k.isin.startsWith('US') && isinValid(k.isin) ? k.isin.slice(2, 11) : null;
    if (!cusip || taken.has(cusip)) continue;
    const hits = tranches.map((t, i) => [t, i]).filter(([t]) => {
      const yr = t.maturity ? Number(t.maturity.slice(0, 4)) : t.maturityYear;
      if (k.year && yr !== k.year) return false;
      if (!k.year && tranches.filter(u => u.rateType === k.rate).length !== 1) return false;
      if (k.rate && k.rate !== t.rateType) return false;
      if (k.coupon !== null && k.coupon !== undefined && t.coupon !== null && t.coupon !== undefined && k.coupon !== t.coupon) return false;
      if (k.currency && k.currency !== (t.currency || 'USD')) return false;
      if (k.maturity && t.maturity && k.maturity !== t.maturity) return false;
      return true;
    });
    // "2028 Notes:" next to "2028 Floating Rate Notes:" on the same sheet names the other 2028 tranche.
    let pick = hits;
    if (hits.length > 1 && k.year && !k.rate) {
      const claimed = new Set(s.ids.filter(o => o !== k && o.year === k.year && o.rate && o.layout === 'labelled').map(o => o.rate));
      pick = hits.filter(([t]) => !claimed.has(t.rateType));
    }
    if (pick.length !== 1) continue;
    const i = pick[0][1];
    const prev = want.get(i);
    if (prev && prev.cusip !== cusip) { bad.add(i); continue; }
    want.set(i, { cusip, isin: prev?.isin || (k.isin && isinValid(k.isin) ? k.isin : null), from: s.fwp, layout: k.layout });
  }
  const byCusip = new Map();
  for (const [i, v] of want) if (!bad.has(i)) byCusip.set(v.cusip, (byCusip.get(v.cusip) || []).concat(i));
  for (const [i, v] of want) {
    if (bad.has(i) || byCusip.get(v.cusip).length !== 1) continue;
    const t = tranches[i];
    if (t.cusip || t.isin || !only.has(t)) continue;
    t.cusip = v.cusip; t.isin = v.isin; t.idFrom = v.from; t.idLayout = v.layout;
  }
}

// ── Whole-document parse ─────────────────────────────────────────────────

// filing: { accessionNumber, form, filingDate, cik, url }
// fwps:   [{ accessionNumber, html }] same-deal FWPs (caller selects by §7.4 window)
// Returns { status, rule, title, rows: [bond_issuance rows], notes: [...], fwpNeeded }.
export function parseFiling(filing, html, { fwps = [], ingestedAt = new Date().toISOString(), parserVersion = PARSER_VERSION } = {}) {
  const text = htmlToText(html);
  const base = { accession_number: filing.accessionNumber, cik: filing.cik, form_type: filing.form, filing_date: filing.filingDate,
                 source_url: filing.url, parser_version: parserVersion, ingested_at: ingestedAt };
  // F8: every whole-filing row carries its status_reason (run log / dry-run record; not a D1 column until BOND-CR1).
  const audit = (status, rule, extra = {}) => ({ status, rule, reason: extra.reason || null, title: auditTitle(text) || extra.title || null, notes: extra.notes || [],
    ...(extra.draftLines !== undefined ? { draftLines: extra.draftLines, draftTranches: extra.draftTranches } : {}),
    rows: [{ ...base, tranche_seq: 0, instrument_key: null, isin: null, cusip: null, filing_status: status, tranche_label: null, security_class: null,
             rate_type: null, coupon_rate: null, spread_bps: null, benchmark: null, principal_amount: null, currency: 'USD', maturity_date: null,
             seniority: null, parse_confidence: 0, status_reason: extra.reason || null }], fwpNeeded: false });

  if (filing.form === 'FWP') return { status: 'informational', rule: 'R2', rows: [], notes: [], fwpNeeded: false };
  const { header, title } = extractTitle(text);
  const pre = preliminaryRule(filing.form, text);
  if (pre) {
    // F1: the title gate (other → structured → non-debt) runs on a draft before it is called preliminary.
    const dc = classifyTitle(title, text);
    if (dc.status === 'skipped_structured') return audit(dc.status, `F1 ${pre} / ${dc.rule}`, { title: header.slice(0, 300), reason: 'draft_structured' });
    if (dc.status === 'skipped_non_debt') return audit(dc.status, `F1 ${pre} / ${dc.rule}`, { title: header.slice(0, 300), reason: 'draft_not_debt' });
    if (dc.status === 'skipped_other' && dc.rule.startsWith('7.3-1')) return audit(dc.status, `F1 ${pre} / ${dc.rule}`, { title: header.slice(0, 300), reason: dc.reason });
    // F2: the runner links the draft to its final; until then it has none.
    return audit('preliminary', pre, { reason: 'draft_no_final', draftLines: draftTrancheLines(header), draftTranches: draftTranches(header) });
  }

  const cls = classifyTitle(title, text);
  if (cls.status !== 'debt') return audit(cls.status, cls.rule, { title: header.slice(0, 300), reason: cls.reason });

  const body = text.slice(0, 120000);
  let tranches = retailTranches(text);
  let shape = 'retail';
  if (!tranches.length) { tranches = coverTranches(header); shape = 'cover'; }
  const ts = termSheet(text);
  if (!tranches.length && (MTN.test(title) || ts.maturity)) {
    // Single MTN pricing supplement (§7.4): terms from the pricing-supplement table.
    const lab = ts.title || (title.match(/Medium[- ]Term Notes[^|]{0,120}/i) || [title])[0];
    tranches = [{ label: lab.slice(0, 200), principal: ts.principal, principalCur: ts.principalCur, coupon: ts.coupon,
      rateType: rateTypeOf(lab + ' ' + (ts.benchmark ? 'Floating' : '')), seniority: seniorityOf(lab), securityClass: 'notes',
      maturityText: ts.maturity, maturity: ts.maturity, maturityYear: ts.maturity ? Number(ts.maturity.slice(0, 4)) : null,
      currency: currencyOf(lab), termsCurrency: ts.principalCur ? currencyOf(ts.principalCur) : null, source: 'terms', path: cls.rule === 'B-3a' ? 'B-3a' : '7.3-4' }];
    shape = 'terms';
  }
  const program = PROGRAM.test(text.slice(0, 3000));
  if (!tranches.length) return program ? audit('skipped_other', '7.3-5iv', { title: header.slice(0, 300), reason: 'program_supplement' })   // F3
                                       : audit('parse_failed', 'no tranche found', { title: header.slice(0, 300), reason: 'no_tranche' });

  const single = tranches.length === 1;
  for (const t of tranches) {
    if (single && shape === 'cover') {                              // single-tranche deals: the term sheet fills gaps
      t.principal ??= ts.principal;
      if (!t.maturity && ts.maturity && Number(ts.maturity.slice(0, 4)) === t.maturityYear) t.maturity = ts.maturity;
      if (t.coupon === null && ts.coupon !== null && t.rateType !== 'floating') t.coupon = ts.coupon;
    }
    if (!t.maturity && t.maturityYear) { const fm = findMaturity(body, t); if (fm) { t.maturity = fm.iso; t.maturityNote = fm.note || null; } }
    if (t.principal === null) { const p = findPrincipal(body, t); if (p) { t.principal = p.amount; t.bodyCurrency = currencyOf(p.cur); } }
    if (t.coupon === null && t.rateType !== 'floating') t.coupon = findCoupon(body, t, single);
    if (t.rateType !== 'fixed') {
      const s = findSpread(body, t, single);
      if (s) { t.spread = s.bps; t.benchmark = s.benchmark; }
      else if (ts.benchmark && single) t.benchmark = ts.benchmark;
    }
  }
  // F3: a programme supplement prices nothing — no tranche has both an amount and a full maturity.
  if (program && !tranches.some(t => t.principal > 0 && t.maturity)) return audit('skipped_other', '7.3-5iv', { title: header.slice(0, 300), reason: 'program_supplement' });
  assignIdentifiers(body, tranches.filter(t => !t.cusip));

  // FWP enrichment and cross-check (§7.4, §14.1).
  const fwpSections = fwps.flatMap(f => parseFwp(f.html).map(s => ({ ...s, fwp: f.accessionNumber })));
  const notes = [];
  const fwpHit = tranches.map(t => (fwpSections.length ? fwpMatch(t, fwpSections) : null));
  // F6: term-sheet identifiers for tranches the 424B and the 1.2 FWP reader leave without one.
  const sheets = fwps.map(f => ({ ...fwpTermSheet(f.html), fwp: f.accessionNumber }));
  const open = tranches.filter((t, i) => !t.cusip && !t.isin && !(fwpHit[i] && (fwpHit[i].cusip || fwpHit[i].isin)));
  if (sheets.length && open.length) assignTermSheetIds(tranches, sheets, { only: new Set(open), taken: fwpHit.map(f => f?.cusip).filter(Boolean) });
  const rows = tranches.map((t, i) => {
    const f = fwpHit[i];
    let conflict = null;
    if (f) {
      if (!t.cusip && !t.isin) { t.cusip = f.cusip && cusipValid(f.cusip) ? f.cusip : (f.isin?.startsWith('US') ? f.isin.slice(2, 11) : null); t.isin = f.isin; t.idFrom = f.fwp; }
      if (f.principal && t.principal && Math.abs(f.principal - t.principal) > 0.5) conflict = `principal ${t.principal} vs FWP ${f.principal}`;
      else if (f.principalSplit) notes.push(`tranche ${i + 1}: term-sheet amount printed in ${f.principalSplit} allocations (to the public and other); their total agrees with the 424B`);
      if (f.maturity && t.maturity && f.maturity !== t.maturity) conflict = `maturity ${t.maturity} vs FWP ${f.maturity}`;
    }
    if (t.isin && !isinValid(t.isin)) t.isin = null;
    if (t.cusip && !cusipValid(t.cusip)) t.cusip = null;
    if (t.isin && t.cusip && t.isin.startsWith('US') && t.isin.slice(2, 11) !== t.cusip) { notes.push(`tranche ${i + 1}: ISIN/CUSIP disagree; both dropped`); t.isin = null; t.cusip = null; }
    const rateOk = t.rateType === 'floating' ? (t.spread != null && !!t.benchmark) : t.coupon !== null;
    let conf = 40 + (t.principal > 0 ? 15 : 0) + (rateOk ? 15 : 0) + (t.maturity ? 15 : 0) + ((t.cusip || t.isin) ? 10 : 0) + (f && !conflict ? 5 : 0);
    if (conflict) { conf = Math.min(conf, 59); notes.push(`tranche ${i + 1}: FWP disagreement (${conflict})`); }
    // Why a tranche cannot be final: §14.1 score, §7.4 full maturity, L8-14 principal,
    // and B-3 condition 2 for retail-table rows (coupon or floating benchmark).
    const why = [];
    if (conf < 60) why.push(`confidence ${conf}`);
    if (!t.maturity) why.push('no full maturity');
    if (!(t.principal > 0)) why.push('L8-14 no principal');
    if (t.path === 'B-3b' && !(t.coupon !== null || (t.rateType === 'floating' && t.benchmark))) why.push('B-3b no coupon/benchmark');
    const final = why.length === 0;
    if (t.termsCurrency && t.termsCurrency !== t.currency) notes.push(`tranche ${i + 1}: title currency ${t.currency}, term-sheet currency ${t.termsCurrency} (title kept, B-4 condition 2)`);
    if (t.bodyCurrency && t.bodyCurrency !== t.currency) notes.push(`tranche ${i + 1}: title currency ${t.currency}, offering-sentence currency ${t.bodyCurrency} (title kept, B-4 condition 2)`);
    if (t.maturityNote) notes.push(`tranche ${i + 1}: ${t.maturityNote}`);
    const isin = t.isin || null, cusip = t.cusip || null;
    // F8: the reason a tranche is not final (one code, first that applies), or what a partial final lacks.
    const reason = final ? null : conflict ? 'fwp_conflict' : !t.maturity ? 'no_maturity' : !(t.principal > 0) ? 'no_principal' : 'low_confidence';
    const missing = final ? missingOf(t, isin, cusip) : [];
    return { ...base, tranche_seq: i + 1, instrument_key: final ? instrumentKey(isin, cusip) : null, isin, cusip,
      filing_status: final ? 'final' : 'parse_failed', tranche_label: t.label || null, security_class: t.securityClass || 'notes',
      rate_type: t.rateType, coupon_rate: t.rateType === 'floating' ? null : t.coupon, spread_bps: t.spread ?? null, benchmark: t.benchmark ?? null,
      principal_amount: t.principal ?? null, currency: t.currency || 'USD', maturity_date: t.maturity || null, seniority: t.seniority ?? null,
      parse_confidence: conf, path: t.path || '7.3-4', ...(t.idLayout ? { id_source: `fwp ${t.idFrom} (${t.idLayout})` } : {}), status_reason: final ? (missing.length ? 'partial' : null) : reason,
      ...(missing.length ? { missing } : {}), ...(final ? {} : { fail_reason: why.join('; ') }) };   // path / fail_reason / status_reason / missing: run log only (not columns)
  });
  const fwpNeeded = rows.some(r => r.filing_status === 'final' && !r.cusip && !r.isin) && !fwps.length;
  const co = coverIssuers(header);
  // Spec v2 §3 #12 / §4 (captured, not written until CR2): pricing date and banks as the same-deal term sheet labels them.
  const pricedSheet = sheets.find(s => s.pricedOn), bankSheet = sheets.find(s => s.banks.length);
  const offering = sheets.length ? { priced_on: pricedSheet?.pricedOn || null, priced_on_source: pricedSheet ? `fwp ${pricedSheet.fwp}` : null,
                                     banks: bankSheet?.banks || [], banks_source: bankSheet ? `fwp ${bankSheet.fwp}` : null } : null;
  return { status: 'debt', rule: `${cls.rule} / ${shape}`, title: header.slice(0, 300), rows, notes, fwpNeeded, coIssuers: co.names, guaranteed: co.guaranteed,
           ...(offering ? { offering } : {}) };
}

// F8 partial (spec v1 §1.3): a final row without a CUSIP/ISIN, or without its rate — the coupon (fixed,
// fixed-to-floating) or the spread and benchmark (floating, fixed-to-floating).
function missingOf(t, isin, cusip) {
  const out = [];
  if (!isin && !cusip) out.push('cusip');
  if (t.rateType !== 'floating' && (t.coupon === null || t.coupon === undefined)) out.push('coupon');
  if (t.rateType !== 'fixed' && (t.spread == null || !t.benchmark)) out.push('spread');
  return out;
}

// F2: the number of tranche lines on a draft's cover ("$ % Notes due , 20", "Floating Rate Notes due 20__").
// The runner compares it with the final's tranche count; drafts carry no tranche identity.
const DRAFT_LINE = /\b(?:Notes?|Debentures?|Bonds?)(?:,?\s*Series(?:\s+[A-Z0-9-]{1,5})?)?\s+due\b/gi;
export const draftTrancheLines = header => (String(header).match(DRAFT_LINE) || []).length;

// F2b (FIX2): what each draft cover line says about its tranche — rate type, and the maturity year where the
// draft prints one ("Floating Rate Notes due 2029"; "% Notes due 20" has none). A line that repeats an identified
// line (same year or series, same words) is the cover's title sentence, not another tranche.
export function draftTranches(header) {
  const h = String(header), out = [], seen = new Set();
  const re = new RegExp(DRAFT_LINE.source, 'gi');
  let m, prev = 0;
  while ((m = re.exec(h))) {
    const lead = h.slice(Math.max(prev, m.index - 80), m.index);
    const yr = h.slice(m.index + m[0].length, m.index + m[0].length + 30).match(new RegExp(`^\\s*((?:${MONTH_RE}\\s+\\d{1,2}\\s*,\\s*)?(\\d{4}))\\b`, 'i'));
    const series = (lead.match(/\bSeries\s+([A-Z0-9]{1,6})\b/i) || [])[1] || null;
    const rate = rateTypeOf(lead.slice(-60) + ' ' + m[0]);
    const key = `${rate}|${yr ? yr[1].replace(/\s+/g, ' ').toLowerCase() : ''}|${series || ''}`;
    prev = m.index + m[0].length;
    if ((yr || series) && seen.has(key)) continue;
    seen.add(key);
    out.push({ rate, year: yr ? Number(yr[2]) : null, series });
  }
  return out;
}

// N-3: an audit title for whole-filing rows. EDGAR header tokens and the SEC
// legend are dropped, and the cover's offering line is preferred. Report-only:
// classification still uses extractTitle() unchanged.
const EDGAR_TOKENS = /\b\d*\s*\S+\.html?\b|\S+ - none - [\d.]+s|\bTABLE OF CONTENTS\b|\bTable of Contents\b|\bDocument\b|\b424B\d\b|\bFWP\b|Filed [Pp]ursuant to Rule 424\(b\)\s*\(?\d\)?|(?:Registration|SEC File|File)\s+(?:Statement\s+)?Nos?\.?:?\s*333-[\d-]+(?:\s+(?:and\s+)?333-[\d-]+)*/g;
const LEGEND = /Neither the Securities and Exchange Commission[^.]*\.(?:[^.]*\.){0,3}?[^.]*criminal offense\.|Any representation to the contrary is a criminal offense\./gi;
const OFFERING_LINE = /(?:Offers? to Exchange|Exchange Offer for)(?:L\.P\.|Inc\.|[^.]){0,160}|(?:Up to\s+)?(?:[$€£]\s?)?\d{1,3}(?:,\d{3})+(?:\.\d+)?\s+(?:(?:[A-Z][\w.-]*\s){0,6})?(?:Shares\b(?:\s+of)?(?:\s+(?:The\s+)?[A-Z][\w.&-]*){0,4}\s+Common Stock|Shares\b|Depositary Shares\b[^.]{0,100}|(?:\d{4}\s+)?(?:Series\s+\w+\s+)?Equity Units\b|of Common Stock|Common Stock)|Variable Denomination Floating Rate Demand Notes|MERGER PROPOSED|NOTICE OF ACTION BY WRITTEN CONSENT/;

export function auditTitle(text) {
  const t = text.slice(0, 6000).replace(LEGEND, ' ').replace(EDGAR_TOKENS, ' ').replace(/\s+/g, ' ').trim();
  const m = t.match(OFFERING_LINE);
  if (m) return m[0].trim().slice(0, 200);
  const { header } = extractTitle(t);
  return header.trim().slice(0, 200) || null;
}

// L8-12: co-registrant issuers named on the cover (a subsidiary issuer whose
// filing sits under the parent's CIK). The runner resolves each name to its own
// CIK from the filing's EDGAR index; ≥ 2 names on one cover = a mixed cover.
const CO_ISSUER = /\b((?:[A-Z][\w.&'-]*\s){1,6}(?:Capital Holdings, Inc\.|OP LLC|Finance B\.V\.|Finance LLC|International Finance B\.V\.))/g;

export function coverIssuers(header) {
  const names = [];
  for (const m of header.matchAll(CO_ISSUER)) {
    // A run of capitalised words can start inside the guarantor's name ("… Guaranteed by
    // Welltower Inc. Welltower OP LLC"): keep only what follows the last entity suffix.
    const n = m[1].trim().replace(/^(?:(?:PROSPECTUS|SUPPLEMENT|PRICING|Prospectus|Supplement|Pricing|and|of)\s+)+/, '')
      .replace(/^.*\b(?:Inc\.|Corporation|Company|Corp\.)\s+(?=[A-Z])/, '');
    if (!names.some(x => normName(x) === normName(n))) names.push(n);
  }
  return { names, guaranteed: /(?:Fully and )?(?:Unconditionally|Irrevocably)(?: and (?:Unconditionally|Irrevocably))? Guaranteed by/i.test(header) };
}
export const normName = s => String(s).toLowerCase().replace(/&amp;/g, '&').replace(/[.,'’]/g, '').replace(/\b(inc|llc|bv|corp|corporation|co|company|the)\b/g, '').replace(/\s+/g, ' ').trim();

// Cover-issuer hint for the Data-Identity Lead (L8-4): a co-registrant or
// guaranteed subsidiary named on the cover. Report-only; never changes a row.
export function coverIssuerHint(header) {
  const m = header.match(/\b((?:[A-Z][\w.&'-]*\s){1,6}(?:Capital Holdings, Inc\.|OP LLC|Finance B\.V\.|Finance LLC|International Finance B\.V\.))/);
  const g = /(?:Fully and )?Unconditionally Guaranteed by/i.test(header);
  return m ? m[1].trim() : g ? 'guaranteed (see cover)' : null;
}
