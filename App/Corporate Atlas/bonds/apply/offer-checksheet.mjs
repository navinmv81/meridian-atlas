// MA-NOV-BOND.OFFER2 — writes the 20-filing manual check sheet (spec v2 §6.2) for U8 BOND.VERIFY from an offer-dryrun.mjs output.
//
//   node offer-checksheet.mjs --run=<offer-dryrun output> --out=<offer-check-sheet.md> --generated=<ISO time>
//
// Every row that the bond page would show for these filings is listed: each fact (including "Not stated in the filing" and
// "Not applicable", which are claims too) and each party, with where it was read. The checker fills "Source value", "OK" (Y/N) and
// "Note". The sample is stratified as spec v2 §6.2: A 424B5 USD 4 · A multi-tranche 4 (one EUR, one guaranteed subsidiary) · A with a
// change-of-control or special mandatory redemption 2 · B Toyota 2 · Caterpillar 2 · Deere 2 · C Verizon 2 · GM 2.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const arg = Object.fromEntries(process.argv.slice(2).map(s => s.match(/^--([a-z0-9-]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2]]));
for (const k of ['run', 'out', 'generated']) if (!arg[k]) throw new Error(`--${k}= is required`);

export const SAMPLE = [
  ['A 424B5 syndicated, USD', '0001193125-25-142782', 'UNH, 4 tranches, change of control'],
  ['A 424B5 syndicated, USD', '0001193125-26-349174', 'ICE, tranche-specific bank roles, special mandatory redemption on 2 of 4 tranches'],
  ['A 424B5 syndicated, USD', '0001104659-26-020619', 'AbbVie, 7 tranches, tranche-specific bank rows'],
  ['A 424B5 syndicated, USD', '0001104659-24-000673', 'Duke, 2 tranches'],
  ['A multi-tranche', '0001193125-25-064173', 'AT&T, EUR, European bank names, tax redemption'],
  ['A multi-tranche', '0001193125-25-120844', 'Pfizer Netherlands, EUR, guaranteed by Pfizer Inc. (filed as 424B5)'],
  ['A multi-tranche', '0000950103-24-000197', 'Toyota syndicated pricing supplement (family A), floating + fixed, two not redeemable'],
  ['A multi-tranche', '0001193125-25-217490', 'Oracle, 6 tranches'],
  ['A change of control / special mandatory redemption', '0001193125-25-216381', 'Lowe’s, change of control + special mandatory redemption'],
  ['A change of control / special mandatory redemption', '0001193125-24-134264', 'CVS, change of control'],
  ['B Toyota', '0000950103-24-000537', 'Toyota MTN, fixed rate callable'],
  ['B Toyota', '0000950103-24-002543', 'Toyota MTN, floating, two agents with separate commissions'],
  ['B Caterpillar', '0001104659-24-105055', 'Caterpillar, bank list not split in OFFER1'],
  ['B Caterpillar', '0001104659-24-000426', 'Caterpillar, fixed'],
  ['B Deere', '0001104659-24-000827', 'Deere, fixed, "Redemption Provisions: None"'],
  ['B Deere', '0001104659-24-005136', 'Deere, floating'],
  ['C Verizon', '0001193125-24-057532', 'Verizon retail table, 2 CUSIPs'],
  ['C Verizon', '0001193125-24-207015', 'Verizon retail table'],
  ['C GM', '0000804269-25-000011', 'GM retail table, 2 CUSIPs'],
  ['C GM', '0000804269-25-000028', 'GM retail table, 5 agents + trustee'],
];

const LABEL = {
  document_date: 'Date of this document', identifier: 'CUSIP / ISIN', amount: 'Amount', currency: 'Currency', interest_rate: 'Interest rate', maturity: 'Matures',
  issue_price_pct: 'Price to investors', interest_paid: 'Interest paid', day_count: 'How interest is counted', priced_on: 'Priced on', issue_date: 'Issue date',
  ranking: 'Ranking', secured: 'Secured or unsecured', early_repayment: 'Early repayment by the issuer', change_of_control: 'Buy-back if control changes',
  special_mandatory_redemption: 'Mandatory early repayment if a deal fails', survivors_option: 'Repayment on the holder’s death', use_of_proceeds: 'What the money is for',
  bank_fee_pct: 'Bank fee', proceeds_pct: 'Proceeds to the issuer before expenses (%)', proceeds_amount: 'Proceeds to the issuer (amount, this tranche)',
  proceeds_total: 'Proceeds to the issuer (whole deal)', risk_factors: 'Risks', selling_restrictions: 'Where the notes may not be sold', conflicts_of_interest: 'Bank conflicts of interest',
  listing: 'Listing'
};
const STATE = { not_disclosed: 'Not stated in the filing', not_applicable: 'Not applicable' };
const money = (n, cur = '') => `${cur ? cur + ' ' : ''}${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
function shown(f) {
  if (f.state !== 'disclosed') return STATE[f.state];
  const t = f.value_text, n = f.value_num, d = f.value_date;
  switch (f.field) {
    case 'interest_paid': { const v = JSON.parse(t); return [v.f, v.on && v.on.join(', '), v.first && `first ${v.first}`, v.p].filter(Boolean).join(' · '); }
    case 'early_repayment': { const v = JSON.parse(t); return v.can === 'no' ? 'No — cannot be repaid early' : ['Yes', v.from && `from ${v.from}`, v.price, v.tax && 'tax redemption'].filter(Boolean).join(' · '); }
    case 'use_of_proceeds': { const v = JSON.parse(t); return v.c.join('; ') + (v.acq ? ` (acquisition: ${v.acq})` : ''); }
    case 'selling_restrictions': return JSON.parse(t).join(', ') || '(section, no places named)';
    case 'amount': return money(n);
    case 'issue_price_pct': case 'bank_fee_pct': case 'proceeds_pct': return `${n}%`;
    case 'proceeds_amount': case 'proceeds_total': return `${money(n, (t || '').split(' · ')[0])} (${(t || '').split(' · ')[1] || ''})`;
    case 'change_of_control': return `Yes, at ${n}% of principal`;
    case 'special_mandatory_redemption': return `Yes, at ${n}%${d ? `, if the deal fails by ${d}` : ''}`;
    case 'interest_rate': return t || `${n}%`;
    case 'risk_factors': return 'Section link';
    default: if (f.field.startsWith('parties.')) return `${n} named`; return t ?? (n != null ? String(n) : d);
  }
}
const where = (x, url) => {
  const link = x.source_anchor ? `${x.source_url}#${x.source_anchor}` : x.source_url;
  const doc = x.source_doc === 'fwp' ? 'term sheet' : 'filing';
  return `[${doc}](${link}) · ${x.source_part}${x.source_heading ? ` — ${String(x.source_heading).replace(/\|/g, '/')}` : ''}${x.source_page ? `, page ${x.source_page}` : ''}${x.char_offset != null ? ` · @${x.char_offset}` : ''}`;
};
const esc = s => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');

const runText = readFileSync(arg.run, 'utf8');
const run = JSON.parse(runText);
const byAcc = new Map(run.filings.map(f => [f.accession, f]));
const order = f => (f.field.startsWith('parties.') ? 100 : Object.keys(LABEL).indexOf(f.field));
const L = [];
let nFacts = 0, nParties = 0;
const issuers = new Set();
let multi = 0;
for (const [, acc] of SAMPLE) { const f = byAcc.get(acc); if (!f || f.status !== 'debt') throw new Error(`${acc}: not a debt filing in the run`); issuers.add(f.issuer); if (f.tranches > 1) multi++; nFacts += f.facts.length; nParties += f.parties.length; }
L.push('# MA-NOV-BOND — offering facts: 20-filing manual check sheet (spec v2 §6.2)', '');
L.push('```text', `GENERATED:  ${arg.generated} by apply/offer-checksheet.mjs from ${path.basename(arg.run)} (${createHash('sha256').update(runText).digest('hex').slice(0, 16)}…)`,
  `OFFERING:   ${run.offering_version} · parser ${run.parser_version}`, `FOR:        U8 BOND.VERIFY — the Data-Identity Lead fills "Source value", "OK" and "Note"`,
  `SAMPLE:     20 filings · ${issuers.size} issuers · ${multi} multi-tranche · ${nFacts} fact rows + ${nParties} party rows to check`, '```', '');
L.push('**How to check.** Open the filing link (it jumps to the section where the filing has an anchor). Find the value at the section and page given. Write what the filing prints in *Source value*, then *OK* = Y or N. "Not stated in the filing" is a claim too: mark N if the filing does state it. "@n" is the character position in the decoded text, for the verifier’s tool only.', '');
L.push('**Gate (spec v2 §6.3).** ≥ 95% of checked rows correct overall and per field; a field below 95% is hidden for November. Any wrong party role, trustee or guarantor listed as a selling bank, fact on the wrong tranche, or shown value with no source location blocks the offering release.', '');
L.push('| # | Stratum | Filing | Issuer | Family | Tranches | Why chosen |', '|---|---|---|---|---|---|---|');
SAMPLE.forEach(([s, acc, why], i) => { const f = byAcc.get(acc); L.push(`| ${i + 1} | ${s} | [${acc}](${f.url}) | ${f.issuer} | ${f.family} | ${f.tranches} | ${why} |`); });
L.push('');
SAMPLE.forEach(([s, acc], i) => {
  const f = byAcc.get(acc);
  L.push(`## ${i + 1}. ${f.issuer} — ${acc} (${f.form}, filed ${f.filing_date}, family ${f.family})`, '');
  L.push(`Filing: ${f.url}${f.fwps.length ? ` · term sheets: ${f.fwps.join(', ')}` : ''}`, '');
  L.push('| Tranche | Label | Matures | Amount |', '|---|---|---|---|');
  for (const r of f.rows) L.push(`| t${r.tranche_seq} | ${esc(r.tranche_label)} | ${r.maturity_date ?? ''} | ${r.principal_amount ? money(r.principal_amount, r.currency) : ''} |`);
  L.push('', '| # | Field | Tranche | Shown value | Where it was read | Source value | OK | Note |', '|---|---|---|---|---|---|---|---|');
  let k = 0;
  for (const x of [...f.facts].sort((a, b) => order(a) - order(b) || a.tranche_seq - b.tranche_seq))
    L.push(`| ${++k} | ${LABEL[x.field] || x.field.replace('parties.', 'Banks / roles: ')} | ${x.tranche_seq ? 't' + x.tranche_seq : 'all'} | ${esc(shown(x))} | ${where(x)} |  |  |  |`);
  if (f.parties.length) {
    L.push('', '| # | Party | Role | Printed role | Tranche | Where it was read | Source value | OK | Note |', '|---|---|---|---|---|---|---|---|---|');
    for (const p of f.parties) L.push(`| P${p.party_seq} | ${esc(p.party_name)} | ${p.role} | ${esc(p.role_printed)} | ${p.tranche_seq ? 't' + p.tranche_seq : 'all'} | [${p.source_doc === 'fwp' ? 'term sheet' : 'filing'}](${p.source_url}) · ${p.source_part}${p.source_page ? `, page ${p.source_page}` : ''} |  |  |  |`);
  }
  if (f.notes.length) L.push('', `Notes from the extractor: ${f.notes.map(esc).join(' · ')}`);
  L.push('');
});
writeFileSync(arg.out, L.join('\n') + '\n');
console.log(JSON.stringify({ filings: SAMPLE.length, issuers: issuers.size, multi_tranche: multi, fact_rows: nFacts, party_rows: nParties }));
