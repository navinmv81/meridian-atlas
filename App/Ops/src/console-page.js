// console-page.js — MA-OCT-005 (spec rev 0 §4.2, Option B; Ops review M-1, M-6, N-6, N-7).
// GET /api/ops/admin/console: the operator console shell. Same pattern as 004's dq-page.js.
// It reads 0 D1 rows; ops-api.js has already re-verified the Access JWT, and the service-token
// allowlist refuses every token here (adminRouteId → 'other'), so the console is human-only.
//
// The shell loads ma-data.js and ma-ops.js from the meridian-atlas GitHub Pages path and opens
// the console. Every admin call is then same-origin: the Access cookie is first-party, with no
// CORS and no SameSite change. If the loaded ma-ops.js predates 005 (no OPS_CONSOLE_SUPPORTED),
// the shell says the console arrives with the 2 Nov release and starts nothing (M-6).
//
// CSP (M-1): script-src is scoped to the Pages *path* plus a nonce for the two inline scripts;
// style-src is 'unsafe-inline' with no nonce, because ma-ops.js renders inline style="" attributes
// and a nonce would make browsers ignore 'unsafe-inline'. ma-ops.js emits no inline on*= handlers.
// connect-src: self (meridian-ops), meridian-control (A6's 302 target for Board/Ledger/Events/Drift)
// and meridian-proxy (the Health tab).

export const CONSOLE_ASSET_BASE = 'https://navinmv81.github.io/meridian-atlas/';
const CONNECT = ["'self'", 'https://meridian-control.navinmv1981.workers.dev', 'https://meridian-proxy.navinmv1981.workers.dev'];

function nonce() {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function consoleCsp(n, assetBase = CONSOLE_ASSET_BASE) {
  return `default-src 'none'; script-src ${assetBase} 'nonce-${n}'; style-src 'unsafe-inline'; connect-src ${CONNECT.join(' ')}; `
       + `img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`;
}

// assetBase is fixed in production; tests may pass another to load local copies.
export function renderConsoleShell(assetBase = CONSOLE_ASSET_BASE) {
  const n = nonce();
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><title>Meridian Atlas — Operator console</title>
<style>html,body{margin:0;background:#0a0c10;color:#e8eaed;font:14px/1.45 system-ui,-apple-system,sans-serif}
#console-msg{padding:32px 40px}</style></head>
<body><div id="console-msg" role="status">Loading the operator console…</div>
<noscript><p style="padding:0 40px">The operator console needs JavaScript.</p></noscript>
<script nonce="${n}">window.MA_OPS_CONSOLE = true;</script>
<script src="${assetBase}ma-data.js"></script>
<script src="${assetBase}ma-ops.js"></script>
<script nonce="${n}">(function () {
  var msg = document.getElementById('console-msg');
  if (window.OPS_CONSOLE_SUPPORTED !== true || typeof window.openOps !== 'function') {
    msg.textContent = 'The operator console arrives with the 2 Nov release. Until then, cases are handled by the Main Lane.';
    return;
  }
  msg.remove();
  window.openOps({ console: true });
})();</script>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': consoleCsp(n, assetBase),
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    }
  });
}
