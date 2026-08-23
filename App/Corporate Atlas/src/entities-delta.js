// meridian-entities-delta
// Monthly GLEIF delta maintenance. Downloads the LastMonth delta file from
// GLEIF and applies fresh Level 1 fields to existing entity_master rows.
// Cron: 0 3 1 * * (HOLD — see wrangler-entities-delta.toml; frozen until Phase 5)
//
// SAFETY:
// - Never writes to fund_holdings_monthly or any ETF domain table.
// - Only UPDATEs entity_master rows that already exist (matched by LEI).
// - Honors hold_all_jobs kill switch in holdings_pipeline_state.

// MA-SEP-001, 16 August 2026: this file previously computed its own inline
// normalized_name (`parentName.toUpperCase().trim().replace(/\s+/g, ' ')`)
// for GLEIF parent (type='holding') inserts — no suffix-stripping, no
// punctuation-stripping at all, identical to the same gap in
// entities-enrich.js. Now importing the same shared function
// entities-figi.js and entities-enrich.js use (see entities-seed.js's
// normalizeName() comment, MA-AUG-001) so all insert paths agree on one
// normalization scheme.
import { normalizeName } from './entities-seed.js';

const DELTA_URL = 'https://leilookup.gleif.org/api/v2/filedownload/deltafiles/LastMonth';
const BATCH_SIZE = 50;

// Same column mapping used by the Golden Copy seed (gleif-build-local.js),
// limited to the Level 1 fields this Worker is allowed to refresh.
const COL_MAP = {
  'LEI': 'lei',
  'Entity.EntityStatus': 'entity_status',
  'Entity.EntityExpirationDate': 'expiration_date',
  'Entity.EntityExpirationReason': 'expiration_reason',
  'Registration.RegistrationStatus': 'lei_registration_status',
  'Registration.LastUpdateDate': 'lei_last_updated',
  'Registration.NextRenewalDate': 'lei_next_renewal',
};

// Parse a single CSV line respecting quoted fields.
function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      fields.push(field);
      field = '';
    } else {
      field += c;
    }
  }
  fields.push(field);
  return fields;
}

async function checkHold(env) {
  const row = await env.DB.prepare(
    `SELECT value FROM holdings_pipeline_state WHERE key = 'hold_all_jobs'`
  ).first();
  return row?.value === 'true';
}

// Streams the GLEIF delta CSV response body line by line, calling onRow(rowObj)
// for each parsed data row (after the header row has been consumed).
async function streamDeltaCsv(response, onRow) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let header = null;
  let colIdx = null;

  function processLine(line) {
    if (!line) return;
    if (!header) {
      header = parseCsvLine(line);
      colIdx = {};
      for (const [csvCol, dbCol] of Object.entries(COL_MAP)) {
        const idx = header.indexOf(csvCol);
        if (idx === -1) {
          console.log(`[entities-delta] WARNING: column "${csvCol}" not found in delta header`);
        } else {
          colIdx[dbCol] = idx;
        }
      }
      return;
    }
    const fields = parseCsvLine(line);
    const row = {};
    for (const dbCol of Object.keys(COL_MAP).map(k => COL_MAP[k])) {
      const idx = colIdx[dbCol];
      row[dbCol] = idx != null ? (fields[idx] ?? null) : null;
    }
    if (row.lei) onRow(row);
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nlIndex;
    while ((nlIndex = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nlIndex).replace(/\r$/, '');
      buffer = buffer.slice(nlIndex + 1);
      processLine(line);
    }
  }
  // Final partial line (no trailing newline)
  if (buffer.trim()) processLine(buffer.replace(/\r$/, ''));
}

async function runDelta(env) {
  if (await checkHold(env)) {
    console.log('[entities-delta] hold_all_jobs = true — exiting immediately');
    return;
  }

  console.log('[entities-delta] Downloading GLEIF LastMonth delta file');
  const res = await fetch(DELTA_URL);
  if (!res.ok) {
    console.log(`[entities-delta] Delta download failed: HTTP ${res.status}`);
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  let updatedCount = 0;
  let inactiveFlaggedCount = 0;
  const statements = [];

  const flush = async () => {
    if (statements.length === 0) return;
    for (let i = 0; i < statements.length; i += BATCH_SIZE) {
      const batch = statements.slice(i, i + BATCH_SIZE);
      await env.DB.batch(batch);
    }
    statements.length = 0;
  };

  await streamDeltaCsv(res, (row) => {
    const stmt = env.DB.prepare(`
      UPDATE entity_master SET
        entity_status = ?,
        lei_registration_status = ?,
        lei_last_updated = ?,
        lei_next_renewal = ?,
        expiration_date = ?,
        expiration_reason = ?,
        gleif_last_updated = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE lei = ?
    `).bind(
      row.entity_status ?? null,
      row.lei_registration_status ?? null,
      row.lei_last_updated ?? null,
      row.lei_next_renewal ?? null,
      row.expiration_date ?? null,
      row.expiration_reason ?? null,
      row.lei
    );
    statements.push(stmt);
    updatedCount++;

    if (row.entity_status === 'INACTIVE' || row.entity_status === 'LAPSED') {
      statements.push(
        env.DB.prepare(`
          INSERT OR REPLACE INTO holdings_pipeline_state (key, value)
          VALUES (?, ?)
        `).bind(`delta_inactive_${row.lei}`, `${row.entity_status}:${today}`)
      );
      inactiveFlaggedCount++;
    }
  });

  // Only entities that already exist in entity_master are actually updated by
  // the UPDATE statements above (matched WHERE lei = ?). updatedCount here
  // reflects rows attempted; flush before reporting actual touched rows.
  await flush();

  console.log(`[entities-delta] Processed delta file — ${updatedCount} update statements issued, ${inactiveFlaggedCount} inactive/lapsed flagged`);

  await env.DB.batch([
    env.DB.prepare(`INSERT OR REPLACE INTO holdings_pipeline_state (key, value) VALUES ('delta_last_run', ?)`)
      .bind(new Date().toISOString()),
    env.DB.prepare(`INSERT OR REPLACE INTO holdings_pipeline_state (key, value) VALUES ('delta_entities_updated', ?)`)
      .bind(String(updatedCount)),
    env.DB.prepare(`INSERT OR REPLACE INTO holdings_pipeline_state (key, value) VALUES ('delta_inactive_flagged', ?)`)
      .bind(String(inactiveFlaggedCount)),
  ]);

  console.log('[entities-delta] Summary written to holdings_pipeline_state');
}

async function refreshParentExceptions(env) {
  const BATCH = 100;
  const GLEIF_BASE = 'https://api.gleif.org/api/v1';

  const candidates = await env.DB.prepare(`
    SELECT entity_id, lei, name
    FROM entity_master
    WHERE direct_parent_exception IS NOT NULL
    ORDER BY updated_at ASC
    LIMIT ?
  `).bind(BATCH).all();

  if (!candidates.results.length) {
    console.log('[entities-delta] Relationship refresh: nothing to check');
    return;
  }

  let foundParent = 0;
  for (const entity of candidates.results) {
    try {
      const resp = await fetch(`${GLEIF_BASE}/lei-records/${entity.lei}`);
      if (!resp.ok) continue;
      const detail = await resp.json();
      const relationships = detail.relationships ?? {};
      const directParentRel = relationships['direct-parent'];

      if (directParentRel?.data) {
        // GLEIF now has a parent recorded — write it, clear exception
        const parentLei = directParentRel.data.id;
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

          await env.DB.prepare(`
            UPDATE entity_master
            SET direct_parent_lei = ?,
                direct_parent_name = ?,
                direct_parent_exception = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE entity_id = ?
          `).bind(parent.lei, parent.name, entity.entity_id).run();

          foundParent++;
        }
      }
      // else: still no parent declared — leave exception as-is, no write needed
    } catch (err) {
      console.error(`[entities-delta] Relationship refresh error on ${entity.name}:`, err.message);
    }
  }

  console.log(`[entities-delta] Relationship refresh: checked ${candidates.results.length}, found ${foundParent} new parents`);
}

export default {
  async scheduled(event, env, ctx) {
    console.log('[entities-delta] Cron started');
    await runDelta(env);
    await refreshParentExceptions(env);
    console.log('[entities-delta] Cron complete');
  },

  // Allow manual trigger via HTTP for testing — mirrors entities-seed pattern.
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname !== '/run') {
      return new Response('Not found', { status: 404 });
    }
    ctx.waitUntil(runDelta(env));
    return new Response(JSON.stringify({ ok: true, message: 'Delta run triggered' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
