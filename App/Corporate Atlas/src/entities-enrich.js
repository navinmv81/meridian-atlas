// meridian-entities-enrich
// Enriches entity_master with LEI data and parent relationships via GLEIF public API.
// Dispatcher (see scheduled() below) routes purely on getMinutes() at
// invocation time, not on which cron string fired: mins<50 -> Phase 1 only;
// mins>=50 -> Phase 2 then Phase 3, always together (no separate even-hours
// gate exists in code despite an earlier version of this comment implying
// one — corrected 1 August 2026, MA-AUG-002 cadence decision).
// Phase 1: populate isin_hint for operating entities — D1 only, 0 subrequests
// Phase 2: GLEIF ISIN search for entities with isin_hint but no LEI
// Phase 3: fetch LEI detail + Level 2 parent relationships
// Cron (re-enabled 1 August 2026): crons = ["0 6 * * *", "50 6 * * *"] —
// daily, down from the original 72 invocations/day (*/30 + hourly). See
// wrangler-entities-enrich.toml for the full reasoning.
//
// SAFETY (added MA-AUG-002, July 28 2026 — Ops diagnostic): this Worker previously
// had no write-budget guard and no manual kill switch, unlike its siblings
// (entities-seed.js has checkWriteBudget(); entities-delta.js has checkHold()).
// Both are added below, reading the same shared holdings_pipeline_state keys.

// MA-SEP-001, 16 August 2026: this file previously computed its own inline
// normalized_name (`parentName.toUpperCase().trim().replace(/\s+/g, ' ')`)
// for GLEIF parent (type='holding') inserts — no suffix-stripping, no
// punctuation-stripping at all. A dotted legal name like "Danaher Corp." or
// "Adyen N.V." would keep its punctuation and suffix verbatim in
// normalized_name, guaranteeing a mismatch against any entity_master row for
// the same company seeded via entities-seed.js's normalizeName(). Now
// importing the same shared function entities-figi.js already uses (see that
// file's comment, MA-AUG-001) so all three insert paths agree on one
// normalization scheme.
import { normalizeName } from './entities-seed.js';

const DAILY_CAP = 100000; // account-wide D1 daily write cap (soft), shared across all Workers — replaces the old ENRICH_WRITE_LIMIT, 5 August 2026

async function checkWriteBudget(env) {
  // FIXED MA-AUG-002, July 28 2026: aligned to holdings-pipeline.js's key
  // format (dashes kept) — same bug as entities-seed.js had, fixed there
  // at the same time. See that file's comment for the full explanation.
  //
  // TIGHTENED 5 August 2026 (MA-AUG-004 safety-net audit follow-up): moved
  // from "used >= 60,000" to entities-seed.js's headroom-based pattern —
  // the old form only guaranteed 40,000 of headroom, not a stated safety
  // margin against this Worker's own worst case. Unlike entities-seed.js's
  // well-documented ~61,400-row empirical worst case, this Worker's real
  // per-invocation ceiling hasn't been measured at scale yet (Phase 1 is
  // bounded to 100 rows, Phase 2/3 to 45 GLEIF-bound entities each with a
  // handful of writes apiece — realistically low hundreds of logical rows,
  // nowhere near entities-seed's bulk-insert volume). 5,000 headroom is a
  // reasoned, generously-padded estimate, not an empirically-verified
  // ceiling like entities-seed's 65,000 — revisit once this Worker's real
  // write volume is observed at its first few live cadence runs.
  const REQUIRED_HEADROOM = 5000;
  const today = new Date().toISOString().slice(0, 10);
  const key = `writes_today_${today}`;
  const row = await env.DB.prepare(
    `SELECT value FROM holdings_pipeline_state WHERE key = ?`
  ).bind(key).first();
  const writesToday = parseInt(row?.value ?? '0', 10);
  const headroom = DAILY_CAP - writesToday;
  if (headroom < REQUIRED_HEADROOM) {
    console.log(`[entities-enrich] Insufficient write headroom (${headroom} remaining, need ${REQUIRED_HEADROOM}; ${writesToday} used today). Skipping.`);
    return false;
  }
  return true;
}

async function checkHold(env) {
  const row = await env.DB.prepare(
    `SELECT value FROM holdings_pipeline_state WHERE key = 'hold_all_jobs'`
  ).first();
  return row?.value === 'true';
}

// ── Phase 1 — ISIN Population ─────────────────────────────────────────────────

async function runPhase1(env) {
  const BATCH = 100;

  const entities = await env.DB.prepare(`
    SELECT entity_id, name
    FROM entity_enrichment_queue
    WHERE type_hint = 'operating'
      AND (isin_hint IS NULL OR isin_hint = '')
      AND status IN ('pending', 'failed')
      AND (retry_after IS NULL OR retry_after <= CURRENT_TIMESTAMP)
    LIMIT ?
  `).bind(BATCH).all();

  if (!entities.results.length) {
    console.log('[entities-enrich] Phase 1: nothing to populate');
    return;
  }

  let populated = 0;
  for (const entity of entities.results) {
    const isinRow = await env.DB.prepare(`
      SELECT isin FROM fund_holdings_monthly
      WHERE UPPER(TRIM(security_name)) = UPPER(TRIM(?))
        AND isin IS NOT NULL AND isin != ''
      LIMIT 1
    `).bind(entity.name).first();

    if (isinRow?.isin) {
      await env.DB.prepare(`
        UPDATE entity_enrichment_queue
        SET isin_hint = ?,
            lookup_method = 'isin',
            status = 'pending',
            retry_after = NULL
        WHERE entity_id = ?
      `).bind(isinRow.isin, entity.entity_id).run();
      populated++;
    }
  }

  console.log(`[entities-enrich] Phase 1: populated ${populated} of ${entities.results.length} entities`);
}

// ── Phase 2 — GLEIF ISIN Search ───────────────────────────────────────────────

async function runPhase2(env) {
  const BATCH = 45;
  const GLEIF_BASE = 'https://api.gleif.org/api/v1';

  const entities = await env.DB.prepare(`
    SELECT eq.entity_id, eq.name, eq.isin_hint, eq.country_hint
    FROM entity_enrichment_queue eq
    JOIN entity_master em ON eq.entity_id = em.entity_id
    WHERE eq.isin_hint IS NOT NULL
      AND eq.isin_hint != ''
      AND em.lei IS NULL
      AND em.type != 'fund'
      AND eq.status = 'pending'
      AND (eq.retry_after IS NULL OR eq.retry_after <= CURRENT_TIMESTAMP)
    LIMIT ?
  `).bind(BATCH).all();

  if (!entities.results.length) {
    console.log('[entities-enrich] Phase 2: nothing to enrich');
    return;
  }

  let matched = 0;
  for (const entity of entities.results) {
    try {
      await env.DB.prepare(
        `UPDATE entity_enrichment_queue SET status = 'in_progress', last_attempt = CURRENT_TIMESTAMP WHERE entity_id = ?`
      ).bind(entity.entity_id).run();

      const url = `${GLEIF_BASE}/lei-records?filter%5Bisin%5D=${entity.isin_hint}&page%5Bsize%5D=5`;
      const resp = await fetch(url);

      if (!resp.ok) throw new Error(`GLEIF HTTP ${resp.status}`);

      const data = await resp.json();
      const candidates = data.data ?? [];

      if (candidates.length === 1) {
        const lei = candidates[0].attributes?.lei ?? null;
        const leiStatus = candidates[0].attributes?.entity?.status ?? null;
        const country = candidates[0].attributes?.entity?.legalAddress?.country ?? null;

        if (lei) {
          await env.DB.prepare(`
            UPDATE entity_master
            SET lei = ?, lei_status = ?, country = COALESCE(country, ?), updated_at = CURRENT_TIMESTAMP
            WHERE entity_id = ?
          `).bind(lei, leiStatus, country, entity.entity_id).run();

          await env.DB.prepare(
            `UPDATE entity_enrichment_queue SET status = 'complete', last_attempt = CURRENT_TIMESTAMP WHERE entity_id = ?`
          ).bind(entity.entity_id).run();

          matched++;
        } else {
          throw new Error('LEI field missing in response');
        }
      } else {
        // No match or ambiguous — fail with retry
        await env.DB.prepare(`
          UPDATE entity_enrichment_queue
          SET status = 'failed', retry_after = datetime('now', '+7 days')
          WHERE entity_id = ?
        `).bind(entity.entity_id).run();
      }
    } catch (err) {
      console.error(`[entities-enrich] Phase 2 error on ${entity.name}:`, err.message);
      await env.DB.prepare(`
        UPDATE entity_enrichment_queue
        SET status = 'failed', retry_after = datetime('now', '+1 day')
        WHERE entity_id = ?
      `).bind(entity.entity_id).run();
    }
  }

  console.log(`[entities-enrich] Phase 2: matched ${matched} of ${entities.results.length}`);
}

// ── Phase 3 — GLEIF Detail + Parents ─────────────────────────────────────────

async function runPhase3(env) {
  const BATCH = 45;
  const GLEIF_BASE = 'https://api.gleif.org/api/v1';

  const entities = await env.DB.prepare(`
    SELECT entity_id, name, lei, type, lei_status
    FROM entity_master
    WHERE lei IS NOT NULL
      AND type != 'fund'
      AND (
        lei_status IS NULL
        OR (
          direct_parent_lei IS NULL
          AND ultimate_parent_lei IS NULL
          AND direct_parent_exception IS NULL
        )
      )
    LIMIT ?
  `).bind(BATCH).all();

  if (!entities.results.length) {
    console.log('[entities-enrich] Phase 3: nothing to detail');
    return;
  }

  for (const entity of entities.results) {
    try {
      const resp = await fetch(`${GLEIF_BASE}/lei-records/${entity.lei}`);
      if (!resp.ok) throw new Error(`GLEIF detail HTTP ${resp.status}`);

      const detail = await resp.json();
      const attrs = detail.data?.attributes ?? {};

      if (!entity.lei_status) {
        // Only update Level 1 fields if not already enriched
        await env.DB.prepare(`
          UPDATE entity_master
          SET lei_status = ?,
              country = COALESCE(country, ?),
              updated_at = CURRENT_TIMESTAMP
          WHERE entity_id = ?
        `).bind(
          attrs.entity?.status ?? 'ACTIVE',
          attrs.entity?.legalAddress?.country ?? null,
          entity.entity_id
        ).run();
      }

      if (entity.type === 'fund') {
        continue; // funds use fund_manager relationship, not GLEIF parent chain
      }

      // Level 2 parent relationships
      const relationships = detail.relationships ?? {};
      let directParentWritten = false;
      const directParentRel = relationships['direct-parent'];
      const directParentException = directParentRel?.meta?.exception
        ?? (directParentRel === undefined ? 'NO_LINK_DECLARED' : null);
      for (const [relType, relData] of [
        ['direct-parent', relationships['direct-parent']],
        ['ultimate-parent', relationships['ultimate-parent']]
      ]) {
        if (!relData?.data) continue;
        const parentLei = relData.data.id;
        if (!parentLei) continue;

        let parent = await env.DB.prepare(
          `SELECT entity_id, lei, name FROM entity_master WHERE lei = ?`
        ).bind(parentLei).first();

        if (!parent) {
          const parentResp = await fetch(`${GLEIF_BASE}/lei-records/${parentLei}`);
          if (parentResp.ok) {
            const parentDetail = await parentResp.json();
            const parentName = parentDetail.data?.attributes?.entity?.legalName?.name ?? parentLei;
            const parentNorm = normalizeName(parentName); // MA-SEP-001: was an inline, suffix/punctuation-naive fold
            const parentCountry = parentDetail.data?.attributes?.entity?.legalAddress?.country ?? null;

            await env.DB.prepare(`
              INSERT INTO entity_master (name, normalized_name, type, lei, lei_status, country)
              VALUES (?, ?, 'holding', ?, 'ACTIVE', ?)
              ON CONFLICT(normalized_name, type) DO UPDATE SET
                lei = excluded.lei,
                updated_at = CURRENT_TIMESTAMP
            `).bind(parentName, parentNorm, parentLei, parentCountry).run();

            parent = await env.DB.prepare(
              `SELECT entity_id, lei, name FROM entity_master WHERE lei = ?`
            ).bind(parentLei).first();
          }
        }

        if (parent) {
          await env.DB.prepare(`
            INSERT INTO entity_relationships
              (parent_entity_id, child_entity_id, relationship_type, source)
            VALUES (?, ?, 'legal_parent', 'gleif')
            ON CONFLICT DO NOTHING
          `).bind(parent.entity_id, entity.entity_id).run();

          // Mirror onto entity_master so the UI can read it directly
          if (relType === 'direct-parent') {
            directParentWritten = true;
            await env.DB.prepare(`
              UPDATE entity_master
              SET direct_parent_lei  = ?,
                  direct_parent_name = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE entity_id = ?
            `).bind(parent.lei, parent.name, entity.entity_id).run();
          } else if (relType === 'ultimate-parent') {
            await env.DB.prepare(`
              UPDATE entity_master
              SET ultimate_parent_lei  = ?,
                  ultimate_parent_name = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE entity_id = ?
            `).bind(parent.lei, parent.name, entity.entity_id).run();
          }
        }
      }

      // Record GLEIF exception so this entity is not retried endlessly
      if (!directParentWritten && directParentException) {
        await env.DB.prepare(`
          UPDATE entity_master
          SET direct_parent_exception = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE entity_id = ?
        `).bind(directParentException, entity.entity_id).run();
      }

    } catch (err) {
      console.error(`[entities-enrich] Phase 3 error on ${entity.name}:`, err.message);
    }
  }

  console.log(`[entities-enrich] Phase 3: processed ${entities.results.length} entities`);
}

// ── Cron dispatcher ───────────────────────────────────────────────────────────

export default {
  async scheduled(event, env, ctx) {
    console.log('[entities-enrich] Cron started');

    if (await checkHold(env)) {
      console.log('[entities-enrich] hold_all_jobs = true — exiting immediately');
      return;
    }
    if (!(await checkWriteBudget(env))) return;

    const mins = new Date().getMinutes();
    const hour = new Date().getHours();

    if (mins < 50) {
      await runPhase1(env);
    } else {
      await runPhase2(env);
      await runPhase3(env);
    }

    console.log('[entities-enrich] Cron complete');
  },

  // NOTE: unlike entities-seed.js's /run handler (which checks the guard inside
  // ctx.waitUntil and always responds ok:true regardless of outcome), this checks
  // synchronously first so the HTTP response honestly reflects whether the run
  // actually executed or was blocked — useful for manual diagnostic testing.
  // Flagging this as a deliberate deviation; worth backporting to entities-seed.js
  // as a fast-follow if you want consistent behavior across both Workers.
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname !== '/run') {
      return new Response('Not found', { status: 404 });
    }
    if (await checkHold(env)) {
      return new Response(JSON.stringify({ ok: false, message: 'hold_all_jobs is active' }), {
        status: 423,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!(await checkWriteBudget(env))) {
      return new Response(JSON.stringify({ ok: false, message: 'Daily write budget reached' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const mins = new Date().getMinutes();
    const hour = new Date().getHours();
    ctx.waitUntil((async () => {
      if (mins < 50) {
        await runPhase1(env);
      } else {
        await runPhase2(env);
        await runPhase3(env);
      }
    })());
    return new Response(JSON.stringify({ ok: true, message: 'Enrichment triggered' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
