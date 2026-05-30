/* ============================================================
   ma-etf.js — Meridian Atlas
   ETF Holdings (N-PORT) feature: openEtfHoldings, onEtfSelectChange
   Globals needed: MY_WORKER_URL, showModal, closeModal, openBySymbol
   ============================================================ */

/* --- ETF HOLDINGS N-PORT SCRIPT START --- */
/**
 * ETF Holdings (N-PORT) Feature Flow & Design:
 * 
 * 1. Initialise: Clicking "ETF Holdings" opens the `#ov` modal overlay and populates
 *    the dropdown selector by making a GET request to `/api/etf-list` on the Cloudflare Worker.
 * 2. Lookup & Routing: When the user selects a ticker, `onEtfSelectChange()` is triggered:
 *    - It queries GET `/api/etf-holdings?symbol={ticker}`.
 *    - The Cloudflare Worker maps the ticker to its CIK and Series ID.
 *    - If the ETF lacks a `series_id` (e.g. grantor trusts like GLD/SLV), the Worker yields a 400 NO_NPORT.
 * 3. SEC Query & Parse: If a valid Series ID is found, the Worker:
 *    - Searches the SEC Full-Text Search (EFTS) endpoint for `forms=NPORT-P`.
 *    - Fetches the latest primary N-PORT XML document (`primary_doc.xml`) using a compliant User-Agent.
 *    - Parses issuer name, ticker, CUSIP, shares, value USD, and weight % using robust XML regex tags.
 * 4. Caching & Display: Parsed JSON responses are cached at the Cloudflare Edge for 24 hours (`Cache-Control: s-maxage=86400`)
 *    to comply with SEC rate limits and ensure lightning-fast subsequent loads.
 * 5. Interactivity: Clicking a holding's ticker symbol inside the high-density table closes the modal
 *    and seamlessly reloads the main terminal layout with that selected symbol using `openBySymbol()`.
 */
async function openEtfHoldings() {
  const modalHtml = `
    <div class="mhdr">
      <div>
        <div class="mtitle">ETF Holdings (N-PORT)</div>
        <div class="msub">Analyze institutional portfolio disclosures of top-traded ETFs</div>
      </div>
      <button class="mclose" onclick="closeModal()">✕</button>
    </div>

    <div class="etf-selector-row" style="margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 11px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: .06em;">Select ETF:</span>
      <select id="etfSelect" class="btn" style="flex: 1; text-align: left; height: 28px; background: var(--bg3); border: 1px solid var(--border); font-size: 11px; padding: 2px 8px; border-radius: var(--r); outline: none; color: var(--text);" onchange="onEtfSelectChange()">
        <option value="">-- Choose an ETF --</option>
      </select>
    </div>

    <div id="etfHoldingsContent">
      <div style="text-align: center; padding: 40px 20px; color: var(--muted); font-size: 11.5px; background: var(--bg3); border-radius: var(--r); border: 1px solid var(--border);">
        Select an ETF from the list to view its latest SEC Form N-PORT holdings.
      </div>
    </div>`;

  showModal(modalHtml);

  const select = document.getElementById("etfSelect");
  if (!select) return;

  let etfs = null;
  try {
    const listRes = await fetch(`${MY_WORKER_URL}/api/etf-list`);
    if (listRes.ok) {
      etfs = await listRes.json();
    }
  } catch (e) {
    console.warn("Could not fetch ETF list from worker, using embedded fallback...", e);
  }

  if (!etfs || etfs.length === 0) {
    // Compiled embedded fallback for offline and local-file compatibility
    etfs = [{"ticker":"ACWI","name":"iShares MSCI ACWI ETF"},{"ticker":"AGG","name":"iShares Core U.S. Aggregate Bond ETF"},{"ticker":"AMLP","name":"Alerian MLP ETF"},{"ticker":"AOA","name":"iShares Core Aggressive Allocation ETF"},{"ticker":"AOK","name":"iShares Core Conservative Allocation ETF"},{"ticker":"AOM","name":"iShares Core Moderate Allocation ETF"},{"ticker":"AOR","name":"iShares Core Growth Allocation ETF"},{"ticker":"ARKF","name":"ARK Fintech Innovation ETF"},{"ticker":"ARKG","name":"ARK Genomic Revolution ETF"},{"ticker":"ARKG","name":"ARK Genomic Revolution ETF"},{"ticker":"ARKK","name":"ARK Innovation ETF"},{"ticker":"ARKQ","name":"ARK Autonomous Technology & Robotics ETF"},{"ticker":"ARKW","name":"ARK Next Generation Internet ETF"},{"ticker":"AVDV","name":"Avantis International Small Cap Value ETF"},{"ticker":"AVEM","name":"Avantis Emerging Markets Equity ETF"},{"ticker":"AVUV","name":"Avantis U.S. Small Cap Value ETF"},{"ticker":"BIL","name":"SPDR Bloomberg 1-3 Month T-Bill ETF"},{"ticker":"BITB","name":"Bitwise Bitcoin ETF"},{"ticker":"BIV","name":"Vanguard Intermediate-Term Bond ETF"},{"ticker":"BKLN","name":"Invesco Senior Loan ETF"},{"ticker":"BLV","name":"Vanguard Long-Term Bond ETF"},{"ticker":"BND","name":"Vanguard Total Bond Market ETF"},{"ticker":"BNDX","name":"Vanguard Total International Bond ETF"},{"ticker":"BOTZ","name":"Global X Robotics & Artificial Intelligence ETF"},{"ticker":"BOXX","name":"Alpha Architect 1-3 Month Box ETF"},{"ticker":"BSV","name":"Vanguard Short-Term Bond ETF"},{"ticker":"CALF","name":"Pacer US Small Cap Cash Cows 100 ETF"},{"ticker":"CIBR","name":"First Trust NASDAQ Cybersecurity ETF"},{"ticker":"CLOU","name":"Global X Cloud Computing ETF"},{"ticker":"CNRG","name":"SPDR S&P Kensho Clean Power ETF"},{"ticker":"COWZ","name":"Pacer US Cash Cows 100 ETF"},{"ticker":"DBO","name":"Invesco DB Oil Fund"},{"ticker":"DFAC","name":"Dimensional U.S. Core Equity 2 ETF"},{"ticker":"DFAE","name":"Dimensional Emerging Core Equity Market ETF"},{"ticker":"DFAI","name":"Dimensional International Core Equity Market ETF"},{"ticker":"DFAU","name":"Dimensional US Equity ETF"},{"ticker":"DGRO","name":"iShares Core Dividend Growth ETF"},{"ticker":"DGRW","name":"WisdomTree U.S. Quality Dividend Growth Fund"},{"ticker":"DIA","name":"SPDR Dow Jones Industrial Average ETF Trust"},{"ticker":"DLN","name":"WisdomTree U.S. LargeCap Dividend Fund"},{"ticker":"DVY","name":"iShares Select Dividend ETF"},{"ticker":"EEM","name":"iShares MSCI Emerging Markets ETF"},{"ticker":"EEMV","name":"iShares MSCI Emerging Markets Min Vol Factor ETF"},{"ticker":"EFA","name":"iShares MSCI EAFE ETF"},{"ticker":"EFAV","name":"iShares MSCI EAFE Min Vol Factor ETF"},{"ticker":"EIDO","name":"iShares MSCI Indonesia ETF"},{"ticker":"EMB","name":"iShares JP Morgan USD Emerging Markets Bond ETF"},{"ticker":"ENZL","name":"iShares MSCI New Zealand ETF"},{"ticker":"EPHE","name":"iShares MSCI Philippines ETF"},{"ticker":"EPOL","name":"iShares MSCI Poland ETF"},{"ticker":"EPU","name":"iShares MSCI Peru and Global Exposure ETF"},{"ticker":"ESGD","name":"iShares ESG Aware MSCI EAFE ETF"},{"ticker":"ETHA","name":"iShares Ethereum Trust ETF"},{"ticker":"EWA","name":"iShares MSCI Australia ETF"},{"ticker":"EWC","name":"iShares MSCI Canada ETF"},{"ticker":"EWG","name":"iShares MSCI Germany ETF"},{"ticker":"EWH","name":"iShares MSCI Hong Kong ETF"},{"ticker":"EWI","name":"iShares MSCI Italy ETF"},{"ticker":"EWJ","name":"iShares MSCI Japan ETF"},{"ticker":"EWP","name":"iShares MSCI Spain ETF"},{"ticker":"EWQ","name":"iShares MSCI France ETF"},{"ticker":"EWT","name":"iShares MSCI Taiwan ETF"},{"ticker":"EWU","name":"iShares MSCI United Kingdom ETF"},{"ticker":"EWY","name":"iShares MSCI South Korea ETF"},{"ticker":"EWZ","name":"iShares MSCI Brazil ETF"},{"ticker":"EWZS","name":"iShares MSCI Brazil Small-Cap ETF"},{"ticker":"EZBC","name":"Franklin Bitcoin ETF"},{"ticker":"EZU","name":"iShares MSCI Eurozone ETF"},{"ticker":"FAN","name":"First Trust Global Wind Energy ETF"},{"ticker":"FAS","name":"Direxion Daily Financial Bull 3X Shares"},{"ticker":"FAZ","name":"Direxion Daily Financial Bear 3X Shares"},{"ticker":"FBTC","name":"Fidelity Wise Origin Bitcoin Fund"},{"ticker":"FDN","name":"First Trust Dow Jones Internet Index Fund"},{"ticker":"FENY","name":"Fidelity MSCI Energy Index ETF"},{"ticker":"FETH","name":"Fidelity Ethereum Fund"},{"ticker":"FHLC","name":"Fidelity MSCI Health Care Index ETF"},{"ticker":"FIDU","name":"Fidelity MSCI Industrials Index ETF"},{"ticker":"FLOT","name":"iShares Floating Rate Bond ETF"},{"ticker":"FNCL","name":"Fidelity MSCI Financials Index ETF"},{"ticker":"FTEC","name":"Fidelity MSCI Information Technology Index ETF"},{"ticker":"GDX","name":"VanEck Gold Miners ETF"},{"ticker":"GDXJ","name":"VanEck Junior Gold Miners ETF"},{"ticker":"GLD","name":"SPDR Gold Shares"},{"ticker":"GNR","name":"SPDR S&P Global Natural Resources ETF"},{"ticker":"GOVT","name":"iShares U.S. Treasury Bond ETF"},{"ticker":"HDV","name":"iShares Core High Dividend ETF"},{"ticker":"HYD","name":"VanEck High Yield Muni ETF"},{"ticker":"HYG","name":"iShares iBoxx $ High Yield Corporate Bond ETF"},{"ticker":"IAI","name":"iShares U.S. Broker-Dealers & Securities Exchanges ETF"},{"ticker":"IAK","name":"iShares U.S. Insurance ETF"},{"ticker":"IAU","name":"iShares Gold Trust"},{"ticker":"IBB","name":"iShares Biotechnology ETF"},{"ticker":"IBIT","name":"iShares Bitcoin Trust ETF"},{"ticker":"ICLN","name":"iShares Global Clean Energy ETF"},{"ticker":"IEF","name":"iShares 7-10 Year Treasury Bond ETF"},{"ticker":"IEMG","name":"iShares Core MSCI Emerging Markets ETF"},{"ticker":"IGIB","name":"iShares 5-10 Year Investment Grade Corporate Bond ETF"},{"ticker":"IGLB","name":"iShares 10+ Year Investment Grade Corporate Bond ETF"},{"ticker":"IGM","name":"iShares Expanded Tech Sector ETF"},{"ticker":"IGOV","name":"iShares International Treasury Bond ETF"},{"ticker":"IGSB","name":"iShares 1-5 Year Investment Grade Corporate Bond ETF"},{"ticker":"IGV","name":"iShares Expanded Tech-Software Sector ETF"},{"ticker":"IHF","name":"iShares U.S. Healthcare Providers ETF"},{"ticker":"IHI","name":"iShares U.S. Medical Devices ETF"},{"ticker":"IJH","name":"iShares Core S&P Mid-Cap ETF"},{"ticker":"IJJ","name":"iShares S&P Mid-Cap 400 Value ETF"},{"ticker":"IJK","name":"iShares S&P Mid-Cap 400 Growth ETF"},{"ticker":"IJR","name":"iShares Core S&P Small-Cap ETF"},{"ticker":"IJT","name":"iShares S&P Small-Cap 600 Growth ETF"},{"ticker":"INDA","name":"iShares MSCI India ETF"},{"ticker":"ITOT","name":"iShares Core S&P Total U.S. Stock Market ETF"},{"ticker":"IVE","name":"iShares S&P 500 Value ETF"},{"ticker":"IVV","name":"iShares Core S&P 500 ETF"},{"ticker":"IVW","name":"iShares S&P 500 Growth ETF"},{"ticker":"IWC","name":"iShares Micro-Cap ETF"},{"ticker":"IWM","name":"iShares Russell 2000 ETF"},{"ticker":"IWN","name":"iShares Russell 2000 Value ETF"},{"ticker":"IWO","name":"iShares Russell 2000 Growth ETF"},{"ticker":"IWP","name":"iShares Russell Mid-Cap Growth ETF"},{"ticker":"IWR","name":"iShares Russell Mid-Cap ETF"},{"ticker":"IYE","name":"iShares U.S. Energy ETF"},{"ticker":"IYF","name":"iShares U.S. Financials ETF"},{"ticker":"IYH","name":"iShares U.S. Healthcare ETF"},{"ticker":"IYLD","name":"iShares Morningstar Multi-Asset Income ETF"},{"ticker":"IYR","name":"iShares U.S. Real Estate ETF"},{"ticker":"IYT","name":"iShares Transportation Average ETF"},{"ticker":"IYW","name":"iShares U.S. Technology ETF"},{"ticker":"JEPI","name":"JPMorgan Equity Premium Income ETF"},{"ticker":"JEPQ","name":"JPMorgan Nasdaq Equity Premium Income ETF"},{"ticker":"JMST","name":"JPMorgan Ultra-Short Municipal Income ETF"},{"ticker":"JNK","name":"SPDR Bloomberg High Yield Bond ETF"},{"ticker":"JPST","name":"JPMorgan Ultra-Short Income ETF"},{"ticker":"KBE","name":"SPDR S&P Bank ETF"},{"ticker":"KRE","name":"SPDR S&P Regional Banking ETF"},{"ticker":"LABD","name":"Direxion Daily S&P Biotech Bear 3X Shares"},{"ticker":"LABU","name":"Direxion Daily S&P Biotech Bull 3X Shares"},{"ticker":"LIT","name":"Global X Lithium & Battery Tech ETF"},{"ticker":"LQD","name":"iShares iBoxx $ Investment Grade Corporate Bond ETF"},{"ticker":"MBB","name":"iShares MBS ETF"},{"ticker":"MCHI","name":"iShares MSCI China ETF"},{"ticker":"MDY","name":"SPDR S&P MidCap 400 ETF Trust"},{"ticker":"MGK","name":"Vanguard Mega Cap Growth ETF"},{"ticker":"MGV","name":"Vanguard Mega Cap Value ETF"},{"ticker":"MINT","name":"PIMCO Enhanced Short Maturity Active ETF"},{"ticker":"MSOS","name":"AdvisorShares Pure US Cannabis ETF"},{"ticker":"MTUM","name":"iShares MSCI USA Momentum Factor ETF"},{"ticker":"MUB","name":"iShares National Muni Bond ETF"},{"ticker":"MUB","name":"iShares National Muni Bond ETF"},{"ticker":"NEAR","name":"BlackRock Short Maturity Bond ETF"},{"ticker":"OIH","name":"VanEck Oil Services ETF"},{"ticker":"ONEQ","name":"Fidelity Nasdaq Composite Index ETF"},{"ticker":"PAVE","name":"Global X U.S. Infrastructure Development ETF"},{"ticker":"PDBC","name":"Invesco Optimum Yield Diversified Commodity Strategy No K-1 ETF"},{"ticker":"PEJ","name":"Invesco Dynamic Leisure and Entertainment ETF"},{"ticker":"PFF","name":"iShares Preferred Stock & Income Securities ETF"},{"ticker":"PPH","name":"VanEck Pharmaceutical ETF"},{"ticker":"QAT","name":"iShares MSCI Qatar ETF"},{"ticker":"QQQ","name":"Invesco QQQ Trust Series 1"},{"ticker":"QQQM","name":"Invesco NASDAQ 100 ETF"},{"ticker":"QUAL","name":"iShares MSCI USA Quality Factor ETF"},{"ticker":"REMX","name":"VanEck Rare Earth and Strategic Metals ETF"},{"ticker":"RSP","name":"Invesco S&P 500 Equal Weight ETF"},{"ticker":"RYF","name":"Invesco S&P 500 Equal Weight Financials ETF"},{"ticker":"RYH","name":"Invesco S&P 500 Equal Weight Health Care ETF"},{"ticker":"RYT","name":"Invesco S&P 500 Equal Weight Technology ETF"},{"ticker":"SCHA","name":"Schwab U.S. Small-Cap ETF"},{"ticker":"SCHB","name":"Schwab U.S. Broad Market ETF"},{"ticker":"SCHD","name":"Schwab U.S. Dividend Equity ETF"},{"ticker":"SCHE","name":"Schwab Emerging Markets Equity ETF"},{"ticker":"SCHF","name":"Schwab International Equity ETF"},{"ticker":"SCHG","name":"Schwab U.S. Large-Cap Growth ETF"},{"ticker":"SCHI","name":"Schwab 5-10 Year Corporate Bond ETF"},{"ticker":"SCHM","name":"Schwab U.S. Mid-Cap ETF"},{"ticker":"SCHP","name":"Schwab U.S. TIPS ETF"},{"ticker":"SCHV","name":"Schwab U.S. Large-Cap Value ETF"},{"ticker":"SCHX","name":"Schwab U.S. Large-Cap ETF"},{"ticker":"SDY","name":"SPDR S&P Dividend ETF"},{"ticker":"SGOV","name":"iShares 0-3 Month Treasury Bond ETF"},{"ticker":"SHV","name":"iShares Short Treasury Bond ETF"},{"ticker":"SHY","name":"iShares 1-3 Year Treasury Bond ETF"},{"ticker":"SHYG","name":"iShares 0-5 Year High Yield Corporate Bond ETF"},{"ticker":"SIZE","name":"iShares MSCI USA Size Factor ETF"},{"ticker":"SJNK","name":"SPDR Bloomberg Short Term High Yield Bond ETF"},{"ticker":"SLQD","name":"iShares 0-5 Year Investment Grade Corporate Bond ETF"},{"ticker":"SLV","name":"iShares Silver Trust"},{"ticker":"SMH","name":"VanEck Semiconductor ETF"},{"ticker":"SMMD","name":"iShares Russell 2500 ETF"},{"ticker":"SOXL","name":"Direxion Daily Semiconductor Bull 3X Shares"},{"ticker":"SOXS","name":"Direxion Daily Semiconductor Bear 3X Shares"},{"ticker":"SOXX","name":"iShares Semiconductor ETF"},{"ticker":"SPAB","name":"SPDR Portfolio Aggregate Bond ETF"},{"ticker":"SPDW","name":"SPDR Portfolio Developed World ex-US ETF"},{"ticker":"SPEM","name":"SPDR Portfolio Emerging Markets ETF"},{"ticker":"SPIB","name":"SPDR Portfolio Intermediate Term Corporate Bond ETF"},{"ticker":"SPLG","name":"SPDR Portfolio S&P 500 ETF"},{"ticker":"SPSB","name":"SPDR Portfolio Short Term Corporate Bond ETF"},{"ticker":"SPTI","name":"SPDR Portfolio Intermediate Term Treasury ETF"},{"ticker":"SPTL","name":"SPDR Portfolio Long Term Treasury ETF"},{"ticker":"SPTS","name":"SPDR Portfolio Short Term Treasury ETF"},{"ticker":"SPXL","name":"Direxion Daily S&P 500 Bull 3X Shares"},{"ticker":"SPXS","name":"Direxion Daily S&P 500 Bear 3X Shares"},{"ticker":"SPY","name":"SPDR S&P 500 ETF Trust"},{"ticker":"SPYD","name":"SPDR Portfolio S&P 500 High Dividend ETF"},{"ticker":"SPYV","name":"SPDR Portfolio S&P 500 Value ETF"},{"ticker":"SPYX","name":"SPDR S&P 500 Fossil Fuel Reserves Free ETF"},{"ticker":"SQQQ","name":"ProShares UltraPro Short QQQ"},{"ticker":"SRLN","name":"SPDR Blackstone Senior Loan ETF"},{"ticker":"STIP","name":"iShares 0-5 Year TIPS Bond ETF"},{"ticker":"SVXY","name":"ProShares Short VIX Short-Term Futures ETF"},{"ticker":"TAN","name":"Invesco Solar ETF"},{"ticker":"TIP","name":"iShares TIPS Bond ETF"},{"ticker":"TLT","name":"iShares 20+ Year Treasury Bond ETF"},{"ticker":"TNA","name":"Direxion Daily Small Cap Bull 3X Shares"},{"ticker":"TQQQ","name":"ProShares UltraPro QQQ"},{"ticker":"TZA","name":"Direxion Daily Small Cap Bear 3X Shares"},{"ticker":"UNG","name":"United States Natural Gas Fund LP"},{"ticker":"UPRO","name":"ProShares UltraPro S&P 500"},{"ticker":"USMV","name":"iShares MSCI USA Min Vol Factor ETF"},{"ticker":"USO","name":"United States Oil Fund LP"},{"ticker":"UVXY","name":"ProShares Ultra VIX Short-Term Futures ETF"},{"ticker":"VB","name":"Vanguard Small-Cap ETF"},{"ticker":"VBK","name":"Vanguard Small-Cap Growth ETF"},{"ticker":"VBR","name":"Vanguard Small-Cap Value ETF"},{"ticker":"VCIT","name":"Vanguard Intermediate-Term Corporate Bond ETF"},{"ticker":"VCSH","name":"Vanguard Short-Term Corporate Bond ETF"},{"ticker":"VEA","name":"Vanguard FTSE Developed Markets ETF"},{"ticker":"VGIT","name":"Vanguard Intermediate-Term Treasury ETF"},{"ticker":"VGK","name":"Vanguard FTSE Europe ETF"},{"ticker":"VGLT","name":"Vanguard Long-Term Treasury ETF"},{"ticker":"VGSH","name":"Vanguard Short-Term Treasury ETF"},{"ticker":"VIG","name":"Vanguard Dividend Appreciation ETF"},{"ticker":"VLUE","name":"iShares MSCI USA Value Factor ETF"},{"ticker":"VNQ","name":"Vanguard Real Estate ETF"},{"ticker":"VNQI","name":"Vanguard Global ex-U.S. Real Estate ETF"},{"ticker":"VO","name":"Vanguard Mid-Cap ETF"},{"ticker":"VOE","name":"Vanguard Mid-Cap Value ETF"},{"ticker":"VOO","name":"Vanguard S&P 500 ETF"},{"ticker":"VOT","name":"Vanguard Mid-Cap Growth ETF"},{"ticker":"VPL","name":"Vanguard FTSE Pacific ETF"},{"ticker":"VSS","name":"Vanguard FTSE All-World ex-US Small-Cap ETF"},{"ticker":"VTI","name":"Vanguard Total Stock Market ETF"},{"ticker":"VTIP","name":"Vanguard Short-Term Inflation-Protected Securities ETF"},{"ticker":"VTV","name":"Vanguard Value ETF"},{"ticker":"VUG","name":"Vanguard Growth ETF"},{"ticker":"VV","name":"Vanguard Large-Cap ETF"},{"ticker":"VWO","name":"Vanguard FTSE Emerging Markets ETF"},{"ticker":"VXF","name":"Vanguard Extended Market ETF"},{"ticker":"VXUS","name":"Vanguard Total International Stock ETF"},{"ticker":"VYD","name":"Vanguard High Dividend Yield ETF"},{"ticker":"XAR","name":"SPDR S&P Aerospace & Defense ETF"},{"ticker":"XES","name":"SPDR S&P Oil & Gas Equipment & Services ETF"},{"ticker":"XHB","name":"SPDR S&P Homebuilders ETF"},{"ticker":"XLB","name":"Materials Select Sector SPDR Fund"},{"ticker":"XLC","name":"Communication Services Select Sector SPDR Fund"},{"ticker":"XLE","name":"Energy Select Sector SPDR Fund"},{"ticker":"XLF","name":"Financial Select Sector SPDR Fund"},{"ticker":"XLI","name":"Industrial Select Sector SPDR Fund"},{"ticker":"XLK","name":"Technology Select Sector SPDR Fund"},{"ticker":"XLP","name":"Consumer Staples Select Sector SPDR Fund"},{"ticker":"XLRE","name":"Real Estate Select Sector SPDR Fund"},{"ticker":"XLU","name":"Utilities Select Sector SPDR Fund"},{"ticker":"XLV","name":"Health Care Select Sector SPDR Fund"},{"ticker":"XLY","name":"Consumer Discretionary Select Sector SPDR Fund"},{"ticker":"XME","name":"SPDR S&P Metals & Mining ETF"},{"ticker":"XOP","name":"SPDR S&P Oil & Gas Exploration & Production ETF"},{"ticker":"XRT","name":"SPDR S&P Retail ETF"}];
  }

  etfs = [...new Map(etfs.map(e => [e.ticker, e])).values()];
  etfs.sort((a, b) => a.ticker.localeCompare(b.ticker));
  
  select.innerHTML = "<option value=\"\">-- Choose an ETF --</option>";
  etfs.forEach(e => {
    const opt = document.createElement("option");
    opt.value = e.ticker;
    opt.textContent = `${e.ticker} – ${e.name}`;
    select.appendChild(opt);
  });
}

let etfAbortController = null;
let currentEtfHoldings = [];
let currentFilterText = "";
let currentSliceSize = "All";

function fmtCompact(val) {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    style: "currency",
    currency: "USD"
  }).format(val);
}

function updateHoldingsDisplay() {
  const tbody = document.querySelector("#etfHoldingsTable tbody");
  const rowCountSpan = document.getElementById("etfRowCount");
  if (!tbody) return;

  const searchVal = currentFilterText.toLowerCase().trim();
  const filtered = currentEtfHoldings.filter(h => {
    const symbolMatch = h.symbol ? h.symbol.toLowerCase().includes(searchVal) : false;
    const nameMatch = h.name ? h.name.toLowerCase().includes(searchVal) : false;
    return symbolMatch || nameMatch;
  });

  let sliced = filtered;
  if (currentSliceSize === "Top 10") {
    sliced = filtered.slice(0, 10);
  } else if (currentSliceSize === "Top 25") {
    sliced = filtered.slice(0, 25);
  } else if (currentSliceSize === "Top 50") {
    sliced = filtered.slice(0, 50);
  }

  const fmtNumber = (num) => {
    if (num === null || num === undefined) return "—";
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(num);
  };
  
  const fmtWeight = (weight) => {
    if (weight === null || weight === undefined) return "—";
    return `${weight.toFixed(2)}%`;
  };

  const fmtValue = (val) => {
    if (val === null || val === undefined) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
  };

  let tableRows = "";
  if (sliced.length === 0) {
    tableRows = `<tr><td colspan="6" style="text-align: center; color: var(--dim); padding: 20px;">No holdings found matching the filter criteria.</td></tr>`;
  } else {
    sliced.forEach(h => {
      const tkrStr = h.symbol || "";
      let tkr = `<span style="color: var(--dim);">—</span>`;
      
      if (h.symbol) {
        tkr = `<span class="mv-sym" style="cursor: pointer;" onclick="closeModal(); setTimeout(() => openBySymbol('${tkrStr}', '${h.name.replace(/'/g, "\\'")}'), 100);">${h.symbol}</span>`;
      } else {
        const hasRte = h.annualizedRte !== null && h.annualizedRte !== undefined;
        const hasMat = h.maturityDat !== null && h.maturityDat !== undefined && h.maturityDat !== "";
        if (hasRte || hasMat) {
          let label = "";
          if (hasRte && hasMat) {
            const prefix = (h.couponKind === "Fixed" || h.couponKind === "Variable") ? `${h.couponKind} ` : "";
            const dateStr = h.maturityDat.substring(0, 7);
            label = `${prefix}${h.annualizedRte}% · ${dateStr}`;
          } else if (hasRte) {
            label = `${h.annualizedRte}%`;
          } else if (hasMat) {
            label = h.maturityDat;
          }
          tkr = `<span style="font-size: 10px; color: var(--text2); font-weight: 500;">${label}</span>`;
        } else if (h.isin && h.isin.length >= 2) {
          // No ticker and no bond data — show ISIN country code badge so the cell
          // isn't just a dash. Many filers (e.g. Invesco) omit <ticker> even for US equities.
          const cc = h.isin.substring(0, 2).toUpperCase();
          tkr = `<span style="font-size: 9px; font-weight: 700; color: var(--dim); letter-spacing: 0.04em; background: var(--bg2); border: 1px solid var(--border); border-radius: 3px; padding: 1px 4px;">${cc}</span>`;
        }
      }

      const isinCell = h.isin
        ? `<span style="font-family: var(--mono); font-size: 10px; color: var(--text2);">${h.isin}</span>`
        : `<span style="color: var(--dim);">—</span>`;
      
      tableRows += `
        <tr>
          <td style="font-family: var(--mono); font-weight: 600; text-align: left;">${tkr}</td>
          <td style="text-align: left;">${isinCell}</td>
          <td style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 210px;" title="${h.name}">${h.name}</td>
          <td class="sec-pct" style="text-align: right; font-weight: 700; color: var(--text);">${fmtWeight(h.weight_pct)}</td>
          <td class="pr" style="text-align: right;">${fmtValue(h.value_usd)}</td>
          <td class="vo" style="text-align: right;">${fmtNumber(h.shares)}</td>
        </tr>`;
    });
  }

  tbody.innerHTML = tableRows;

  if (rowCountSpan) {
    rowCountSpan.textContent = `Showing ${filtered.length} of ${currentEtfHoldings.length} holdings`;
  }

  const btns = {
    "Top 10": document.getElementById("btn-top-10"),
    "Top 25": document.getElementById("btn-top-25"),
    "Top 50": document.getElementById("btn-top-50"),
    "All": document.getElementById("btn-top-all")
  };
  
  for (const [key, btn] of Object.entries(btns)) {
    if (btn) {
      if (key === currentSliceSize) {
        btn.style.borderColor = "var(--blue)";
        btn.style.color = "var(--blue)";
      } else {
        btn.style.borderColor = "var(--border)";
        btn.style.color = "var(--text2)";
      }
    }
  }
}

async function onEtfSelectChange() {
  const select = document.getElementById("etfSelect");
  const contentDiv = document.getElementById("etfHoldingsContent");
  if (!select || !contentDiv) return;

  const ticker = select.value;
  if (!ticker) {
    contentDiv.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--muted); font-size: 11.5px; background: var(--bg3); border-radius: var(--r); border: 1px solid var(--border);">
        Select an ETF from the list to view its latest SEC Form N-PORT holdings.
      </div>`;
    return;
  }

  etfAbortController?.abort();
  etfAbortController = new AbortController();

  contentDiv.innerHTML = `
    <div style="text-align: center; padding: 48px 20px; color: var(--blue); font-size: 12px; background: var(--bg3); border-radius: var(--r); border: 1px solid var(--border);">
      <div class="mspinner"></div>
      <div style="margin-top: 10px; font-weight: 500; letter-spacing: 0.02em;">Fetching holdings from SEC N-PORT…</div>
    </div>`;

  try {
    const url = `${MY_WORKER_URL}/api/etf-holdings?symbol=${encodeURIComponent(ticker)}`;
    const resp = await fetch(url, { signal: etfAbortController.signal });
    let data = null;
    
    if (resp.ok) {
      try {
        data = await resp.json();
      } catch (jsonErr) {
        console.warn("Worker response was not JSON:", jsonErr);
      }
    }

    if (!data || !data.holdings || !data.ticker || data.error) {
      if (data && data.error === "NO_NPORT") {
        contentDiv.innerHTML = `
          <div style="text-align: center; padding: 40px 20px; color: var(--amber); font-size: 11.5px; background: var(--bg3); border-radius: var(--r); border: 1px solid var(--border); line-height: 1.5;">
            <div style="font-size: 16px; margin-bottom: 8px;">⚠️</div>
            <div><strong>N-PORT holdings are not available for this ETF</strong><br><span style="color: var(--dim)">(grantor trust/UIT or not a 1940 Act fund).</span></div>
          </div>`;
        return;
      }

      const noNportTickers = new Set([
        "GLD", "SLV", "IAU", "SGOL", "PHYS", "PSLV", "USO", "UNG", "DBO", "PDBC", "IBIT", "FBTC", "BITB", 
        "EZBC", "ETHA", "FETH", "SPY", "QQQ", "DIA", "GDX", "GDXJ", "OIH", "MSOS"
      ]);

      if (noNportTickers.has(ticker)) {
        contentDiv.innerHTML = `
          <div style="text-align: center; padding: 40px 20px; color: var(--amber); font-size: 11.5px; background: var(--bg3); border-radius: var(--r); border: 1px solid var(--border); line-height: 1.5;">
            <div style="font-size: 16px; margin-bottom: 8px;">⚠️</div>
            <div><strong>N-PORT holdings are not available for this ETF</strong><br><span style="color: var(--dim)">(grantor trust/UIT or not a 1940 Act fund).</span></div>
          </div>`;
        return;
      }

      // Live data unavailable — show error instead of mock data
      contentDiv.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--dim); font-size: 11.5px; background: var(--bg3); border-radius: var(--r); border: 1px solid var(--border); line-height: 1.6;">
          <div style="font-size: 16px; margin-bottom: 8px;">⚠️</div>
          <div><strong style="color: var(--text2);">Holdings unavailable for ${ticker}</strong><br>
          Unable to fetch N-PORT data from SEC EDGAR right now.<br>
          <span style="color: var(--dim); font-size: 10.5px;">Please try again in a moment or select a different ETF.</span></div>
        </div>`;
      return;
    }

    currentEtfHoldings = data.holdings || [];
    currentFilterText = "";
    currentSliceSize = "All";

    const breakdownColors = {
      "Equity": "var(--blue)",
      "US Govt": "var(--green)",
      "Corp Bond": "var(--amber)",
      "MBS": "var(--red)",
      "Cash": "var(--teal)",
      "Other": "var(--dim)"
    };

    let breakdownBarHtml = "";
    let breakdownLegendHtml = "";

    if (data.sectorBreakdown && data.sectorBreakdown.length > 0) {
      data.sectorBreakdown.forEach(item => {
        if (item.pct > 0) {
          const color = breakdownColors[item.label] || "var(--dim)";
          breakdownBarHtml += `<span style="width: ${item.pct}%; background: ${color}; height: 100%;" title="${item.label}: ${item.pct.toFixed(2)}% (${item.count} holdings)"></span>`;
          breakdownLegendHtml += `
            <div style="display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: ${color}; display: inline-block;"></span>
              <span>${item.label} <strong style="color: var(--text);">${item.pct.toFixed(1)}%</strong></span>
            </div>`;
        }
      });
    }

    let displayNetAssets = data.fundInfo?.netAssets;
    if (displayNetAssets === undefined || displayNetAssets === null) {
      displayNetAssets = data.fundInfo?.totAssets;
    }

    const periodDisplay = data.fundInfo?.repPdDate || data.fundInfo?.repPdEnd || data.period_ending || '—';
    const holdingsCount = data.holdings ? data.holdings.length : 0;

    contentDiv.innerHTML = `

      <!-- Fund Header Card (Feature 1) -->
      <div class="fund-header-card" style="padding: 12px; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--r); margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
          <div>
            <div style="font-size: 13px; font-weight: 700; color: var(--text); line-height: 1.3;" id="fundRegName">${data.fundInfo?.regName || '—'}</div>
            <div style="font-size: 11px; color: var(--text2); margin-top: 2px;">
              ${data.ticker} · ${data.name || '—'}
            </div>
          </div>
          <div id="prospectusBtnContainer"></div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; font-size: 11px; color: var(--text2); border-top: 1px solid var(--border); padding-top: 8px; margin-top: 8px;">
          <div>
            <div style="color: var(--dim); font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Total Assets</div>
            <div style="font-weight: 600; color: var(--text);">${fmtCompact(data.fundInfo?.totAssets)}</div>
          </div>
          <div>
            <div style="color: var(--dim); font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Net Assets</div>
            <div style="font-weight: 600; color: var(--text);">${fmtCompact(displayNetAssets)}</div>
          </div>
          <div>
            <div style="color: var(--dim); font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Period End</div>
            <div style="font-weight: 600; color: var(--text);">${periodDisplay}</div>
          </div>
          <div>
            <div style="color: var(--dim); font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Filing Date</div>
            <div style="font-weight: 600; color: var(--text);">${data.file_date || '—'}</div>
          </div>
          <div>
            <div style="color: var(--dim); font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Holdings Count</div>
            <div style="font-weight: 600; color: var(--text);">${holdingsCount}</div>
          </div>
        </div>
      </div>

      <!-- Sector Allocation (Feature 3) -->
      ${breakdownBarHtml ? `
      <div class="sector-breakdown-card" style="margin-bottom: 12px; padding: 10px; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--r);">
        <div style="font-size: 9px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px;">Asset Allocation</div>
        <div style="display: flex; height: 10px; border-radius: 3px; overflow: hidden; background: var(--bg2); margin-bottom: 8px;">
          ${breakdownBarHtml}
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 12px 16px; font-size: 10px; color: var(--text2); line-height: 1.2;">
          ${breakdownLegendHtml}
        </div>
      </div>` : ''}

      <!-- Search and Slices (Feature 2) -->
      <div class="holdings-controls" style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px;">
          <input type="text" id="etfSearchInput" placeholder="Filter holdings by ticker or name..." class="btn" style="width: 100%; height: 28px; background: var(--bg3); border: 1px solid var(--border); font-size: 11px; padding: 2px 8px; border-radius: var(--r); outline: none; color: var(--text);" oninput="onEtfSearchInput(this.value)">
        </div>
        
        <div style="display: flex; align-items: center; gap: 4px;">
          <button class="btn etf-filter-btn" id="btn-top-10" onclick="onEtfSliceChange('Top 10')" style="height: 28px; font-size: 10px; font-weight: 600; padding: 2px 8px; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--r); cursor: pointer; color: var(--text2); outline: none;">Top 10</button>
          <button class="btn etf-filter-btn" id="btn-top-25" onclick="onEtfSliceChange('Top 25')" style="height: 28px; font-size: 10px; font-weight: 600; padding: 2px 8px; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--r); cursor: pointer; color: var(--text2); outline: none;">Top 25</button>
          <button class="btn etf-filter-btn" id="btn-top-50" onclick="onEtfSliceChange('Top 50')" style="height: 28px; font-size: 10px; font-weight: 600; padding: 2px 8px; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--r); cursor: pointer; color: var(--text2); outline: none;">Top 50</button>
          <button class="btn etf-filter-btn" id="btn-top-all" onclick="onEtfSliceChange('All')" style="height: 28px; font-size: 10px; font-weight: 600; padding: 2px 8px; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--r); cursor: pointer; color: var(--text2); outline: none;">All</button>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 10px; color: var(--text2); font-weight: 500;">
        <span id="etfRowCount">Showing ${currentEtfHoldings.length} of ${currentEtfHoldings.length} holdings</span>
      </div>

      <div id="etfHoldingsTable" style="max-height: 380px; overflow: auto; border: 1px solid var(--border); border-radius: var(--r); background: var(--bg2); max-width: 100%;">
        <table class="dt" style="width: 100%; table-layout: fixed; min-width: 600px;">
          <thead>
            <tr>
              <th style="text-align: left; width: 70px; position: sticky; top: 0; background: var(--bg3); z-index: 10;">Ticker</th>
              <th style="text-align: left; width: 110px; position: sticky; top: 0; background: var(--bg3); z-index: 10;">ISIN</th>
              <th style="text-align: left; width: 210px; position: sticky; top: 0; background: var(--bg3); z-index: 10;">Security Name</th>
              <th style="text-align: right; width: 70px; position: sticky; top: 0; background: var(--bg3); z-index: 10;">Weight %</th>
              <th style="text-align: right; width: 110px; position: sticky; top: 0; background: var(--bg3); z-index: 10;">Value (USD)</th>
              <th style="text-align: right; width: 90px; position: sticky; top: 0; background: var(--bg3); z-index: 10;">Shares</th>
            </tr>
          </thead>
          <tbody>
            <!-- Will be populated dynamically -->
          </tbody>
        </table>
      </div>`;

    updateHoldingsDisplay();

    fetch(`${MY_WORKER_URL}/api/etf-prospectus?symbol=${encodeURIComponent(ticker)}`, { signal: etfAbortController.signal })
      .then(r => r.json())
      .then(pData => {
        if (pData && pData.url) {
          const container = document.getElementById("prospectusBtnContainer");
          if (container) {
            container.innerHTML = `
              <a href="${pData.url}" target="_blank" rel="noopener noreferrer" class="btn" style="text-decoration: none; display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 600; color: var(--text); background: var(--bg2); border: 1px solid var(--border); padding: 4px 8px; border-radius: var(--r); cursor: pointer; transition: background 0.15s;">
                View Prospectus ↗
              </a>`;
          }
        }
      })
      .catch(err => {
        if (err.name !== "AbortError") {
          console.warn("Failed to fetch prospectus URL:", err);
        }
      });

  } catch (err) {
    if (err.name === "AbortError") return;
    console.error("Error loading ETF holdings:", err);
    contentDiv.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--red); font-size: 11.5px; background: var(--bg3); border-radius: var(--r); border: 1px solid var(--border); line-height: 1.5;">
        <div style="font-size: 16px; margin-bottom: 8px;">⚠️</div>
        <div><strong>Unable to fetch ETF holdings from SEC N-PORT right now.</strong><br><span style="color: var(--dim)">Please try again later.</span></div>
      </div>`;
  }
}

window.openEtfHoldings = openEtfHoldings;
window.onEtfSelectChange = onEtfSelectChange;
window.onEtfSearchInput = function(val) {
  currentFilterText = val;
  updateHoldingsDisplay();
};
window.onEtfSliceChange = function(size) {
  currentSliceSize = size;
  updateHoldingsDisplay();
};
/* --- ETF HOLDINGS N-PORT SCRIPT END --- */