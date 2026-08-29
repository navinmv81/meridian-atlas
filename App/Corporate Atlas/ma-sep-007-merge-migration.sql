-- MA-SEP-007 merge migration — 121 approved groups (105 Scenario-B auto + 16 Scenario-C auto), 123 loser entity_ids
-- Survivor rule: B = lowest entity_id among same-LEI group; C = the LEI-bearing entity_id (per finalized rule)
-- Names sourced live from GLEIF lei-records API at execution time (2026-08-29), not from either existing row
-- Repoints 7 dependent tables (6 named in the packet + entity_isin_map, per MA-SEP-001's actual executed pattern)

CREATE TABLE IF NOT EXISTS _ma_sep_007_merge_map (
  duplicate_id INTEGER PRIMARY KEY,
  survivor_id  INTEGER NOT NULL
);
DELETE FROM _ma_sep_007_merge_map;
INSERT OR IGNORE INTO _ma_sep_007_merge_map (duplicate_id, survivor_id) VALUES (25782,2730),(1818,1551),(26410,2604),(25623,2607),(25751,2705),(26711,2535),(25785,2733),(26515,2585),(27112,2611),(27026,2515),(25189,2309),(25749,2703),(25775,2725),(25626,2601),(25665,2612),(25752,2706),(25759,2713),(24824,2237),(1812,1628),(2699,2394),(25773,2724),(25653,2609),(2702,2458),(25748,2458),(2716,2548),(25745,2700),(25776,2726),(25585,2594),(26639,2600),(25788,2736),(25639,1987),(25767,2720),(2302,1760),(2251,1757),(25681,2588),(26627,2603),(25578,2064),(27116,2590),(28149,2599),(25761,2715),(1838,1641),(25746,2701),(2279,1904),(28148,2583),(2250,1497),(26584,2591),(1773,1622),(26919,2605),(27029,2606),(1793,1542),(26600,2332),(25408,2555),(25632,2175),(27078,2613),(24895,2289),(25679,2595),(26339,2598),(25772,2723),(2298,1712),(2320,1753),(25417,2516),(2734,2404),(25786,2404),(2240,1619),(25676,2596),(26955,2587),(25621,2108),(1770,1611),(25616,2584),(2296,1533),(25614,2139),(26847,2592),(1901,1781),(1849,1438),(2310,1537),(25637,2614),(2299,1763),(24856,2321),(25595,2602),(1808,1690),(1786,761),(1804,1685),(1790,1563),(1892,1819),(25640,2084),(2300,1439),(24887,2276),(25769,2511),(2316,1471),(2294,1636),(26943,2339),(26601,2526),(26684,2581),(1768,1630),(6978,2476),(27114,2446),(2236,1452),(1850,1495),(2245,431),(1748,716),(1772,1489),(2329,1506),(1829,1659),(25412,2346),(25407,2356),(25415,2527),(25419,2566),(286,1552),(295,1462),(106208,28294),(105718,28688),(91468,6980),(87662,26170),(107658,28010),(99371,28106),(30848,28247),(105656,28305),(105448,28768),(105411,28799),(105645,28815),(105504,28835),(100417,29280),(30705,29616);

CREATE TABLE IF NOT EXISTS _ma_sep_007_name_map (
  survivor_id INTEGER PRIMARY KEY,
  new_name    TEXT NOT NULL
);
DELETE FROM _ma_sep_007_name_map;
INSERT OR IGNORE INTO _ma_sep_007_name_map (survivor_id, new_name) VALUES (2730,'Bayer Aktiengesellschaft'),(1551,'THE TORO COMPANY'),(2604,'XTB SPÓŁKA AKCYJNA'),(2607,'LPP SPÓŁKA AKCYJNA'),(2705,'Talanx Aktiengesellschaft'),(2535,'U C B'),(2733,'Siemens Aktiengesellschaft'),(2585,'"KRUK" SPÓŁKA AKCYJNA'),(2611,'ENEA SPÓŁKA AKCYJNA'),(2515,'ENDESA SA'),(2309,'PARAMOUNT GLOBAL'),(2703,'RATIONAL Aktiengesellschaft'),(2725,'HOCHTIEF Aktiengesellschaft'),(2601,'mBank Spółka Akcyjna'),(2612,'ORLEN SPÓŁKA AKCYJNA'),(2706,'GEA Group Aktiengesellschaft'),(2713,'Sartorius Aktiengesellschaft'),(2237,'PUBLIC STORAGE OPERATING COMPANY'),(1628,'THE TJX COMPANIES, INC.'),(2394,'Beiersdorf Aktiengesellschaft'),(2724,'VOLKSWAGEN AKTIENGESELLSCHAFT'),(2609,'MODIVO SPÓŁKA AKCYJNA'),(2458,'Deutsche Börse Aktiengesellschaft'),(2548,'Rheinmetall Aktiengesellschaft'),(2700,'Continental Aktiengesellschaft'),(2726,'COMMERZBANK Aktiengesellschaft'),(2594,'BUDIMEX SPÓŁKA AKCYJNA'),(2600,'GRUPA KĘTY SPÓŁKA AKCYJNA'),(2736,'Knorr-Bremse Aktiengesellschaft'),(1987,'BİM BİRLEŞİK MAĞAZALAR ANONİM ŞİRKETİ'),(2720,'DEUTSCHE BANK AKTIENGESELLSCHAFT'),(1760,'THE ALLSTATE CORPORATION'),(1757,'THE KROGER CO.'),(2588,'CD PROJEKT RED SPÓŁKA AKCYJNA'),(2603,'ALIOR BANK SPÓŁKA AKCYJNA'),(2064,'"DINO POLSKA" SPÓŁKA AKCYJNA'),(2590,'GRUPA AZOTY SPÓŁKA AKCYJNA'),(2599,'DIAGNOSTYKA SPÓŁKA AKCYJNA'),(2715,'Dr. Ing. h.c. F. Porsche Aktiengesellschaft'),(1641,'New York Times Co.'),(2701,'Deutsche Lufthansa Aktiengesellschaft'),(1904,'T. ROWE PRICE GROUP, INC.'),(2583,'AUTO PARTNER SPÓŁKA AKCYJNA'),(1497,'THE CIGNA GROUP'),(2591,'JASTRZĘBSKA SPÓŁKA WĘGLOWA SPÓŁKA AKCYJNA'),(1622,'A. O. SMITH CORPORATION'),(2605,'ORANGE POLSKA SPÓŁKA AKCYJNA'),(2606,'ASSECO POLAND SPÓŁKA AKCYJNA'),(1542,'THE SHERWIN-WILLIAMS COMPANY'),(2332,'GROUPE BRUXELLES LAMBERT'),(2555,'"TERNA - RETE ELETTRICA NAZIONALE SOCIETA'' PER AZIONI" (IN FORMA ABBREVIATA "TERNA S.P.A.")'),(2175,'YAPI VE KREDİ BANKASI ANONİM ŞİRKETİ'),(2613,'CYFROWY POLSAT SPÓŁKA AKCYJNA'),(2289,'WELLTOWER OP LLC'),(2595,'KGHM Polska Miedź Spółka Akcyjna'),(2598,'BENEFIT SYSTEMS SPÓŁKA AKCYJNA'),(2723,'Bayerische Motoren Werke Aktiengesellschaft'),(1712,'The Travelers Companies, Inc.'),(1753,'Lowe''s Companies, Inc.'),(2516,'RECORDATI INDUSTRIA CHIMICA E FARMACEUTICA S.P.A. IN BREVE RECORDATI S.P.A.'),(2404,'Münchener Rückversicherungs-Gesellschaft Aktiengesellschaft in München'),(1619,'PUBLIC SERVICE ENTERPRISE GROUP INCORPORATED'),(2596,'POWSZECHNY ZAKŁAD UBEZPIECZEŃ SPÓŁKA AKCYJNA'),(2587,'TAURON POLSKA ENERGIA SPÓŁKA AKCYJNA'),(2108,'ASELSAN ELEKTRONİK SANAYİ VE TİCARET ANONİM ŞİRKETİ'),(1611,'W. R. BERKLEY CORPORATION'),(2584,'BANK POLSKA KASA OPIEKI - SPÓŁKA AKCYJNA'),(1533,'EXPEDITORS INTERNATIONAL OF WASHINGTON, INC.'),(2139,'ČEZ, a. s.'),(2592,'BANK HANDLOWY W WARSZAWIE SPÓŁKA AKCYJNA'),(1781,'HUNTINGTON BANCSHARES INCORPORATED'),(1438,'CARLISLE COMPANIES INCORPORATED'),(1537,'WEST PHARMACEUTICAL SERVICES, INC.'),(2614,'POWSZECHNA KASA OSZCZĘDNOŚCI BANK POLSKI SPÓŁKA AKCYJNA'),(1763,'THE SOUTHERN COMPANY'),(2321,'THE WILLIAMS COMPANIES, INC.'),(2602,'PGE POLSKA GRUPA ENERGETYCZNA SPÓŁKA AKCYJNA'),(1690,'XYLEM INC.'),(761,'LOUISIANA-PACIFIC CORPORATION'),(1685,'FIRST CITIZENS BANCSHARES, INC.'),(1563,'THE HOME DEPOT, INC.'),(1819,'Packaging Corporation of America'),(2084,'BANK OF THE PHIL. ISLANDS'),(1439,'THE HARTFORD INSURANCE GROUP, INC.'),(2276,'THE WALT DISNEY COMPANY'),(2511,'Hannover Rück SE'),(1471,'AMERICAN WATER WORKS COMPANY, INC.'),(1636,'THE GOLDMAN SACHS GROUP, INC.'),(2339,'JERÓNIMO MARTINS SGPS SA'),(2526,'Kühne + Nagel International AG'),(2581,'NESTLÉ S.A.'),(1630,'MOODY''S CORPORATION'),(2476,'BANCO COMERCIAL PORTUGUÊS S.A.'),(2446,'INDUSTRIA DE DISEÑO TEXTIL, S.A.'),(1452,'THE PNC FINANCIAL SERVICES GROUP, INC.'),(1495,'Domino''s Pizza, Inc.'),(431,'L3HARRIS TECHNOLOGIES, INC.'),(716,'THE HANOVER INSURANCE GROUP, INC.'),(1489,'J. B. Hunt Transport Services, Inc.'),(1506,'Philip Morris International Inc.'),(1659,'THE COCA-COLA COMPANY'),(2346,'UNICREDIT, SOCIETA'' PER AZIONI'),(2356,'ASSICURAZIONI GENERALI SOCIETA'' PER AZIONI'),(2527,'POSTE ITALIANE - SOCIETA'' PER AZIONI'),(2566,'LEONARDO - SOCIETA'' PER AZIONI'),(1552,'INVESCO LTD.'),(1462,'STATE STREET CORPORATION'),(28294,'UNITED STATES STEEL CORPORATION'),(28688,'Northern Territory Treasury Corporation'),(6980,'ABB Ltd'),(26170,'United States Lime & Minerals, Inc.'),(28010,'UBS AG'),(28106,'United Mexican States'),(28247,'Export Development Canada'),(28305,'CAISSE D''AMORTISSEMENT DE LA DETTE SOCIALE'),(28768,'Land Berlin'),(28799,'XUNTA DE GALICIA'),(28815,'VILLE DE PARIS'),(28835,'ILE-DE-FRANCE MOBILITES'),(29280,'Banco Nacional de Panama'),(29616,'Northwestern University');

-- 1. entity_relationships (PK: parent_entity_id, child_entity_id, relationship_type)
DELETE FROM entity_relationships
WHERE parent_entity_id IN (SELECT duplicate_id FROM _ma_sep_007_merge_map)
AND EXISTS (
  SELECT 1 FROM entity_relationships e2
  JOIN _ma_sep_007_merge_map m ON m.duplicate_id = entity_relationships.parent_entity_id
  WHERE e2.parent_entity_id = m.survivor_id AND e2.child_entity_id = entity_relationships.child_entity_id AND e2.relationship_type = entity_relationships.relationship_type
);
UPDATE entity_relationships
SET parent_entity_id = (SELECT survivor_id FROM _ma_sep_007_merge_map WHERE duplicate_id = entity_relationships.parent_entity_id)
WHERE parent_entity_id IN (SELECT duplicate_id FROM _ma_sep_007_merge_map);
DELETE FROM entity_relationships
WHERE child_entity_id IN (SELECT duplicate_id FROM _ma_sep_007_merge_map)
AND EXISTS (
  SELECT 1 FROM entity_relationships e2
  JOIN _ma_sep_007_merge_map m ON m.duplicate_id = entity_relationships.child_entity_id
  WHERE e2.child_entity_id = m.survivor_id AND e2.parent_entity_id = entity_relationships.parent_entity_id AND e2.relationship_type = entity_relationships.relationship_type
);
UPDATE entity_relationships
SET child_entity_id = (SELECT survivor_id FROM _ma_sep_007_merge_map WHERE duplicate_id = entity_relationships.child_entity_id)
WHERE child_entity_id IN (SELECT duplicate_id FROM _ma_sep_007_merge_map);
DELETE FROM entity_relationships WHERE parent_entity_id = child_entity_id;

-- 2. fund_entity_link (PK: etf_symbol; entity_id not part of PK)
UPDATE fund_entity_link
SET entity_id = (SELECT survivor_id FROM _ma_sep_007_merge_map WHERE duplicate_id = fund_entity_link.entity_id)
WHERE entity_id IN (SELECT duplicate_id FROM _ma_sep_007_merge_map);

-- 3. instrument_entity_map (PK: instrument_key; entity_id not part of PK)
UPDATE instrument_entity_map
SET entity_id = (SELECT survivor_id FROM _ma_sep_007_merge_map WHERE duplicate_id = instrument_entity_map.entity_id)
WHERE entity_id IN (SELECT duplicate_id FROM _ma_sep_007_merge_map);

-- 4. entity_exposure_monthly (PK: report_month, entity_id, holder_entity_id)
DELETE FROM entity_exposure_monthly
WHERE entity_id IN (SELECT duplicate_id FROM _ma_sep_007_merge_map)
AND EXISTS (
  SELECT 1 FROM entity_exposure_monthly e2
  JOIN _ma_sep_007_merge_map m ON m.duplicate_id = entity_exposure_monthly.entity_id
  WHERE e2.entity_id = m.survivor_id AND e2.report_month = entity_exposure_monthly.report_month AND e2.holder_entity_id = entity_exposure_monthly.holder_entity_id
);
UPDATE entity_exposure_monthly
SET entity_id = (SELECT survivor_id FROM _ma_sep_007_merge_map WHERE duplicate_id = entity_exposure_monthly.entity_id)
WHERE entity_id IN (SELECT duplicate_id FROM _ma_sep_007_merge_map);
-- holder_entity_id: confirmed live 2026-08-29, 0 affected rows (holders are funds, not in this merge set)

-- 5. fund_exposure_coverage (PK: report_month, holder_entity_id)
-- confirmed live 2026-08-29, 0 affected rows (holders are funds, not in this merge set) — no statement needed

-- 6. entity_enrichment_queue (PK: entity_id itself)
DELETE FROM entity_enrichment_queue
WHERE entity_id IN (SELECT duplicate_id FROM _ma_sep_007_merge_map)
AND EXISTS (
  SELECT 1 FROM entity_enrichment_queue e2
  JOIN _ma_sep_007_merge_map m ON m.duplicate_id = entity_enrichment_queue.entity_id
  WHERE e2.entity_id = m.survivor_id
);
UPDATE entity_enrichment_queue
SET entity_id = (SELECT survivor_id FROM _ma_sep_007_merge_map WHERE duplicate_id = entity_enrichment_queue.entity_id)
WHERE entity_id IN (SELECT duplicate_id FROM _ma_sep_007_merge_map);

-- 7. entity_isin_map (PK: isin, lei; entity_id not part of PK) — added beyond the packet's 6-table list,
-- matching MA-SEP-001's actual executed pattern (this table didn't exist when the original Build Brief spec was written)
UPDATE entity_isin_map
SET entity_id = (SELECT survivor_id FROM _ma_sep_007_merge_map WHERE duplicate_id = entity_isin_map.entity_id)
WHERE entity_id IN (SELECT duplicate_id FROM _ma_sep_007_merge_map);

-- 8. entity_master: update survivor names to GLEIF legalName, then remove fully-repointed loser rows
UPDATE entity_master
SET name = (SELECT new_name FROM _ma_sep_007_name_map WHERE survivor_id = entity_master.entity_id)
WHERE entity_id IN (SELECT survivor_id FROM _ma_sep_007_name_map);
DELETE FROM entity_master WHERE entity_id IN (SELECT duplicate_id FROM _ma_sep_007_merge_map);

-- 9. Drop scratch mapping tables
DROP TABLE _ma_sep_007_merge_map;
DROP TABLE _ma_sep_007_name_map;
