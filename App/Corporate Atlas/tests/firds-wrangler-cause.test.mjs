// MA-OCT-002b B4: wranglerCause() in firds-local-seed.mjs, tested IN ISOLATION. The runner calls main() on import,
// so this test never imports it: it extracts the function's source text and evaluates only that. 0 network, 0 D1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../firds-local-seed.mjs', import.meta.url), 'utf8');
const body = src.slice(src.indexOf('export function wranglerCause(err) {'), src.indexOf('\nclass Stmt {'));
const wranglerCause = new Function(`${body.replace('export function', 'function')}; return wranglerCause;`)();

test('10000 auth error from wrangler --json stdout → codes=10000 + message, 32-hex ids redacted', () => {
  const err = { stdout: '{"error":{"text":"A request to the Cloudflare API (/accounts/ea36070477560935a68ad9110a2fd40b/d1/database) failed.","notes":[{"text":"Authentication error [code: 10000]"}],"code":10000}}', stderr: '' };
  const c = wranglerCause(err);
  assert.match(c, /codes=10000/);
  assert.match(c, /message="A request to the Cloudflare API \(\/accounts\/<id>\/d1\/database\) failed\."/);
  assert.doesNotMatch(c, /ea36070477560935a68ad9110a2fd40b/);
});
test('7403 and a text-mode ✘ [ERROR] line are both recognised', () => {
  assert.match(wranglerCause({ stderr: '✘ [ERROR] A request to the Cloudflare API failed. [code: 7403]' }), /codes=7403 message="A request to the Cloudflare API failed\. \[code: 7403\]"/);
});
test('no stdout/stderr (spawn error, timeout) → empty string, so the old message is unchanged', () => {
  assert.equal(wranglerCause({ message: 'spawn ETIMEDOUT' }), '');
});
test('output without a code → codes=none', () => { assert.match(wranglerCause({ stderr: 'something else' }), /codes=none/); });
