# Entities Enrich Worker — Phase Restructure

**Working directory:** `/Users/navinkumar/Desktop/MeridianAtlas/June Refresh/Corporate Atlas`  
**File to modify:** `src/entities-enrich.js`  
**Config to update:** `wrangler-entities-enrich.toml`  
**Existing files touched outside this folder:** None.

---

## Ground Rules

1. Working directory is `Corporate Atlas/` only. Do not access `../ETF Refresh/`.
2. Do not modify any file except `src/entities-enrich.js` and `wrangler-entities-enrich.toml`.
3. Do not hardcode any identifiers, LEI strings, or external values.
4. Diagnostic step is mandatory before any change.
5. Show diff only after changes — do not reprint the full file.

---

## Step 1 — Diagnostic

Read `src/entities-enrich.js` and report:

1. The current value of `MAX_ENRICH_PER_RUN`
2. The current structure of the cron handler — summarise what each section does in plain English
3. Whether a pre-processing phase for `isin_hint` population already exists and where it sits in the file
4. The current `[triggers]` block in `wrangler-entities-enrich.toml` — paste it exactly

Do not change any file. Report findings only. Wait for confirmation before proceeding to Step 2.

---

## Step 2 — Restructure into Three Phases

Restructure `src/entities-enrich.js` so the single cron handler runs one of three phases depending on the current minute. The phase is determined at the top of the handler:

```javascript
const mins = new Date().getMinutes();
const hour = new Date().getHours();

if (mins < 50) {
  await runPhase1(env);
} else {
  await runPhase2(env);
  if (hour % 2 === 0) await runPhase3(env);
}
```

### Phase 1 — ISIN Population (`runPhase1`)

**Runs when:** minute < 50 (the `*/10` cron fires at minutes 0, 10, 20, 30, 40 — all below 50)  
**Purpose:** Populate `isin_hint` for operating entities that don't have one yet  
**External API calls:** None — D1 reads and writes only  
**Subrequests per invocation:** 0

Logic:

```javascript
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
```

### Phase 2 — GLEIF Search (`runPhase2`)

**Runs when:** minute >= 50 (the `50 * * * *` cron fires at minute 50 each hour)  
**Purpose:** Call GLEIF ISIN search for entities that have `isin_hint` but no LEI yet  
**External API calls:** 1 GLEIF call per entity  
**Subrequests per invocation:** max 45

Logic:

```javascript
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
```

### Phase 3 — GLEIF Detail + Parents (`runPhase3`)

**Runs when:** minute >= 50 AND hour is even  
**Purpose:** Fetch LEI detail and Level 2 parent relationships for entities that have a LEI but no `lei_status` yet  
**External API calls:** 1–2 GLEIF calls per entity (detail + optional parent lookup)  
**Subrequests per invocation:** max 45

Logic:

```javascript
async function runPhase3(env) {
  const BATCH = 45;
  const GLEIF_BASE = 'https://api.gleif.org/api/v1';

  const entities = await env.DB.prepare(`
    SELECT entity_id, name, lei
    FROM entity_master
    WHERE lei IS NOT NULL
      AND lei_status IS NULL
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

      // Update lei_status and country
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

      // Level 2 parent relationships
      const relationships = detail.relationships ?? {};
      for (const [, relData] of [
        ['direct-parent', relationships['direct-parent']],
        ['ultimate-parent', relationships['ultimate-parent']]
      ]) {
        if (!relData?.data) continue;
        const parentLei = relData.data.id;
        if (!parentLei) continue;

        // Find or create parent entity
        let parent = await env.DB.prepare(
          `SELECT entity_id FROM entity_master WHERE lei = ?`
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
              `SELECT entity_id FROM entity_master WHERE lei = ?`
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
        }
      }

    } catch (err) {
      console.error(`[entities-enrich] Phase 3 error on ${entity.name}:`, err.message);
    }
  }

  console.log(`[entities-enrich] Phase 3: processed ${entities.results.length} entities`);
}
```

---

## Step 3 — Update `wrangler-entities-enrich.toml`

Replace the existing `[triggers]` block with:

```toml
[triggers]
crons = ["*/10 * * * *", "50 * * * *"]
```

The `*/10` cron fires at minutes 0, 10, 20, 30, 40 — all below 50, so Phase 1 runs.  
The `50 * * * *` cron fires at minute 50 every hour — Phase 2 runs, and Phase 3 runs on even hours.

---

## Step 4 — Show Diff and Deploy

Show the diff of changes to both files. Then deploy:

```bash
wrangler deploy --config "/Users/navinkumar/Desktop/MeridianAtlas/June Refresh/Corporate Atlas/wrangler-entities-enrich.toml"
```

Report the version ID from the deploy output.

---

## Step 5 — Verify

After deploy, confirm the triggers are registered:

```bash
wrangler deployments list --config "/Users/navinkumar/Desktop/MeridianAtlas/June Refresh/Corporate Atlas/wrangler-entities-enrich.toml"
```

Then wait for the next `*/10` cron to fire and run:

```bash
wrangler d1 execute meridian-etf --remote \
  --command="SELECT COUNT(*) as has_isin FROM entity_enrichment_queue WHERE isin_hint IS NOT NULL AND isin_hint != '' AND type_hint = 'operating';"
```

If the count is above 0 and growing, Phase 1 is working. Report the result.
