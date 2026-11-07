// Pure client-side logic for control-tower.html. Each function is self-contained: project.mjs embeds
// their source text verbatim in <script id="tower-logic">, and test 9 evaluates that embedded text.

// Page status (MA-NOV-P1.FIX2 F3, Founder option b — no scheduler, honest snapshot labels).
// Nothing regenerates the page on a timer: it is rewritten on every begin/end and Main Lane update. So:
//   STALE_RUN         a lease in the snapshot is past its expiry (red) — checked first
//   LIVE              snapshot younger than 2 × refresh_s
//   RUNNING_SNAPSHOT  older snapshot, a lease not yet expired — the run is shown with the snapshot's age
//   SNAPSHOT          older snapshot, no lease — idle, not OFFLINE
// `leases`: [{id, run_id, expires}] from the snapshot's packets.
export function towerStatus(generatedAtIso, nowMs, refreshS, leases) {
  var ageS = (nowMs - Date.parse(generatedAtIso)) / 1000;
  var mins = Math.max(0, Math.floor(ageS / 60));
  var ls = leases || [];
  var stale = ls.filter(function (l) { return l.expires && nowMs > Date.parse(l.expires); });
  if (stale.length) {
    return { state: 'STALE_RUN', cls: 'red', ageS: ageS,
      label: 'STALE RUN — ' + stale.map(function (l) { return l.id + ' run ' + l.run_id + ' lease expired ' + l.expires; }).join('; ') };
  }
  if (ageS <= 2 * refreshS) {
    return { state: 'LIVE', cls: 'live', ageS: ageS, label: 'LIVE · snapshot ' + formatAge(ageS) + ' old' + (ls.length ? ' · run in progress' : ' · idle') };
  }
  if (ls.length) {
    return { state: 'RUNNING_SNAPSHOT', cls: 'amber', ageS: ageS,
      label: 'RUNNING (snapshot) — ' + ls.map(function (l) { return l.id + ' run ' + l.run_id; }).join('; ') + ' · snapshot ' + mins + ' min old' };
  }
  return { state: 'SNAPSHOT', cls: 'idle', ageS: ageS,
    label: 'Idle — snapshot from ' + generatedAtIso + ' (' + mins + ' min ago); regenerated on every begin/end and Main Lane update' };
}

// Heartbeat colour: red past lease expiry, amber when older than amberS, otherwise ok.
export function heartbeatClass(heartbeatIso, expiresIso, nowMs, amberS) {
  if (expiresIso && nowMs > Date.parse(expiresIso)) return 'red';
  if (!heartbeatIso) return 'amber';
  return (nowMs - Date.parse(heartbeatIso)) / 1000 > amberS ? 'amber' : 'ok';
}

// Lease expiry colour for interactive runs (no heartbeat is expected from an interactive session).
export function leaseClass(expiresIso, nowMs) {
  if (!expiresIso) return 'ok';
  return nowMs > Date.parse(expiresIso) ? 'red' : 'ok';
}

export function formatAge(s) {
  if (!(s >= 0)) return '?';
  if (s < 90) return Math.round(s) + 's';
  if (s < 5400) return Math.round(s / 60) + 'm';
  if (s < 172800) return Math.round(s / 3600) + 'h';
  return Math.round(s / 86400) + 'd';
}

export const TOWER_LOGIC_FUNCTIONS = [towerStatus, heartbeatClass, leaseClass, formatAge];
