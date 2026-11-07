#!/usr/bin/env node
// Stub Claude Code binary for dispatcher tests. Never calls a model. Behaviour is env-controlled:
//   FAKE_CALLS=<file>          append one JSON line per non --version invocation (argv + prompt)
//   FAKE_PIDFILE=<file>        write this process's pid
//   FAKE_SLEEP_MS=<n>          sleep before exiting
//   FAKE_REPORT=<rel path>     write a report file (relative to cwd)
//   FAKE_WRITE_OUTSIDE=<rel>   write a file outside the allowed scope
//   FAKE_QUOTA=1               emit a usage-limit error result event
//   FAKE_EXIT=<n>              exit code (default 0)
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
if (argv.includes('--version')) { console.log('0.0.0-fake (Claude Code stub)'); process.exit(0); }

const env = process.env;
let prompt = '';
try { prompt = fs.readFileSync(0, 'utf8'); } catch { /* no stdin */ }
if (env.FAKE_CALLS) fs.appendFileSync(env.FAKE_CALLS, JSON.stringify({ argv, prompt, cwd: process.cwd(), pid: process.pid }) + '\n');
if (env.FAKE_PIDFILE) fs.writeFileSync(env.FAKE_PIDFILE, String(process.pid));
const sid = argv[argv.indexOf('--session-id') + 1];
console.log(JSON.stringify({ type: 'system', subtype: 'init', session_id: sid }));

const sleep = Number(env.FAKE_SLEEP_MS || 0);
if (sleep) await new Promise((r) => setTimeout(r, sleep));

const put = (rel, text) => { const p = path.join(process.cwd(), rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
if (env.FAKE_REPORT) put(env.FAKE_REPORT, `# stub report\nsession ${sid}\n`);
if (env.FAKE_WRITE_OUTSIDE) put(env.FAKE_WRITE_OUTSIDE, 'outside scope\n');
if (env.FAKE_QUOTA === '1') {
  console.log(JSON.stringify({ type: 'result', subtype: 'error', is_error: true, result: 'Claude AI usage limit reached|1762531200', session_id: sid }));
  process.exit(Number(env.FAKE_EXIT || 1));
}
console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'done', session_id: sid }));
process.exit(Number(env.FAKE_EXIT || 0));
