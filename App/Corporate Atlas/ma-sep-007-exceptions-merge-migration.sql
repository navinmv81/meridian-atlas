-- MA-SEP-007 Tier 2 individual-review exceptions -- 4 of 7 approved by Founder decision 2026-08-29
-- Approved: IBM/International Business Machines Corp., MERCK KGaA, RWE AG, RELX PLC -- all legal-form abbreviation variants
-- NOT approved (stay separate, no action): SLM Corp/Navient Corp, Santander Bank Polska/Erste Bank Polska, OPAP Holding SA/Allwyn AG
-- Same repoint pattern as the other two MA-SEP-007 migrations (7 dependent tables). Survivor = lowest entity_id.
-- Name should be re-confirmed live via GLEIF lei-records API at execution time, same as the other Scenario B/C merges.

CREATE TABLE IF NOT EXISTS _ma_sep_007_exc_merge_map (duplicate_id INTEGER PRIMARY KEY, survivor_id INTEGER NOT NULL);
DELETE FROM _ma_sep_007_exc_merge_map;
INSERT OR IGNORE INTO _ma_sep_007_exc_merge_map (duplicate_id, survivor_id) VALUES (1758,1366),(2732,2417),(25783,2731),(26801,2569);

CREATE TABLE IF NOT EXISTS _ma_sep_007_exc_name_map (survivor_id INTEGER PRIMARY KEY, lei TEXT NOT NULL, new_name TEXT);
DELETE FROM _ma_sep_007_exc_name_map;
INSERT OR IGNORE INTO _ma_sep_007_exc_name_map (survivor_id, lei, new_name) VALUES (1366,'VGRQXHF3J8VDLUA7XE92',NULL),(2417,'529900OAREIS0MOPTW25',NULL),(2731,'529900GB7KCA94ACC940',NULL),(2569,'549300WSX3VBUFFJOO66',NULL);
-- >>> STOP HERE: fetch all 4 GLEIF names and UPDATE _ma_sep_007_exc_name_map SET new_name = ? WHERE survivor_id = ? before continuing <<<


-- 1. entity_relationships
DELETE FROM entity_relationships
WHERE parent_entity_id IN (SELECT duplicate_id FROM _ma_sep_007_exc_merge_map)
AND EXISTS (SELECT 1 FROM entity_relationships e2 JOIN _ma_sep_007_exc_merge_map m ON m.duplicate_id = entity_relationships.parent_entity_id
  WHERE e2.parent_entity_id = m.survivor_id AND e2.child_entity_id = entity_relationships.child_entity_id AND e2.relationship_type = entity_relationships.relationship_type);
UPDATE entity_relationships SET parent_entity_id = (SELECT survivor_id FROM _ma_sep_007_exc_merge_map WHERE duplicate_id = entity_relationships.parent_entity_id)
WHERE parent_entity_id IN (SELECT duplicate_id FROM _ma_sep_007_exc_merge_map);
DELETE FROM entity_relationships
WHERE child_entity_id IN (SELECT duplicate_id FROM _ma_sep_007_exc_merge_map)
AND EXISTS (SELECT 1 FROM entity_relationships e2 JOIN _ma_sep_007_exc_merge_map m ON m.duplicate_id = entity_relationships.child_entity_id
  WHERE e2.child_entity_id = m.survivor_id AND e2.parent_entity_id = entity_relationships.parent_entity_id AND e2.relationship_type = entity_relationships.relationship_type);
UPDATE entity_relationships SET child_entity_id = (SELECT survivor_id FROM _ma_sep_007_exc_merge_map WHERE duplicate_id = entity_relationships.child_entity_id)
WHERE child_entity_id IN (SELECT duplicate_id FROM _ma_sep_007_exc_merge_map);
DELETE FROM entity_relationships WHERE parent_entity_id = child_entity_id;

-- 2. fund_entity_link
UPDATE fund_entity_link SET entity_id = (SELECT survivor_id FROM _ma_sep_007_exc_merge_map WHERE duplicate_id = fund_entity_link.entity_id)
WHERE entity_id IN (SELECT duplicate_id FROM _ma_sep_007_exc_merge_map);

-- 3. instrument_entity_map
UPDATE instrument_entity_map SET entity_id = (SELECT survivor_id FROM _ma_sep_007_exc_merge_map WHERE duplicate_id = instrument_entity_map.entity_id)
WHERE entity_id IN (SELECT duplicate_id FROM _ma_sep_007_exc_merge_map);

-- 4. entity_exposure_monthly
DELETE FROM entity_exposure_monthly
WHERE entity_id IN (SELECT duplicate_id FROM _ma_sep_007_exc_merge_map)
AND EXISTS (SELECT 1 FROM entity_exposure_monthly e2 JOIN _ma_sep_007_exc_merge_map m ON m.duplicate_id = entity_exposure_monthly.entity_id
  WHERE e2.entity_id = m.survivor_id AND e2.report_month = entity_exposure_monthly.report_month AND e2.holder_entity_id = entity_exposure_monthly.holder_entity_id);
UPDATE entity_exposure_monthly SET entity_id = (SELECT survivor_id FROM _ma_sep_007_exc_merge_map WHERE duplicate_id = entity_exposure_monthly.entity_id)
WHERE entity_id IN (SELECT duplicate_id FROM _ma_sep_007_exc_merge_map);
-- holder_entity_id: re-confirm 0 affected rows live before skipping, same as prior two migrations

-- 5. fund_exposure_coverage -- re-confirm 0 affected rows live before skipping

-- 6. entity_enrichment_queue
DELETE FROM entity_enrichment_queue
WHERE entity_id IN (SELECT duplicate_id FROM _ma_sep_007_exc_merge_map)
AND EXISTS (SELECT 1 FROM entity_enrichment_queue e2 JOIN _ma_sep_007_exc_merge_map m ON m.duplicate_id = entity_enrichment_queue.entity_id WHERE e2.entity_id = m.survivor_id);
UPDATE entity_enrichment_queue SET entity_id = (SELECT survivor_id FROM _ma_sep_007_exc_merge_map WHERE duplicate_id = entity_enrichment_queue.entity_id)
WHERE entity_id IN (SELECT duplicate_id FROM _ma_sep_007_exc_merge_map);

-- 7. entity_isin_map
UPDATE entity_isin_map SET entity_id = (SELECT survivor_id FROM _ma_sep_007_exc_merge_map WHERE duplicate_id = entity_isin_map.entity_id)
WHERE entity_id IN (SELECT duplicate_id FROM _ma_sep_007_exc_merge_map);

-- 8. entity_master: apply GLEIF names, then remove repointed loser rows
UPDATE entity_master SET name = (SELECT new_name FROM _ma_sep_007_exc_name_map WHERE survivor_id = entity_master.entity_id)
WHERE entity_id IN (SELECT survivor_id FROM _ma_sep_007_exc_name_map WHERE new_name IS NOT NULL);
DELETE FROM entity_master WHERE entity_id IN (SELECT duplicate_id FROM _ma_sep_007_exc_merge_map);

DROP TABLE _ma_sep_007_exc_merge_map;
DROP TABLE _ma_sep_007_exc_name_map;