// meridian-entities-enrich
// Enriches entity_master with LEI data and parent relationships via GLEIF public API.
// Phase 1 (*/10 * * * *): populate isin_hint for operating entities — D1 only, 0 subrequests
// Phase 2 (50 * * * *):   GLEIF ISIN search for entities with isin_hint but no LEI
// Phase 3 (50 * * * *, even hours): fetch LEI detail + Level 2 parent relationships

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
            const parentNorm = parentName.toUpperCase().trim().replace(/\s+/g, ' ');
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

  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname !== '/run') {
      return new Response('Not found', { status: 404 });
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
