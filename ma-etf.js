/* ============================================================
   ma-etf.js — Meridian Atlas
   ETF Holdings (N-PORT) – Three-stage UI rebuild
   Globals needed: MY_WORKER_URL, showModal, closeModal, openBySymbol
   ============================================================ */

/* --- ETF HOLDINGS N-PORT SCRIPT START --- */

// ── State ─────────────────────────────────────────────────────
let currentEtfsList     = [];
let etfAbortController  = null;
let currentEtfHoldings  = [];
let currentFilterText   = "";
let currentSliceSize    = "All";
let currentIssuerFilter = "All";

let currentAssetClassFilter  = 'All';
let currentIssuerSearchText  = '';
let currentDeepOnly          = false;
let sidebarShowAll           = false;
let sidebarSearchText        = '';
let sidebarCurrentIssuer     = '';
let currentEtfTab            = 'holdings'; // 'overview' | 'holdings' | 'changes'

// ── Static metadata ───────────────────────────────────────────
const ETF_META = {
  ACWI:  { issuer:"iShares",    assetClass:"Global Equity",          index:"MSCI ACWI Index" },
  AGG:   { issuer:"iShares",    assetClass:"Fixed Income – IG",      index:"Bloomberg US Aggregate Bond Index" },
  AMLP:  { issuer:"ALPS",       assetClass:"US Equity",              index:"Alerian MLP Infrastructure Index" },
  AOA:   { issuer:"iShares",    assetClass:"Multi-Asset",            index:null },
  AOK:   { issuer:"iShares",    assetClass:"Multi-Asset",            index:null },
  AOM:   { issuer:"iShares",    assetClass:"Multi-Asset",            index:null },
  AOR:   { issuer:"iShares",    assetClass:"Multi-Asset",            index:null },
  ARKF:  { issuer:"ARK",        assetClass:"US Equity",              index:null },
  ARKG:  { issuer:"ARK",        assetClass:"US Equity",              index:null },
  ARKK:  { issuer:"ARK",        assetClass:"US Equity",              index:null },
  ARKQ:  { issuer:"ARK",        assetClass:"US Equity",              index:null },
  ARKW:  { issuer:"ARK",        assetClass:"US Equity",              index:null },
  AVDV:  { issuer:"Avantis",    assetClass:"Intl Equity",            index:null },
  AVEM:  { issuer:"Avantis",    assetClass:"EM Equity",              index:null },
  AVUV:  { issuer:"Avantis",    assetClass:"US Equity",              index:null },
  BIL:   { issuer:"SPDR",       assetClass:"Fixed Income – Treasury",index:"Bloomberg 1-3 Month T-Bill Index" },
  BITB:  { issuer:"Bitwise",    assetClass:"Crypto",                 index:null },
  BIV:   { issuer:"Vanguard",   assetClass:"Fixed Income – IG",      index:"Bloomberg US 5-10 Year Gov/Credit Float Adj Index" },
  BKLN:  { issuer:"Invesco",    assetClass:"Fixed Income – Loans",   index:"Morningstar LSTA US Leveraged Loan 100 Index" },
  BLV:   { issuer:"Vanguard",   assetClass:"Fixed Income – IG",      index:"Bloomberg US Long Gov/Credit Float Adj Index" },
  BND:   { issuer:"Vanguard",   assetClass:"Fixed Income – IG",      index:"Bloomberg US Aggregate Float Adjusted Index" },
  BNDX:  { issuer:"Vanguard",   assetClass:"Fixed Income – Intl",    index:"Bloomberg Global Aggregate ex-USD Float Adj RIC Cap Index" },
  BOTZ:  { issuer:"Global X",   assetClass:"US Equity",              index:"Indxx Global Robotics & AI Thematic Index" },
  BOXX:  { issuer:"Alpha Architect", assetClass:"Fixed Income – IG", index:null },
  BSV:   { issuer:"Vanguard",   assetClass:"Fixed Income – IG",      index:"Bloomberg US 1-5 Year Gov/Credit Float Adj Index" },
  CALF:  { issuer:"Pacer",      assetClass:"US Equity",              index:"Pacer US Small Cap Cash Cows Index" },
  CIBR:  { issuer:"First Trust", assetClass:"US Equity",             index:"Nasdaq CTA Cybersecurity Index" },
  CLOU:  { issuer:"Global X",   assetClass:"US Equity",              index:"Indxx Global Cloud Computing Index" },
  CNRG:  { issuer:"SPDR",       assetClass:"US Equity",              index:"S&P Kensho Clean Power Index" },
  COWZ:  { issuer:"Pacer",      assetClass:"US Equity",              index:"Pacer US Cash Cows 100 Index" },
  DBO:   { issuer:"Invesco",    assetClass:"Commodity",              index:null },
  DFAC:  { issuer:"Dimensional", assetClass:"US Equity",             index:null },
  DFAE:  { issuer:"Dimensional", assetClass:"EM Equity",             index:null },
  DFAI:  { issuer:"Dimensional", assetClass:"Intl Equity",           index:null },
  DFAU:  { issuer:"Dimensional", assetClass:"US Equity",             index:null },
  DGRO:  { issuer:"iShares",    assetClass:"US Equity",              index:"Morningstar US Dividend Growth Index" },
  DGRW:  { issuer:"WisdomTree", assetClass:"US Equity",              index:"WisdomTree US Quality Dividend Growth Index" },
  DIA:   { issuer:"SPDR",       assetClass:"US Equity",              index:"Dow Jones Industrial Average" },
  DLN:   { issuer:"WisdomTree", assetClass:"US Equity",              index:"WisdomTree US LargeCap Dividend Index" },
  DVY:   { issuer:"iShares",    assetClass:"US Equity",              index:"Dow Jones U.S. Select Dividend Index" },
  EEM:   { issuer:"iShares",    assetClass:"EM Equity",              index:"MSCI Emerging Markets Index" },
  EEMV:  { issuer:"iShares",    assetClass:"EM Equity",              index:"MSCI Emerging Markets Minimum Volatility Index" },
  EFA:   { issuer:"iShares",    assetClass:"Intl Equity",            index:"MSCI EAFE Index" },
  EFAV:  { issuer:"iShares",    assetClass:"Intl Equity",            index:"MSCI EAFE Minimum Volatility Index" },
  EIDO:  { issuer:"iShares",    assetClass:"EM Equity",              index:"MSCI Indonesia Index" },
  EMB:   { issuer:"iShares",    assetClass:"Fixed Income – EM",      index:"J.P. Morgan EMBI Global Core Index" },
  ENZL:  { issuer:"iShares",    assetClass:"Intl Equity",            index:"MSCI New Zealand IMI 25/50 Index" },
  EPHE:  { issuer:"iShares",    assetClass:"EM Equity",              index:"MSCI Philippines Investable Market Index" },
  EPOL:  { issuer:"iShares",    assetClass:"EM Equity",              index:"MSCI Poland IMI 25/50 Index" },
  EPU:   { issuer:"iShares",    assetClass:"EM Equity",              index:"MSCI All Peru Capped Index" },
  ESGD:  { issuer:"iShares",    assetClass:"Intl Equity",            index:"MSCI EAFE ESG Leaders Index" },
  ETHA:  { issuer:"iShares",    assetClass:"Crypto",                 index:null },
  EWA:   { issuer:"iShares",    assetClass:"Intl Equity",            index:"MSCI Australia Index" },
  EWC:   { issuer:"iShares",    assetClass:"Intl Equity",            index:"MSCI Canada Custom Capped Index" },
  EWG:   { issuer:"iShares",    assetClass:"Intl Equity",            index:"MSCI Germany Index" },
  EWH:   { issuer:"iShares",    assetClass:"Intl Equity",            index:"MSCI Hong Kong Index" },
  EWI:   { issuer:"iShares",    assetClass:"Intl Equity",            index:"MSCI Italy 25/50 Index" },
  EWJ:   { issuer:"iShares",    assetClass:"Intl Equity",            index:"MSCI Japan Index" },
  EWP:   { issuer:"iShares",    assetClass:"Intl Equity",            index:"MSCI Spain 25/50 Index" },
  EWQ:   { issuer:"iShares",    assetClass:"Intl Equity",            index:"MSCI France Index" },
  EWT:   { issuer:"iShares",    assetClass:"EM Equity",              index:"MSCI Taiwan 25/50 Index" },
  EWU:   { issuer:"iShares",    assetClass:"Intl Equity",            index:"MSCI United Kingdom Index" },
  EWY:   { issuer:"iShares",    assetClass:"EM Equity",              index:"MSCI South Korea Capped Index" },
  EWZ:   { issuer:"iShares",    assetClass:"EM Equity",              index:"MSCI Brazil Capped Index" },
  EWZS:  { issuer:"iShares",    assetClass:"EM Equity",              index:"MSCI Brazil Small Cap Index" },
  EZBC:  { issuer:"Franklin",   assetClass:"Crypto",                 index:null },
  EZU:   { issuer:"iShares",    assetClass:"Intl Equity",            index:"MSCI EMU Index" },
  FAN:   { issuer:"First Trust", assetClass:"Global Equity",         index:"ISE Clean Edge Global Wind Energy Index" },
  FAS:   { issuer:"Direxion",   assetClass:"Leveraged",              index:null },
  FAZ:   { issuer:"Direxion",   assetClass:"Leveraged",              index:null },
  FBTC:  { issuer:"Fidelity",   assetClass:"Crypto",                 index:null },
  FDN:   { issuer:"First Trust", assetClass:"US Equity",             index:"Dow Jones Internet Composite Index" },
  FENY:  { issuer:"Fidelity",   assetClass:"US Equity",              index:"MSCI USA IMI Energy Index" },
  FETH:  { issuer:"Fidelity",   assetClass:"Crypto",                 index:null },
  FHLC:  { issuer:"Fidelity",   assetClass:"US Equity",              index:"MSCI USA IMI Health Care Index" },
  FIDU:  { issuer:"Fidelity",   assetClass:"US Equity",              index:"MSCI USA IMI Industrials Index" },
  FLOT:  { issuer:"iShares",    assetClass:"Fixed Income – IG",      index:"Bloomberg US Floating Rate Note < 5 Years Index" },
  FNCL:  { issuer:"Fidelity",   assetClass:"US Equity",              index:"MSCI USA IMI Financials Index" },
  FTEC:  { issuer:"Fidelity",   assetClass:"US Equity",              index:"MSCI USA IMI Information Technology Index" },
  GDX:   { issuer:"VanEck",     assetClass:"US Equity",              index:"NYSE Arca Gold Miners Index" },
  GDXJ:  { issuer:"VanEck",     assetClass:"Global Equity",          index:"MVIS Global Junior Gold Miners Index" },
  GLD:   { issuer:"SPDR",       assetClass:"Commodity",              index:null },
  GNR:   { issuer:"SPDR",       assetClass:"Global Equity",          index:"S&P Global Natural Resources Index" },
  GOVT:  { issuer:"iShares",    assetClass:"Fixed Income – Treasury",index:"ICE US Treasury Core Bond Index" },
  HDV:   { issuer:"iShares",    assetClass:"US Equity",              index:"Morningstar Dividend Yield Focus Index" },
  HYD:   { issuer:"VanEck",     assetClass:"Fixed Income – Muni",    index:"ICE High Yield Crossover Municipal Bond Index" },
  HYG:   { issuer:"iShares",    assetClass:"Fixed Income – HY",      index:"iBoxx $ Liquid High Yield Index" },
  IAI:   { issuer:"iShares",    assetClass:"US Equity",              index:"Dow Jones US Select Investment Services Index" },
  IAK:   { issuer:"iShares",    assetClass:"US Equity",              index:"Dow Jones US Select Insurance Index" },
  IAU:   { issuer:"iShares",    assetClass:"Commodity",              index:null },
  IBB:   { issuer:"iShares",    assetClass:"US Equity",              index:"Nasdaq Biotechnology Index" },
  IBIT:  { issuer:"iShares",    assetClass:"Crypto",                 index:null },
  ICLN:  { issuer:"iShares",    assetClass:"Global Equity",          index:"S&P Global Clean Energy Index" },
  IEF:   { issuer:"iShares",    assetClass:"Fixed Income – Treasury",index:"ICE US Treasury 7-10 Year Bond Index" },
  IEMG:  { issuer:"iShares",    assetClass:"EM Equity",              index:"MSCI Emerging Markets Investable Market Index" },
  IGIB:  { issuer:"iShares",    assetClass:"Fixed Income – IG",      index:"ICE BofA 5-10 Year US Corporate Index" },
  IGLB:  { issuer:"iShares",    assetClass:"Fixed Income – IG",      index:"ICE BofA 10+ Year US Corporate Index" },
  IGM:   { issuer:"iShares",    assetClass:"US Equity",              index:"S&P North American Technology Sector Index" },
  IGOV:  { issuer:"iShares",    assetClass:"Fixed Income – Intl",    index:"FTSE World Government Bond Index ex-US" },
  IGSB:  { issuer:"iShares",    assetClass:"Fixed Income – IG",      index:"ICE BofA 1-5 Year US Corporate Index" },
  IGV:   { issuer:"iShares",    assetClass:"US Equity",              index:"S&P North American Technology-Software Index" },
  IHF:   { issuer:"iShares",    assetClass:"US Equity",              index:"Dow Jones US Select Health Care Providers Index" },
  IHI:   { issuer:"iShares",    assetClass:"US Equity",              index:"Dow Jones US Select Medical Equipment Index" },
  IJH:   { issuer:"iShares",    assetClass:"US Equity",              index:"S&P MidCap 400 Index" },
  IJJ:   { issuer:"iShares",    assetClass:"US Equity",              index:"S&P MidCap 400 Value Index" },
  IJK:   { issuer:"iShares",    assetClass:"US Equity",              index:"S&P MidCap 400 Growth Index" },
  IJR:   { issuer:"iShares",    assetClass:"US Equity",              index:"S&P SmallCap 600 Index" },
  IJT:   { issuer:"iShares",    assetClass:"US Equity",              index:"S&P SmallCap 600 Growth Index" },
  INDA:  { issuer:"iShares",    assetClass:"EM Equity",              index:"MSCI India Index" },
  ITOT:  { issuer:"iShares",    assetClass:"US Equity",              index:"S&P Total Market Index" },
  IVE:   { issuer:"iShares",    assetClass:"US Equity",              index:"S&P 500 Value Index" },
  IVV:   { issuer:"iShares",    assetClass:"US Equity",              index:"S&P 500 Index" },
  IVW:   { issuer:"iShares",    assetClass:"US Equity",              index:"S&P 500 Growth Index" },
  IWC:   { issuer:"iShares",    assetClass:"US Equity",              index:"Russell Microcap Index" },
  IWM:   { issuer:"iShares",    assetClass:"US Equity",              index:"Russell 2000 Index" },
  IWN:   { issuer:"iShares",    assetClass:"US Equity",              index:"Russell 2000 Value Index" },
  IWO:   { issuer:"iShares",    assetClass:"US Equity",              index:"Russell 2000 Growth Index" },
  IWP:   { issuer:"iShares",    assetClass:"US Equity",              index:"Russell Mid-Cap Growth Index" },
  IWR:   { issuer:"iShares",    assetClass:"US Equity",              index:"Russell Mid-Cap Index" },
  IYE:   { issuer:"iShares",    assetClass:"US Equity",              index:"Dow Jones US Oil & Gas Index" },
  IYF:   { issuer:"iShares",    assetClass:"US Equity",              index:"Dow Jones US Financials Index" },
  IYH:   { issuer:"iShares",    assetClass:"US Equity",              index:"Dow Jones US Health Care Index" },
  IYLD:  { issuer:"iShares",    assetClass:"Multi-Asset",            index:"Morningstar Multi-Asset High Income Index" },
  IYR:   { issuer:"iShares",    assetClass:"US Equity",              index:"Dow Jones US Real Estate Capped Index" },
  IYT:   { issuer:"iShares",    assetClass:"US Equity",              index:"NYSE Arca North American Transportation Index" },
  IYW:   { issuer:"iShares",    assetClass:"US Equity",              index:"Dow Jones US Technology Capped Index" },
  JEPI:  { issuer:"JPMorgan",   assetClass:"US Equity",              index:null },
  JEPQ:  { issuer:"JPMorgan",   assetClass:"US Equity",              index:null },
  JMST:  { issuer:"JPMorgan",   assetClass:"Fixed Income – Muni",    index:null },
  JNK:   { issuer:"SPDR",       assetClass:"Fixed Income – HY",      index:"Bloomberg High Yield Very Liquid Index" },
  JPST:  { issuer:"JPMorgan",   assetClass:"Fixed Income – IG",      index:null },
  KBE:   { issuer:"SPDR",       assetClass:"US Equity",              index:"S&P Banks Select Industry Index" },
  KRE:   { issuer:"SPDR",       assetClass:"US Equity",              index:"S&P Regional Banks Select Industry Index" },
  LABD:  { issuer:"Direxion",   assetClass:"Leveraged",              index:null },
  LABU:  { issuer:"Direxion",   assetClass:"Leveraged",              index:null },
  LIT:   { issuer:"Global X",   assetClass:"Global Equity",          index:"Solactive Global Lithium Index" },
  LQD:   { issuer:"iShares",    assetClass:"Fixed Income – IG",      index:"iBoxx $ Investment Grade Corporate Bond Index" },
  MBB:   { issuer:"iShares",    assetClass:"Fixed Income – MBS",     index:"Bloomberg US MBS Index" },
  MCHI:  { issuer:"iShares",    assetClass:"EM Equity",              index:"MSCI China Index" },
  MDY:   { issuer:"SPDR",       assetClass:"US Equity",              index:"S&P MidCap 400 Index" },
  MGK:   { issuer:"Vanguard",   assetClass:"US Equity",              index:"CRSP US Mega Cap Growth Index" },
  MGV:   { issuer:"Vanguard",   assetClass:"US Equity",              index:"CRSP US Mega Cap Value Index" },
  MINT:  { issuer:"PIMCO",      assetClass:"Fixed Income – IG",      index:null },
  MSOS:  { issuer:"AdvisorShares", assetClass:"US Equity",           index:null },
  MTUM:  { issuer:"iShares",    assetClass:"US Equity",              index:"MSCI USA Momentum SR Variant Index" },
  MUB:   { issuer:"iShares",    assetClass:"Fixed Income – Muni",    index:"ICE AMT-Free US National Municipal Index" },
  NEAR:  { issuer:"BlackRock",  assetClass:"Fixed Income – IG",      index:null },
  OIH:   { issuer:"VanEck",     assetClass:"US Equity",              index:"MVIS US Listed Oil Services 25 Index" },
  ONEQ:  { issuer:"Fidelity",   assetClass:"US Equity",              index:"Nasdaq Composite Index" },
  PAVE:  { issuer:"Global X",   assetClass:"US Equity",              index:"INDXX U.S. Infrastructure Development Index" },
  PDBC:  { issuer:"Invesco",    assetClass:"Commodity",              index:null },
  PEJ:   { issuer:"Invesco",    assetClass:"US Equity",              index:"Dynamic Leisure and Entertainment Intellidex Index" },
  PFF:   { issuer:"iShares",    assetClass:"Fixed Income – Preferred",index:"ICE Exchange-Listed Preferred & Hybrid Securities Index" },
  PPH:   { issuer:"VanEck",     assetClass:"US Equity",              index:"MVIS US Listed Pharmaceutical 25 Index" },
  QAT:   { issuer:"iShares",    assetClass:"EM Equity",              index:"MSCI All Qatar Capped Index" },
  QQQ:   { issuer:"Invesco",    assetClass:"US Equity",              index:"Nasdaq-100 Index" },
  QQQM:  { issuer:"Invesco",    assetClass:"US Equity",              index:"Nasdaq-100 Index" },
  QUAL:  { issuer:"iShares",    assetClass:"US Equity",              index:"MSCI USA Quality Factor Index" },
  REMX:  { issuer:"VanEck",     assetClass:"Global Equity",          index:"MVIS Global Rare Earth/Strategic Metals Index" },
  RSP:   { issuer:"Invesco",    assetClass:"US Equity",              index:"S&P 500 Equal Weight Index" },
  RYF:   { issuer:"Invesco",    assetClass:"US Equity",              index:"S&P 500 Equal Weight Financials Index" },
  RYH:   { issuer:"Invesco",    assetClass:"US Equity",              index:"S&P 500 Equal Weight Health Care Index" },
  RYT:   { issuer:"Invesco",    assetClass:"US Equity",              index:"S&P 500 Equal Weight Information Technology Index" },
  SCHA:  { issuer:"Schwab",     assetClass:"US Equity",              index:"Dow Jones US Small-Cap Total Stock Market Index" },
  SCHB:  { issuer:"Schwab",     assetClass:"US Equity",              index:"Dow Jones US Broad Stock Market Index" },
  SCHD:  { issuer:"Schwab",     assetClass:"US Equity",              index:"Dow Jones US Dividend 100 Index" },
  SCHE:  { issuer:"Schwab",     assetClass:"EM Equity",              index:"FTSE Emerging Index" },
  SCHF:  { issuer:"Schwab",     assetClass:"Intl Equity",            index:"FTSE Developed ex US Index" },
  SCHG:  { issuer:"Schwab",     assetClass:"US Equity",              index:"Dow Jones US Large-Cap Growth Total Stock Market Index" },
  SCHI:  { issuer:"Schwab",     assetClass:"Fixed Income – IG",      index:"Bloomberg US 5-10 Year Corporate Bond Index" },
  SCHM:  { issuer:"Schwab",     assetClass:"US Equity",              index:"Dow Jones US Mid-Cap Total Stock Market Index" },
  SCHP:  { issuer:"Schwab",     assetClass:"Fixed Income – Treasury",index:"Bloomberg US Treasury Inflation-Protected Securities Index" },
  SCHV:  { issuer:"Schwab",     assetClass:"US Equity",              index:"Dow Jones US Large-Cap Value Total Stock Market Index" },
  SCHX:  { issuer:"Schwab",     assetClass:"US Equity",              index:"Dow Jones US Large-Cap Total Stock Market Index" },
  SDY:   { issuer:"SPDR",       assetClass:"US Equity",              index:"S&P High Yield Dividend Aristocrats Index" },
  SGOV:  { issuer:"iShares",    assetClass:"Fixed Income – Treasury",index:"ICE 0-3 Month US Treasury Securities Index" },
  SHV:   { issuer:"iShares",    assetClass:"Fixed Income – Treasury",index:"ICE Short US Treasury Securities Index" },
  SHY:   { issuer:"iShares",    assetClass:"Fixed Income – Treasury",index:"ICE US Treasury 1-3 Year Bond Index" },
  SHYG:  { issuer:"iShares",    assetClass:"Fixed Income – HY",      index:"iBoxx $ Liquid High Yield 0-5 Index" },
  SIZE:  { issuer:"iShares",    assetClass:"US Equity",              index:"MSCI USA Risk Weighted Index" },
  SJNK:  { issuer:"SPDR",       assetClass:"Fixed Income – HY",      index:"Bloomberg Short Term High Yield Index" },
  SLQD:  { issuer:"iShares",    assetClass:"Fixed Income – IG",      index:"iBoxx $ Liquid Investment Grade 0-5 Index" },
  SLV:   { issuer:"iShares",    assetClass:"Commodity",              index:null },
  SMH:   { issuer:"VanEck",     assetClass:"US Equity",              index:"MVIS US Listed Semiconductor 25 Index" },
  SMMD:  { issuer:"iShares",    assetClass:"US Equity",              index:"Russell 2500 Index" },
  SOXL:  { issuer:"Direxion",   assetClass:"Leveraged",              index:null },
  SOXS:  { issuer:"Direxion",   assetClass:"Leveraged",              index:null },
  SOXX:  { issuer:"iShares",    assetClass:"US Equity",              index:"ICE Semiconductor Index" },
  SPAB:  { issuer:"SPDR",       assetClass:"Fixed Income – IG",      index:"Bloomberg US Aggregate Bond Index" },
  SPDW:  { issuer:"SPDR",       assetClass:"Intl Equity",            index:"S&P Developed ex-US BMI Index" },
  SPEM:  { issuer:"SPDR",       assetClass:"EM Equity",              index:"S&P Emerging BMI Index" },
  SPIB:  { issuer:"SPDR",       assetClass:"Fixed Income – IG",      index:"Bloomberg Intermediate US Corporate Bond Index" },
  SPLG:  { issuer:"SPDR",       assetClass:"US Equity",              index:"S&P 500 Index" },
  SPSB:  { issuer:"SPDR",       assetClass:"Fixed Income – IG",      index:"Bloomberg 1-3 Year US Corporate Bond Index" },
  SPTI:  { issuer:"SPDR",       assetClass:"Fixed Income – Treasury",index:"Bloomberg Intermediate US Treasury Index" },
  SPTL:  { issuer:"SPDR",       assetClass:"Fixed Income – Treasury",index:"Bloomberg Long US Treasury Index" },
  SPTS:  { issuer:"SPDR",       assetClass:"Fixed Income – Treasury",index:"Bloomberg 1-3 Year US Treasury Index" },
  SPXL:  { issuer:"Direxion",   assetClass:"Leveraged",              index:null },
  SPXS:  { issuer:"Direxion",   assetClass:"Leveraged",              index:null },
  SPY:   { issuer:"SPDR",       assetClass:"US Equity",              index:"S&P 500 Index" },
  SPYD:  { issuer:"SPDR",       assetClass:"US Equity",              index:"S&P 500 High Dividend Index" },
  SPYV:  { issuer:"SPDR",       assetClass:"US Equity",              index:"S&P 500 Value Index" },
  SPYX:  { issuer:"SPDR",       assetClass:"US Equity",              index:"S&P 500 Fossil Fuel Free Index" },
  SQQQ:  { issuer:"ProShares",  assetClass:"Leveraged",              index:null },
  SRLN:  { issuer:"SPDR",       assetClass:"Fixed Income – Loans",   index:null },
  STIP:  { issuer:"iShares",    assetClass:"Fixed Income – Treasury",index:"ICE 0-5 Year TIPS Index" },
  SVXY:  { issuer:"ProShares",  assetClass:"Alternatives",           index:null },
  TAN:   { issuer:"Invesco",    assetClass:"Global Equity",          index:"MAC Global Solar Energy Index" },
  TIP:   { issuer:"iShares",    assetClass:"Fixed Income – Treasury",index:"Bloomberg US Treasury Inflation-Protected Securities Index" },
  TLT:   { issuer:"iShares",    assetClass:"Fixed Income – Treasury",index:"ICE US Treasury 20+ Year Bond Index" },
  TNA:   { issuer:"Direxion",   assetClass:"Leveraged",              index:null },
  TQQQ:  { issuer:"ProShares",  assetClass:"Leveraged",              index:null },
  TZA:   { issuer:"Direxion",   assetClass:"Leveraged",              index:null },
  UNG:   { issuer:"US Commodity Funds", assetClass:"Commodity",      index:null },
  UPRO:  { issuer:"ProShares",  assetClass:"Leveraged",              index:null },
  USMV:  { issuer:"iShares",    assetClass:"US Equity",              index:"MSCI USA Minimum Volatility Index" },
  USO:   { issuer:"US Commodity Funds", assetClass:"Commodity",      index:null },
  UVXY:  { issuer:"ProShares",  assetClass:"Alternatives",           index:null },
  VB:    { issuer:"Vanguard",   assetClass:"US Equity",              index:"CRSP US Small Cap Index" },
  VBK:   { issuer:"Vanguard",   assetClass:"US Equity",              index:"CRSP US Small Cap Growth Index" },
  VBR:   { issuer:"Vanguard",   assetClass:"US Equity",              index:"CRSP US Small Cap Value Index" },
  VCIT:  { issuer:"Vanguard",   assetClass:"Fixed Income – IG",      index:"Bloomberg US 5-10 Year Corporate Bond Index" },
  VCSH:  { issuer:"Vanguard",   assetClass:"Fixed Income – IG",      index:"Bloomberg US 1-5 Year Corporate Bond Index" },
  VEA:   { issuer:"Vanguard",   assetClass:"Intl Equity",            index:"FTSE Developed All Cap ex US Index" },
  VGIT:  { issuer:"Vanguard",   assetClass:"Fixed Income – Treasury",index:"Bloomberg US Treasury 3-10 Year Bond Index" },
  VGK:   { issuer:"Vanguard",   assetClass:"Intl Equity",            index:"FTSE Developed Europe All Cap Index" },
  VGLT:  { issuer:"Vanguard",   assetClass:"Fixed Income – Treasury",index:"Bloomberg US Treasury Long Bond Index" },
  VGSH:  { issuer:"Vanguard",   assetClass:"Fixed Income – Treasury",index:"Bloomberg US Treasury 1-3 Year Bond Index" },
  VIG:   { issuer:"Vanguard",   assetClass:"US Equity",              index:"S&P US Dividend Growers Index" },
  VLUE:  { issuer:"iShares",    assetClass:"US Equity",              index:"MSCI USA Enhanced Value Index" },
  VNQ:   { issuer:"Vanguard",   assetClass:"US Equity",              index:"MSCI US Investable Market Real Estate 25/50 Index" },
  VNQI:  { issuer:"Vanguard",   assetClass:"Global Equity",          index:"S&P Global ex-US Property Index" },
  VO:    { issuer:"Vanguard",   assetClass:"US Equity",              index:"CRSP US Mid Cap Index" },
  VOE:   { issuer:"Vanguard",   assetClass:"US Equity",              index:"CRSP US Mid Cap Value Index" },
  VOO:   { issuer:"Vanguard",   assetClass:"US Equity",              index:"S&P 500 Index" },
  VOT:   { issuer:"Vanguard",   assetClass:"US Equity",              index:"CRSP US Mid Cap Growth Index" },
  VPL:   { issuer:"Vanguard",   assetClass:"Intl Equity",            index:"FTSE Asia Pacific All Cap Index" },
  VSS:   { issuer:"Vanguard",   assetClass:"Intl Equity",            index:"FTSE Global All Cap ex US Small Cap Index" },
  VTI:   { issuer:"Vanguard",   assetClass:"US Equity",              index:"CRSP US Total Market Index" },
  VTIP:  { issuer:"Vanguard",   assetClass:"Fixed Income – Treasury",index:"Bloomberg US 0-5 Year TIPS Index" },
  VTV:   { issuer:"Vanguard",   assetClass:"US Equity",              index:"CRSP US Large Cap Value Index" },
  VUG:   { issuer:"Vanguard",   assetClass:"US Equity",              index:"CRSP US Large Cap Growth Index" },
  VV:    { issuer:"Vanguard",   assetClass:"US Equity",              index:"CRSP US Large Cap Index" },
  VWO:   { issuer:"Vanguard",   assetClass:"EM Equity",              index:"FTSE Emerging Markets All Cap China A Inclusion Index" },
  VXF:   { issuer:"Vanguard",   assetClass:"US Equity",              index:"S&P Completion Index" },
  VXUS:  { issuer:"Vanguard",   assetClass:"Intl Equity",            index:"FTSE Global All Cap ex US Index" },
  VYD:   { issuer:"Vanguard",   assetClass:"US Equity",              index:"FTSE High Dividend Yield Index" },
  XAR:   { issuer:"SPDR",       assetClass:"US Equity",              index:"S&P Aerospace & Defense Select Industry Index" },
  XES:   { issuer:"SPDR",       assetClass:"US Equity",              index:"S&P Oil & Gas Equipment & Services Select Industry Index" },
  XHB:   { issuer:"SPDR",       assetClass:"US Equity",              index:"S&P Homebuilders Select Industry Index" },
  XLB:   { issuer:"SPDR",       assetClass:"US Equity",              index:"Materials Select Sector Index" },
  XLC:   { issuer:"SPDR",       assetClass:"US Equity",              index:"Communication Services Select Sector Index" },
  XLE:   { issuer:"SPDR",       assetClass:"US Equity",              index:"Energy Select Sector Index" },
  XLF:   { issuer:"SPDR",       assetClass:"US Equity",              index:"Financial Select Sector Index" },
  XLI:   { issuer:"SPDR",       assetClass:"US Equity",              index:"Industrial Select Sector Index" },
  XLK:   { issuer:"SPDR",       assetClass:"US Equity",              index:"Technology Select Sector Index" },
  XLP:   { issuer:"SPDR",       assetClass:"US Equity",              index:"Consumer Staples Select Sector Index" },
  XLRE:  { issuer:"SPDR",       assetClass:"US Equity",              index:"Real Estate Select Sector Index" },
  XLU:   { issuer:"SPDR",       assetClass:"US Equity",              index:"Utilities Select Sector Index" },
  XLV:   { issuer:"SPDR",       assetClass:"US Equity",              index:"Health Care Select Sector Index" },
  XLY:   { issuer:"SPDR",       assetClass:"US Equity",              index:"Consumer Discretionary Select Sector Index" },
  XME:   { issuer:"SPDR",       assetClass:"US Equity",              index:"S&P Metals & Mining Select Industry Index" },
  XOP:   { issuer:"SPDR",       assetClass:"US Equity",              index:"S&P Oil & Gas Exploration & Production Select Industry Index" },
  XRT:   { issuer:"SPDR",       assetClass:"US Equity",              index:"S&P Retail Select Industry Index" },
};

// ── Asset-class pill colours ──────────────────────────────────
function assetClassPillStyle(ac) {
  const s = (ac || "").toLowerCase();
  if (s.includes("fixed income") || s.includes("treasury") || s.includes("muni") || s.includes("mbs") || s.includes("preferred") || s.includes("loans")) {
    return "background:var(--amber,#f59e0b22);color:var(--amber,#f59e0b);border:1px solid var(--amber,#f59e0b)44;";
  }
  if (s.includes("leveraged"))   return "background:var(--red,#ef444422);color:var(--red,#ef4444);border:1px solid var(--red,#ef4444)44;";
  if (s.includes("em equity"))   return "background:#a78bfa22;color:#a78bfa;border:1px solid #a78bfa44;";
  if (s.includes("intl equity")) return "background:#34d39922;color:#34d399;border:1px solid #34d39944;";
  if (s.includes("global equity"))return "background:#38bdf822;color:#38bdf8;border:1px solid #38bdf844;";
  if (s.includes("commodity"))   return "background:#fb923c22;color:#fb923c;border:1px solid #fb923c44;";
  if (s.includes("multi-asset")) return "background:#818cf822;color:#818cf8;border:1px solid #818cf844;";
  if (s.includes("crypto"))      return "background:#f472b622;color:#f472b6;border:1px solid #f472b644;";
  if (s.includes("alternatives")) return "background:var(--dim,#55555522);color:var(--text2);border:1px solid var(--border);";
  return "background:var(--blue,#3b82f622);color:var(--blue,#3b82f6);border:1px solid var(--blue,#3b82f6)44;";
}

// ── Field-name normaliser ──────────────────────────────────────
function getWeight(h) {
  const v = h.weightpct !== undefined ? h.weightpct : h.weight_pct;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

// ── Bond detection ────────────────────────────────────────────
function isBondHoldings(holdings) {
  if (!Array.isArray(holdings) || holdings.length === 0) return false;
  const withMat = holdings.filter(h => {
    const d = h.maturityDate || h.maturityDat;
    return d != null && d !== "";
  }).length;
  return (withMat / holdings.length) > 0.30;
}

function isBondEtf(etf, holdings) {
  if (etf && etf.assetClass && etf.assetClass.toLowerCase().includes("fixed income")) return true;
  return isBondHoldings(holdings);
}

// ── Date parsing — robust multi-format ────────────────────────
function parseMaturityDate(raw) {
  if (!raw || raw === "N/A" || raw === "null" || raw === "undefined") return null;
  const s = String(raw).trim();
  if (!s) return null;

  // ISO: 2034-11-15 or 2034-11-15T00:00:00
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.substring(0, 10));
    return isNaN(d.getTime()) ? null : d;
  }

  // Compact: 20341115
  if (/^\d{8}$/.test(s)) {
    const d = new Date(+s.slice(0,4), +s.slice(4,6) - 1, +s.slice(6,8));
    return isNaN(d.getTime()) ? null : d;
  }

  // US slash: 11/15/2034
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [mo, dy, yr] = s.split("/").map(Number);
    const d = new Date(yr, mo - 1, dy);
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback: let JS try (handles most remaining formats)
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ── Bond analytics ────────────────────────────────────────────
function computeBondAnalytics(holdings, reportDate) {
  const refDate = reportDate ? new Date(reportDate) : new Date();
  const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

  let wamNumerator = 0, wamDenominator = 0;
  const buckets = { "0–1Y":0, "1–3Y":0, "3–7Y":0, "7–10Y":0, "10Y+":0 };
  const couponSplit = {};
  let totalCouponWeight = 0;

  // Debug: log first 5 sample dates to confirm parsing
  const sampleDates = holdings.slice(0, 5).map(h => ({
    raw: h.maturityDate || h.maturityDat,
    parsed: parseMaturityDate(h.maturityDate || h.maturityDat)?.toISOString() || "FAIL"
  }));
  console.log("[ETF Bond Debug] Sample maturity dates:", sampleDates);

  for (const h of holdings) {
    const wpct = getWeight(h);
    if (wpct <= 0) continue;

    // Coupon kind — dynamic keys, normalise field name variants
    const kind = (h.couponKind || h.couponkind || h.couponType || "").trim();
    if (kind && kind.toLowerCase() !== "none") {
      couponSplit[kind] = (couponSplit[kind] || 0) + wpct;
      totalCouponWeight += wpct;
    }

    // WAM + buckets
    const matDate = parseMaturityDate(h.maturityDate || h.maturityDat);
    if (!matDate) continue;
    const yrs = (matDate.getTime() - refDate.getTime()) / MS_PER_YEAR;
    if (yrs <= 0) continue;

    wamNumerator  += wpct * yrs;
    wamDenominator += wpct;
    if      (yrs <= 1)  buckets["0–1Y"]  += wpct;
    else if (yrs <= 3)  buckets["1–3Y"]  += wpct;
    else if (yrs <= 7)  buckets["3–7Y"]  += wpct;
    else if (yrs <= 10) buckets["7–10Y"] += wpct;
    else                buckets["10Y+"]  += wpct;
  }

  const wam = wamDenominator > 0 ? wamNumerator / wamDenominator : null;
  console.log("[ETF Bond Debug] WAM result:", wam, "Denom:", wamDenominator);

  // Normalise buckets to % of maturity-covered weight
  const totalBucketWeight = wamDenominator || 1;
  Object.keys(buckets).forEach(k => {
    buckets[k] = (buckets[k] / totalBucketWeight) * 100;
  });

  // Normalise coupon split to % of total coupon-tagged weight
  Object.keys(couponSplit).forEach(k => {
    couponSplit[k] = totalCouponWeight > 0 ? (couponSplit[k] / totalCouponWeight) * 100 : 0;
  });

  return { wam, buckets, couponSplit, totalCouponWeight };
}

// ── Number formatters ──────────────────────────────────────────
function fmtCompact(val) {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return new Intl.NumberFormat("en-US", { notation:"compact", style:"currency", currency:"USD" }).format(val);
}

function fmtWeight(w) {
  if (w === null || w === undefined || isNaN(w)) return "—";
  return `${parseFloat(w).toFixed(2)}%`;
}

function fmtCoupon(rte) {
  if (rte === null || rte === undefined || rte === "") return "—";
  return `${parseFloat(rte).toFixed(2)}%`;
}

const PILL_BASE = "display:inline-flex;align-items:center;border-radius:4px;font-size:9.5px;font-weight:600;padding:2px 7px;letter-spacing:.04em;white-space:nowrap;";

// ── Error state helpers ────────────────────────────────────────
function _noNportHtml() {
  return `<div style="text-align:center;padding:48px 20px;color:var(--amber);font-size:11.5px;background:var(--bg3);border-radius:var(--r);border:1px solid var(--border);line-height:1.5;">
    <div style="font-size:18px;margin-bottom:8px;">⚠️</div>
    <div><strong>N-PORT holdings not available for this ETF</strong><br>
    <span style="color:var(--dim);">(Grantor trust, commodity pool, or non-1940-Act fund.)</span></div>
  </div>`;
}

function _fetchErrorHtml(ticker) {
  return `<div style="text-align:center;padding:48px 20px;color:var(--red);font-size:11.5px;background:var(--bg3);border-radius:var(--r);border:1px solid var(--border);line-height:1.5;">
    <div style="font-size:18px;margin-bottom:8px;">⚠️</div>
    <div><strong>Unable to fetch holdings for ${ticker}</strong><br>
    <span style="color:var(--dim);">Please try again later or select a different ETF.</span></div>
  </div>`;
}

// ── ETF list initialisation (shared) ──────────────────────────
function _initEtfsList(rawEtfs) {
  let etfs = rawEtfs;
  if (!etfs || etfs.length === 0) {
    etfs = [
      "ACWI","AGG","AMLP","AOA","AOK","AOM","AOR","ARKF","ARKG","ARKK","ARKQ","ARKW",
      "AVDV","AVEM","AVUV","BIL","BITB","BIV","BKLN","BLV","BND","BNDX","BOTZ","BOXX",
      "BSV","CALF","CIBR","CLOU","CNRG","COWZ","DBO","DFAC","DFAE","DFAI","DFAU","DGRO",
      "DGRW","DIA","DLN","DVY","EEM","EEMV","EFA","EFAV","EIDO","EMB","ENZL","EPHE","EPOL",
      "EPU","ESGD","ETHA","EWA","EWC","EWG","EWH","EWI","EWJ","EWP","EWQ","EWT","EWU",
      "EWY","EWZ","EWZS","EZBC","EZU","FAN","FAS","FAZ","FBTC","FDN","FENY","FETH","FHLC",
      "FIDU","FLOT","FNCL","FTEC","GDX","GDXJ","GLD","GNR","GOVT","HDV","HYD","HYG","IAI",
      "IAK","IAU","IBB","IBIT","ICLN","IEF","IEMG","IGIB","IGLB","IGM","IGOV","IGSB","IGV",
      "IHF","IHI","IJH","IJJ","IJK","IJR","IJT","INDA","ITOT","IVE","IVV","IVW","IWC","IWM",
      "IWN","IWO","IWP","IWR","IYE","IYF","IYH","IYLD","IYR","IYT","IYW","JEPI","JEPQ",
      "JMST","JNK","JPST","KBE","KRE","LABD","LABU","LIT","LQD","MBB","MCHI","MDY","MGK",
      "MGV","MINT","MSOS","MTUM","MUB","NEAR","OIH","ONEQ","PAVE","PDBC","PEJ","PFF","PPH",
      "QAT","QQQ","QQQM","QUAL","REMX","RSP","RYF","RYH","RYT","SCHA","SCHB","SCHD","SCHE",
      "SCHF","SCHG","SCHI","SCHM","SCHP","SCHV","SCHX","SDY","SGOV","SHV","SHY","SHYG",
      "SIZE","SJNK","SLQD","SLV","SMH","SMMD","SOXL","SOXS","SOXX","SPAB","SPDW","SPEM",
      "SPIB","SPLG","SPSB","SPTI","SPTL","SPTS","SPXL","SPXS","SPY","SPYD","SPYV","SPYX",
      "SQQQ","SRLN","STIP","SVXY","TAN","TIP","TLT","TNA","TQQQ","TZA","UNG","UPRO","USMV",
      "USO","UVXY","VB","VBK","VBR","VCIT","VCSH","VEA","VGIT","VGK","VGLT","VGSH","VIG",
      "VLUE","VNQ","VNQI","VO","VOE","VOO","VOT","VPL","VSS","VTI","VTIP","VTV","VUG","VV",
      "VWO","VXF","VXUS","VYD","XAR","XES","XHB","XLB","XLC","XLE","XLF","XLI","XLK","XLP",
      "XLRE","XLU","XLV","XLY","XME","XOP","XRT"
    ].map(tk => {
      const m = ETF_META[tk] || {};
      return { ticker:tk, name:tk, issuer:m.issuer||"Other", assetClass:m.assetClass||"Equity", index:m.index||null };
    });
  } else {
    etfs = etfs.map(e => {
      const m = ETF_META[e.ticker] || {};
      return {
        ...e,
        issuer:         e.issuer         || m.issuer     || "Other",
        assetClass:     e.assetClass     || m.assetClass || "Equity",
        index:          e.index !== undefined ? e.index : (m.index !== undefined ? m.index : null),
        netAssets:      e.netAssets      || null,
        coverageStatus: e.coverageStatus || 'directory',
        hasNport:       e.hasNport       !== undefined ? e.hasNport : 1,
      };
    });
  }
  etfs = [...new Map(etfs.map(e => [e.ticker, e])).values()];
  etfs.sort((a,b) => a.ticker.localeCompare(b.ticker));
  currentEtfsList = etfs;
}

// ── Sorted provider list: by fund count descending ────────────
function _getProviderOptions(etfs) {
  const counts = {};
  etfs.forEach(e => { counts[e.issuer] = (counts[e.issuer] || 0) + 1; });
  return Object.entries(counts)
    .sort((a,b) => b[1] - a[1])
    .map(([issuer]) => issuer);
}

// ── Asset class chips ──────────────────────────────────────────
function _buildAssetChips() {
  const container = document.getElementById('etfAssetChips');
  if (!container) return;

  const bucketMap = {
    'Equity':       ['us equity','intl equity','emerging markets','us equity – growth',
                     'us equity – value','us equity – blend','sector','thematic'],
    'Fixed Income': ['fixed income – ig','fixed income – hy','fixed income – govt',
                     'fixed income – muni','fixed income – em','fixed income – short',
                     'fixed income – ultra short','fixed income – tips','fixed income'],
    'Multi-Asset':  ['multi-asset','allocation'],
    'Commodity':    ['commodity','gold','precious metals','energy','agriculture'],
    'Alternatives': ['leveraged','inverse','volatility','currency','digital assets'],
  };

  const reverseMap = {};
  for (const [bucket, classes] of Object.entries(bucketMap)) {
    for (const c of classes) reverseMap[c] = bucket;
  }
  window._etfBucketMap = reverseMap;

  const counts = { All: currentEtfsList.length };
  for (const etf of currentEtfsList) {
    const ac = (etf.assetClass || '').toLowerCase();
    const bucket = reverseMap[ac] || 'Other';
    counts[bucket] = (counts[bucket] || 0) + 1;
  }

  const buckets = ['All','Equity','Fixed Income','Multi-Asset','Commodity','Alternatives','Other'];
  const active  = currentAssetClassFilter || 'All';
  window._activeEtfChip = active;

  container.innerHTML = buckets
    .filter(b => (counts[b] || 0) > 0)
    .map(b => {
      const isA = b === active;
      return `<button onclick="onEtfChipClick('${b}')"
        style="padding:3px 10px;font-size:10px;font-weight:600;border-radius:20px;
               cursor:pointer;border:1px solid ${isA ? 'var(--blue)' : 'var(--border)'};
               background:${isA ? 'rgba(59,130,246,0.15)' : 'var(--bg3)'};
               color:${isA ? 'var(--blue)' : 'var(--dim)'};
               outline:none;white-space:nowrap;transition:all .15s;">
        ${b} <span style="opacity:0.7">${counts[b] || 0}</span>
      </button>`;
    }).join('');
}

// ── Shared fund row HTML (used in launcher + sidebar) ─────────
function _fundRowHtml(e, activeTicker, clickHandler) {
  const isActive     = e.ticker === activeTicker;
  const hasDeep      = e.coverageStatus === 'deep';
  const netAssetsStr = e.netAssets ? fmtCompact(e.netAssets) : null;

  const badgeHtml = hasDeep
    ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;
                    background:rgba(59,130,246,0.15);color:var(--blue);
                    font-weight:600;flex-shrink:0;">DEEP</span>`
    : '';

  return `<div class="etf-fund-row" data-ticker="${e.ticker}"
    onclick="${clickHandler}('${e.ticker}')"
    style="padding:6px 8px;cursor:pointer;
           border-left:2px solid ${isActive ? 'var(--blue)' : 'transparent'};
           background:${isActive ? 'var(--bg2)' : 'transparent'};
           display:flex;flex-direction:column;gap:2px;border-radius:3px;
           transition:background .1s;"
    onmouseenter="if(!${isActive})this.style.background='var(--bg2)'"
    onmouseleave="if(!${isActive})this.style.background='transparent'">
    <div style="display:flex;align-items:center;gap:4px;justify-content:space-between;">
      <span style="font-family:var(--mono);font-size:11px;font-weight:700;
                   color:var(--text);">${e.ticker}</span>
      <div style="display:flex;align-items:center;gap:3px;flex-shrink:0;">
        ${netAssetsStr ? `<span style="font-size:9px;color:var(--dim);
          font-family:var(--mono);">${netAssetsStr}</span>` : ''}
        ${badgeHtml}
      </div>
    </div>
    <span style="font-size:10px;color:var(--dim);overflow:hidden;
                 text-overflow:ellipsis;white-space:nowrap;"
      title="${(e.name || '').replace(/"/g,'&quot;')}">${e.name || e.ticker}</span>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// STAGE 1 — ETF Launcher (compact modal)
// ═══════════════════════════════════════════════════════════════

async function openEtfHoldings() {
  // Close any existing detail panel first
  closeEtfDetailView();

  const launcherHtml = `
    <!-- HEADER -->
    <div style="display:flex;align-items:center;justify-content:space-between;
                margin-bottom:14px;flex-shrink:0;">
      <div>
        <div style="font-size:15px;font-weight:700;color:var(--text);">ETF Holdings</div>
        <div style="font-size:11px;color:var(--dim);margin-top:2px;">
          N-PORT data · <span id="etfLauncherCount">Loading…</span>
        </div>
      </div>
    </div>

    <!-- SEARCH -->
    <input type="text" id="etfLauncherSearch"
      placeholder="Search ticker or name…"
      autocomplete="off"
      style="width:100%;height:34px;background:var(--bg3);border:1px solid var(--border);
             border-radius:var(--r);color:var(--text);font-size:12px;padding:0 10px;
             outline:none;box-sizing:border-box;margin-bottom:10px;transition:border-color .15s;"
      onfocus="this.style.borderColor='var(--blue)'"
      onblur="this.style.borderColor='var(--border)'"
      oninput="onEtfLauncherSearch(this.value)">

    <!-- ASSET CLASS CHIPS -->
    <div id="etfAssetChips"
      style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;flex-shrink:0;">
    </div>

    <!-- ISSUER SEARCH -->
    <input type="text" id="etfIssuerSearch"
      placeholder="Filter by issuer…"
      autocomplete="off"
      style="width:100%;height:28px;background:var(--bg3);border:1px solid var(--border);
             border-radius:var(--r);color:var(--text);font-size:11px;padding:0 10px;
             outline:none;box-sizing:border-box;margin-bottom:8px;transition:border-color .15s;"
      onfocus="this.style.borderColor='var(--blue)'"
      onblur="this.style.borderColor='var(--border)'"
      oninput="onEtfIssuerSearch(this.value)">

    <!-- DEEP ONLY TOGGLE -->
    <label style="display:flex;align-items:center;gap:6px;font-size:11px;
                  color:var(--dim);cursor:pointer;margin-bottom:10px;
                  user-select:none;flex-shrink:0;">
      <input type="checkbox" id="etfDeepOnlyToggle"
        onchange="onEtfDeepOnlyToggle(this.checked)"
        style="cursor:pointer;accent-color:var(--blue);">
      Deep analytics only
    </label>

    <!-- TOOL BUTTONS -->
    <div style="padding-top:10px;border-top:1px solid var(--border);
                margin-bottom:10px;display:grid;grid-template-columns:1fr 1fr;
                gap:6px;flex-shrink:0;">
      <button onclick="openEtfOverlapTool()"
        style="height:32px;font-size:11px;font-weight:600;
               background:var(--bg3);border:1px solid var(--border);
               border-radius:var(--r);cursor:pointer;color:var(--text2);
               outline:none;transition:all .15s;"
        onmouseenter="this.style.borderColor='var(--blue)';this.style.color='var(--blue)'"
        onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">
        ⊕ Overlap
      </button>
      <button onclick="openEtfCompareTool()"
        style="height:32px;font-size:11px;font-weight:600;
               background:var(--bg3);border:1px solid var(--border);
               border-radius:var(--r);cursor:pointer;color:var(--text2);
               outline:none;transition:all .15s;"
        onmouseenter="this.style.borderColor='var(--blue)';this.style.color='var(--blue)'"
        onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">
        ⊞ Compare
      </button>
      <button onclick="openExposureExplorer()"
        style="height:32px;font-size:11px;font-weight:600;
               background:var(--bg3);border:1px solid var(--border);
               border-radius:var(--r);cursor:pointer;color:var(--text2);
               outline:none;transition:all .15s;"
        onmouseenter="this.style.borderColor='var(--blue)';this.style.color='var(--blue)'"
        onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">
        ◎ Exposure
      </button>
      <button onclick="openUniverseMonitor()"
        style="height:32px;font-size:11px;font-weight:600;
               background:var(--bg3);border:1px solid var(--border);
               border-radius:var(--r);cursor:pointer;color:var(--text2);
               outline:none;transition:all .15s;"
        onmouseenter="this.style.borderColor='var(--blue)';this.style.color='var(--blue)'"
        onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">
        ◈ Universe
      </button>
    </div>

    <!-- FUND LIST -->
    <div id="etfLauncherFundList"
      style="flex:1;overflow-y:auto;display:flex;flex-direction:column;
             gap:1px;min-height:0;">
      <div style="text-align:center;padding:24px 0;color:var(--dim);font-size:11px;">
        Loading ETFs…
      </div>
    </div>`;

  showModal(launcherHtml, { maxWidth: "520px", maxHeight: "85vh" });

  // Reset all filters
  currentFilterText        = '';
  currentIssuerFilter      = 'All';
  currentAssetClassFilter  = 'All';
  currentIssuerSearchText  = '';
  currentDeepOnly          = false;
  window._activeEtfChip    = 'All';

  // Fetch ETF list
  let rawEtfs = null;
  try {
    const res = await fetch(`${MY_WORKER_URL}/api/etf-list`);
    if (res.ok) rawEtfs = await res.json();
  } catch(e) {
    console.warn("ETF list fetch failed, using fallback", e);
  }

  _initEtfsList(rawEtfs);
  _buildAssetChips();
  _renderLauncherFundList();
}

function _renderLauncherFundList() {
  const list = document.getElementById('etfLauncherFundList');
  if (!list) return;

  const searchVal = (currentFilterText || '').toLowerCase().trim();
  const issuerVal = (currentIssuerSearchText || '').toLowerCase().trim();
  const deepOnly  = currentDeepOnly || false;
  const bucket    = currentAssetClassFilter || 'All';

  let visible = currentEtfsList;

  if (searchVal) {
    // Text search overrides all other filters
    visible = visible.filter(e =>
      e.ticker.toLowerCase().includes(searchVal) ||
      (e.name || '').toLowerCase().includes(searchVal)
    );
  } else {
    if (bucket !== 'All') {
      visible = visible.filter(e => {
        const ac     = (e.assetClass || '').toLowerCase();
        const mapped = window._etfBucketMap?.[ac] || 'Other';
        return mapped === bucket;
      });
    }
    if (issuerVal) {
      visible = visible.filter(e =>
        (e.issuer || '').toLowerCase().includes(issuerVal)
      );
    }
    if (deepOnly) {
      visible = visible.filter(e => e.coverageStatus === 'deep');
    }
  }

  const countEl = document.getElementById('etfLauncherCount');
  if (countEl) countEl.textContent = `${visible.length.toLocaleString()} ETFs`;

  if (!visible.length) {
    list.innerHTML = `<div style="text-align:center;padding:32px 0;color:var(--dim);
      font-size:11px;">No ETFs match your filters.</div>`;
    return;
  }

  list.innerHTML = visible.map(e => _fundRowHtml(e, null, 'onEtfFundRowClick')).join('');
}

window.onEtfLauncherProviderChange = function() {};

window.onEtfLauncherSearch = function(val) {
  currentFilterText = val;
  _renderLauncherFundList();
};

window.onEtfChipClick = function(bucket) {
  currentAssetClassFilter = bucket;
  window._activeEtfChip   = bucket;
  _buildAssetChips();
  _renderLauncherFundList();
};

window.onEtfIssuerSearch = function(val) {
  currentIssuerSearchText = val;
  _renderLauncherFundList();
};

window.onEtfDeepOnlyToggle = function(checked) {
  currentDeepOnly = checked;
  _renderLauncherFundList();
};

// ── Fund row click — closes launcher, opens detail view ───────
window.onEtfFundRowClick = function(ticker) {
  const activeIssuer = currentIssuerFilter;
  closeModal();
  openEtfDetailView(ticker, currentEtfsList, activeIssuer);
};

// ═══════════════════════════════════════════════════════════════
// STAGE 2 — ETF Detail View (full-screen overlay)
// ═══════════════════════════════════════════════════════════════

function openEtfDetailView(ticker, allEtfs, activeIssuer) {
  // Ensure list is populated (can be called programmatically)
  if (allEtfs && allEtfs.length > 0) currentEtfsList = allEtfs;

  // Reset holdings state and default to Holdings tab
  currentFilterText   = "";
  currentSliceSize    = "All";
  currentIssuerFilter = activeIssuer || "All";
  currentEtfTab       = 'holdings';

  const panelHtml = `
    <style>
      #etfDetailPanel * { box-sizing: border-box; }
      #etfDetailPanel .etf-fund-row:hover {
        background: var(--bg2) !important;
      }
      #etfDetailSidebar::-webkit-scrollbar { width: 4px; }
      #etfDetailSidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
      #etfMainContent::-webkit-scrollbar { width: 6px; }
      #etfMainContent::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    </style>

    <!-- TOP BAR -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;
                border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg3);">
      <button onclick="openEtfHoldings()"
        style="display:inline-flex;align-items:center;gap:5px;background:none;border:1px solid var(--border);
               border-radius:var(--r);padding:4px 10px;cursor:pointer;color:var(--text2);font-size:11px;
               font-weight:600;outline:none;transition:all .15s;"
        onmouseenter="this.style.borderColor='var(--blue)';this.style.color='var(--blue)'"
        onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">
        ← Back to ETF List
      </button>
      <div style="display:flex;gap:6px;">
        <button
          onclick="openEtfOverlapTool(document.getElementById('etfHoldingsContent')?.dataset.activeTicker || '')"
          style="background:none;border:1px solid var(--border);border-radius:var(--r);
                 padding:4px 10px;cursor:pointer;color:var(--text2);font-size:10px;
                 font-weight:600;outline:none;"
          onmouseenter="this.style.borderColor='var(--blue)';this.style.color='var(--blue)'"
          onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">
          ⊕ Overlap
        </button>
        <button
          onclick="openEtfCompareTool([document.getElementById('etfHoldingsContent')?.dataset.activeTicker || ''])"
          style="background:none;border:1px solid var(--border);border-radius:var(--r);
                 padding:4px 10px;cursor:pointer;color:var(--text2);font-size:10px;
                 font-weight:600;outline:none;"
          onmouseenter="this.style.borderColor='var(--blue)';this.style.color='var(--blue)'"
          onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">
          ⊞ Compare
        </button>
      </div>
      <span style="font-size:12px;font-weight:700;color:var(--text2);letter-spacing:.02em;">ETF Holdings (N-PORT)</span>
      <button onclick="closeEtfDetailView()"
        style="background:none;border:1px solid var(--border);border-radius:var(--r);padding:4px 10px;
               cursor:pointer;color:var(--text2);font-size:11px;font-weight:600;outline:none;"
        onmouseenter="this.style.borderColor='var(--red)';this.style.color='var(--red)'"
        onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">
        ✕ Close
      </button>
    </div>

    <!-- TAB BAR -->
    <div id="etfTabBar"
      style="display:flex;align-items:center;gap:0;padding:0 16px;
             border-bottom:1px solid var(--border);flex-shrink:0;
             background:var(--bg3);">
      <button id="etfTab-overview"
        onclick="switchEtfTab('overview')"
        style="padding:8px 14px;font-size:11px;font-weight:600;background:none;border:none;
               border-bottom:2px solid transparent;cursor:pointer;color:var(--dim);
               outline:none;transition:all .15s;">
        Overview
      </button>
      <button id="etfTab-holdings"
        onclick="switchEtfTab('holdings')"
        style="padding:8px 14px;font-size:11px;font-weight:600;background:none;border:none;
               border-bottom:2px solid var(--blue);cursor:pointer;color:var(--blue);
               outline:none;transition:all .15s;">
        Holdings
      </button>
      <button id="etfTab-changes"
        onclick="switchEtfTab('changes')"
        style="padding:8px 14px;font-size:11px;font-weight:600;background:none;border:none;
               border-bottom:2px solid transparent;cursor:pointer;color:var(--dim);
               outline:none;transition:all .15s;">
        Changes
      </button>
    </div>

    <!-- BODY: SIDEBAR + MAIN -->
    <div style="display:flex;flex:1;min-height:0;overflow:hidden;">

      <!-- LEFT SIDEBAR -->
      <div id="etfDetailSidebar"
        style="width:240px;flex-shrink:0;border-right:1px solid var(--border);
               overflow:hidden;display:flex;flex-direction:column;background:var(--bg);">

        <!-- Sidebar search -->
        <div style="padding:10px 10px 6px;flex-shrink:0;">
          <input type="text" id="etfSidebarSearch"
            placeholder="Search…"
            autocomplete="off"
            style="width:100%;height:28px;background:var(--bg3);border:1px solid var(--border);
                   border-radius:var(--r);color:var(--text);font-size:11px;padding:0 8px;
                   outline:none;box-sizing:border-box;transition:border-color .15s;"
            onfocus="this.style.borderColor='var(--blue)'"
            onblur="this.style.borderColor='var(--border)'"
            oninput="onEtfSidebarSearch(this.value)">
        </div>

        <!-- Issuer label + show all toggle -->
        <div style="padding:0 10px 8px;display:flex;align-items:center;
                    justify-content:space-between;flex-shrink:0;">
          <span id="etfSidebarIssuerLabel"
            style="font-size:10px;color:var(--dim);overflow:hidden;
                   text-overflow:ellipsis;white-space:nowrap;flex:1;"></span>
          <button id="etfSidebarToggle"
            onclick="onEtfSidebarToggleAll()"
            style="font-size:10px;color:var(--blue);background:none;border:none;
                   cursor:pointer;padding:0;flex-shrink:0;white-space:nowrap;
                   font-weight:600;outline:none;">Show all</button>
        </div>

        <!-- Fund list -->
        <div id="etfDetailSidebarList"
          style="flex:1;overflow-y:auto;display:flex;flex-direction:column;
                 gap:1px;padding:0 8px 12px;">
        </div>
      </div>

      <!-- MAIN CONTENT -->
      <div id="etfHoldingsContent"
        style="flex:1;min-width:0;overflow-y:auto;padding:16px;background:var(--bg);">
        <div style="text-align:center;padding:60px 20px;color:var(--blue);font-size:12px;
                    background:var(--bg3);border-radius:var(--r);border:1px solid var(--border);">
          <div class="mspinner"></div>
          <div style="margin-top:10px;font-weight:500;letter-spacing:.02em;">Loading holdings…</div>
        </div>
      </div>

    </div>`;

  // Create the overlay panel
  let panel = document.getElementById("etfDetailPanel");
  if (panel) panel.remove();

  panel = document.createElement("div");
  panel.id = "etfDetailPanel";
  panel.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:1000;" +
    "background:var(--bg);overflow:hidden;display:flex;flex-direction:column;";
  panel.innerHTML = panelHtml;
  document.body.appendChild(panel);

  sidebarShowAll    = false;
  sidebarSearchText = '';
  _renderDetailSidebar(ticker);

  // Fetch and render holdings
  onEtfSelectChange(ticker);
}

// ── Close detail panel ─────────────────────────────────────────
window.closeEtfDetailView = function() {
  const panel = document.getElementById("etfDetailPanel");
  if (panel) panel.remove();
};

window.onEtfDetailProviderChange = function() {};

// ── Sidebar fund click — loads new ETF without closing panel ──
window.onEtfDetailSidebarClick = function(ticker) {
  _renderDetailSidebar(ticker);
  onEtfSelectChange(ticker);
};

// ── Sidebar render ─────────────────────────────────────────────
function _renderDetailSidebar(activeTicker) {
  const listEl    = document.getElementById('etfDetailSidebarList');
  const labelEl   = document.getElementById('etfSidebarIssuerLabel');
  const toggleBtn = document.getElementById('etfSidebarToggle');
  if (!listEl) return;

  const etf    = currentEtfsList.find(e => e.ticker === activeTicker);
  const issuer = etf?.issuer || '';
  sidebarCurrentIssuer = issuer;

  if (labelEl) {
    labelEl.textContent = sidebarShowAll ? 'All ETFs' : (issuer || 'This issuer');
  }
  if (toggleBtn) {
    toggleBtn.textContent = sidebarShowAll ? 'Same issuer' : 'Show all';
  }

  let visible = currentEtfsList;

  if (!sidebarShowAll && issuer) {
    visible = visible.filter(e => e.issuer === issuer);
  }

  const q = (sidebarSearchText || '').toLowerCase().trim();
  if (q) {
    visible = visible.filter(e =>
      e.ticker.toLowerCase().includes(q) ||
      (e.name || '').toLowerCase().includes(q)
    );
  }

  listEl.innerHTML = visible
    .map(e => _fundRowHtml(e, activeTicker, 'onEtfDetailSidebarClick'))
    .join('');

  requestAnimationFrame(() => {
    const activeRow = listEl.querySelector(`.etf-fund-row[data-ticker="${activeTicker}"]`);
    if (activeRow) activeRow.scrollIntoView({ block: 'nearest' });
  });
}

window.onEtfSidebarSearch = function(val) {
  sidebarSearchText = val;
  const active = document.getElementById('etfHoldingsContent')?.dataset.activeTicker;
  if (active) _renderDetailSidebar(active);
};

window.onEtfSidebarToggleAll = function() {
  sidebarShowAll = !sidebarShowAll;
  const active = document.getElementById('etfHoldingsContent')?.dataset.activeTicker;
  if (active) _renderDetailSidebar(active);
};

// ═══════════════════════════════════════════════════════════════
// SHARED: onEtfSelectChange — fetch + render into #etfHoldingsContent
// (content div lives inside detail panel; unchanged internal logic)
// ═══════════════════════════════════════════════════════════════

async function onEtfSelectChange(ticker) {
  const contentDiv = document.getElementById("etfHoldingsContent");
  if (!contentDiv || !ticker) return;

  // Tag the active ticker on the container for sidebar sync
  contentDiv.dataset.activeTicker = ticker;

  etfAbortController?.abort();
  etfAbortController = new AbortController();

  currentEtfTab = 'holdings';
  _updateTabBar('holdings');
  delete contentDiv.dataset.holdingsLoaded;

  contentDiv.innerHTML = `
    <div style="text-align:center;padding:60px 20px;color:var(--blue);font-size:12px;
                background:var(--bg3);border-radius:var(--r);border:1px solid var(--border);">
      <div class="mspinner"></div>
      <div style="margin-top:10px;font-weight:500;letter-spacing:.02em;">Fetching holdings from SEC N-PORT…</div>
    </div>`;

  const NO_NPORT = new Set([
    "GLD","SLV","IAU","SGOL","PHYS","PSLV","USO","UNG","DBO","PDBC",
    "IBIT","FBTC","BITB","EZBC","ETHA","FETH","SPY","QQQ","DIA","GDX","GDXJ","OIH","MSOS"
  ]);

  if (NO_NPORT.has(ticker)) {
    contentDiv.innerHTML = _noNportHtml();
    return;
  }

  try {
    // Try stored holdings first — fast, no EDGAR rate limit
    let data       = null;
    let dataSource = 'live';

    try {
      const storedRes = await fetch(
        `${MY_WORKER_URL}/api/etf-holdings-stored?symbol=${encodeURIComponent(ticker)}`,
        { signal: etfAbortController.signal }
      );
      if (storedRes.ok) {
        const stored = await storedRes.json();
        if (stored.holdings && stored.holdings.length > 0) {
          data = {
            ticker:        stored.ticker,
            name:          stored.name,
            period_ending: stored.report_month,
            file_date:     stored.snapshot?.filing_date || '',
            holdings: stored.holdings.map(h => ({
              symbol:        h.security_ticker,
              name:          h.security_name,
              cusip:         h.cusip,
              isin:          h.isin,
              shares:        h.shares,
              value_usd:     h.position_value,
              weight_pct:    h.weight_pct,
              assetCat:      h.asset_cat,
              couponKind:    null,
              annualizedRte: null,
              maturityDat:   null,
              yieldVal:      null
            })),
            fundInfo: {
              regName:   stored.name,
              netAssets: stored.snapshot?.net_assets,
              totAssets: stored.snapshot?.total_assets,
              repPdEnd:  stored.snapshot?.period_end
            },
            sectorBreakdown: []
          };
          dataSource = 'stored';
        }
      }
    } catch(e) {
      if (e.name === 'AbortError') return;
    }

    // Fall back to live EDGAR fetch if no stored data
    if (!data) {
      const liveRes = await fetch(
        `${MY_WORKER_URL}/api/etf-holdings?symbol=${encodeURIComponent(ticker)}`,
        { signal: etfAbortController.signal }
      );
      if (liveRes.ok) {
        try { data = await liveRes.json(); } catch(e) { console.warn("Non-JSON response", e); }
      }
      dataSource = 'live';
    }

    if (!data || !data.holdings || data.error) {
      if (data?.error === "NO_NPORT") { contentDiv.innerHTML = _noNportHtml(); return; }
      contentDiv.innerHTML = _fetchErrorHtml(ticker);
      return;
    }

    console.log(`[ETF] Loaded holdings from: ${dataSource}`);

    currentEtfHoldings = data.holdings || [];
    currentSliceSize   = "All";
    currentFilterText  = "";

    const etf    = currentEtfsList.find(e => e.ticker === ticker) || null;
    const isBond = isBondEtf(etf, currentEtfHoldings);

    // ── Fund metadata ────────────────────────────────────────
    let displayNetAssets = data.fundInfo?.netAssets ?? data.fundInfo?.totAssets;
    const periodDisplay  = data.fundInfo?.repPdDate || data.fundInfo?.repPdEnd || data.period_ending || "—";
    const holdingsCount  = currentEtfHoldings.length;
    const regName        = data.fundInfo?.regName || "—";
    const fundName       = data.name || etf?.name || ticker;
    const acLabel        = etf?.assetClass || "—";
    const benchLabel     = (etf?.index) ? etf.index : "Active";

    // ── Concentration metrics ────────────────────────────────
    const hasNegativeHoldings = currentEtfHoldings.some(h => getWeight(h) < 0);
    const positiveHoldings    = currentEtfHoldings.filter(h => getWeight(h) > 0);
    const sortedPositive      = positiveHoldings.sort((a,b) => getWeight(b) - getWeight(a));
    const top10Conc = sortedPositive.slice(0,10).reduce((s,h) => s + getWeight(h), 0);
    const largestW  = sortedPositive.length > 0 ? getWeight(sortedPositive[0]) : 0;
    const largestName = sortedPositive.length > 0 ? (sortedPositive[0].name || sortedPositive[0].symbol || "—") : "—";
    let sumW2 = 0;
    currentEtfHoldings.forEach(h => { const w = getWeight(h)/100; sumW2 += w*w; });
    const effectiveN = sumW2 > 0 ? 1/sumW2 : 0;

    // ── Sector/asset breakdown bar ───────────────────────────
    const breakdownColors = {
      "Equity":"var(--blue)","US Govt":"var(--green)","Corp Bond":"var(--amber)",
      "MBS":"var(--red)","Cash":"var(--teal)","Other":"var(--dim)"
    };
    let breakdownBarHtml = "", breakdownLegendHtml = "";
    if (data.sectorBreakdown?.length > 0) {
      const activeSegments = data.sectorBreakdown.filter(item => item.pct > 0);
      const isLeveragedOrInverse = etf && (etf.assetClass === "Leveraged" || etf.assetClass === "Inverse" ||
        etf.assetClass.toLowerCase() === "leveraged" || etf.assetClass.toLowerCase() === "inverse");
      const shouldRelabelOther = activeSegments.length === 1 && activeSegments[0].label === "Other" &&
        activeSegments[0].pct >= 95 && isLeveragedOrInverse;

      data.sectorBreakdown.forEach(item => {
        if (item.pct > 0) {
          const isTarget = shouldRelabelOther && item.label === "Other";
          const displayLabel = isTarget ? "Cash & Derivatives" : item.label;
          const col = breakdownColors[item.label] || "var(--dim)";
          breakdownBarHtml    += `<span style="width:${item.pct}%;background:${col};height:100%;" title="${displayLabel}: ${item.pct.toFixed(2)}% (${item.count} holdings)"></span>`;
          breakdownLegendHtml += `<div style="display:inline-flex;align-items:center;gap:4px;white-space:nowrap;">
            <span style="width:7px;height:7px;border-radius:50%;background:${col};display:inline-block;"></span>
            <span>${displayLabel} <strong style="color:var(--text);">${item.pct.toFixed(1)}%</strong></span></div>`;
        }
      });
    }

    // ── Bond analytics ───────────────────────────────────────
    let bondAnalyticsHtml = "";
    if (isBond) {
      const an = computeBondAnalytics(currentEtfHoldings, periodDisplay);
      const bucketBar = (pct) =>
        `<div style="flex:1;background:var(--bg2);height:4px;border-radius:2px;overflow:hidden;margin:0 6px;">` +
        `<div style="width:${Math.min(pct,100)}%;background:var(--blue);height:100%;"></div></div>`;
      const couponBar = (pct) =>
        `<div style="flex:1;background:var(--bg2);height:4px;border-radius:2px;overflow:hidden;margin:0 6px;">` +
        `<div style="width:${Math.min(pct,100)}%;background:var(--green);height:100%;"></div></div>`;
      const rowStyle = "display:flex;align-items:center;justify-content:space-between;font-size:10px;color:var(--text2);";
      const valStyle = "font-weight:600;color:var(--text);min-width:34px;text-align:right;";

      bondAnalyticsHtml = `
      <div style="margin-bottom:10px;padding:12px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);">
        <div style="font-size:9px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;">Fixed Income Analytics</div>
        <div style="display:grid;grid-template-columns:1fr 2fr 2fr;gap:16px;">
          <div style="border-right:1px solid var(--border);padding-right:12px;display:flex;flex-direction:column;justify-content:center;">
            <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Weighted Avg Maturity</div>
            ${an.wam !== null
              ? `<div style="font-size:20px;font-weight:700;color:var(--blue);">${an.wam.toFixed(2)}<span style="font-size:11px;font-weight:500;color:var(--text2);"> Yrs</span></div>`
              : `<div style="font-size:12px;font-weight:600;color:var(--dim);">N/A</div>`}
          </div>
          <div style="border-right:1px solid var(--border);padding-right:12px;">
            <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Maturity Profile</div>
            ${an.wam !== null
              ? `<div style="display:flex;flex-direction:column;gap:5px;">
              ${Object.entries(an.buckets).map(([b,p]) =>
                `<div style="${rowStyle}"><span style="min-width:36px;">${b}</span>${bucketBar(p)}<span style="${valStyle}">${p.toFixed(1)}%</span></div>`
              ).join("")}
            </div>`
              : `<div style="color:var(--dim);font-size:10.5px;">Maturity date data not available in this N-PORT filing</div>`}
          </div>
          <div>
            <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Coupon Kind Split</div>
            <div style="display:flex;flex-direction:column;gap:5px;">
              ${Object.entries(an.couponSplit).map(([k,p]) =>
                `<div style="${rowStyle}"><span style="min-width:54px;">${k}</span>${couponBar(p)}<span style="${valStyle}">${p.toFixed(1)}%</span></div>`
              ).join("")}
            </div>
          </div>
        </div>
      </div>`;
    }

    // ── Country column visibility ────────────────────────────
    const domesticBondClasses = ["fixed income – ig","fixed income – hy","fixed income – treasury",
      "fixed income – mbs","fixed income – muni","fixed income – preferred","fixed income – loans"];
    const showCountry = !domesticBondClasses.includes((acLabel||"").toLowerCase());

    // ── Render content ───────────────────────────────────────
    contentDiv.innerHTML = `

      <!-- IDENTITY CARD -->
      <div style="padding:12px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;">
          <div>
            <span style="font-size:20px;font-weight:800;color:var(--text);letter-spacing:-.02em;">${ticker}</span>
            <span style="font-size:11.5px;color:var(--text2);margin-left:8px;">${fundName}</span>
            ${regName !== "—" && regName !== fundName ? `<div style="font-size:10px;color:var(--dim);margin-top:2px;">${regName}</div>` : ""}
          </div>
          <div id="prospectusBtnContainer"></div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;border-top:1px solid var(--border);padding-top:8px;font-size:10.5px;">
          <div style="display:flex;flex-direction:column;gap:2px;">
            <span style="font-size:8.5px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;">Asset Class</span>
            <span style="${PILL_BASE}${assetClassPillStyle(acLabel)}">${acLabel}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <span style="font-size:8.5px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;">Net Assets</span>
            <span style="font-weight:700;color:var(--text);">${fmtCompact(displayNetAssets)}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <span style="font-size:8.5px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;">Period End</span>
            <span style="font-weight:600;color:var(--text);">${periodDisplay}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <span style="font-size:8.5px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;">Holdings</span>
            <span style="font-weight:600;color:var(--text);">${holdingsCount.toLocaleString()}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:120px;">
            <span style="font-size:8.5px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;">Benchmark</span>
            <span style="font-weight:500;color:${benchLabel==="Active"?"var(--amber)":"var(--text2)"};font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${benchLabel}">${benchLabel}</span>
          </div>
        </div>
      </div>

      <!-- ANALYTICS ROW: 3 tiles -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">
        <div style="padding:10px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);">
          <div style="font-size:8.5px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Largest Position</div>
          <div style="font-size:18px;font-weight:700;color:var(--text);font-family:var(--mono);">${largestW.toFixed(2)}%</div>
          <div style="font-size:9.5px;color:var(--text2);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${largestName}">${largestName}</div>
        </div>
        <div style="padding:10px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);">
          <div style="font-size:8.5px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Top 10 Concentration</div>
          <div style="font-size:18px;font-weight:700;color:var(--text);font-family:var(--mono);" ${hasNegativeHoldings ? 'title="Long positions only — fund holds short/derivative positions"' : ''}>${top10Conc.toFixed(2)}%${hasNegativeHoldings ? '*' : ''}</div>
          <div style="font-size:9.5px;color:var(--text2);margin-top:2px;">of ${holdingsCount.toLocaleString()} holdings · Eff. N ${effectiveN.toFixed(1)}</div>
        </div>
        <div style="padding:10px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);">
          <div style="font-size:8.5px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Asset Allocation</div>
          ${breakdownBarHtml ? `
          <div style="display:flex;height:8px;border-radius:3px;overflow:hidden;background:var(--bg2);margin-bottom:6px;">${breakdownBarHtml}</div>
          <div style="display:flex;flex-direction:column;gap:3px;font-size:9.5px;color:var(--text2);">${breakdownLegendHtml}</div>` :
          `<div style="color:var(--dim);font-size:10px;">—</div>`}
        </div>
      </div>

      <!-- FIXED INCOME ANALYTICS (bond ETFs only) -->
      ${bondAnalyticsHtml}

      <!-- HOLDINGS CONTROLS -->
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;">
        <input type="text" id="etfHoldingSearch" placeholder="Filter holdings by ticker or name…" class="btn"
          style="flex:1;min-width:160px;height:28px;background:var(--bg3);border:1px solid var(--border);font-size:11px;padding:2px 8px;border-radius:var(--r);outline:none;color:var(--text);"
          oninput="onEtfHoldingFilter(this.value)">
        <div style="display:flex;gap:4px;">
          ${["Top 10","Top 25","Top 50","All"].map(s =>
            `<button class="btn etf-filter-btn" id="btn-${s.toLowerCase().replace(" ","-")}"
              onclick="onEtfSliceChange('${s}')"
              style="height:28px;font-size:10px;font-weight:600;padding:2px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);cursor:pointer;color:var(--text2);outline:none;">${s}</button>`
          ).join("")}
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:10px;color:var(--text2);font-weight:500;">
        <span id="etfRowCount">Showing ${currentEtfHoldings.length} of ${currentEtfHoldings.length} holdings</span>
      </div>

      <!-- HOLDINGS TABLE -->
      <div id="etfHoldingsTable" style="overflow:auto;border:1px solid var(--border);border-radius:var(--r);background:var(--bg2);">
        <table class="dt" style="width:100%;table-layout:fixed;">
          <thead id="etfHoldingsThead"></thead>
          <tbody id="etfHoldingsTbody"></tbody>
        </table>
      </div>`;

    contentDiv.dataset.isBond      = isBond ? "1" : "0";
    contentDiv.dataset.showCountry = showCountry ? "1" : "0";

    updateHoldingsDisplay();

    // Mark holdings as loaded; if user switched tabs during load, stop here
    const cd = document.getElementById('etfHoldingsContent');
    if (cd) cd.dataset.holdingsLoaded = '1';
    if (currentEtfTab !== 'holdings') return;

    // Prospectus async fetch
    fetch(`${MY_WORKER_URL}/api/etf-prospectus?symbol=${encodeURIComponent(ticker)}`, { signal: etfAbortController.signal })
      .then(r => r.json())
      .then(pData => {
        if (pData?.url) {
          const c = document.getElementById("prospectusBtnContainer");
          if (c) c.innerHTML = `<a href="${pData.url}" target="_blank" rel="noopener noreferrer"
            style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:var(--text2);text-decoration:none;">
            View Prospectus ↗</a>`;
        }
      })
      .catch(err => { if (err.name !== "AbortError") console.warn("Prospectus fetch failed:", err); });

  } catch(err) {
    if (err.name === "AbortError") return;
    console.error("ETF holdings error:", err);
    contentDiv.innerHTML = _fetchErrorHtml("this ETF");
  }
}

// ── Snapshot bar — superseded by Overview tab; kept as no-op ──
async function _loadEtfSnapshot(ticker) { return; }

// ── Tab helpers ────────────────────────────────────────────────
function _updateTabBar(activeTab) {
  ['overview','holdings','changes'].forEach(t => {
    const btn = document.getElementById(`etfTab-${t}`);
    if (!btn) return;
    const isActive = t === activeTab;
    btn.style.borderBottomColor = isActive ? 'var(--blue)' : 'transparent';
    btn.style.color = isActive ? 'var(--blue)' : 'var(--dim)';
  });
}

window.switchEtfTab = function(tab) {
  currentEtfTab = tab;
  _updateTabBar(tab);

  const contentDiv = document.getElementById('etfHoldingsContent');
  const ticker = contentDiv?.dataset.activeTicker;
  if (!ticker) return;

  if (tab === 'overview') {
    _renderOverviewTab(ticker);
  } else if (tab === 'holdings') {
    if (!contentDiv?.dataset.holdingsLoaded) {
      onEtfSelectChange(ticker);
    } else {
      _showHoldingsContent();
    }
  } else if (tab === 'changes') {
    _renderChangesTab(ticker);
  }
};

function _showHoldingsContent() {
  _updateTabBar('holdings');
}

// ── Overview tab ───────────────────────────────────────────────
async function _renderOverviewTab(ticker) {
  const contentDiv = document.getElementById('etfHoldingsContent');
  if (!contentDiv) return;

  _updateTabBar('overview');

  contentDiv.innerHTML = `
    <div style="text-align:center;padding:40px 20px;color:var(--dim);font-size:11px;">
      <div class="mspinner"></div>
      <div style="margin-top:8px;">Loading overview…</div>
    </div>`;

  try {
    const res = await fetch(
      `${MY_WORKER_URL}/api/etf-snapshot?symbol=${encodeURIComponent(ticker)}`
    );
    if (!res.ok) throw new Error(`Snapshot failed: ${res.status}`);
    const data = await res.json();
    const snaps = data.snapshots || [];
    const etf   = currentEtfsList.find(e => e.ticker === ticker) || {};

    if (!snaps.length) {
      contentDiv.innerHTML = `
        <div style="padding:32px;text-align:center;color:var(--dim);font-size:11px;">
          No snapshot data available yet. Holdings pipeline processes this ETF monthly.
        </div>`;
      return;
    }

    const latest = snaps[0];
    const fmtRtn = r => r != null
      ? `<span style="color:${r>=0?'var(--green,#22c55e)':'var(--red,#ef4444)'};font-weight:700;">
           ${r>=0?'+':''}${r.toFixed(2)}%</span>`
      : '<span style="color:var(--dim);">—</span>';

    const returnsHtml = snaps.slice(0,3).map(s => `
      <div style="padding:10px 12px;background:var(--bg3);border:1px solid var(--border);
                  border-radius:var(--r);text-align:center;">
        <div style="font-size:9px;color:var(--dim);text-transform:uppercase;
                    letter-spacing:.05em;margin-bottom:6px;">
          ${s.report_month}
        </div>
        <div style="font-size:20px;">${fmtRtn(s.monthly_return_1)}</div>
      </div>`
    ).join('');

    const hasDerivatives = latest.derivatives_flag    === 1;
    const hasSecLending  = latest.securities_lending_flag === 1;

    contentDiv.innerHTML = `
      <!-- IDENTITY -->
      <div style="padding:12px;background:var(--bg3);border:1px solid var(--border);
                  border-radius:var(--r);margin-bottom:10px;">
        <div style="font-size:20px;font-weight:800;color:var(--text);letter-spacing:-.02em;
                    margin-bottom:4px;">${ticker}</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:8px;">${etf.name || ''}</div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:10.5px;
                    border-top:1px solid var(--border);padding-top:8px;">
          <div style="display:flex;flex-direction:column;gap:2px;">
            <span style="font-size:8.5px;color:var(--dim);text-transform:uppercase;
                         letter-spacing:.05em;">Net Assets</span>
            <span style="font-weight:700;color:var(--text);">${fmtCompact(latest.net_assets)}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <span style="font-size:8.5px;color:var(--dim);text-transform:uppercase;
                         letter-spacing:.05em;">Total Assets</span>
            <span style="font-weight:600;color:var(--text2);">${fmtCompact(latest.total_assets)}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <span style="font-size:8.5px;color:var(--dim);text-transform:uppercase;
                         letter-spacing:.05em;">Holdings</span>
            <span style="font-weight:600;color:var(--text);">${(latest.holdings_count||0).toLocaleString()}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <span style="font-size:8.5px;color:var(--dim);text-transform:uppercase;
                         letter-spacing:.05em;">Period End</span>
            <span style="font-weight:600;color:var(--text);">${latest.period_end||'—'}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <span style="font-size:8.5px;color:var(--dim);text-transform:uppercase;
                         letter-spacing:.05em;">Filed</span>
            <span style="font-weight:600;color:var(--text);">${latest.filing_date||'—'}</span>
          </div>
          ${hasDerivatives ? `
          <div style="display:flex;align-items:center;">
            <span style="font-size:9px;padding:2px 7px;border-radius:3px;
                         background:rgba(251,191,36,0.15);color:var(--amber,#f59e0b);
                         font-weight:600;">Uses Derivatives</span>
          </div>` : ''}
          ${hasSecLending ? `
          <div style="display:flex;align-items:center;">
            <span style="font-size:9px;padding:2px 7px;border-radius:3px;
                         background:rgba(99,102,241,0.15);color:#818cf8;
                         font-weight:600;">Securities Lending</span>
          </div>` : ''}
        </div>
      </div>

      <!-- MONTHLY RETURNS -->
      ${snaps.length > 0 ? `
      <div style="margin-bottom:10px;">
        <div style="font-size:9px;font-weight:600;color:var(--text2);text-transform:uppercase;
                    letter-spacing:.05em;margin-bottom:8px;">Monthly Total Returns</div>
        <div style="display:grid;grid-template-columns:repeat(${Math.min(snaps.length,3)},1fr);
                    gap:8px;">
          ${returnsHtml}
        </div>
      </div>` : ''}

      <!-- FUND STRUCTURE -->
      <div style="padding:12px;background:var(--bg3);border:1px solid var(--border);
                  border-radius:var(--r);">
        <div style="font-size:9px;font-weight:600;color:var(--text2);text-transform:uppercase;
                    letter-spacing:.05em;margin-bottom:8px;">Fund Structure</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:11px;">
          <div style="display:flex;flex-direction:column;gap:2px;">
            <span style="font-size:9px;color:var(--dim);">Asset Class</span>
            <span style="font-weight:600;color:var(--text);">${etf.assetClass || '—'}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <span style="font-size:9px;color:var(--dim);">Benchmark</span>
            <span style="font-weight:600;color:var(--text2);font-size:10px;">${etf.index || 'Active'}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <span style="font-size:9px;color:var(--dim);">Issuer</span>
            <span style="font-weight:600;color:var(--text2);font-size:10px;">${etf.issuer || '—'}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <span style="font-size:9px;color:var(--dim);">Coverage</span>
            <span style="font-size:9px;padding:2px 7px;border-radius:3px;
                         background:rgba(59,130,246,0.15);color:var(--blue);font-weight:600;">
              ${etf.coverageStatus === 'deep' ? 'DEEP' : 'DIRECTORY'}
            </span>
          </div>
        </div>
      </div>`;

  } catch(e) {
    contentDiv.innerHTML = `
      <div style="padding:32px;text-align:center;color:var(--dim);font-size:11px;">
        Could not load overview data.
      </div>`;
  }
}

// ── Changes tab ────────────────────────────────────────────────
async function _renderChangesTab(ticker) {
  const contentDiv = document.getElementById('etfHoldingsContent');
  if (!contentDiv) return;

  _updateTabBar('changes');

  contentDiv.innerHTML = `
    <div style="text-align:center;padding:40px 20px;color:var(--dim);font-size:11px;">
      <div class="mspinner"></div>
      <div style="margin-top:8px;">Computing changes…</div>
    </div>`;

  try {
    const res = await fetch(
      `${MY_WORKER_URL}/api/etf-changes?symbol=${encodeURIComponent(ticker)}`
    );
    if (!res.ok) throw new Error(`Changes fetch failed: ${res.status}`);
    const data = await res.json();

    if (data.error === 'insufficient_data') {
      contentDiv.innerHTML = `
        <div style="padding:32px;text-align:center;color:var(--dim);font-size:11px;">
          <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px;">
            Not enough data yet
          </div>
          Need at least 2 months of stored holdings to show changes.
          Holdings pipeline runs every 2 hours — check back soon.
        </div>`;
      return;
    }

    const fmtChng = (w) => {
      if (w == null) return '—';
      const color = w > 0 ? 'var(--green,#22c55e)' : 'var(--red,#ef4444)';
      return `<span style="color:${color};font-weight:600;">${w>0?'+':''}${w.toFixed(2)}%</span>`;
    };

    const fmtW = (w) => w != null ? `${w.toFixed(2)}%` : '—';

    const sectionHtml = (title, rows, columns) => {
      if (!rows.length) return `
        <div style="margin-bottom:16px;">
          <div style="font-size:10px;font-weight:600;color:var(--text2);text-transform:uppercase;
                      letter-spacing:.05em;margin-bottom:8px;">${title}</div>
          <div style="color:var(--dim);font-size:11px;padding:12px;
                      background:var(--bg3);border-radius:var(--r);">None</div>
        </div>`;

      const headerHtml = columns.map(c =>
        `<th style="padding:6px 8px;text-align:${c.right?'right':'left'};font-size:9px;
                    font-weight:600;color:var(--dim);text-transform:uppercase;
                    letter-spacing:.05em;white-space:nowrap;">${c.label}</th>`
      ).join('');

      const rowsHtml = rows.map((r,i) =>
        `<tr style="border-top:1px solid var(--border);
                    background:${i%2===0?'var(--bg3)':'var(--bg2)'};">
          ${columns.map(c =>
            `<td style="padding:6px 8px;font-size:11px;text-align:${c.right?'right':'left'};
                        ${c.mono?'font-family:var(--mono);':''}
                        ${c.dim?'color:var(--dim);':'color:var(--text);'}
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
                        max-width:${c.maxW||'200px'};">
              ${c.render(r)}
            </td>`
          ).join('')}
        </tr>`
      ).join('');

      return `
        <div style="margin-bottom:16px;">
          <div style="font-size:10px;font-weight:600;color:var(--text2);text-transform:uppercase;
                      letter-spacing:.05em;margin-bottom:8px;">
            ${title} <span style="font-weight:400;color:var(--dim);">(${rows.length})</span>
          </div>
          <div style="overflow:auto;border:1px solid var(--border);border-radius:var(--r);">
            <table style="width:100%;border-collapse:collapse;">
              <thead style="background:var(--bg3);">
                <tr>${headerHtml}</tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>`;
    };

    contentDiv.innerHTML = `
      <!-- PERIOD HEADER -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;">
        <span style="font-size:13px;font-weight:700;color:var(--text);">Portfolio Changes</span>
        <span style="font-size:11px;color:var(--dim);">
          ${data.previous_month} → ${data.current_month}
        </span>
      </div>

      ${sectionHtml('New Positions', data.new_positions, [
        { label: 'Security',    render: r => r.security_name || '—', maxW: '220px' },
        { label: 'Ticker',      render: r => r.security_ticker || '—', mono: true, dim: true },
        { label: 'CUSIP',       render: r => r.cusip || '—', mono: true, dim: true },
        { label: 'Weight',      render: r => fmtW(r.weight_pct), right: true, mono: true },
        { label: 'Type',        render: r => r.asset_cat || '—', dim: true },
      ])}

      ${sectionHtml('Exited Positions', data.exited_positions, [
        { label: 'Security',    render: r => r.security_name || '—', maxW: '220px' },
        { label: 'Ticker',      render: r => r.security_ticker || '—', mono: true, dim: true },
        { label: 'CUSIP',       render: r => r.cusip || '—', mono: true, dim: true },
        { label: 'Prev Weight', render: r => fmtW(r.prev_weight), right: true, mono: true },
        { label: 'Type',        render: r => r.asset_cat || '—', dim: true },
      ])}

      ${sectionHtml('Largest Weight Changes', data.weight_changes, [
        { label: 'Security',    render: r => r.security_name || '—', maxW: '220px' },
        { label: 'Ticker',      render: r => r.security_ticker || '—', mono: true, dim: true },
        { label: 'Previous',    render: r => fmtW(r.prev_weight), right: true, mono: true, dim: true },
        { label: 'Current',     render: r => fmtW(r.current_weight), right: true, mono: true },
        { label: 'Change',      render: r => fmtChng(r.weight_change), right: true, mono: true },
      ])}`;

  } catch(e) {
    contentDiv.innerHTML = `
      <div style="padding:32px;text-align:center;color:var(--dim);font-size:11px;">
        Could not load changes data.
      </div>`;
  }
}

// ── Holdings table render ─────────────────────────────────────
function updateHoldingsDisplay() {
  const tbody = document.getElementById("etfHoldingsTbody");
  const thead = document.getElementById("etfHoldingsThead");
  const rowCountSpan = document.getElementById("etfRowCount");
  if (!tbody || !thead) return;

  const contentDiv  = document.getElementById("etfHoldingsContent");
  const isBond      = contentDiv?.dataset.isBond      === "1";
  const showCountry = contentDiv?.dataset.showCountry  === "1";

  // Headers
  if (isBond) {
    thead.innerHTML = `<tr>
      <th style="text-align:left;width:200px;position:sticky;top:0;background:var(--bg3);z-index:10;">Security Name</th>
      <th style="text-align:right;width:70px;position:sticky;top:0;background:var(--bg3);z-index:10;">Coupon</th>
      <th style="text-align:right;width:95px;position:sticky;top:0;background:var(--bg3);z-index:10;">Maturity</th>
      <th style="text-align:right;width:90px;position:sticky;top:0;background:var(--bg3);z-index:10;">Asset Type</th>
      <th style="text-align:right;width:70px;position:sticky;top:0;background:var(--bg3);z-index:10;">Weight %</th>
    </tr>`;
  } else {
    thead.innerHTML = `<tr>
      <th style="text-align:left;width:120px;position:sticky;top:0;background:var(--bg3);z-index:10;font-family:var(--mono);">ISIN</th>
      <th style="text-align:left;width:60px;position:sticky;top:0;background:var(--bg3);z-index:10;">Ticker</th>
      <th style="text-align:left;position:sticky;top:0;background:var(--bg3);z-index:10;">Security Name</th>
      ${showCountry ? `<th style="text-align:center;width:50px;position:sticky;top:0;background:var(--bg3);z-index:10;">Ctry</th>` : ""}
      <th style="text-align:right;width:65px;position:sticky;top:0;background:var(--bg3);z-index:10;">Weight %</th>
    </tr>`;
  }

  // Filter
  const searchVal = (currentFilterText || "").toLowerCase().trim();
  const filtered  = currentEtfHoldings.filter(h => {
    if (!searchVal) return true;
    return (h.symbol||"").toLowerCase().includes(searchVal) || (h.name||"").toLowerCase().includes(searchVal);
  });

  // Slice
  let sliced = filtered;
  if      (currentSliceSize === "Top 10") sliced = filtered.slice(0, 10);
  else if (currentSliceSize === "Top 25") sliced = filtered.slice(0, 25);
  else if (currentSliceSize === "Top 50") sliced = filtered.slice(0, 50);

  // Rows
  let rows = "";
  if (sliced.length === 0) {
    const cols = isBond ? 5 : (showCountry ? 5 : 4);
    rows = `<tr><td colspan="${cols}" style="text-align:center;color:var(--dim);padding:20px;">No holdings match the filter.</td></tr>`;
  } else {
    sliced.forEach(h => {
      const wpct    = getWeight(h);
      const rawW    = h.weightpct !== undefined ? h.weightpct : h.weight_pct;
      const wStr    = (rawW === undefined || rawW === null || rawW === "") ? "—" : `${wpct.toFixed(2)}%`;
      const isNeg   = wpct < 0;
      const wStyle  = isNeg ? 'style="text-align:right;font-weight:700;color:var(--red);"' : 'style="text-align:right;font-weight:700;"';

      if (isBond) {
        const nameStr  = h.name || "—";
        const coupon   = fmtCoupon(h.annualizedRate !== undefined ? h.annualizedRate : h.annualizedRte);
        const maturity = (h.maturityDate || h.maturityDat || "—").slice(0, 10);
        const assetType= h.assetType || "—";
        rows += `<tr>
          <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${nameStr}">${nameStr}</td>
          <td style="text-align:right;font-family:var(--mono);font-size:10.5px;">${coupon}</td>
          <td style="text-align:right;font-family:var(--mono);font-size:10.5px;">${maturity}</td>
          <td style="text-align:right;font-size:10px;color:var(--text2);">${assetType}</td>
          <td ${wStyle}>${wStr}</td>
        </tr>`;
      } else {
        const isin = h.isin
          ? `<span style="font-family:var(--mono);font-size:10px;color:var(--text2);">${h.isin}</span>`
          : `<span style="color:var(--dim);">—</span>`;

        let tkrCell = `<span style="color:var(--dim);">—</span>`;
        if (h.symbol) {
          const safe = (h.name||"").replace(/'/g,"\\'");
          tkrCell = `<span class="mv-sym" style="font-weight:700;font-family:var(--mono);cursor:pointer;color:var(--blue);"
            onclick="closeEtfDetailView();setTimeout(()=>openBySymbol('${h.symbol}','${safe}'),100);">${h.symbol}</span>`;
        }

        const countryCellHtml = showCountry ? (() => {
          if (!h.country) return `<td style="text-align:center;color:var(--dim);">—</td>`;
          return `<td style="text-align:center;">
            <span style="font-size:9px;font-weight:700;font-family:var(--mono);background:var(--bg3);border:1px solid var(--border);border-radius:3px;padding:1px 4px;">${h.country}</span>
          </td>`;
        })() : "";

        const nameStr = h.name || "—";
        rows += `<tr>
          <td>${isin}</td>
          <td>${tkrCell}</td>
          <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${nameStr}">${nameStr}</td>
          ${countryCellHtml}
          <td ${wStyle}>${wStr}</td>
        </tr>`;
      }
    });
  }

  tbody.innerHTML = rows;

  if (rowCountSpan) {
    rowCountSpan.textContent = `Showing ${sliced.length} of ${currentEtfHoldings.length} holdings`;
  }

  // Slice button highlight
  ["Top 10","Top 25","Top 50","All"].forEach(s => {
    const btn = document.getElementById(`btn-${s.toLowerCase().replace(" ","-")}`);
    if (!btn) return;
    btn.style.borderColor = s === currentSliceSize ? "var(--blue)" : "var(--border)";
    btn.style.color       = s === currentSliceSize ? "var(--blue)"  : "var(--text2)";
  });
}

// ── Holdings filter (separate from discovery search) ──────────
window.onEtfHoldingFilter = function(val) {
  currentFilterText = val;
  updateHoldingsDisplay();
};

// ── Slice handler ──────────────────────────────────────────────
window.onEtfSliceChange = function(size) {
  currentSliceSize = size;
  updateHoldingsDisplay();
};

// ── Overlap Tool ───────────────────────────────────────────────
window.openEtfOverlapTool = function(prefilledA, prefilledB) {
  document.getElementById('etfOverlapPanel')?.remove();

  const panel = document.createElement('div');
  panel.id = 'etfOverlapPanel';
  panel.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;' +
    'z-index:1001;background:var(--bg);overflow-y:auto;display:flex;flex-direction:column;';

  panel.innerHTML = `
    <style>#etfOverlapPanel * { box-sizing: border-box; }</style>

    <!-- TOP BAR -->
    <div style="display:flex;align-items:center;justify-content:space-between;
                padding:10px 16px;border-bottom:1px solid var(--border);
                flex-shrink:0;background:var(--bg3);">
      <span style="font-size:13px;font-weight:700;color:var(--text);">ETF Overlap Tool</span>
      <button onclick="document.getElementById('etfOverlapPanel').remove()"
        style="background:none;border:1px solid var(--border);border-radius:var(--r);
               padding:4px 10px;cursor:pointer;color:var(--text2);font-size:11px;
               font-weight:600;outline:none;"
        onmouseenter="this.style.borderColor='var(--red)';this.style.color='var(--red)'"
        onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">
        ✕ Close
      </button>
    </div>

    <!-- INPUTS -->
    <div style="padding:16px;border-bottom:1px solid var(--border);
                background:var(--bg3);flex-shrink:0;">
      <div style="font-size:11px;color:var(--dim);margin-bottom:10px;">
        Enter two ETF tickers to see how much their holdings overlap.
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input type="text" id="overlapTickerA" placeholder="ETF A (e.g. SPY)"
          value="${prefilledA || ''}"
          style="width:120px;height:34px;background:var(--bg2);border:1px solid var(--border);
                 border-radius:var(--r);color:var(--text);font-size:13px;font-weight:700;
                 padding:0 10px;outline:none;font-family:var(--mono);text-transform:uppercase;"
          oninput="this.value=this.value.toUpperCase()">
        <span style="color:var(--dim);font-size:13px;">vs</span>
        <input type="text" id="overlapTickerB" placeholder="ETF B (e.g. IVV)"
          value="${prefilledB || ''}"
          style="width:120px;height:34px;background:var(--bg2);border:1px solid var(--border);
                 border-radius:var(--r);color:var(--text);font-size:13px;font-weight:700;
                 padding:0 10px;outline:none;font-family:var(--mono);text-transform:uppercase;"
          oninput="this.value=this.value.toUpperCase()">
        <button onclick="runEtfOverlap()"
          style="height:34px;padding:0 16px;font-size:11px;font-weight:700;
                 background:var(--blue);border:none;border-radius:var(--r);
                 cursor:pointer;color:#fff;outline:none;">
          Calculate Overlap
        </button>
      </div>
    </div>

    <!-- RESULTS -->
    <div id="overlapResults" style="flex:1;padding:16px;overflow-y:auto;">
      <div style="text-align:center;padding:60px 20px;color:var(--dim);font-size:11px;">
        Enter two ETF tickers above and click Calculate.
      </div>
    </div>`;

  document.body.appendChild(panel);
  if (prefilledA && prefilledB) setTimeout(runEtfOverlap, 100);
};

window.runEtfOverlap = async function() {
  const tickerA = (document.getElementById('overlapTickerA')?.value || '').trim().toUpperCase();
  const tickerB = (document.getElementById('overlapTickerB')?.value || '').trim().toUpperCase();
  const results = document.getElementById('overlapResults');
  if (!results) return;

  if (!tickerA || !tickerB) {
    results.innerHTML = `<div style="text-align:center;padding:40px;color:var(--dim);font-size:11px;">
      Please enter both ETF tickers.</div>`;
    return;
  }

  results.innerHTML = `
    <div style="text-align:center;padding:60px 20px;color:var(--blue);font-size:11px;">
      <div class="mspinner"></div>
      <div style="margin-top:10px;">Computing overlap…</div>
    </div>`;

  try {
    const res = await fetch(
      `${MY_WORKER_URL}/api/etf-overlap?a=${encodeURIComponent(tickerA)}&b=${encodeURIComponent(tickerB)}`
    );
    const data = await res.json();

    if (data.error) {
      results.innerHTML = `<div style="padding:32px;text-align:center;color:var(--dim);font-size:11px;">
        ${data.error}</div>`;
      return;
    }

    const overlapColor = data.overlap_pct > 60 ? 'var(--red,#ef4444)'
      : data.overlap_pct > 30 ? 'var(--amber,#f59e0b)'
      : 'var(--green,#22c55e)';

    const overlapLabel = data.overlap_pct > 60 ? 'High Overlap'
      : data.overlap_pct > 30 ? 'Moderate Overlap'
      : 'Low Overlap';

    const sharedRowsHtml = (data.shared_holdings || []).slice(0, 50).map((h, i) => `
      <tr style="border-top:1px solid var(--border);background:${i%2===0?'var(--bg3)':'var(--bg2)'};">
        <td style="padding:6px 8px;font-size:11px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${h.security_name || '—'}
        </td>
        <td style="padding:6px 8px;font-size:11px;font-family:var(--mono);color:var(--dim);text-align:right;">
          ${h.weight_a != null ? h.weight_a.toFixed(2)+'%' : '—'}
        </td>
        <td style="padding:6px 8px;font-size:11px;font-family:var(--mono);color:var(--dim);text-align:right;">
          ${h.weight_b != null ? h.weight_b.toFixed(2)+'%' : '—'}
        </td>
        <td style="padding:6px 8px;font-size:11px;font-family:var(--mono);font-weight:700;text-align:right;">
          ${h.overlap_weight != null ? h.overlap_weight.toFixed(2)+'%' : '—'}
        </td>
      </tr>`).join('');

    const countryHtml = (data.country_overlap || []).map(c => `
      <div style="display:flex;justify-content:space-between;align-items:center;
                  padding:4px 0;font-size:11px;border-bottom:1px solid var(--border);">
        <span style="color:var(--text);">${c.issuer_country || '—'}</span>
        <div style="display:flex;gap:12px;font-family:var(--mono);">
          <span style="color:var(--dim);">${(c.weight_a||0).toFixed(1)}%</span>
          <span style="color:var(--dim);">${(c.weight_b||0).toFixed(1)}%</span>
        </div>
      </div>`).join('');

    results.innerHTML = `
      <!-- OVERLAP SCORE -->
      <div style="text-align:center;padding:24px;background:var(--bg3);
                  border:1px solid var(--border);border-radius:var(--r);margin-bottom:16px;">
        <div style="font-size:48px;font-weight:800;font-family:var(--mono);
                    color:${overlapColor};">${data.overlap_pct.toFixed(1)}%</div>
        <div style="font-size:12px;font-weight:600;color:${overlapColor};margin-top:4px;">
          ${overlapLabel}
        </div>
        <div style="font-size:11px;color:var(--dim);margin-top:8px;">
          ${data.shared_count} shared holdings —
          ${data.etf_a.ticker} (${data.total_weight_a.toFixed(0)}% covered) vs
          ${data.etf_b.ticker} (${data.total_weight_b.toFixed(0)}% covered)
        </div>
        <div style="font-size:10px;color:var(--dim);margin-top:4px;">
          ${data.etf_a.ticker}: ${data.etf_a.report_month} ·
          ${data.etf_b.ticker}: ${data.etf_b.report_month}
        </div>
      </div>

      <!-- SHARED HOLDINGS TABLE -->
      <div style="margin-bottom:16px;">
        <div style="font-size:10px;font-weight:600;color:var(--text2);
                    text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">
          Shared Holdings
          <span style="font-weight:400;color:var(--dim);">(${data.shared_count} total, showing top 50)</span>
        </div>
        <div style="overflow:auto;border:1px solid var(--border);border-radius:var(--r);">
          <table style="width:100%;border-collapse:collapse;">
            <thead style="background:var(--bg3);">
              <tr>
                <th style="padding:6px 8px;text-align:left;font-size:9px;font-weight:600;
                           color:var(--dim);text-transform:uppercase;letter-spacing:.05em;">Security</th>
                <th style="padding:6px 8px;text-align:right;font-size:9px;font-weight:600;
                           color:var(--dim);text-transform:uppercase;letter-spacing:.05em;">
                  ${data.etf_a.ticker} %</th>
                <th style="padding:6px 8px;text-align:right;font-size:9px;font-weight:600;
                           color:var(--dim);text-transform:uppercase;letter-spacing:.05em;">
                  ${data.etf_b.ticker} %</th>
                <th style="padding:6px 8px;text-align:right;font-size:9px;font-weight:600;
                           color:var(--dim);text-transform:uppercase;letter-spacing:.05em;">Min Weight</th>
              </tr>
            </thead>
            <tbody>${sharedRowsHtml}</tbody>
          </table>
        </div>
      </div>

      <!-- COUNTRY OVERLAP -->
      ${countryHtml ? `
      <div style="padding:12px;background:var(--bg3);border:1px solid var(--border);
                  border-radius:var(--r);">
        <div style="font-size:10px;font-weight:600;color:var(--text2);
                    text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">
          Country Overlap
        </div>
        <div style="display:flex;justify-content:flex-end;gap:12px;font-size:9px;
                    color:var(--dim);margin-bottom:4px;font-family:var(--mono);">
          <span>${data.etf_a.ticker}</span>
          <span>${data.etf_b.ticker}</span>
        </div>
        ${countryHtml}
      </div>` : ''}`;

  } catch(e) {
    results.innerHTML = `<div style="padding:32px;text-align:center;color:var(--dim);font-size:11px;">
      Error computing overlap: ${e.message}</div>`;
  }
};

// ── Compare Tool ───────────────────────────────────────────────
window.openEtfCompareTool = function(prefilledSymbols) {
  document.getElementById('etfComparePanel')?.remove();

  const panel = document.createElement('div');
  panel.id = 'etfComparePanel';
  panel.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;' +
    'z-index:1001;background:var(--bg);overflow-y:auto;display:flex;flex-direction:column;';

  const prefilled = prefilledSymbols || [];

  panel.innerHTML = `
    <style>#etfComparePanel * { box-sizing: border-box; }</style>

    <!-- TOP BAR -->
    <div style="display:flex;align-items:center;justify-content:space-between;
                padding:10px 16px;border-bottom:1px solid var(--border);
                flex-shrink:0;background:var(--bg3);">
      <span style="font-size:13px;font-weight:700;color:var(--text);">ETF Compare</span>
      <button onclick="document.getElementById('etfComparePanel').remove()"
        style="background:none;border:1px solid var(--border);border-radius:var(--r);
               padding:4px 10px;cursor:pointer;color:var(--text2);font-size:11px;
               font-weight:600;outline:none;"
        onmouseenter="this.style.borderColor='var(--red)';this.style.color='var(--red)'"
        onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">
        ✕ Close
      </button>
    </div>

    <!-- INPUTS -->
    <div style="padding:16px;border-bottom:1px solid var(--border);
                background:var(--bg3);flex-shrink:0;">
      <div style="font-size:11px;color:var(--dim);margin-bottom:10px;">
        Compare 2–3 ETFs side by side using stored N-PORT data.
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input type="text" id="compareT1" placeholder="ETF 1"
          value="${prefilled[0]||''}"
          style="width:100px;height:34px;background:var(--bg2);border:1px solid var(--border);
                 border-radius:var(--r);color:var(--text);font-size:13px;font-weight:700;
                 padding:0 10px;outline:none;font-family:var(--mono);text-transform:uppercase;"
          oninput="this.value=this.value.toUpperCase()">
        <input type="text" id="compareT2" placeholder="ETF 2"
          value="${prefilled[1]||''}"
          style="width:100px;height:34px;background:var(--bg2);border:1px solid var(--border);
                 border-radius:var(--r);color:var(--text);font-size:13px;font-weight:700;
                 padding:0 10px;outline:none;font-family:var(--mono);text-transform:uppercase;"
          oninput="this.value=this.value.toUpperCase()">
        <input type="text" id="compareT3" placeholder="ETF 3 (optional)"
          value="${prefilled[2]||''}"
          style="width:140px;height:34px;background:var(--bg2);border:1px solid var(--border);
                 border-radius:var(--r);color:var(--text);font-size:12px;font-weight:600;
                 padding:0 10px;outline:none;font-family:var(--mono);text-transform:uppercase;"
          oninput="this.value=this.value.toUpperCase()">
        <button onclick="runEtfCompare()"
          style="height:34px;padding:0 16px;font-size:11px;font-weight:700;
                 background:var(--blue);border:none;border-radius:var(--r);
                 cursor:pointer;color:#fff;outline:none;">
          Compare
        </button>
      </div>
    </div>

    <!-- RESULTS -->
    <div id="compareResults" style="flex:1;padding:16px;overflow-y:auto;">
      <div style="text-align:center;padding:60px 20px;color:var(--dim);font-size:11px;">
        Enter 2–3 ETF tickers above and click Compare.
      </div>
    </div>`;

  document.body.appendChild(panel);
  if (prefilled.length >= 2) setTimeout(runEtfCompare, 100);
};

window.runEtfCompare = async function() {
  const t1 = (document.getElementById('compareT1')?.value||'').trim().toUpperCase();
  const t2 = (document.getElementById('compareT2')?.value||'').trim().toUpperCase();
  const t3 = (document.getElementById('compareT3')?.value||'').trim().toUpperCase();
  const results = document.getElementById('compareResults');
  if (!results) return;

  const symbols = [t1, t2, t3].filter(Boolean);
  if (symbols.length < 2) {
    results.innerHTML = `<div style="text-align:center;padding:40px;color:var(--dim);
      font-size:11px;">Please enter at least 2 ETF tickers.</div>`;
    return;
  }

  results.innerHTML = `
    <div style="text-align:center;padding:60px 20px;color:var(--blue);font-size:11px;">
      <div class="mspinner"></div>
      <div style="margin-top:10px;">Loading comparison…</div>
    </div>`;

  try {
    const res = await fetch(
      `${MY_WORKER_URL}/api/etf-compare?symbols=${encodeURIComponent(symbols.join(','))}`
    );
    const data = await res.json();
    if (data.error) {
      results.innerHTML = `<div style="padding:32px;text-align:center;color:var(--dim);
        font-size:11px;">${data.error}</div>`;
      return;
    }

    const etfs = data.etfs || [];
    const cols = etfs.length;
    const gridCols = `repeat(${cols}, 1fr)`;

    const fmt    = n => n ? fmtCompact(n) : '—';
    const fmtRtn = r => r != null
      ? `<span style="color:${r>=0?'var(--green,#22c55e)':'var(--red,#ef4444)'};font-weight:700;">
           ${r>=0?'+':''}${r.toFixed(2)}%</span>`
      : '<span style="color:var(--dim)">—</span>';

    const headerHtml = etfs.map(e => `
      <div style="padding:12px;background:var(--bg3);border:1px solid var(--border);
                  border-radius:var(--r);text-align:center;">
        <div style="font-size:18px;font-weight:800;color:var(--text);
                    font-family:var(--mono);">${e.ticker}</div>
        <div style="font-size:10px;color:var(--dim);margin-top:3px;overflow:hidden;
                    text-overflow:ellipsis;white-space:nowrap;"
          title="${(e.name||'').replace(/"/g,'&quot;')}">${e.name||'—'}</div>
        ${e.coverage_status==='deep'
          ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;margin-top:4px;
                          display:inline-block;background:rgba(59,130,246,0.15);
                          color:var(--blue);font-weight:600;">DEEP</span>`
          : ''}
      </div>`).join('');

    const statRow = (label, vals) => `
      <div style="display:grid;grid-template-columns:140px ${gridCols};gap:8px;
                  align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
        <div style="font-size:10px;color:var(--dim);">${label}</div>
        ${vals.map(v => `<div style="font-size:12px;font-weight:600;color:var(--text);
          text-align:center;font-family:var(--mono);">${v}</div>`).join('')}
      </div>`;

    const statsHtml = `
      ${statRow('Net Assets', etfs.map(e => fmt(e.snapshot?.net_assets)))}
      ${statRow('Holdings', etfs.map(e => e.snapshot?.holdings_count?.toLocaleString() || '—'))}
      ${statRow('Return (latest mo.)', etfs.map(e => fmtRtn(e.snapshot?.monthly_return_1)))}
      ${statRow('Top-10 Concentration', etfs.map(e => e.concentration?.top10_conc != null ? e.concentration.top10_conc.toFixed(1)+'%' : '—'))}
      ${statRow('Largest Position', etfs.map(e => e.concentration?.largest_weight != null ? e.concentration.largest_weight.toFixed(2)+'%' : '—'))}
      ${statRow('Asset Class', etfs.map(e => e.asset_class || '—'))}
      ${statRow('Benchmark', etfs.map(e => `<span style="font-size:10px;color:var(--text2);">${e.index_name||'Active'}</span>`))}
      ${statRow('Period', etfs.map(e => e.snapshot?.period_end||'—'))}`;

    const holdingsHtml = etfs.map(e => {
      const rows = (e.top10 || []).map((h, i) => `
        <div style="display:flex;justify-content:space-between;padding:4px 0;
                    border-bottom:1px solid var(--border);font-size:10px;">
          <span style="color:var(--text);overflow:hidden;text-overflow:ellipsis;
                       white-space:nowrap;max-width:70%;"
            title="${(h.security_name||'').replace(/"/g,'&quot;')}">
            ${i+1}. ${h.security_name||'—'}
          </span>
          <span style="font-family:var(--mono);color:var(--text2);flex-shrink:0;margin-left:8px;">
            ${h.weight_pct!=null ? h.weight_pct.toFixed(2)+'%' : '—'}
          </span>
        </div>`).join('');
      return `
        <div style="padding:12px;background:var(--bg3);border:1px solid var(--border);
                    border-radius:var(--r);">
          <div style="font-size:10px;font-weight:600;color:var(--text2);
                      text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">
            ${e.ticker} Top 10
          </div>
          ${rows || '<div style="color:var(--dim);font-size:10px;">No data</div>'}
        </div>`;
    }).join('');

    const overlapHtml = (data.overlap_scores || []).map(o => {
      const color = o.overlap_pct > 60 ? 'var(--red,#ef4444)'
        : o.overlap_pct > 30 ? 'var(--amber,#f59e0b)'
        : 'var(--green,#22c55e)';
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:8px 12px;background:var(--bg3);border:1px solid var(--border);
                    border-radius:var(--r);">
          <span style="font-size:12px;font-weight:700;color:var(--text);
                       font-family:var(--mono);">${o.ticker_a} ↔ ${o.ticker_b}</span>
          <span style="font-size:16px;font-weight:800;color:${color};
                       font-family:var(--mono);">${o.overlap_pct.toFixed(1)}%</span>
        </div>`;
    }).join('');

    results.innerHTML = `
      <!-- HEADER CARDS -->
      <div style="display:grid;grid-template-columns:${gridCols};gap:8px;margin-bottom:16px;">
        ${headerHtml}
      </div>

      <!-- STAT TABLE -->
      <div style="padding:12px;background:var(--bg3);border:1px solid var(--border);
                  border-radius:var(--r);margin-bottom:16px;overflow-x:auto;">
        <div style="font-size:10px;font-weight:600;color:var(--text2);text-transform:uppercase;
                    letter-spacing:.05em;margin-bottom:10px;">Key Metrics</div>
        ${statsHtml}
      </div>

      <!-- OVERLAP SCORES -->
      ${overlapHtml ? `
      <div style="margin-bottom:16px;">
        <div style="font-size:10px;font-weight:600;color:var(--text2);text-transform:uppercase;
                    letter-spacing:.05em;margin-bottom:8px;">Overlap Scores</div>
        <div style="display:flex;flex-direction:column;gap:6px;">${overlapHtml}</div>
      </div>` : ''}

      <!-- TOP 10 HOLDINGS -->
      <div>
        <div style="font-size:10px;font-weight:600;color:var(--text2);text-transform:uppercase;
                    letter-spacing:.05em;margin-bottom:8px;">Top 10 Holdings</div>
        <div style="display:grid;grid-template-columns:${gridCols};gap:8px;">
          ${holdingsHtml}
        </div>
      </div>`;

  } catch(e) {
    results.innerHTML = `<div style="padding:32px;text-align:center;color:var(--dim);
      font-size:11px;">Error: ${e.message}</div>`;
  }
};

// ── Exposure Explorer ──────────────────────────────────────────
window.openExposureExplorer = function(prefilledStock) {
  document.getElementById('etfExposurePanel')?.remove();

  const panel = document.createElement('div');
  panel.id = 'etfExposurePanel';
  panel.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;' +
    'z-index:1001;background:var(--bg);overflow-y:auto;display:flex;flex-direction:column;';

  panel.innerHTML = `
    <style>#etfExposurePanel * { box-sizing: border-box; }</style>

    <!-- TOP BAR -->
    <div style="display:flex;align-items:center;justify-content:space-between;
                padding:10px 16px;border-bottom:1px solid var(--border);
                flex-shrink:0;background:var(--bg3);">
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text);">Exposure Explorer</div>
        <div style="font-size:10px;color:var(--dim);margin-top:1px;">
          Find which ETFs are exposed to a stock or country
        </div>
      </div>
      <button onclick="document.getElementById('etfExposurePanel').remove()"
        style="background:none;border:1px solid var(--border);border-radius:var(--r);
               padding:4px 10px;cursor:pointer;color:var(--text2);font-size:11px;
               font-weight:600;outline:none;"
        onmouseenter="this.style.borderColor='var(--red)';this.style.color='var(--red)'"
        onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">
        ✕ Close
      </button>
    </div>

    <!-- SEARCH BAR -->
    <div style="padding:16px;border-bottom:1px solid var(--border);
                background:var(--bg3);flex-shrink:0;">
      <div style="display:flex;gap:6px;margin-bottom:10px;">
        <button id="expTabStock" onclick="switchExpTab('stock')"
          style="padding:4px 12px;font-size:11px;font-weight:600;border-radius:20px;
                 cursor:pointer;border:1px solid var(--blue);background:rgba(59,130,246,0.15);
                 color:var(--blue);outline:none;">
          By Stock
        </button>
        <button id="expTabCountry" onclick="switchExpTab('country')"
          style="padding:4px 12px;font-size:11px;font-weight:600;border-radius:20px;
                 cursor:pointer;border:1px solid var(--border);background:var(--bg3);
                 color:var(--dim);outline:none;">
          By Country
        </button>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" id="exposureQuery"
          placeholder="e.g. NVIDIA, Microsoft, Apple…"
          value="${prefilledStock || ''}"
          style="flex:1;max-width:200px;height:34px;background:var(--bg2);
                 border:1px solid var(--border);border-radius:var(--r);
                 color:var(--text);font-size:13px;font-weight:700;padding:0 10px;
                 outline:none;font-family:var(--mono);text-transform:uppercase;"
          oninput="this.value=this.value.toUpperCase()"
          onkeydown="if(event.key==='Enter')runExposureSearch()">
        <button onclick="runExposureSearch()"
          style="height:34px;padding:0 16px;font-size:11px;font-weight:700;
                 background:var(--blue);border:none;border-radius:var(--r);
                 cursor:pointer;color:#fff;outline:none;">
          Search
        </button>
      </div>
      <div style="font-size:10px;color:var(--dim);margin-top:8px;" id="expHint">
        Enter a company name (e.g. NVIDIA, Apple, Microsoft) to find ETFs that hold it, ranked by exposure weight.
      </div>
    </div>

    <!-- RESULTS -->
    <div id="exposureResults" style="flex:1;padding:16px;overflow-y:auto;">
      <div style="text-align:center;padding:60px 20px;color:var(--dim);font-size:11px;">
        Search for a stock ticker or country code above.
      </div>
    </div>`;

  document.body.appendChild(panel);
  panel._expMode = 'stock';

  if (prefilledStock) setTimeout(runExposureSearch, 100);
};

window.switchExpTab = function(mode) {
  const panel = document.getElementById('etfExposurePanel');
  if (!panel) return;
  panel._expMode = mode;

  const stockBtn   = document.getElementById('expTabStock');
  const countryBtn = document.getElementById('expTabCountry');
  const input      = document.getElementById('exposureQuery');
  const hint       = document.getElementById('expHint');

  const active   = 'border:1px solid var(--blue);background:rgba(59,130,246,0.15);color:var(--blue);';
  const inactive = 'border:1px solid var(--border);background:var(--bg3);color:var(--dim);';

  if (stockBtn)   stockBtn.style.cssText   += mode === 'stock'   ? active : inactive;
  if (countryBtn) countryBtn.style.cssText += mode === 'country' ? active : inactive;

  if (input) {
    input.placeholder = mode === 'stock' ? 'e.g. NVIDIA, Microsoft, Apple…' : 'e.g. US, JP, DE, GB…';
  }
  if (hint) {
    hint.textContent = mode === 'stock'
      ? 'Enter a company name (e.g. NVIDIA, Apple, Microsoft) to find ETFs that hold it.'
      : 'Enter a 2-letter country code (ISO 3166-1 alpha-2) to find ETFs with that exposure.';
  }

  document.getElementById('exposureResults').innerHTML =
    '<div style="text-align:center;padding:60px 20px;color:var(--dim);font-size:11px;">Search above.</div>';
};

window.runExposureSearch = async function() {
  const panel = document.getElementById('etfExposurePanel');
  if (!panel) return;
  const mode    = panel._expMode || 'stock';
  const query   = (document.getElementById('exposureQuery')?.value || '').trim().toUpperCase();
  const results = document.getElementById('exposureResults');
  if (!results || !query) return;

  results.innerHTML = `
    <div style="text-align:center;padding:60px 20px;color:var(--blue);font-size:11px;">
      <div class="mspinner"></div>
      <div style="margin-top:10px;">Searching…</div>
    </div>`;

  try {
    const url = mode === 'stock'
      ? `${MY_WORKER_URL}/api/etf-exposure?stock=${encodeURIComponent(query)}`
      : `${MY_WORKER_URL}/api/etf-exposure?country=${encodeURIComponent(query)}`;

    const res  = await fetch(url);
    const data = await res.json();

    if (data.error) {
      results.innerHTML = `<div style="padding:32px;text-align:center;color:var(--dim);
        font-size:11px;">${data.error}</div>`;
      return;
    }

    if (!data.etfs || data.etfs.length === 0) {
      results.innerHTML = `<div style="padding:32px;text-align:center;color:var(--dim);
        font-size:11px;">No ETFs found with exposure to <strong>${query}</strong>
        in the latest holdings data (${data.report_month}).</div>`;
      return;
    }

    const trendHtml = (data.trend || []).length > 1 ? `
      <div style="display:flex;gap:16px;margin-bottom:12px;">
        ${data.trend.map(t => `
          <div style="text-align:center;padding:6px 10px;background:var(--bg3);
                      border:1px solid var(--border);border-radius:var(--r);">
            <div style="font-size:9px;color:var(--dim);">${t.report_month}</div>
            <div style="font-size:12px;font-weight:700;color:var(--text);
                        font-family:var(--mono);">${t.fund_count} funds</div>
            <div style="font-size:10px;color:var(--dim);">
              avg ${(t.avg_weight||0).toFixed(2)}%
            </div>
          </div>`).join('')}
      </div>` : '';

    const rowsHtml = data.etfs.map((e, i) => {
      const weight = mode === 'stock'
        ? (e.weight_pct || 0).toFixed(2) + '%'
        : (e.country_weight || 0).toFixed(2) + '%';
      return `
        <tr style="border-top:1px solid var(--border);cursor:pointer;
                   background:${i%2===0?'var(--bg3)':'var(--bg2)'};"
            onclick="document.getElementById('etfExposurePanel').remove();
                     openEtfDetailView('${e.etf_ticker}', window.currentEtfsList||[])">
          <td style="padding:7px 8px;font-size:12px;font-weight:700;
                     color:var(--blue);font-family:var(--mono);">
            ${e.etf_ticker}
          </td>
          <td style="padding:7px 8px;font-size:11px;color:var(--text2);
                     max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
              title="${(e.etf_name||'').replace(/"/g,'&quot;')}">
            ${e.etf_name || '—'}
          </td>
          <td style="padding:7px 8px;font-size:10px;color:var(--dim);">
            ${e.asset_class || '—'}
          </td>
          <td style="padding:7px 8px;font-size:12px;font-weight:700;
                     font-family:var(--mono);text-align:right;color:var(--text);">
            ${weight}
          </td>
          <td style="padding:7px 8px;font-size:10px;color:var(--dim);
                     text-align:right;font-family:var(--mono);">
            ${fmtCompact(e.net_assets)}
          </td>
        </tr>`;
    }).join('');

    results.innerHTML = `
      <!-- SUMMARY -->
      <div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap;">
        <div style="padding:10px 14px;background:var(--bg3);border:1px solid var(--border);
                    border-radius:var(--r);text-align:center;">
          <div style="font-size:22px;font-weight:800;color:var(--blue);
                      font-family:var(--mono);">${data.total_funds_exposed}</div>
          <div style="font-size:10px;color:var(--dim);margin-top:2px;">ETFs Exposed</div>
        </div>
        <div style="padding:10px 14px;background:var(--bg3);border:1px solid var(--border);
                    border-radius:var(--r);text-align:center;">
          <div style="font-size:22px;font-weight:800;color:var(--text);
                      font-family:var(--mono);">${fmtCompact(data.total_assets_exposed)}</div>
          <div style="font-size:10px;color:var(--dim);margin-top:2px;">Total Fund Assets</div>
        </div>
        <div style="padding:10px 14px;background:var(--bg3);border:1px solid var(--border);
                    border-radius:var(--r);">
          <div style="font-size:10px;color:var(--dim);margin-bottom:2px;">As of</div>
          <div style="font-size:13px;font-weight:700;color:var(--text);">
            ${data.report_month}
          </div>
        </div>
      </div>

      <!-- TREND -->
      ${trendHtml}

      <!-- RESULTS TABLE -->
      <div style="overflow:auto;border:1px solid var(--border);border-radius:var(--r);">
        <table style="width:100%;border-collapse:collapse;">
          <thead style="background:var(--bg3);">
            <tr>
              <th style="padding:6px 8px;text-align:left;font-size:9px;font-weight:600;
                         color:var(--dim);text-transform:uppercase;letter-spacing:.05em;">Ticker</th>
              <th style="padding:6px 8px;text-align:left;font-size:9px;font-weight:600;
                         color:var(--dim);text-transform:uppercase;letter-spacing:.05em;">Name</th>
              <th style="padding:6px 8px;text-align:left;font-size:9px;font-weight:600;
                         color:var(--dim);text-transform:uppercase;letter-spacing:.05em;">Class</th>
              <th style="padding:6px 8px;text-align:right;font-size:9px;font-weight:600;
                         color:var(--dim);text-transform:uppercase;letter-spacing:.05em;">
                ${mode === 'stock' ? 'Weight' : 'Country %'}</th>
              <th style="padding:6px 8px;text-align:right;font-size:9px;font-weight:600;
                         color:var(--dim);text-transform:uppercase;letter-spacing:.05em;">AUM</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;

  } catch(e) {
    results.innerHTML = `<div style="padding:32px;text-align:center;color:var(--dim);
      font-size:11px;">Error: ${e.message}</div>`;
  }
};

// ── Universe Change Monitor ────────────────────────────────────
window.openUniverseMonitor = function() {
  document.getElementById('etfUniversePanel')?.remove();

  const panel = document.createElement('div');
  panel.id = 'etfUniversePanel';
  panel.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;' +
    'z-index:1001;background:var(--bg);overflow-y:auto;display:flex;flex-direction:column;';

  panel.innerHTML = `
    <style>#etfUniversePanel * { box-sizing: border-box; }</style>

    <!-- TOP BAR -->
    <div style="display:flex;align-items:center;justify-content:space-between;
                padding:10px 16px;border-bottom:1px solid var(--border);
                flex-shrink:0;background:var(--bg3);">
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text);">Universe Change Monitor</div>
        <div style="font-size:10px;color:var(--dim);margin-top:1px;">
          Portfolio rotation across all ETFs — month over month
        </div>
      </div>
      <button onclick="document.getElementById('etfUniversePanel').remove()"
        style="background:none;border:1px solid var(--border);border-radius:var(--r);
               padding:4px 10px;cursor:pointer;color:var(--text2);font-size:11px;
               font-weight:600;outline:none;"
        onmouseenter="this.style.borderColor='var(--red)';this.style.color='var(--red)'"
        onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text2)'">
        ✕ Close
      </button>
    </div>

    <!-- SCOPE SELECTOR -->
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);
                background:var(--bg3);flex-shrink:0;display:flex;gap:8px;align-items:center;
                flex-wrap:wrap;">
      <span style="font-size:11px;color:var(--dim);">Scope:</span>
      <div style="display:flex;gap:4px;">
        <button id="uniScopeAll" onclick="setUniverseScope('universe')"
          style="padding:3px 10px;font-size:10px;font-weight:600;border-radius:20px;
                 cursor:pointer;border:1px solid var(--blue);
                 background:rgba(59,130,246,0.15);color:var(--blue);outline:none;">
          All ETFs
        </button>
        <button id="uniScopeIssuer" onclick="setUniverseScope('issuer')"
          style="padding:3px 10px;font-size:10px;font-weight:600;border-radius:20px;
                 cursor:pointer;border:1px solid var(--border);
                 background:var(--bg3);color:var(--dim);outline:none;">
          By Issuer
        </button>
      </div>
      <input type="text" id="uniIssuerInput"
        placeholder="Issuer name (e.g. iShares, ARK)"
        style="display:none;height:28px;background:var(--bg2);border:1px solid var(--border);
               border-radius:var(--r);color:var(--text);font-size:11px;padding:0 8px;
               outline:none;width:180px;"
        onkeydown="if(event.key==='Enter')loadUniverseChanges()">
      <button onclick="loadUniverseChanges()"
        style="height:28px;padding:0 12px;font-size:11px;font-weight:700;
               background:var(--blue);border:none;border-radius:var(--r);
               cursor:pointer;color:#fff;outline:none;">
        Load
      </button>
    </div>

    <!-- RESULTS -->
    <div id="universeResults" style="flex:1;padding:16px;overflow-y:auto;">
      <div style="text-align:center;padding:60px 20px;color:var(--dim);font-size:11px;">
        Click Load to see portfolio rotation across the universe.
      </div>
    </div>`;

  document.body.appendChild(panel);
  panel._scope = 'universe';
};

window.setUniverseScope = function(scope) {
  const panel = document.getElementById('etfUniversePanel');
  if (!panel) return;
  panel._scope = scope;

  const allBtn      = document.getElementById('uniScopeAll');
  const issuerBtn   = document.getElementById('uniScopeIssuer');
  const issuerInput = document.getElementById('uniIssuerInput');

  const active   = 'border:1px solid var(--blue);background:rgba(59,130,246,0.15);color:var(--blue);';
  const inactive = 'border:1px solid var(--border);background:var(--bg3);color:var(--dim);';

  if (allBtn)    allBtn.style.cssText    += scope === 'universe' ? active : inactive;
  if (issuerBtn) issuerBtn.style.cssText += scope === 'issuer'   ? active : inactive;
  if (issuerInput) issuerInput.style.display = scope === 'issuer' ? 'block' : 'none';
};

window.loadUniverseChanges = async function() {
  const panel   = document.getElementById('etfUniversePanel');
  const results = document.getElementById('universeResults');
  if (!panel || !results) return;

  const scope  = panel._scope || 'universe';
  const issuer = scope === 'issuer'
    ? (document.getElementById('uniIssuerInput')?.value || '').trim()
    : null;

  results.innerHTML = `
    <div style="text-align:center;padding:60px 20px;color:var(--blue);font-size:11px;">
      <div class="mspinner"></div>
      <div style="margin-top:10px;">Analysing portfolio rotation…</div>
    </div>`;

  try {
    let url = `${MY_WORKER_URL}/api/universe-changes?scope=${scope}`;
    if (issuer) url += `&issuer=${encodeURIComponent(issuer)}`;

    const res  = await fetch(url);
    const data = await res.json();

    if (data.error === 'insufficient_data') {
      results.innerHTML = `<div style="padding:32px;text-align:center;color:var(--dim);
        font-size:11px;">
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px;">
          Not enough data yet
        </div>
        Need at least 2 months of holdings across the universe.
        The pipeline runs every 2 hours — check back soon.
      </div>`;
      return;
    }

    const periodLabel = `${data.previous_month} → ${data.current_month}`;
    const stats = data.universe_stats || {};

    const sectionHtml = (title, rows, cols, emptyMsg) => {
      if (!rows || !rows.length) return `
        <div style="margin-bottom:16px;">
          <div style="font-size:10px;font-weight:600;color:var(--text2);
                      text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">
            ${title}
          </div>
          <div style="color:var(--dim);font-size:11px;padding:12px;
                      background:var(--bg3);border-radius:var(--r);">
            ${emptyMsg || 'None'}
          </div>
        </div>`;

      const headerHtml = cols.map(c =>
        `<th style="padding:6px 8px;text-align:${c.right?'right':'left'};font-size:9px;
                    font-weight:600;color:var(--dim);text-transform:uppercase;
                    letter-spacing:.05em;white-space:nowrap;">${c.label}</th>`
      ).join('');

      const rowsHtml = rows.map((r,i) =>
        `<tr style="border-top:1px solid var(--border);
                    background:${i%2===0?'var(--bg3)':'var(--bg2)'};">
          ${cols.map(c =>
            `<td style="padding:6px 8px;font-size:11px;
                        text-align:${c.right?'right':'left'};
                        ${c.mono?'font-family:var(--mono);':''}
                        ${c.dim?'color:var(--dim);':'color:var(--text);'}
                        white-space:nowrap;overflow:hidden;
                        text-overflow:ellipsis;max-width:${c.maxW||'180px'};">
              ${c.render(r)}
            </td>`
          ).join('')}
        </tr>`
      ).join('');

      return `
        <div style="margin-bottom:16px;">
          <div style="font-size:10px;font-weight:600;color:var(--text2);
                      text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">
            ${title}
            <span style="font-weight:400;color:var(--dim);">(${rows.length})</span>
          </div>
          <div style="overflow:auto;border:1px solid var(--border);border-radius:var(--r);">
            <table style="width:100%;border-collapse:collapse;">
              <thead style="background:var(--bg3);">
                <tr>${headerHtml}</tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>`;
    };

    const fmtChg = v => {
      if (v == null) return '—';
      const color = v > 0 ? 'var(--green,#22c55e)' : 'var(--red,#ef4444)';
      return `<span style="color:${color};font-weight:700;">
        ${v>0?'+':''}${v.toFixed(3)}%</span>`;
    };

    results.innerHTML = `
      <!-- HEADER -->
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
        <div style="padding:8px 14px;background:var(--bg3);border:1px solid var(--border);
                    border-radius:var(--r);">
          <div style="font-size:9px;color:var(--dim);">Period</div>
          <div style="font-size:13px;font-weight:700;color:var(--text);">${periodLabel}</div>
        </div>
        <div style="padding:8px 14px;background:var(--bg3);border:1px solid var(--border);
                    border-radius:var(--r);">
          <div style="font-size:9px;color:var(--dim);">ETFs Covered</div>
          <div style="font-size:18px;font-weight:800;color:var(--blue);
                      font-family:var(--mono);">${stats.etf_count || 0}</div>
        </div>
        <div style="padding:8px 14px;background:var(--bg3);border:1px solid var(--border);
                    border-radius:var(--r);">
          <div style="font-size:9px;color:var(--dim);">Total Holdings</div>
          <div style="font-size:18px;font-weight:800;color:var(--text);
                      font-family:var(--mono);">
            ${(stats.total_holdings||0).toLocaleString()}
          </div>
        </div>
        ${issuer ? `<div style="padding:8px 14px;background:rgba(59,130,246,0.1);
                    border:1px solid var(--blue);border-radius:var(--r);">
          <div style="font-size:9px;color:var(--dim);">Filtered by Issuer</div>
          <div style="font-size:12px;font-weight:700;color:var(--blue);">${issuer}</div>
        </div>` : ''}
      </div>

      ${sectionHtml('Most Widely Added', data.new_positions, [
        { label:'Security',   render: r => r.security_name||'—', maxW:'200px' },
        { label:'Ticker',     render: r => r.security_ticker||'—', mono:true, dim:true },
        { label:'# Funds',    render: r => r.fund_count||0, right:true, mono:true },
        { label:'Avg Weight', render: r => ((r.avg_weight||0).toFixed(3))+'%', right:true, mono:true },
        { label:'Type',       render: r => r.asset_cat||'—', dim:true },
      ])}

      ${sectionHtml('Most Widely Exited', data.exited_positions, [
        { label:'Security',   render: r => r.security_name||'—', maxW:'200px' },
        { label:'Ticker',     render: r => r.security_ticker||'—', mono:true, dim:true },
        { label:'# Funds',    render: r => r.fund_count||0, right:true, mono:true },
        { label:'Avg Wt',     render: r => ((r.avg_weight||0).toFixed(3))+'%', right:true, mono:true },
        { label:'Type',       render: r => r.asset_cat||'—', dim:true },
      ])}

      ${sectionHtml('Largest Aggregate Increases', data.top_increases, [
        { label:'Security',    render: r => r.security_name||'—', maxW:'200px' },
        { label:'Ticker',      render: r => r.security_ticker||'—', mono:true, dim:true },
        { label:'# Funds',     render: r => r.fund_count||0, right:true, mono:true },
        { label:'Total Δ',     render: r => fmtChg(r.total_change), right:true, mono:true },
        { label:'Avg Δ',       render: r => fmtChg(r.avg_change), right:true, mono:true },
      ])}

      ${sectionHtml('Largest Aggregate Decreases', data.top_decreases, [
        { label:'Security',    render: r => r.security_name||'—', maxW:'200px' },
        { label:'Ticker',      render: r => r.security_ticker||'—', mono:true, dim:true },
        { label:'# Funds',     render: r => r.fund_count||0, right:true, mono:true },
        { label:'Total Δ',     render: r => fmtChg(r.total_change), right:true, mono:true },
        { label:'Avg Δ',       render: r => fmtChg(r.avg_change), right:true, mono:true },
      ])}`;

  } catch(e) {
    results.innerHTML = `<div style="padding:32px;text-align:center;color:var(--dim);
      font-size:11px;">Error: ${e.message}</div>`;
  }
};

// ── Global exports ─────────────────────────────────────────────
window.openEtfHoldings   = openEtfHoldings;
window.openEtfDetailView = openEtfDetailView;
window.onEtfSelectChange = onEtfSelectChange;

/* --- ETF HOLDINGS N-PORT SCRIPT END --- */
