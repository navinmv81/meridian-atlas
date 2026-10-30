// dq-page.js — MA-OCT-004 (spec rev 1 §9, 570de1a5…5379). D-3 GET /api/ops/admin/dq/new: the
// Access-gated link-out page for 007's "Report mapping problem" button (007 Q1 (a)). It also owns
// the 007 prefill contract (§9.1), which D-2 re-applies server-side for via=nav-007.
//
// The page holds no state: 0 D1 reads, no cookies, no storage, no external resources. It renders the
// validated parameters read-only plus one note box; Submit makes one same-origin fetch to D-2 with
// Content-Type application/json and X-Ops-Client: dq-page (§8.4). Every value is HTML-escaped; the
// data block is JSON with <, >, &, U+2028/9 escaped. CSP per §9.2 (REVARC RQ-3, base-uri 'none').

export const NAV_TYPES = ['missing_mapping', 'ambiguous_mapping', 'low_confidence_mapping', 'merged_link_unresolved'];
const TYPE_LABELS = {
  missing_mapping: 'No issuer linked', ambiguous_mapping: 'Ambiguous issuer', low_confidence_mapping: 'Low-confidence issuer link',
  merged_link_unresolved: 'Link to a merged entity not resolved'
};
const REF_KEYS = ['isin', 'cusip', 'ticker', 'candidates', 'state', 'reason'];
const MAX_REF_BYTES = 1536;
const D2_PATH = '/api/ops/admin/dq-tickets';

// §6 key rules for the two domains 007 can send. Build finding E8: deriveInstrumentKey makes bare
// 12-character ISIN keys (no prefix), so those are accepted beside the spec's PREFIX:value form.
export const ENTITY_KEY_RE = /^[1-9]\d{0,9}$/;
export const INSTRUMENT_KEY_RE = /^(?:[A-Z]{2}[A-Z0-9]{9}\d|[A-Z]{2,8}:\S{1,120})$/;
export function isPlaceholderKey(key) {   // 007 §3.1 (R7-2)
  return /^CUSIP:0{6,9}$/.test(key) || ['NAME:N/A', 'NAME:NA', 'NAME:NONE'].includes(key);
}

// 007 `key` → { object_domain, object_key } or null (§9.1).
export function navKey(key) {
  if (typeof key !== 'string') return null;
  const m = /^entity:(.+)$/.exec(key);
  if (m) return ENTITY_KEY_RE.test(m[1]) ? { object_domain: 'entity', object_key: m[1] } : null;
  if (!INSTRUMENT_KEY_RE.test(key) || isPlaceholderKey(key)) return null;
  return { object_domain: 'instrument', object_key: key };
}

// Keeps only the whitelisted `ref` keys, with simple value types; anything else is dropped (§9.1).
export function navRef(ref) {
  const out = {};
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return out;
  for (const k of REF_KEYS) {
    const v = ref[k];
    if (v === undefined || v === null) continue;
    if (k === 'candidates') {
      if (Array.isArray(v)) {
        const ids = v.filter(x => Number.isInteger(x) && x > 0 && x < 1e10).slice(0, 10);
        if (ids.length) out.candidates = ids;
      }
    } else if (typeof v === 'string' && v.length <= 200) out[k] = v;
  }
  return out;
}

// Validates the §9.1 query. Returns { prefill } or { error } (a user-facing sentence, no detail).
export function parsePrefill(params) {
  const type = params.get('type'), domain = params.get('domain'), key = params.get('key'), via = params.get('via'), refRaw = params.get('ref');
  if (!NAV_TYPES.includes(type) || domain !== 'entities' || via !== 'nav-007') return { error: 'This report link is not valid.' };
  const mapped = navKey(key);
  if (!mapped) return { error: 'This report link does not name an instrument or entity that can be reported.' };
  let ref = {};
  if (refRaw) {
    if (new TextEncoder().encode(refRaw).length > MAX_REF_BYTES) return { error: 'This report link is not valid.' };
    try { ref = navRef(JSON.parse(refRaw)); } catch { return { error: 'This report link is not valid.' }; }
  }
  return { prefill: { ticket_type: type, ...mapped, object_ref: { ...ref, via: 'nav-007' }, via: 'nav-007' } };
}

export const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const jsonForScript = v => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

function nonce() {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function pageHeaders(n) {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${n}'; style-src 'nonce-${n}'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  };
}

const STYLE = `body{font:15px/1.45 system-ui,-apple-system,sans-serif;margin:0;background:#f6f7f9;color:#1d2330}
main{max-width:560px;margin:32px auto;padding:24px;background:#fff;border:1px solid #dde1e7;border-radius:8px}
h1{font-size:19px;margin:0 0 16px}dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 14px;margin:0 0 16px}
dt{color:#5b6475}dd{margin:0;word-break:break-all}textarea{width:100%;box-sizing:border-box;min-height:90px;font:inherit}
.row{display:flex;gap:10px;margin-top:14px}button{font:inherit;padding:7px 16px;border-radius:6px;border:1px solid #9aa3b2;background:#fff;cursor:pointer}
button[type=submit]{background:#1d4ed8;border-color:#1d4ed8;color:#fff}button:disabled{opacity:.55;cursor:default}
#out{margin-top:14px;font-weight:600}.muted{color:#5b6475;font-size:13px}`;

function shell(n, title, inner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><title>${escapeHtml(title)}</title><style nonce="${n}">${STYLE}</style></head>
<body><main>${inner}</main></body></html>`;
}

export function messagePage(status, title, message) {
  const n = nonce();
  return new Response(shell(n, title, `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>`), { status, headers: pageHeaders(n) });
}

// D-3. `consumerEnabled` false → "Reporting is paused" (§9.2 kill switch). 0 D1 reads.
export function renderDqPage(url, consumerEnabled) {
  if (!consumerEnabled) return messagePage(503, 'Reporting is paused', 'Reporting mapping problems is paused for now. Please try again later.');
  const { prefill, error } = parsePrefill(url.searchParams);
  if (error) return messagePage(400, 'Cannot report this', error);
  const n = nonce();
  const ref = prefill.object_ref;
  const rows = [['Problem', TYPE_LABELS[prefill.ticket_type]], [prefill.object_domain === 'entity' ? 'Entity id' : 'Instrument', prefill.object_key]];
  if (ref.isin) rows.push(['ISIN', ref.isin]);
  if (ref.cusip) rows.push(['CUSIP', ref.cusip]);
  if (ref.ticker) rows.push(['Ticker', ref.ticker]);
  if (ref.candidates) rows.push(['Candidate entities', ref.candidates.join(', ')]);
  if (ref.state) rows.push(['Shown as', ref.state]);
  if (ref.reason) rows.push(['Reason', ref.reason]);
  const data = { endpoint: D2_PATH, body: { request_id: crypto.randomUUID(), ...prefill } };
  const inner = `<h1>Report a mapping problem</h1>
<dl>${rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>
<form id="f"><label for="note">Anything else we should know? (optional)</label>
<textarea id="note" maxlength="1000"></textarea>
<div class="row"><button type="submit" id="go">Submit</button><button type="button" id="cancel">Cancel</button></div></form>
<div id="out" role="status" aria-live="polite"></div>
<p class="muted">Sent to the Data-Identity Lead with your sign-in identity. Nothing is shown on the public site.</p>
<script type="application/json" id="dq-data">${jsonForScript(data)}</script>
<script nonce="${n}">(function(){
var d=JSON.parse(document.getElementById('dq-data').textContent),f=document.getElementById('f'),go=document.getElementById('go'),out=document.getElementById('out');
var MSG={400:'This report could not be accepted.',401:'Your sign-in has expired. Reload the page to sign in again.',403:'You are not allowed to send this report.',429:'Too many reports today. Please try again tomorrow.',503:'Reporting is paused for now. Please try again later.'};
function say(t){out.textContent=t;}
document.getElementById('cancel').addEventListener('click',function(){if(history.length>1)history.back();else window.close();});
f.addEventListener('submit',function(ev){ev.preventDefault();go.disabled=true;say('Sending…');
var b=Object.assign({},d.body),note=document.getElementById('note').value.trim();if(note)b.note=note;
fetch(d.endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Ops-Client':'dq-page'},body:JSON.stringify(b)})
.then(function(r){return r.json().catch(function(){return {};}).then(function(j){
if(r.status===201||(r.status===200&&j.replay)){say((j.case&&j.case.case_ref||'Report')+' created');return;}
if(r.status===200&&j.deduplicated){say('Already reported as '+j.case_ref+' ('+j.status+')');return;}
say(MSG[r.status]||'Something went wrong. Please try again later.');go.disabled=false;});})
.catch(function(){say('Something went wrong. Please try again later.');go.disabled=false;});});
})();</script>`;
  return new Response(shell(n, 'Report a mapping problem', inner), { status: 200, headers: pageHeaders(n) });
}
