// Pure client-side logic for control-tower.html. Each function is self-contained: project.mjs embeds
// their source text verbatim in <script id="tower-logic">, and test 9 evaluates that embedded text.

// OFFLINE when the page's snapshot is older than two refresh intervals (MA-NOV-000 §Q5.4).
export function towerState(generatedAtIso, nowMs, refreshS) {
  const ageS = (nowMs - Date.parse(generatedAtIso)) / 1000;
  return { ageS: ageS, offline: !(ageS <= 2 * refreshS) };
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

export const TOWER_LOGIC_FUNCTIONS = [towerState, heartbeatClass, leaseClass, formatAge];
