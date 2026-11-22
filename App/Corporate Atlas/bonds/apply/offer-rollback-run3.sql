-- MA-NOV-BOND.OFFER2 offering rollback — run 3 of 3. NOT RUN by OFFER2; for U8 BOND.VERIFY after BOND-CR2 and write approval 2.
-- Offering bonds-offering-1.1.0; reliability bonds-1.3.1 must be applied first (BOND.APPLY1). Generated 2026-11-22T16:30:00Z from offer-run.json (52b5f2922b9e3648…).
-- 1 batches, 5 statements, 133 rows (deletes exactly the rows this run inserted; a row never inserted is not counted). Stop on the first mismatch against the batch vector.

-- batch 1: 2 filings, 2 statements, expected [108,25]
DELETE FROM bond_offering_fact WHERE parser_version = 'bonds-offering-1.1.0' AND accession_number IN ('0001193125-26-349174', '0001193125-26-387878');
DELETE FROM bond_offering_party WHERE parser_version = 'bonds-offering-1.1.0' AND accession_number IN ('0001193125-26-349174', '0001193125-26-387878');
