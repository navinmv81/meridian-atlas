# Meridian Atlas — Phase 0 Seed Fix (Cursor Prompt)

## HOW TO USE THIS IN CURSOR

1. Open your project folder in Cursor:
   `/Users/navinkumar/Desktop/MeridianAtlas/Refresh May 2026/June Refresh/ETF Refresh/`
2. Open `seed-etf-master.js` in the editor
3. Open Cursor chat (Cmd+L), make sure it has `seed-etf-master.js` in context
4. Paste everything below the divider into Cursor chat

---

## THE PROBLEM

The seed script `seed-etf-master.js` only produced 264 rows.
The correct output should be ~590 rows.

Root cause: the script processed Source B (ETF_META, ~269 ETFs) but did not
correctly process Source A (the Worker JSON array, ~430 ETFs with cik/series_id).

264 rows ≈ Source B size only. Source A records that don't exist in Source B
were never inserted.

---

## CONTEXT — TWO DATA SOURCES

### Source A — Worker JSON (~430 ETFs)
These are the ETFs currently hardcoded in the Cloudflare Worker.
Each has: `ticker`, `name`, `issuer`, `cik`, `series_id` (nullable), optional `notes`.

This is the FULL Source A array. Use this exactly:

```json
[
  {"ticker":"SPY","name":"SPDR S&P 500 ETF Trust","issuer":"State Street / SPDR S&P 500 ETF Trust","cik":"0000884394","series_id":null,"notes":"Unit Investment Trust (UIT). No N-PORT."},
  {"ticker":"QQQ","name":"Invesco QQQ Trust","issuer":"Invesco / Invesco QQQ Trust","cik":"0001067839","series_id":null,"notes":"Unit Investment Trust (UIT). No N-PORT."},
  {"ticker":"IVV","name":"iShares Core S&P 500 ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004297"},
  {"ticker":"VOO","name":"Vanguard S&P 500 ETF","issuer":"Vanguard / Vanguard Index Funds","cik":"0000052848","series_id":"S000002277"},
  {"ticker":"VTI","name":"Vanguard Total Stock Market ETF","issuer":"Vanguard / Vanguard Index Funds","cik":"0000052848","series_id":"S000002838"},
  {"ticker":"BRK.B","name":"Berkshire Hathaway Inc Class B","issuer":"Berkshire Hathaway","cik":null,"series_id":null,"notes":"Not an ETF — equity. No N-PORT."},
  {"ticker":"GLD","name":"SPDR Gold Shares","issuer":"State Street / SPDR Gold Trust","cik":"0001222333","series_id":null,"notes":"Grantor trust under the 1933 Act. No N-PORT."},
  {"ticker":"IAU","name":"iShares Gold Trust","issuer":"BlackRock / iShares Delaware Trust Sponsor LLC","cik":"0001278028","series_id":null,"notes":"Grantor trust under the 1933 Act. No N-PORT."},
  {"ticker":"SLV","name":"iShares Silver Trust","issuer":"BlackRock / iShares Delaware Trust Sponsor LLC","cik":"0001330568","series_id":null,"notes":"Grantor trust under the 1933 Act. No N-PORT."},
  {"ticker":"IBIT","name":"iShares Bitcoin Trust ETF","issuer":"BlackRock / iShares Bitcoin Trust ETF","cik":"0001980994","series_id":null,"notes":"Commodity trust (Bitcoin ETP) under the 1933 Act. No N-PORT."},
  {"ticker":"FBTC","name":"Fidelity Wise Origin Bitcoin Fund","issuer":"Fidelity","cik":"0001980176","series_id":null,"notes":"Commodity trust (Bitcoin ETP) under the 1933 Act. No N-PORT."},
  {"ticker":"BITB","name":"Bitwise Bitcoin ETF","issuer":"Bitwise","cik":"0001980245","series_id":null,"notes":"Commodity trust (Bitcoin ETP) under the 1933 Act. No N-PORT."},
  {"ticker":"ETHA","name":"iShares Ethereum Trust ETF","issuer":"BlackRock","cik":"0002027633","series_id":null,"notes":"Commodity trust (Ethereum ETP) under the 1933 Act. No N-PORT."},
  {"ticker":"USO","name":"United States Oil Fund LP","issuer":"USCF Investments","cik":"0001327977","series_id":null,"notes":"Commodity partnership (LP), not a 1940 Act fund. No N-PORT."},
  {"ticker":"UNG","name":"United States Natural Gas Fund LP","issuer":"USCF Investments","cik":"0001359838","series_id":null,"notes":"Commodity partnership (LP), not a 1940 Act fund. No N-PORT."},
  {"ticker":"DIA","name":"SPDR Dow Jones Industrial Average ETF Trust","issuer":"State Street","cik":"0001041014","series_id":null,"notes":"Unit Investment Trust (UIT). No N-PORT."},
  {"ticker":"MDY","name":"SPDR S&P MidCap 400 ETF Trust","issuer":"State Street","cik":"0000916132","series_id":null,"notes":"Unit Investment Trust (UIT). No N-PORT."},
  {"ticker":"AGG","name":"iShares Core U.S. Aggregate Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004362"},
  {"ticker":"BND","name":"Vanguard Total Bond Market ETF","issuer":"Vanguard / Vanguard Bond Index Funds","cik":"0000794105","series_id":"S000002564"},
  {"ticker":"LQD","name":"iShares iBoxx $ Investment Grade Corporate Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004359"},
  {"ticker":"HYG","name":"iShares iBoxx $ High Yield Corporate Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000014426"},
  {"ticker":"TLT","name":"iShares 20+ Year Treasury Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004356"},
  {"ticker":"IEF","name":"iShares 7-10 Year Treasury Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004358"},
  {"ticker":"SHY","name":"iShares 1-3 Year Treasury Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004357"},
  {"ticker":"TIP","name":"iShares TIPS Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004363"},
  {"ticker":"GOVT","name":"iShares U.S. Treasury Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000035919"},
  {"ticker":"MUB","name":"iShares National Muni Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000018861"},
  {"ticker":"EMB","name":"iShares JP Morgan USD Emerging Markets Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000019798"},
  {"ticker":"JNK","name":"SPDR Bloomberg High Yield Bond ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000019669"},
  {"ticker":"BIL","name":"SPDR Bloomberg 1-3 Month T-Bill ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000017326"},
  {"ticker":"SGOV","name":"iShares 0-3 Month Treasury Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000068768"},
  {"ticker":"SHV","name":"iShares Short Treasury Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000013694"},
  {"ticker":"MINT","name":"PIMCO Enhanced Short Maturity Active ETF","issuer":"PIMCO / PIMCO ETF Trust","cik":"0001450011","series_id":"S000026751"},
  {"ticker":"JPST","name":"JPMorgan Ultra-Short Income ETF","issuer":"J.P. Morgan / JPMorgan Exchange-Traded Fund Trust","cik":"0001485894","series_id":"S000054790"},
  {"ticker":"FLOT","name":"iShares Floating Rate Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000033136"},
  {"ticker":"BKLN","name":"Invesco Senior Loan ETF","issuer":"Invesco / Invesco Exchange-Traded Fund Trust","cik":"0001378872","series_id":"S000031053"},
  {"ticker":"SRLN","name":"SPDR Blackstone Senior Loan ETF","issuer":"State Street / SPDR Series Trust","cik":"0001516212","series_id":"S000033064"},
  {"ticker":"VCIT","name":"Vanguard Intermediate-Term Corporate Bond ETF","issuer":"Vanguard / Vanguard Bond Index Funds","cik":"0001021882","series_id":"S000026863"},
  {"ticker":"VCSH","name":"Vanguard Short-Term Corporate Bond ETF","issuer":"Vanguard / Vanguard Bond Index Funds","cik":"0001021882","series_id":"S000026862"},
  {"ticker":"BSV","name":"Vanguard Short-Term Bond ETF","issuer":"Vanguard / Vanguard Bond Index Funds","cik":"0000794105","series_id":"S000002563"},
  {"ticker":"BIV","name":"Vanguard Intermediate-Term Bond ETF","issuer":"Vanguard / Vanguard Bond Index Funds","cik":"0000794105","series_id":"S000002561"},
  {"ticker":"BLV","name":"Vanguard Long-Term Bond ETF","issuer":"Vanguard / Vanguard Bond Index Funds","cik":"0000794105","series_id":"S000002562"},
  {"ticker":"BNDX","name":"Vanguard Total International Bond ETF","issuer":"Vanguard / Vanguard Bond Index Funds","cik":"0001532203","series_id":"S000035729"},
  {"ticker":"VGSH","name":"Vanguard Short-Term Treasury ETF","issuer":"Vanguard / Vanguard Bond Index Funds","cik":"0001021882","series_id":"S000026859"},
  {"ticker":"VGIT","name":"Vanguard Intermediate-Term Treasury ETF","issuer":"Vanguard / Vanguard Bond Index Funds","cik":"0001021882","series_id":"S000026860"},
  {"ticker":"VGLT","name":"Vanguard Long-Term Treasury ETF","issuer":"Vanguard / Vanguard Bond Index Funds","cik":"0001021882","series_id":"S000026861"},
  {"ticker":"VTIP","name":"Vanguard Short-Term Inflation-Protected Securities ETF","issuer":"Vanguard / Vanguard Bond Index Funds","cik":"0000836906","series_id":"S000038501"},
  {"ticker":"MBB","name":"iShares MBS ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000013702"},
  {"ticker":"PFF","name":"iShares Preferred Stock & Income Securities ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000013499"},
  {"ticker":"IGSB","name":"iShares 1-5 Year Investment Grade Corporate Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000013697"},
  {"ticker":"IGIB","name":"iShares 5-10 Year Investment Grade Corporate Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000013698"},
  {"ticker":"IGLB","name":"iShares 10+ Year Investment Grade Corporate Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000026651"},
  {"ticker":"SHYG","name":"iShares 0-5 Year High Yield Corporate Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000042353"},
  {"ticker":"SLQD","name":"iShares 0-5 Year Investment Grade Corporate Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000042354"},
  {"ticker":"STIP","name":"iShares 0-5 Year TIPS Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000030481"},
  {"ticker":"IGOV","name":"iShares International Treasury Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000023614"},
  {"ticker":"NEAR","name":"BlackRock Short Maturity Bond ETF","issuer":"BlackRock / iShares Trust","cik":"0001524513","series_id":"S000037042"},
  {"ticker":"SJNK","name":"SPDR Bloomberg Short Term High Yield Bond ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000036414"},
  {"ticker":"SPAB","name":"SPDR Portfolio Aggregate Bond ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000017334"},
  {"ticker":"SPSB","name":"SPDR Portfolio Short Term Corporate Bond ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000019666"},
  {"ticker":"SPIB","name":"SPDR Portfolio Intermediate Term Corporate Bond ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000022923"},
  {"ticker":"SPTS","name":"SPDR Portfolio Short Term Treasury ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000019665"},
  {"ticker":"SPTI","name":"SPDR Portfolio Intermediate Term Treasury ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000017328"},
  {"ticker":"SPTL","name":"SPDR Portfolio Long Term Treasury ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000017329"},
  {"ticker":"HYD","name":"VanEck High Yield Muni ETF","issuer":"VanEck / VanEck ETF Trust","cik":"0001137360","series_id":"S000019193"},
  {"ticker":"JMST","name":"JPMorgan Ultra-Short Municipal Income ETF","issuer":"J.P. Morgan / JPMorgan Exchange-Traded Fund Trust","cik":"0001485894","series_id":"S000063269"},
  {"ticker":"BOXX","name":"Alpha Architect 1-3 Month Box ETF","issuer":"Alpha Architect / Empowered Funds LLC","cik":"0001592900","series_id":"S000077497"},
  {"ticker":"VTI","name":"Vanguard Total Stock Market ETF","issuer":"Vanguard / Vanguard Index Funds","cik":"0000052848","series_id":"S000002838"},
  {"ticker":"VOO","name":"Vanguard S&P 500 ETF","issuer":"Vanguard / Vanguard Index Funds","cik":"0000052848","series_id":"S000002277"},
  {"ticker":"VEA","name":"Vanguard FTSE Developed Markets ETF","issuer":"Vanguard / Vanguard Tax-Managed Funds","cik":"0000923202","series_id":"S000004386"},
  {"ticker":"VWO","name":"Vanguard FTSE Emerging Markets ETF","issuer":"Vanguard / Vanguard International Equity Index Funds","cik":"0000857489","series_id":"S000005786"},
  {"ticker":"VXUS","name":"Vanguard Total International Stock ETF","issuer":"Vanguard / Vanguard Total International Stock Index Fund","cik":"0000736054","series_id":"S000002932"},
  {"ticker":"VNQ","name":"Vanguard Real Estate ETF","issuer":"Vanguard / Vanguard Specialized Funds","cik":"0000734383","series_id":"S000002924"},
  {"ticker":"VIG","name":"Vanguard Dividend Appreciation ETF","issuer":"Vanguard / Vanguard Whitehall Funds","cik":"0000734383","series_id":"S000011322"},
  {"ticker":"VGK","name":"Vanguard FTSE Europe ETF","issuer":"Vanguard / Vanguard International Equity Index Funds","cik":"0000857489","series_id":"S000005787"},
  {"ticker":"VPL","name":"Vanguard FTSE Pacific ETF","issuer":"Vanguard / Vanguard International Equity Index Funds","cik":"0000857489","series_id":"S000005788"},
  {"ticker":"VSS","name":"Vanguard FTSE All-World ex-US Small-Cap ETF","issuer":"Vanguard / Vanguard International Equity Index Funds","cik":"0000857489","series_id":"S000025074"},
  {"ticker":"VNQI","name":"Vanguard Global ex-U.S. Real Estate ETF","issuer":"Vanguard / Vanguard Specialized Funds","cik":"0000857489","series_id":"S000030007"},
  {"ticker":"MGK","name":"Vanguard Mega Cap Growth ETF","issuer":"Vanguard / Vanguard Index Funds","cik":"0000052848","series_id":"S000019700"},
  {"ticker":"MGV","name":"Vanguard Mega Cap Value ETF","issuer":"Vanguard / Vanguard Index Funds","cik":"0000052848","series_id":"S000019699"},
  {"ticker":"VYD","name":"Vanguard High Dividend Yield ETF","issuer":"Vanguard / Vanguard Whitehall Funds","cik":"0000052848","series_id":"S000015197"},
  {"ticker":"EEM","name":"iShares MSCI Emerging Markets ETF","issuer":"BlackRock / iShares, Inc.","cik":"0000930667","series_id":"S000004260"},
  {"ticker":"EFA","name":"iShares MSCI EAFE ETF","issuer":"BlackRock / iShares, Inc.","cik":"0000930667","series_id":"S000004245"},
  {"ticker":"IEMG","name":"iShares Core MSCI Emerging Markets ETF","issuer":"BlackRock / iShares, Inc.","cik":"0000930667","series_id":"S000038923"},
  {"ticker":"ACWI","name":"iShares MSCI ACWI ETF","issuer":"BlackRock / iShares, Inc.","cik":"0001100663","series_id":"S000021461"},
  {"ticker":"EWJ","name":"iShares MSCI Japan ETF","issuer":"BlackRock / iShares, Inc.","cik":"0000930667","series_id":"S000004249"},
  {"ticker":"EWZ","name":"iShares MSCI Brazil ETF","issuer":"BlackRock / iShares, Inc.","cik":"0000930667","series_id":"S000004264"},
  {"ticker":"EWG","name":"iShares MSCI Germany ETF","issuer":"BlackRock / iShares, Inc.","cik":"0000930667","series_id":"S000004269"},
  {"ticker":"EWC","name":"iShares MSCI Canada ETF","issuer":"BlackRock / iShares, Inc.","cik":"0000930667","series_id":"S000004265"},
  {"ticker":"EWT","name":"iShares MSCI Taiwan ETF","issuer":"BlackRock / iShares, Inc.","cik":"0000930667","series_id":"S000004261"},
  {"ticker":"EWH","name":"iShares MSCI Hong Kong ETF","issuer":"BlackRock / iShares, Inc.","cik":"0000930667","series_id":"S000004247"},
  {"ticker":"EWA","name":"iShares MSCI Australia ETF","issuer":"BlackRock / iShares, Inc.","cik":"0000930667","series_id":"S000004246"},
  {"ticker":"EWY","name":"iShares MSCI South Korea ETF","issuer":"BlackRock / iShares, Inc.","cik":"0000930667","series_id":"S000004258"},
  {"ticker":"EWQ","name":"iShares MSCI France ETF","issuer":"BlackRock / iShares, Inc.","cik":"0000930667","series_id":"S000004267"},
  {"ticker":"EWP","name":"iShares MSCI Spain ETF","issuer":"BlackRock / iShares, Inc.","cik":"0000930667","series_id":"S000004256"},
  {"ticker":"EWI","name":"iShares MSCI Italy ETF","issuer":"BlackRock / iShares, Inc.","cik":"0000930667","series_id":"S000004248"},
  {"ticker":"EZU","name":"iShares MSCI Eurozone ETF","issuer":"BlackRock / iShares, Inc.","cik":"0000930667","series_id":"S000004268"},
  {"ticker":"EIDO","name":"iShares MSCI Indonesia ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000028553"},
  {"ticker":"ENZL","name":"iShares MSCI New Zealand ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000028554"},
  {"ticker":"EPOL","name":"iShares MSCI Poland ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000028556"},
  {"ticker":"EWZS","name":"iShares MSCI Brazil Small-Cap ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000028677"},
  {"ticker":"EPHE","name":"iShares MSCI Philippines ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000028735"},
  {"ticker":"ESGD","name":"iShares ESG Aware MSCI EAFE ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000054185"},
  {"ticker":"QAT","name":"iShares MSCI Qatar ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000045074"},
  {"ticker":"EEMV","name":"iShares MSCI Emerging Markets Min Vol Factor ETF","issuer":"BlackRock / iShares, Inc.","cik":"0000930667","series_id":"S000032497"},
  {"ticker":"EFAV","name":"iShares MSCI EAFE Min Vol Factor ETF","issuer":"BlackRock / iShares, Inc.","cik":"0001100663","series_id":"S000031837"},
  {"ticker":"XLK","name":"Technology Select Sector SPDR Fund","issuer":"State Street / The Select Sector SPDR Trust","cik":"0001064642","series_id":"S000004592"},
  {"ticker":"XLF","name":"Financial Select Sector SPDR Fund","issuer":"State Street / The Select Sector SPDR Trust","cik":"0001064642","series_id":"S000004596"},
  {"ticker":"XLV","name":"Health Care Select Sector SPDR Fund","issuer":"State Street / The Select Sector SPDR Trust","cik":"0001064642","series_id":"S000004593"},
  {"ticker":"XLE","name":"Energy Select Sector SPDR Fund","issuer":"State Street / The Select Sector SPDR Trust","cik":"0001064642","series_id":"S000004590"},
  {"ticker":"XLI","name":"Industrial Select Sector SPDR Fund","issuer":"State Street / The Select Sector SPDR Trust","cik":"0001064642","series_id":"S000004594"},
  {"ticker":"XLY","name":"Consumer Discretionary Select Sector SPDR Fund","issuer":"State Street / The Select Sector SPDR Trust","cik":"0001064642","series_id":"S000004589"},
  {"ticker":"XLP","name":"Consumer Staples Select Sector SPDR Fund","issuer":"State Street / The Select Sector SPDR Trust","cik":"0001064642","series_id":"S000004588"},
  {"ticker":"XLU","name":"Utilities Select Sector SPDR Fund","issuer":"State Street / The Select Sector SPDR Trust","cik":"0001064642","series_id":"S000004597"},
  {"ticker":"XLB","name":"Materials Select Sector SPDR Fund","issuer":"State Street / The Select Sector SPDR Trust","cik":"0001064642","series_id":"S000004591"},
  {"ticker":"XLRE","name":"Real Estate Select Sector SPDR Fund","issuer":"State Street / The Select Sector SPDR Trust","cik":"0001064642","series_id":"S000050927"},
  {"ticker":"XLC","name":"Communication Services Select Sector SPDR Fund","issuer":"State Street / The Select Sector SPDR Trust","cik":"0001064642","series_id":"S000061782"},
  {"ticker":"QQQ","name":"Invesco QQQ Trust","issuer":"Invesco / Invesco QQQ Trust","cik":"0001067839","series_id":null,"notes":"Unit Investment Trust (UIT). No N-PORT."},
  {"ticker":"QQQM","name":"Invesco NASDAQ 100 ETF","issuer":"Invesco / Invesco Exchange-Traded Fund Trust II","cik":"0001378872","series_id":"S000069448"},
  {"ticker":"RSP","name":"Invesco S&P 500 Equal Weight ETF","issuer":"Invesco / Invesco Exchange-Traded Fund Trust II","cik":"0001209466","series_id":"S000060812"},
  {"ticker":"PDBC","name":"Invesco Optimum Yield Diversified Commodity Strategy No K-1 ETF","issuer":"Invesco / Invesco Exchange-Traded Fund Trust II","cik":"0001595386","series_id":"S000044509"},
  {"ticker":"TAN","name":"Invesco Solar ETF","issuer":"Invesco / Invesco Exchange-Traded Fund Trust","cik":"0001378872","series_id":"S000060822"},
  {"ticker":"PEJ","name":"Invesco Dynamic Leisure and Entertainment ETF","issuer":"Invesco / Invesco Exchange-Traded Fund Trust","cik":"0001209466","series_id":"S000003028"},
  {"ticker":"RYT","name":"Invesco S&P 500 Equal Weight Technology ETF","issuer":"Invesco / Invesco Exchange-Traded Fund Trust II","cik":"0001482921","series_id":"S000009076"},
  {"ticker":"RYF","name":"Invesco S&P 500 Equal Weight Financials ETF","issuer":"Invesco / Invesco Exchange-Traded Fund Trust II","cik":"0001482921","series_id":"S000009072"},
  {"ticker":"RYH","name":"Invesco S&P 500 Equal Weight Health Care ETF","issuer":"Invesco / Invesco Exchange-Traded Fund Trust II","cik":"0001482921","series_id":"S000009075"},
  {"ticker":"SCHB","name":"Schwab U.S. Broad Market ETF","issuer":"Charles Schwab / Schwab Strategic Trust","cik":"0001454889","series_id":"S000026631"},
  {"ticker":"SCHX","name":"Schwab U.S. Large-Cap ETF","issuer":"Charles Schwab / Schwab Strategic Trust","cik":"0001454889","series_id":"S000026632"},
  {"ticker":"SCHF","name":"Schwab International Equity ETF","issuer":"Charles Schwab / Schwab Strategic Trust","cik":"0001454889","series_id":"S000026637"},
  {"ticker":"SCHE","name":"Schwab Emerging Markets Equity ETF","issuer":"Charles Schwab / Schwab Strategic Trust","cik":"0001454889","series_id":"S000026639"},
  {"ticker":"SCHD","name":"Schwab U.S. Dividend Equity ETF","issuer":"Charles Schwab / Schwab Strategic Trust","cik":"0001454889","series_id":"S000034163"},
  {"ticker":"SCHG","name":"Schwab U.S. Large-Cap Growth ETF","issuer":"Charles Schwab / Schwab Strategic Trust","cik":"0001454889","series_id":"S000026633"},
  {"ticker":"SCHV","name":"Schwab U.S. Large-Cap Value ETF","issuer":"Charles Schwab / Schwab Strategic Trust","cik":"0001454889","series_id":"S000026634"},
  {"ticker":"SCHA","name":"Schwab U.S. Small-Cap ETF","issuer":"Charles Schwab / Schwab Strategic Trust","cik":"0001454889","series_id":"S000026636"},
  {"ticker":"SCHM","name":"Schwab U.S. Mid-Cap ETF","issuer":"Charles Schwab / Schwab Strategic Trust","cik":"0001454889","series_id":"S000026635"},
  {"ticker":"SCHP","name":"Schwab U.S. TIPS ETF","issuer":"Charles Schwab / Schwab Strategic Trust","cik":"0001454889","series_id":"S000029407"},
  {"ticker":"SCHI","name":"Schwab 5-10 Year Corporate Bond ETF","issuer":"Charles Schwab / Schwab Strategic Trust","cik":"0001454889","series_id":"S000066661"},
  {"ticker":"GDX","name":"VanEck Gold Miners ETF","issuer":"VanEck / VanEck ETF Trust","cik":"0001137360","series_id":"S000009191"},
  {"ticker":"GDXJ","name":"VanEck Junior Gold Miners ETF","issuer":"VanEck / VanEck ETF Trust","cik":"0001137360","series_id":"S000026955"},
  {"ticker":"SMH","name":"VanEck Semiconductor ETF","issuer":"VanEck / VanEck ETF Trust","cik":"0001137360","series_id":"S000034411"},
  {"ticker":"OIH","name":"VanEck Oil Services ETF","issuer":"VanEck / VanEck ETF Trust","cik":"0001137360","series_id":"S000034408"},
  {"ticker":"PPH","name":"VanEck Pharmaceutical ETF","issuer":"VanEck / VanEck ETF Trust","cik":"0001137360","series_id":"S000034409"},
  {"ticker":"HYD","name":"VanEck High Yield Muni ETF","issuer":"VanEck / VanEck ETF Trust","cik":"0001137360","series_id":"S000019193"},
  {"ticker":"REMX","name":"VanEck Rare Earth and Strategic Metals ETF","issuer":"VanEck / VanEck ETF Trust","cik":"0001137360","series_id":"S000030045"},
  {"ticker":"ARKK","name":"ARK Innovation ETF","issuer":"ARK / ARK ETF Trust","cik":"0001579982","series_id":"S000042977"},
  {"ticker":"ARKG","name":"ARK Genomic Revolution ETF","issuer":"ARK / ARK ETF Trust","cik":"0001579982","series_id":"S000042975"},
  {"ticker":"ARKW","name":"ARK Next Generation Internet ETF","issuer":"ARK / ARK ETF Trust","cik":"0001579982","series_id":"S000042978"},
  {"ticker":"ARKF","name":"ARK Fintech Innovation ETF","issuer":"ARK / ARK ETF Trust","cik":"0001579982","series_id":"S000064752"},
  {"ticker":"ARKQ","name":"ARK Autonomous Technology & Robotics ETF","issuer":"ARK / ARK ETF Trust","cik":"0001579982","series_id":"S000042976"},
  {"ticker":"TQQQ","name":"ProShares UltraPro QQQ","issuer":"ProShares / ProShares Trust","cik":"0001174610","series_id":"S000024908"},
  {"ticker":"SQQQ","name":"ProShares UltraPro Short QQQ","issuer":"ProShares / ProShares Trust","cik":"0001174610","series_id":"S000024909"},
  {"ticker":"UPRO","name":"ProShares UltraPro S&P 500","issuer":"ProShares / ProShares Trust","cik":"0001174610","series_id":"S000024919"},
  {"ticker":"UVXY","name":"ProShares Ultra VIX Short-Term Futures ETF","issuer":"ProShares / ProShares Trust","cik":"0001174922","series_id":"S000033198"},
  {"ticker":"SVXY","name":"ProShares Short VIX Short-Term Futures ETF","issuer":"ProShares / ProShares Trust","cik":"0001174922","series_id":"S000033197"},
  {"ticker":"SPXS","name":"Direxion Daily S&P 500 Bear 3X Shares","issuer":"Direxion / Direxion Shares ETF Trust","cik":"0001424958","series_id":"S000022765"},
  {"ticker":"SPXL","name":"Direxion Daily S&P 500 Bull 3X Shares","issuer":"Direxion / Direxion Shares ETF Trust","cik":"0001424958","series_id":"S000022767"},
  {"ticker":"SOXL","name":"Direxion Daily Semiconductor Bull 3X Shares","issuer":"Direxion / Direxion Shares ETF Trust","cik":"0001424958","series_id":"S000027920"},
  {"ticker":"SOXS","name":"Direxion Daily Semiconductor Bear 3X Shares","issuer":"Direxion / Direxion Shares ETF Trust","cik":"0001424958","series_id":"S000027921"},
  {"ticker":"TNA","name":"Direxion Daily Small Cap Bull 3X Shares","issuer":"Direxion / Direxion Shares ETF Trust","cik":"0001424958","series_id":"S000022786"},
  {"ticker":"TZA","name":"Direxion Daily Small Cap Bear 3X Shares","issuer":"Direxion / Direxion Shares ETF Trust","cik":"0001424958","series_id":"S000022770"},
  {"ticker":"FAS","name":"Direxion Daily Financial Bull 3X Shares","issuer":"Direxion / Direxion Shares ETF Trust","cik":"0001424958","series_id":"S000022761"},
  {"ticker":"FAZ","name":"Direxion Daily Financial Bear 3X Shares","issuer":"Direxion / Direxion Shares ETF Trust","cik":"0001424958","series_id":"S000022781"},
  {"ticker":"LABU","name":"Direxion Daily S&P Biotech Bull 3X Shares","issuer":"Direxion / Direxion Shares ETF Trust","cik":"0001424958","series_id":"S000049373"},
  {"ticker":"LABD","name":"Direxion Daily S&P Biotech Bear 3X Shares","issuer":"Direxion / Direxion Shares ETF Trust","cik":"0001424958","series_id":"S000049374"},
  {"ticker":"MSOS","name":"AdvisorShares Pure US Cannabis ETF","issuer":"AdvisorShares / AdvisorShares Trust","cik":"0001408970","series_id":"S000066948"},
  {"ticker":"JEPI","name":"JPMorgan Equity Premium Income ETF","issuer":"J.P. Morgan / JPMorgan Exchange-Traded Fund Trust","cik":"0001485894","series_id":"S000068402"},
  {"ticker":"JEPQ","name":"JPMorgan Nasdaq Equity Premium Income ETF","issuer":"J.P. Morgan / JPMorgan Exchange-Traded Fund Trust","cik":"0001485894","series_id":"S000076132"},
  {"ticker":"PAVE","name":"Global X U.S. Infrastructure Development ETF","issuer":"Global X / Global X Funds","cik":"0001432353","series_id":"S000056509"},
  {"ticker":"CLOU","name":"Global X Cloud Computing ETF","issuer":"Global X / Global X Funds","cik":"0001432353","series_id":"S000065121"},
  {"ticker":"BOTZ","name":"Global X Robotics & Artificial Intelligence ETF","issuer":"Global X / Global X Funds","cik":"0001432353","series_id":"S000054693"},
  {"ticker":"LIT","name":"Global X Lithium & Battery Tech ETF","issuer":"Global X / Global X Funds","cik":"0001432353","series_id":"S000029441"},
  {"ticker":"CIBR","name":"First Trust NASDAQ Cybersecurity ETF","issuer":"First Trust / First Trust Exchange-Traded Fund VI","cik":"0001364608","series_id":"S000050385"},
  {"ticker":"FDN","name":"First Trust Dow Jones Internet Index Fund","issuer":"First Trust / First Trust Exchange-Traded Fund II","cik":"0001329377","series_id":"S000012479"},
  {"ticker":"FAN","name":"First Trust Global Wind Energy ETF","issuer":"First Trust / First Trust Exchange-Traded Fund IV","cik":"0001364608","series_id":"S000022933"},
  {"ticker":"FTEC","name":"Fidelity MSCI Information Technology Index ETF","issuer":"Fidelity / Fidelity Covington Trust","cik":"0000945908","series_id":"S000042577"},
  {"ticker":"FHLC","name":"Fidelity MSCI Health Care Index ETF","issuer":"Fidelity / Fidelity Covington Trust","cik":"0000945908","series_id":"S000042575"},
  {"ticker":"FIDU","name":"Fidelity MSCI Industrials Index ETF","issuer":"Fidelity / Fidelity Covington Trust","cik":"0000945908","series_id":"S000042576"},
  {"ticker":"FNCL","name":"Fidelity MSCI Financials Index ETF","issuer":"Fidelity / Fidelity Covington Trust","cik":"0000945908","series_id":"S000042574"},
  {"ticker":"FENY","name":"Fidelity MSCI Energy Index ETF","issuer":"Fidelity / Fidelity Covington Trust","cik":"0000945908","series_id":"S000042573"},
  {"ticker":"ONEQ","name":"Fidelity Nasdaq Composite Index ETF","issuer":"Fidelity / Fidelity Commonwealth Trust","cik":"0000205323","series_id":"S000006011"},
  {"ticker":"ICLN","name":"iShares Global Clean Energy ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000022498"},
  {"ticker":"CNRG","name":"SPDR S&P Kensho Clean Power ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000063360"},
  {"ticker":"AMLP","name":"Alerian MLP ETF","issuer":"SS&C ALPS / ALPS ETF Trust","cik":"0001414040","series_id":"S000029786"},
  {"ticker":"GNR","name":"SPDR S&P Global Natural Resources ETF","issuer":"State Street / SPDR Series Trust","cik":"0001168164","series_id":"S000030037"},
  {"ticker":"XAR","name":"SPDR S&P Aerospace & Defense ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000012318"},
  {"ticker":"XME","name":"SPDR S&P Metals & Mining ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000012333"},
  {"ticker":"XOP","name":"SPDR S&P Oil & Gas Exploration & Production ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000012319"},
  {"ticker":"XRT","name":"SPDR S&P Retail ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000012322"},
  {"ticker":"XHB","name":"SPDR S&P Homebuilders ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000010019"},
  {"ticker":"KRE","name":"SPDR S&P Regional Banking ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000012325"},
  {"ticker":"KBE","name":"SPDR S&P Bank ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000006977"},
  {"ticker":"XES","name":"SPDR S&P Oil & Gas Equipment & Services ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000012334"},
  {"ticker":"SPEM","name":"SPDR Portfolio Emerging Markets ETF","issuer":"State Street / SPDR Series Trust","cik":"0001168164","series_id":"S000014048"},
  {"ticker":"SPDW","name":"SPDR Portfolio Developed World ex-US ETF","issuer":"State Street / SPDR Series Trust","cik":"0001168164","series_id":"S000014038"},
  {"ticker":"SPYD","name":"SPDR Portfolio S&P 500 High Dividend ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000050968"},
  {"ticker":"SPYV","name":"SPDR Portfolio S&P 500 Value ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000006985"},
  {"ticker":"SPYX","name":"SPDR S&P 500 Fossil Fuel Reserves Free ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000051701"},
  {"ticker":"SPLG","name":"SPDR Portfolio S&P 500 ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000006987"},
  {"ticker":"SDY","name":"SPDR S&P Dividend ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000006981"},
  {"ticker":"SPYG","name":"SPDR Portfolio S&P 500 Growth ETF","issuer":"State Street / SPDR Series Trust","cik":"0001064642","series_id":"S000006984"},
  {"ticker":"IWM","name":"iShares Russell 2000 ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004314"},
  {"ticker":"IWF","name":"iShares Russell 1000 Growth ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004309"},
  {"ticker":"IWD","name":"iShares Russell 1000 Value ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004310"},
  {"ticker":"IWB","name":"iShares Russell 1000 ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004307"},
  {"ticker":"IWR","name":"iShares Russell Mid-Cap ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004316"},
  {"ticker":"IWS","name":"iShares Russell Mid-Cap Value ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004317"},
  {"ticker":"IWP","name":"iShares Russell Mid-Cap Growth ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004315"},
  {"ticker":"IJH","name":"iShares Core S&P Mid-Cap ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004299"},
  {"ticker":"IJR","name":"iShares Core S&P Small-Cap ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004300"},
  {"ticker":"IVW","name":"iShares S&P 500 Growth ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004311"},
  {"ticker":"IVE","name":"iShares S&P 500 Value ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004312"},
  {"ticker":"QUAL","name":"iShares MSCI USA Quality Factor ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000041444"},
  {"ticker":"MTUM","name":"iShares MSCI USA Momentum Factor ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000040316"},
  {"ticker":"VLUE","name":"iShares MSCI USA Value Factor ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000040205"},
  {"ticker":"USMV","name":"iShares MSCI USA Min Vol Factor ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000031838"},
  {"ticker":"DGRO","name":"iShares Core Dividend Growth ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000045648"},
  {"ticker":"HDV","name":"iShares Core High Dividend ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000031844"},
  {"ticker":"DVY","name":"iShares Select Dividend ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004334"},
  {"ticker":"IYR","name":"iShares U.S. Real Estate ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004328"},
  {"ticker":"IYW","name":"iShares U.S. Technology ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004329"},
  {"ticker":"IYH","name":"iShares U.S. Healthcare ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004324"},
  {"ticker":"IYF","name":"iShares U.S. Financials ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004323"},
  {"ticker":"IYE","name":"iShares U.S. Energy ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004321"},
  {"ticker":"IYT","name":"iShares Transportation Average ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000004331"},
  {"ticker":"IAI","name":"iShares U.S. Broker-Dealers & Securities Exchanges ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000009420"},
  {"ticker":"IAK","name":"iShares U.S. Insurance ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000009421"},
  {"ticker":"IHI","name":"iShares U.S. Medical Devices ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000009419"},
  {"ticker":"IHF","name":"iShares U.S. Healthcare Providers ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000009418"},
  {"ticker":"IYLD","name":"iShares Morningstar Multi-Asset Income ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000036830"},
  {"ticker":"AOA","name":"iShares Core Aggressive Allocation ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000023588"},
  {"ticker":"AOM","name":"iShares Core Moderate Allocation ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000023586"},
  {"ticker":"AOK","name":"iShares Core Conservative Allocation ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000023585"},
  {"ticker":"AOR","name":"iShares Core Growth Allocation ETF","issuer":"BlackRock / iShares Trust","cik":"0001100663","series_id":"S000023587"},
  {"ticker":"DGRW","name":"WisdomTree U.S. Quality Dividend Growth Fund","issuer":"WisdomTree / WisdomTree Trust","cik":"0001350487","series_id":"S000040816"},
  {"ticker":"DLN","name":"WisdomTree U.S. LargeCap Dividend Fund","issuer":"WisdomTree / WisdomTree Trust","cik":"0001350487","series_id":"S000012392"},
  {"ticker":"AVUV","name":"Avantis U.S. Small Cap Value ETF","issuer":"Avantis / American Century ETF Trust","cik":"0001710607","series_id":"S000066459"},
  {"ticker":"AVDV","name":"Avantis International Small Cap Value ETF","issuer":"Avantis / American Century ETF Trust","cik":"0001710607","series_id":"S000066457"},
  {"ticker":"AVEM","name":"Avantis Emerging Markets Equity ETF","issuer":"Avantis / American Century ETF Trust","cik":"0001710607","series_id":"S000066454"},
  {"ticker":"DFAC","name":"Dimensional U.S. Core Equity 2 ETF","issuer":"Dimensional / Dimensional ETF Trust","cik":"0001816125","series_id":"S000070903"},
  {"ticker":"DFAU","name":"Dimensional US Equity ETF","issuer":"Dimensional / Dimensional ETF Trust","cik":"0001816125","series_id":"S000069432"},
  {"ticker":"DFAI","name":"Dimensional International Core Equity Market ETF","issuer":"Dimensional / Dimensional ETF Trust","cik":"0001816125","series_id":"S000069433"},
  {"ticker":"DFAE","name":"Dimensional Emerging Core Equity Market ETF","issuer":"Dimensional / Dimensional ETF Trust","cik":"0001816125","series_id":"S000069434"},
  {"ticker":"CALF","name":"Pacer US Small Cap Cash Cows 100 ETF","issuer":"Pacer / Pacer Funds Trust","cik":"0001616668","series_id":"S000055468"},
  {"ticker":"COWZ","name":"Pacer US Cash Cows 100 ETF","issuer":"Pacer / Pacer Funds Trust","cik":"0001616668","series_id":"S000055466"},
  {"ticker":"EZBC","name":"Franklin Bitcoin ETF","issuer":"Franklin Templeton","cik":"0001980242","series_id":null,"notes":"Commodity trust (Bitcoin ETP) under the 1933 Act. No N-PORT."},
  {"ticker":"FETH","name":"Fidelity Ethereum Fund","issuer":"Fidelity","cik":"0002024173","series_id":null,"notes":"Commodity trust (Ethereum ETP) under the 1933 Act. No N-PORT."},
  {"ticker":"DBO","name":"Invesco DB Oil Fund","issuer":"Invesco / DB Commodity Services LLC","cik":"0001383312","series_id":null,"notes":"Commodity limited partnership. No N-PORT."}
]
```

---

## THE FIX REQUIRED

Rewrite `seed-etf-master.js` so that it correctly processes BOTH sources.

### Merge logic (exact rules):

Start with all tickers from Source A. Then add any tickers from Source B not already in Source A.

For each merged row:
- `ticker` → Source A ticker (PK). If Source B only: use Source B key.
- `name` → Source A `name`. If Source B only: use ticker string as name.
- `issuer` → Source A `issuer` (full form). If Source B only: null.
- `asset_class` → Source B `ETF_META[ticker].assetClass` if exists, else null.
- `index_name` → Source B `ETF_META[ticker].index` if exists, else null.
- `cik` → Source A `cik`. If Source B only: null.
- `series_id` → Source A `series_id`. If Source B only: null.
- `has_nport` → 0 if `series_id` is null OR `notes` is present, else 1.
- `coverage_status` → `'deep'` if `has_nport = 1`, else `'directory'`.
- `net_assets` → NULL always (Phase 1 populates this).
- `notes` → Source A `notes` if present, else NULL.

### Expected output summary:
```
Total rows:                    ~430 (Source A) + ~160 (Source B only) = ~590
With asset_class:              ~269 (all Source B tickers)
With series_id:                ~410 (Source A tickers with series_id not null)
has_nport = 0 (no N-PORT):    ~20  (UITs, trusts, crypto, commodity LPs)
```

### Output file: `seed-data.sql`
Use `INSERT OR REPLACE INTO etf_master` statements.
Escape all single quotes in string values (replace `'` with `''`).
NULL values should be the SQL keyword NULL, not the string 'null'.

### Run instructions (print at end of script):
```
node seed-etf-master.js
wrangler d1 execute meridian-etf --file=seed-data.sql
```

---

## CONSTRAINTS

- Only fix `seed-etf-master.js` and regenerate `seed-data.sql`
- Do not touch `schema.sql`, `Cloudflare.txt`, or `wrangler.toml`
- Do not run any wrangler commands — output the files only
- The existing `schema.sql` already has the correct table definition — just generate valid INSERTs for it
