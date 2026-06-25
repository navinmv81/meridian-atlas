-- ═══════════════════════════════════════════════════════════════
-- Meridian Atlas ETF Upgrade — Tasks A1–A4
-- Run once via: wrangler d1 execute meridian-etf --remote --file migrations/a1-a4-upgrade.sql
-- ═══════════════════════════════════════════════════════════════

-- A1: Add snapshot integrity column to fund_holdings_monthly
-- Existing rows get DEFAULT 'complete' (backward-compatible)
ALTER TABLE fund_holdings_monthly ADD COLUMN snapshot_status TEXT DEFAULT 'complete';

-- A3: Alias table for exposure explorer
CREATE TABLE IF NOT EXISTS etf_aliases (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  alias          TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  created_at     TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_etf_aliases_alias
  ON etf_aliases(UPPER(TRIM(alias)));

-- A3: Seed alias data (INSERT OR IGNORE — safe to re-run)
INSERT OR IGNORE INTO etf_aliases (alias, canonical_name) VALUES
-- Core tech and internet
('GOOGLE','ALPHABET'),
('GOOGL','ALPHABET'),
('GOOG','ALPHABET'),
('FACEBOOK','META PLATFORMS'),
('META','META PLATFORMS'),
('MSFT','MICROSOFT'),
('AAPL','APPLE'),
('AMZN','AMAZON'),
('NVDA','NVIDIA'),
('NFLX','NETFLIX'),
('TSLA','TESLA'),
('ORCL','ORACLE'),
('ADBE','ADOBE'),
('CRM','SALESFORCE'),
-- Financials and payments
('JPM','JPMORGAN CHASE'),
('BAC','BANK OF AMERICA'),
('WFC','WELLS FARGO'),
('C','CITIGROUP'),
('GS','GOLDMAN SACHS'),
('MS','MORGAN STANLEY'),
('V','VISA'),
('MA','MASTERCARD'),
('AMEX','AMERICAN EXPRESS'),
('BLK','BLACKROCK'),
('SPGI','S&P GLOBAL'),
('MCO','MOODY''S'),
-- Consumer and global brands
('NESTLÉ','NESTLE'),
('NESTLE SA','NESTLE'),
('P&G','PROCTER & GAMBLE'),
('PG','PROCTER & GAMBLE'),
('COKE','COCA-COLA'),
('KO','COCA-COLA'),
('PEPSI','PEPSICO'),
('PEP','PEPSICO'),
('MCDONALDS','MCDONALD''S'),
('MCD','MCDONALD''S'),
('SBUX','STARBUCKS'),
('NKE','NIKE'),
('UNILEVER PLC','UNILEVER'),
('UNILEVER NV','UNILEVER'),
-- Industrials and autos
('BMW','BAYERISCHE MOTOREN WERKE'),
('VW','VOLKSWAGEN'),
('MERCEDES','MERCEDES-BENZ GROUP'),
('DAIMLER','MERCEDES-BENZ GROUP'),
('TOYOTA','TOYOTA MOTOR'),
('HONDA','HONDA MOTOR'),
('SIEMENS AG','SIEMENS'),
('SCHNEIDER','SCHNEIDER ELECTRIC'),
('A-B-B','ABB'),
-- Semiconductors and hardware
('TSMC','TAIWAN SEMICONDUCTOR'),
('TSM','TAIWAN SEMICONDUCTOR'),
('ASML HOLDING','ASML'),
('INTC','INTEL'),
('ADVANCED MICRO DEVICES','AMD'),
('QCOM','QUALCOMM'),
('AVGO','BROADCOM'),
('ARM HOLDINGS','ARM'),
-- Healthcare and pharma
('JNJ','JOHNSON & JOHNSON'),
('PFE','PFIZER'),
('MRK','MERCK'),
('ABBV','ABBVIE'),
('AZN','ASTRAZENECA'),
('ROCHE HOLDING','ROCHE'),
('NOVARTIS AG','NOVARTIS'),
('SANOFI SA','SANOFI'),
-- Energy and materials
('XOM','EXXON MOBIL'),
('CVX','CHEVRON'),
('SHELL PLC','SHELL'),
('BP PLC','BP'),
('TOTAL','TOTALENERGIES'),
('BHP GROUP','BHP'),
('RIO','RIO TINTO'),
('GLEN','GLENCORE');
