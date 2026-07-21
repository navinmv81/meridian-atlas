-- Sprint 2/3: entity_id-scoped indexes for the Issuer page panels
-- (13F ownership, financials, 8-K events). Without these, every
-- /api/entities/:id/issuer-panels request full-scans these tables, since
-- the only indexes that exist on them lead with cik/cusip, not entity_id
-- (see comments in sprint3-managerissuerpositionquarterly.sql,
-- sprint3-issuerperiodsummary.sql, sprint2-issuereventstream.sql).
--
-- issuerfilingmaster is intentionally NOT indexed here — it has no
-- entity_id column (see sprint2-issuerfilingmaster.sql). The filings panel
-- resolves the issuer's cik via issuereventstream instead and queries
-- issuerfilingmaster by (cik, form_type), so its existing deferred index
-- is created here under the name the Issuer-page spec already assumed.

CREATE INDEX IF NOT EXISTS idx_mqp_entity_id
  ON managerissuerpositionquarterly(entity_id, report_period);

CREATE INDEX IF NOT EXISTS idx_ips_entity_id
  ON issuerperiodsummary(entity_id);

CREATE INDEX IF NOT EXISTS idx_ies_entity_id
  ON issuereventstream(entity_id, filed_date);

CREATE INDEX IF NOT EXISTS idx_issuerfilingmaster_cik_form
  ON issuerfilingmaster(cik, form_type);
