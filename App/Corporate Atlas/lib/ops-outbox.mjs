// ops-outbox.mjs — MA-OCT-002a A4 (spec §8.1, R-5): heartbeat sender + local
// outbox for Ops run events (contract v1). Standalone module, no dependencies,
// so any local runner (the boost runner; 011's runner) can import it.
//
//   const ob = createOpsOutbox({ outboxDir, name, cfg, log });
//   const r  = await ob.send(evt);        // never throws; { delivered, spoolable, status }
//   ob.spool(evt);                        // append the exact event body as one JSON line
//   await ob.replay({ max: 10, ceilingMs: 2000 });
//
// Rules (spec §8.1; Data-Identity Lead conditions §8.6):
// - Spooled: timeouts, network errors and HTTP 5xx. NOT spooled: 400/401/403/422
//   (permanent) and 202 (switched off on purpose).
// - Replay: oldest first, up to `max`, each with its own `ceilingMs`, stopping at
//   the first failure. 201 or 200 (`duplicate`) = delivered; the file is rewritten
//   atomically (temp + rename) without the delivered lines. Idempotent by the
//   server's UNIQUE(run_id, phase) + INSERT OR IGNORE: a replay never double-counts.
// - Expiry: events whose started_at is older than 6 days move to expired.jsonl and
//   are logged as permanent losses — counted, never dropped silently.
// - Never writes to stdout/stderr; everything goes through `log` (the caller's
//   heartbeat log). Never throws.

import http from 'node:http';
import https from 'node:https';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const EXPIRY_MS = 6 * 24 * 3600 * 1000;
const PERMANENT = new Set([400, 401, 403, 422]);

export function redact(s) {
  return String(s).replace(/(bearer|authorization|secret|token|key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
                  .replace(/[A-Za-z0-9_\-]{32,}/g, '[redacted]');
}

// Builds the exact JSON body sent for an event (also what is spooled).
export function eventBody(evt) {
  return { v: 1, ...evt,
    error: evt.error ? { class: String(evt.error.class || 'ERROR').slice(0, 64),
                         summary: redact(evt.error.summary || '').slice(0, 500) } : null };
}

// One POST with a hard ceiling. On timeout the request is destroyed, which also
// kills a still-connecting socket (fetch's AbortSignal leaves it running).
function post(cfg, body, ceilingMs) {
  return new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done) { done = true; resolve(r); } };
    try {
      const text = JSON.stringify(body);
      const u = new URL(cfg.url);
      const req = (u.protocol === 'http:' ? http : https).request(u, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text),
                   'X-Ops-Emitter': cfg.emitter, 'X-Ops-Ingest-Key': cfg.key }
      }, resp => {
        let t = '';
        resp.setEncoding('utf8');
        resp.on('data', d => { t += d; });
        resp.on('end', () => finish({ status: resp.statusCode, text: t.replace(/\n/g, ' ').slice(0, 200) }));
        resp.on('error', e => finish({ status: null, error: (e && (e.code || e.name)) || 'Error' }));
      });
      const timer = setTimeout(() => { finish({ status: null, error: 'TimeoutError' }); req.destroy(); }, ceilingMs);
      timer.unref();
      req.on('close', () => clearTimeout(timer));
      req.on('error', e => finish({ status: null, error: (e && (e.code || e.name)) || 'Error' }));
      req.end(text);
    } catch (e) {
      finish({ status: null, error: (e && e.name) || 'Error' });
    }
  });
}

function classify(r) {
  if (r.status === 201 || r.status === 200) return { delivered: true, spoolable: false };
  if (r.status === null || r.status >= 500) return { delivered: false, spoolable: true };
  return { delivered: false, spoolable: false };   // 202 or permanent 4xx (and any other code)
}

export function createOpsOutbox({ outboxDir, name, cfg, log = () => {} }) {
  const file = path.join(outboxDir, `${name}.jsonl`);
  const expiredFile = path.join(outboxDir, 'expired.jsonl');
  const safeLog = text => { try { log(text); } catch { /* never affects the job */ } };

  async function send(evt, { ceilingMs = 2000, replayed = false } = {}) {
    const body = evt.v === 1 ? evt : eventBody(evt);
    if (!cfg) { safeLog(`${body.event} | not sent: .env.ops-ingest not configured`); return { delivered: false, spoolable: false, status: null, body }; }
    const r = await post(cfg, body, ceilingMs);
    const c = classify(r);
    const tag = replayed ? 'replay ' : '';
    safeLog(`${tag}${body.event} | run_id=${body.run_id} | ` + (r.status !== null ? `HTTP ${r.status} ${r.text}` : `not delivered: ${r.error}`)
            + (c.spoolable && !replayed ? ' | spooled' : ''));
    return { ...c, status: r.status, body };
  }

  function spool(evt) {
    try {
      const body = evt.v === 1 ? evt : eventBody(evt);
      mkdirSync(outboxDir, { recursive: true });
      appendFileSync(file, JSON.stringify({ spooled_at: new Date().toISOString(), event: body }) + '\n', 'utf8');
      return true;
    } catch (e) { safeLog(`outbox spool failed: ${(e && e.name) || 'Error'}`); return false; }
  }

  function readLines() {
    if (!existsSync(file)) return [];
    return readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return { bad: l }; } });
  }

  function writeAtomic(entries) {
    const tmp = `${file}.tmp-${process.pid}`;
    writeFileSync(tmp, entries.map(e => (e.bad !== undefined ? e.bad : JSON.stringify(e))).join('\n') + (entries.length ? '\n' : ''), 'utf8');
    renameSync(tmp, file);
  }

  async function replay({ max = 10, ceilingMs = 2000, now = Date.now() } = {}) {
    const result = { replayed: 0, remaining: 0, expired: 0, stopped_on: null };
    try {
      let entries = readLines();
      if (!entries.length) return result;
      const keep = [], expired = [];
      for (const e of entries) {
        const t = Date.parse(e?.event?.started_at);
        if (e.bad === undefined && Number.isFinite(t) && now - t > EXPIRY_MS) expired.push(e); else keep.push(e);
      }
      if (expired.length) {
        mkdirSync(outboxDir, { recursive: true });
        appendFileSync(expiredFile, expired.map(e => JSON.stringify({ ...e, expired_at: new Date(now).toISOString() })).join('\n') + '\n', 'utf8');
        for (const e of expired) safeLog(`outbox EXPIRED (permanent loss, counted) | ${e.event.event} | run_id=${e.event.run_id} | started_at=${e.event.started_at}`);
        result.expired = expired.length;
      }
      // Oldest first by spool order (append-only file).
      const remaining = [];
      let i = 0;
      for (; i < keep.length && result.replayed < max; i++) {
        const e = keep[i];
        if (e.bad !== undefined) { remaining.push(e); continue; }
        const r = await send(e.event, { ceilingMs, replayed: true });
        if (r.delivered) { result.replayed++; continue; }
        if (!r.spoolable) { safeLog(`outbox dropped as permanent (HTTP ${r.status}) | run_id=${e.event.run_id}`); continue; }
        result.stopped_on = r.status === null ? 'network' : `HTTP ${r.status}`;
        remaining.push(e); i++;
        break;
      }
      for (; i < keep.length; i++) remaining.push(keep[i]);
      writeAtomic(remaining);
      result.remaining = remaining.length;
      if (result.replayed || result.expired || result.stopped_on) {
        safeLog(`outbox replay | delivered=${result.replayed} expired=${result.expired} remaining=${result.remaining}` + (result.stopped_on ? ` | stopped on ${result.stopped_on}` : ''));
      }
    } catch (e) {
      safeLog(`outbox replay error: ${(e && e.name) || 'Error'}`);
    }
    return result;
  }

  return { send, spool, replay, file, expiredFile };
}
