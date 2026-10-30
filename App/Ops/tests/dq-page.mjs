#!/usr/bin/env node
// MA-OCT-004 test 3 (spec rev 1 §15 step 3): the D-3 page (src/dq-page.js) rendered directly — escaping (a
// <script> value in `ref` comes out inert), the CSP header and its nonce, the `ref` whitelist, error pages for an
// invalid type / domain / via / key (incl. 007 placeholders), the paused page, no external resources, no storage.
// No network, no D1.   Usage: node App/Ops/tests/dq-page.mjs

import { renderDqPage, parsePrefill, navKey } from '../src/dq-page.js';

let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 900)}`); };
const page = async (qs, enabled = true) => {
  const r = renderDqPage(new URL(`https://meridian-ops.test/api/ops/admin/dq/new?${qs}`), enabled);
  return { status: r.status, h: r.headers, html: await r.text() };
};
const q = o => new URLSearchParams(o).toString();
const base = { type: 'ambiguous_mapping', domain: 'entities', key: 'US0378331005', via: 'nav-007' };

const XSS = '</script><script>alert(1)</script><img src=x onerror=alert(2)>';
const ok = await page(q({ ...base, ref: JSON.stringify({ isin: 'US0378331005', reason: XSS, candidates: [12, 14], extra: 'drop-me', state: 'ambiguous' }) }));
const csp = ok.h.get('content-security-policy') || '';
const nonce = (csp.match(/script-src 'nonce-([A-Za-z0-9_-]+)'/) || [])[1];
check('[§9.2] 200 text/html, Cache-Control no-store, nosniff, no-referrer', ok.status === 200 && /^text\/html/.test(ok.h.get('content-type')) && ok.h.get('cache-control') === 'no-store'
  && ok.h.get('x-content-type-options') === 'nosniff' && ok.h.get('referrer-policy') === 'no-referrer', [...ok.h]);
check("[§9.2] CSP exactly: default-src 'none'; script/style nonce; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'",
  csp === `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'` && nonce?.length >= 20, csp);
const execScripts = [...ok.html.matchAll(/<script(?![^>]*type="application\/json")([^>]*)>/g)];
check('[§9.2] every executable <script> carries the CSP nonce; the style tag too', execScripts.length === 1 && execScripts.every(m => m[1].includes(`nonce="${nonce}"`)) && ok.html.includes(`<style nonce="${nonce}">`), execScripts.map(m => m[1]));
check('[§9.2] the <script> value in ref is inert: HTML-escaped in the visible list, \\u003c-escaped in the data block; no raw </script><script>alert',
  ok.html.includes('&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;') && ok.html.includes('\\u003c/script\\u003e') && !ok.html.includes('<script>alert') && !/<img src=x/.test(ok.html), ok.html.slice(0, 400));
const data = JSON.parse(ok.html.match(/<script type="application\/json" id="dq-data">([\s\S]*?)<\/script>/)[1]);
check('[§9.1] whitelist: extra ref keys dropped; via added; body names D-2 and carries a request_id and the mapped key', !('extra' in data.body.object_ref) && data.body.object_ref.via === 'nav-007'
  && data.endpoint === '/api/ops/admin/dq-tickets' && /^[0-9a-f-]{36}$/.test(data.body.request_id) && data.body.object_domain === 'instrument' && data.body.object_key === 'US0378331005'
  && data.body.ticket_type === 'ambiguous_mapping' && data.body.via === 'nav-007' && JSON.stringify(data.body.object_ref.candidates) === '[12,14]', data);
check('[§9.2] the page fetches only its own origin with Content-Type application/json and X-Ops-Client dq-page; no cookies/storage; no external resources',
  /'X-Ops-Client':'dq-page'/.test(ok.html) && /'Content-Type':'application\/json'/.test(ok.html) && !/localStorage|sessionStorage|document\.cookie|indexedDB/.test(ok.html)
  && !/(src|href)=["']?(https?:)?\/\//i.test(ok.html) && !/innerHTML/.test(ok.html), null);
check('[§9.2] read-only fields + one note box (≤ 1,000) + Submit and Cancel', /<textarea id="note" maxlength="1000">/.test(ok.html) && (ok.html.match(/<input/g) || []).length === 0
  && />Submit</.test(ok.html) && />Cancel</.test(ok.html), null);
const p2 = await page(q(base));
check('[§9.2] a fresh nonce and request_id on every render', !p2.h.get('content-security-policy').includes(nonce) && !p2.html.includes(data.body.request_id), null);

const errs = [
  ['invalid type', { ...base, type: 'missing_entity' }], ['domain not entities', { ...base, domain: 'etf' }], ['via missing', { ...base, via: '' }],
  ['placeholder CUSIP zeros', { ...base, key: 'CUSIP:000000000' }], ['placeholder NAME:N/A', { ...base, key: 'NAME:N/A' }], ['entity:0', { ...base, key: 'entity:0' }],
  ['ref not JSON', { ...base, ref: '{nope' }], ['ref > 1.5 kB', { ...base, ref: JSON.stringify({ reason: 'x'.repeat(1600) }) }]
];
for (const [name, o] of errs) {
  const r = await page(q(o));
  check(`[§9.2] ${name} → 400 error page, no technical detail, no form, no script`, r.status === 400 && /<h1>Cannot report this<\/h1>/.test(r.html) && !/<form|<script/.test(r.html)
    && !/Error|stack|regex|undefined/.test(r.html) && /default-src 'none'/.test(r.h.get('content-security-policy')), r.html.slice(0, 300));
}
const paused = await page(q(base), false);
check('[§9.2 / AC-14] consumer switch off → "Reporting is paused" (503), no form', paused.status === 503 && /Reporting is paused/.test(paused.html) && !/<form/.test(paused.html), paused.html.slice(0, 200));
check('[§9.1] key mapping: entity:{id} → entity; a bare ISIN / CUSIP: / NAME: → instrument', JSON.stringify(navKey('entity:2289')) === '{"object_domain":"entity","object_key":"2289"}'
  && navKey('US0378331005').object_domain === 'instrument' && navKey('CUSIP:037833100').object_domain === 'instrument' && navKey('NAME:FOO_BAR').object_domain === 'instrument'
  && navKey('NAME:NONE') === null && navKey('lowercase:x') === null, null);
check('[§9.1] parsePrefill keeps only isin, cusip, ticker, candidates (≤ 10 positive ints), state, reason',
  JSON.stringify(parsePrefill(new URLSearchParams(q({ ...base, ref: JSON.stringify({ ticker: 'AAPL', candidates: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 'x'], a: 1 }) }))).prefill.object_ref)
    === '{"ticker":"AAPL","candidates":[1,2,3,4,5,6,7,8,9,10],"via":"nav-007"}', null);

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? 'FAILED' : 'ALL PASSED');
process.exit(fail ? 1 : 0);
