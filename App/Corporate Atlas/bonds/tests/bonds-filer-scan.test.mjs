// MA-OCT-008 R-3 (DIL14 RB-2): classify() of the filer-list re-scan. Local only, 0 SEC requests, 0 D1 calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../bonds-filer-scan.mjs';

const links = { '0000794447': { cik: '0000794447', note: 'co-registrant (L8-12) of 0000753308. unmatched pending DIL' }, '0000077476': { cik: '0000077476', note: null } };
const PEP = [{ cik: '0000077476', name: 'PEPSICO INC' }, { cik: '0002007029', name: 'PepsiCo Singapore Financing I Pte. Ltd.' }];

test('P-1 pattern: rows under the parent while the cover names the other filer → CANDIDATE', () => {
  const r = classify({ accession: 'a', storedCik: '0000077476', filers: PEP, links,
    coverText: 'PepsiCo Singapore Financing I Pte. Ltd. (the "issuer") $300,000,000 Floating Rate Notes due 2027 Fully and Unconditionally Guaranteed by PepsiCo, Inc.' });
  assert.equal(r.verdict, 'CANDIDATE'); assert.deepEqual(r.others.map(o => o.cik), ['0002007029']);
});
test('after R-1 the same filing stored under the issuer\'s own co-registrant row is not a candidate', () => {
  const r = classify({ accession: 'a', storedCik: '0002007029', filers: PEP, coverText: 'PepsiCo Singapore Financing I Pte. Ltd. … Guaranteed by PepsiCo, Inc.',
    links: { '0002007029': { cik: '0002007029', note: 'co-registrant (L8-12) of 0000077476.' } } });
  assert.equal(r.verdict, 'stored_under_coregistrant');
});
test('NextEra Energy Capital under its own co-registrant CIK (parent on the cover as guarantor) → not a candidate', () => {
  const r = classify({ accession: 'b', storedCik: '0000794447', links, filers: [{ cik: '0000794447', name: 'NEXTERA ENERGY CAPITAL HOLDINGS INC' }, { cik: '0000753308', name: 'NEXTERA ENERGY INC' }],
    coverText: 'NextEra Energy Capital Holdings, Inc. Debentures … guaranteed by NextEra Energy, Inc.' });
  assert.equal(r.verdict, 'stored_under_coregistrant');
});
test('single filer → single_filer; an extra filer not named on the cover → other_filers_not_on_cover', () => {
  assert.equal(classify({ accession: 'c', storedCik: '0000077476', filers: [PEP[0]], coverText: 'x', links }).verdict, 'single_filer');
  assert.equal(classify({ accession: 'd', storedCik: '0000077476', filers: PEP, coverText: 'PepsiCo, Inc. 4.500% Senior Notes', links }).verdict, 'other_filers_not_on_cover');
});
