// Dependencies this module needs from the global scope: MY_WORKER_URL, fmtMoney, fmtPct, safeText

const DCF_PANEL_HTML = `
<div id="dcfBackdrop" class="dcf-backdrop" aria-hidden="true"></div>
<div id="dcfPanel" class="dcf-panel" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Discounted Cash Flow">
  <div class="dcf-head">
    <div class="dcf-title">Discounted Cash Flow (DCF) Beta</div>
    <button class="dcf-close" onclick="closeDCF()">✕</button>
  </div>
  <div class="dcf-body">
    <div class="dcf-sidebar">
      <div class="dcf-section">
        <h3>Setup</h3>
        <div class="dcf-field">
          <label for="dcfSymbol">Supported symbol</label>
          <select id="dcfSymbol"></select>
        </div>
        <div class="dcf-field">
          <label for="dcfForecastYears">Forecast years</label>
          <select id="dcfForecastYears">
            <option value="5" selected>5 Years</option>
            <option value="10">10 Years</option>
          </select>
        </div>
        <div class="dcf-field">
          <label for="dcfDiscountMode">Discount mode</label>
          <select id="dcfDiscountMode">
            <option value="auto" selected>Auto WACC</option>
            <option value="manual">Manual Override</option>
          </select>
        </div>
        <div class="dcf-actions">
          <button class="dcf-btn primary" onclick="loadDCFData()">Load Data</button>
          <button class="dcf-btn" onclick="calculateDCFAction()">Review and Adjust inputs and Calculate DCF</button>
          <button class="dcf-btn" onclick="resetDCFToSource()">Reset to Source</button>
        </div>
      </div>
      <div class="dcf-section">
        <h3>Assumptions</h3>
        <div class="dcf-grid">
          <div class="dcf-field"><label for="dcfRevenueGrowthPct">Revenue Growth %</label><input id="dcfRevenueGrowthPct" type="number" step="0.01"></div>
          <div class="dcf-field"><label for="dcfEbitdaPct">EBITDA %</label><input id="dcfEbitdaPct" type="number" step="0.01"></div>
          <div class="dcf-field"><label for="dcfDepAmPct">D&A %</label><input id="dcfDepAmPct" type="number" step="0.01"></div>
          <div class="dcf-field"><label for="dcfEbitPct">EBIT %</label><input id="dcfEbitPct" type="number" step="0.01"></div>
          <div class="dcf-field"><label for="dcfCapexPct">Capex %</label><input id="dcfCapexPct" type="number" step="0.01"></div>
          <div class="dcf-field"><label for="dcfTaxRate">Tax Rate %</label><input id="dcfTaxRate" type="number" step="0.01"></div>
          <div class="dcf-field"><label for="dcfReceivablesPct">Receivables %</label><input id="dcfReceivablesPct" type="number" step="0.01"></div>
          <div class="dcf-field"><label for="dcfInventoriesPct">Inventories %</label><input id="dcfInventoriesPct" type="number" step="0.01"></div>
          <div class="dcf-field"><label for="dcfPayablePct">Payables %</label><input id="dcfPayablePct" type="number" step="0.01"></div>
          <div class="dcf-field"><label for="dcfLongTermGrowthRate">Terminal Growth %</label><input id="dcfLongTermGrowthRate" type="number" step="0.01"></div>
          <div class="dcf-field"><label for="dcfCostOfDebt">Cost of Debt %</label><input id="dcfCostOfDebt" type="number" step="0.01"></div>
          <div class="dcf-field"><label for="dcfCostOfEquity">Cost of Equity %</label><input id="dcfCostOfEquity" type="number" step="0.01"></div>
          <div class="dcf-field"><label for="dcfMarketRiskPremium">Market Risk Premium %</label><input id="dcfMarketRiskPremium" type="number" step="0.01"></div>
          <div class="dcf-field"><label for="dcfBeta">Beta</label><input id="dcfBeta" type="number" step="0.001"></div>
          <div class="dcf-field"><label for="dcfRiskFreeRate">Risk Free Rate %</label><input id="dcfRiskFreeRate" type="number" step="0.01"></div>
        </div>
      </div>
    </div>
    <div class="dcf-main">
      <div class="dcf-cards">
        <div class="dcf-card"><div class="dcf-card-label">Implied Fair Value</div><div id="dcfFairValue" class="dcf-card-value">—</div></div>
        <div class="dcf-card"><div class="dcf-card-label">Current Price</div><div id="dcfCurrentPrice" class="dcf-card-value">—</div></div>
        <div class="dcf-card"><div class="dcf-card-label">Upside / Downside</div><div id="dcfUpside" class="dcf-card-value">—</div></div>
        <div class="dcf-card"><div class="dcf-card-label">WACC Used</div><div id="dcfWaccUsed" class="dcf-card-value">—</div></div>
      </div>
      <div class="dcf-section">
        <h3>Model explanation</h3>
        <div id="dcfExplain" class="dcf-explain">Select a supported symbol, review the assumptions, and run the model.</div>
        <div class="dcf-note">Discounted Cash Flow (DCF) Beta — This feature is for educational and informational purposes only. Valuation outputs are model-based estimates that depend heavily on assumptions and external data, which may be incomplete or inaccurate, and should not be relied on as investment advice or a recommendation to buy or sell any security.</div>
      </div>
      <div class="dcf-section">
        <h3>Loaded data</h3>
        <div id="dcfLoadedData" class="dcf-explain">No data loaded.</div>
      </div>
      <div class="dcf-section">
        <h3>Forecast summary</h3>
        <div id="dcfForecastTableWrap" class="dcf-explain">No forecast yet.</div>
      </div>
    </div>
  </div>
</div>`;

const DCF_SUPPORTED_SYMBOLS = ["AAPL","TSLA","AMZN","MSFT","NVDA","GOOGL","META","NFLX","JPM","V","BAC","PYPL","DIS","T","PFE","COST","INTC","KO","TGT","NKE","SPY","BA","BABA","XOM","WMT","GE","CSCO","VZ","JNJ","CVX","PLTR","SQ","SHOP","SBUX","SOFI","HOOD","RBLX","SNAP","AMD","UBER","FDX","ABBV","ETSY","MRNA","LMT","GM","F","LCID","CCL","DAL","UAL","AAL","TSM","SONY","ET","MRO","COIN","RIVN","RIOT","CPRX","VWO","SPYG","NOK","ROKU","VIAC","ATVI","BIDU","DOCU","ZM","PINS","TLRY","WBA","MGM","NIO","C","GS","WFC","ADBE","PEP","UNH","CARR","HCA","TWTR","BILI","SIRI","FUBO","RKT"];

let dcfLoadedPayload = null;
let dcfHasLoadedData = false;

function ensureDCFPanelExists() {
  if (document.getElementById("dcfPanel")) return;
  document.body.insertAdjacentHTML("beforeend", DCF_PANEL_HTML);
  const backdrop = document.getElementById("dcfBackdrop");
  if (backdrop) backdrop.addEventListener("click", closeDCF);
}

function initDCFUI() {
  ensureDCFPanelExists();
  const sel = document.getElementById("dcfSymbol");
  if (!sel || sel.options.length) return;
  DCF_SUPPORTED_SYMBOLS.forEach(sym => {
    const opt = document.createElement("option");
    opt.value = sym; opt.textContent = sym; sel.appendChild(opt);
  });
  sel.value = "AAPL";
}

function bindDCFButton() {
  const btn = document.getElementById("dcfTabBtn");
  if (!btn || btn.dataset.dcfBound === "1") return;
  btn.dataset.dcfBound = "1";
  btn.addEventListener("click", (ev) => { ev.preventDefault(); openDCF(); });
}

function openDCF() {
  initDCFUI();
  const panel = document.getElementById("dcfPanel");
  const backdrop = document.getElementById("dcfBackdrop");
  if (!panel) return;
  panel.classList.add("show");
  panel.setAttribute("aria-hidden", "false");
  if (backdrop) { backdrop.classList.add("show"); backdrop.setAttribute("aria-hidden", "false"); }
  document.body.style.overflow = "hidden";
}

function closeDCF() {
  const panel = document.getElementById("dcfPanel");
  const backdrop = document.getElementById("dcfBackdrop");
  if (!panel) return;
  panel.classList.remove("show");
  panel.setAttribute("aria-hidden", "true");
  if (backdrop) { backdrop.classList.remove("show"); backdrop.setAttribute("aria-hidden", "true"); }
  document.body.style.overflow = "";
}

function resetDCFInputs() {
  const defaults = {
    dcfRevenueGrowthPct: "10.00", dcfEbitdaPct: "", dcfDepAmPct: "", dcfEbitPct: "", dcfCapexPct: "",
    dcfTaxRate: "15.00", dcfReceivablesPct: "", dcfInventoriesPct: "", dcfPayablePct: "",
    dcfLongTermGrowthRate: "4.00", dcfCostOfDebt: "3.64", dcfCostOfEquity: "9.51",
    dcfMarketRiskPremium: "4.72", dcfBeta: "", dcfRiskFreeRate: "3.64"
  };
  Object.entries(defaults).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
}

/**
 * FETCH: Updated to use global MY_WORKER_URL logic
 */
async function fetchDCF(symbol) {
  const workerUrl = typeof MY_WORKER_URL !== 'undefined' ? MY_WORKER_URL : "https://meridian-proxy.navinmv1981.workers.dev";
  const url = `${workerUrl}/?dcf=${encodeURIComponent(symbol)}`;
  const resp = await fetch(url);
  const data = await resp.json();
  
  if (!resp.ok || data.error) throw new Error(data.error || "Failed to load data");
  
  // YOUR WORKER returns: { symbol, revenue, sharesOutstanding, assumptions: {...} }
  // We check these exact keys:
  if (!data.revenue || !data.sharesOutstanding) {
    console.error("DCF URL:", url);
    console.error("Worker Response Data (JSON):", JSON.stringify(data, null, 2));

    const likelyQuotaHit =
      data.currentPrice == null &&
      data.marketCap == null &&
      data.revenue == null &&
      data.sharesOutstanding == null;

    if (likelyQuotaHit) {
      throw new Error("FMP data unavailable — likely daily API limit exceeded. Please wait for reset or reduce calls.");
    }

    throw new Error(`Missing Revenue/Shares for ${symbol}. Check Worker Logs.`);
  }
  
  return data;
}

function valOrPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
}

function fillDCFInputs(payload) {
  const a = payload.assumptions || {};
  document.getElementById("dcfRevenueGrowthPct").value = valOrPct(a.revenueGrowthPct);
  document.getElementById("dcfEbitdaPct").value = valOrPct(a.ebitdaPct);
  document.getElementById("dcfDepAmPct").value = valOrPct(a.depreciationAndAmortizationPct);
  document.getElementById("dcfEbitPct").value = valOrPct(a.ebitPct);
  document.getElementById("dcfCapexPct").value = valOrPct(a.capitalExpenditurePct);
  document.getElementById("dcfTaxRate").value = valOrPct(a.taxRate);
  document.getElementById("dcfReceivablesPct").value = valOrPct(a.receivablesPct);
  document.getElementById("dcfInventoriesPct").value = valOrPct(a.inventoriesPct);
  document.getElementById("dcfPayablePct").value = valOrPct(a.payablePct);
  document.getElementById("dcfLongTermGrowthRate").value = valOrPct(a.longTermGrowthRate);
  document.getElementById("dcfCostOfDebt").value = valOrPct(a.costOfDebt);
  document.getElementById("dcfCostOfEquity").value = valOrPct(a.costOfEquity);
  document.getElementById("dcfMarketRiskPremium").value = valOrPct(a.marketRiskPremium);
  document.getElementById("dcfBeta").value = a.beta ? a.beta.toFixed(3) : "1.000";
  document.getElementById("dcfRiskFreeRate").value = valOrPct(a.riskFreeRate);
  document.getElementById("dcfCurrentPrice").textContent = fmtMoney(payload.currentPrice);
}

function clearDCFValuationOutput() {
  document.getElementById("dcfFairValue").textContent = "—";
  document.getElementById("dcfCurrentPrice").textContent = "—";
  document.getElementById("dcfUpside").textContent = "—";
  document.getElementById("dcfWaccUsed").textContent = "—";
  document.getElementById("dcfForecastTableWrap").textContent = "No forecast yet.";
}

function fmtLargeNumber(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function renderDCFLoadedData(payload) {
  const el = document.getElementById("dcfLoadedData");
  if (!el) return;
  const symbol = safeText(payload?.symbol);
  const companyName = safeText(payload?.companyName || payload?.name);
  const currentPrice = fmtMoney(payload?.currentPrice);
  const marketCap = fmtMoney(payload?.marketCap);
  const sharesOutstanding = fmtLargeNumber(payload?.sharesOutstanding);
  const revenue = fmtLargeNumber(payload?.revenue);
  const cash = fmtMoney(payload?.assumptions?.cash);
  const debt = fmtMoney(payload?.assumptions?.totalDebt);
  const sharesSource = safeText(payload?.sharesSource);
  const lastUpdated = safeText(payload?.lastUpdated);

  el.innerHTML = `
    <div><b>Symbol:</b> ${symbol}</div>
    <div><b>Company Name:</b> ${companyName}</div>
    <div><b>Current Price:</b> ${currentPrice}</div>
    <div><b>Market Cap:</b> ${marketCap}</div>
    <div><b>Shares Outstanding:</b> ${sharesOutstanding}</div>
    <div><b>Revenue:</b> ${revenue}</div>
    <div><b>Cash:</b> ${cash}</div>
    <div><b>Debt:</b> ${debt}</div>
    <div><b>Shares Source:</b> ${sharesSource}</div>
    <div><b>Last Updated:</b> ${lastUpdated}</div>
  `;
}

function getDCFInputs() {
  return {
    forecastYears: Number(document.getElementById("dcfForecastYears").value || 5),
    discountMode: document.getElementById("dcfDiscountMode").value,
    revenueGrowthPct: Number(document.getElementById("dcfRevenueGrowthPct").value || 0),
    ebitdaPct: Number(document.getElementById("dcfEbitdaPct").value || 0),
    depreciationAndAmortizationPct: Number(document.getElementById("dcfDepAmPct").value || 0),
    ebitPct: Number(document.getElementById("dcfEbitPct").value || 0),
    capitalExpenditurePct: Number(document.getElementById("dcfCapexPct").value || 0),
    taxRate: Number(document.getElementById("dcfTaxRate").value || 0),
    receivablesPct: Number(document.getElementById("dcfReceivablesPct").value || 0),
    inventoriesPct: Number(document.getElementById("dcfInventoriesPct").value || 0),
    payablePct: Number(document.getElementById("dcfPayablePct").value || 0),
    longTermGrowthRate: Number(document.getElementById("dcfLongTermGrowthRate").value || 0),
    costOfDebt: Number(document.getElementById("dcfCostOfDebt").value || 0),
    costOfEquity: Number(document.getElementById("dcfCostOfEquity").value || 0),
    marketRiskPremium: Number(document.getElementById("dcfMarketRiskPremium").value || 0),
    beta: Number(document.getElementById("dcfBeta").value || 1),
    riskFreeRate: Number(document.getElementById("dcfRiskFreeRate").value || 0)
  };
}

function calculateWacc(inputs, payload) {
  if (inputs.discountMode === "manual") return (inputs.costOfEquity || 9.5) / 100;
  
  const marketCap = Number(payload.marketCap || 0);
  const totalDebt = Number(payload.assumptions?.totalDebt || 0);
  const taxRate = inputs.taxRate / 100;
  const costOfDebt = (inputs.costOfDebt || 3.64) / 100;
  
  // CAPM for Cost of Equity
  const riskFree = inputs.riskFreeRate / 100;
  const mrp = inputs.marketRiskPremium / 100;
  const costOfEquity = riskFree + (inputs.beta * mrp);
  
  const totalCap = marketCap + totalDebt;
  if (totalCap <= 0) return 0.095; // default fallback 9.5%
  
  const weightEquity = marketCap / totalCap;
  const weightDebt = totalDebt / totalCap;
  
  return (weightEquity * costOfEquity) + (weightDebt * costOfDebt * (1 - taxRate));
}

function calculateDCF(payload, inputs) {
  const revenue0 = Number(payload.revenue || 0);
  const shares = Number(payload.sharesOutstanding || 0);
  const cash = Number(payload.assumptions?.cash || 0);
  const debt = Number(payload.assumptions?.totalDebt || 0);

  const wacc = calculateWacc(inputs, payload);
  const growth = inputs.revenueGrowthPct / 100;
  const ebitMargin = inputs.ebitPct / 100;
  const taxRate = inputs.taxRate / 100;
  const daPct = inputs.depreciationAndAmortizationPct / 100;
  const capexPct = inputs.capitalExpenditurePct / 100;
  const nwcp = (inputs.receivablesPct + inputs.inventoriesPct - inputs.payablePct) / 100;
  const terminalGrowth = inputs.longTermGrowthRate / 100;

  if (wacc <= terminalGrowth) throw new Error("WACC must be higher than terminal growth rate.");

  let revPrev = revenue0;
  let nwcPrev = revenue0 * nwcp;
  let pvFcffSum = 0;
  const forecast = [];

  for (let y = 1; y <= inputs.forecastYears; y++) {
    const revenue = revPrev * (1 + growth);
    const ebit = revenue * ebitMargin;
    const nopat = ebit * (1 - taxRate);
    const da = revenue * daPct;
    const capex = revenue * capexPct;
    const nwc = revenue * nwcp;
    const deltaNwc = nwc - nwcPrev;
    const fcff = nopat + da - capex - deltaNwc;
    const pvFcff = fcff / Math.pow(1 + wacc, y);

    forecast.push({ year: y, revenue, fcff, pvFcff });
    pvFcffSum += pvFcff;
    revPrev = revenue;
    nwcPrev = nwc;
  }

  const finalFcff = forecast[forecast.length - 1].fcff;
  const terminalValue = (finalFcff * (1 + terminalGrowth)) / (wacc - terminalGrowth);
  const pvTV = terminalValue / Math.pow(1 + wacc, inputs.forecastYears);
  const ev = pvFcffSum + pvTV;
  const equityValue = ev + cash - debt;
  const fairValue = equityValue / shares;

  return { 
    wacc, forecast, pvTerminalValue: pvTV, enterpriseValue: ev, 
    equityValue, fairValuePerShare: fairValue, 
    currentPrice: Number(payload.currentPrice || 0),
    upsidePct: payload.currentPrice ? ((fairValue / payload.currentPrice) - 1) * 100 : 0
  };
}

function renderDCFResult(result) {
  document.getElementById("dcfFairValue").textContent = fmtMoney(result.fairValuePerShare);
  document.getElementById("dcfCurrentPrice").textContent = fmtMoney(result.currentPrice);
  document.getElementById("dcfUpside").textContent = fmtPct(result.upsidePct);
  document.getElementById("dcfWaccUsed").textContent = fmtPct(result.wacc * 100);

  const rows = result.forecast.map(r => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">Year ${r.year}</td>
      <td style="text-align:right;padding:8px;border-bottom:1px solid #eee">${fmtMoney(r.revenue)}</td>
      <td style="text-align:right;padding:8px;border-bottom:1px solid #eee">${fmtMoney(r.fcff)}</td>
      <td style="text-align:right;padding:8px;border-bottom:1px solid #eee">${fmtMoney(r.pvFcff)}</td>
    </tr>`).join("");

  document.getElementById("dcfForecastTableWrap").innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr style="background:#f5f5f5">
        <th style="text-align:left;padding:8px">Year</th><th style="text-align:right;padding:8px">Revenue</th>
        <th style="text-align:right;padding:8px">FCFF</th><th style="text-align:right;padding:8px">PV</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="border-top:2px solid #ddd"><td colspan="3" style="text-align:right;padding:4px"><b>Enterprise Value</b></td><td style="text-align:right">${fmtMoney(result.enterpriseValue)}</td></tr>
        <tr><td colspan="3" style="text-align:right;padding:4px"><b>Equity Value</b></td><td style="text-align:right">${fmtMoney(result.equityValue)}</td></tr>
      </tfoot>
    </table>`;
}

async function runDCF() {
  const explain = document.getElementById("dcfExplain");
  const symbol = document.getElementById("dcfSymbol").value;
  try {
    explain.textContent = `Loading data for ${symbol}...`;
    const payload = await fetchDCF(symbol);
    dcfLoadedPayload = payload;
    dcfHasLoadedData = true;
    fillDCFInputs(payload);
    renderDCFLoadedData(payload);
    clearDCFValuationOutput();
    explain.textContent = `Data loaded for ${symbol}. Review assumptions, then click Calculate DCF.`;
  } catch (err) {
    dcfLoadedPayload = null;
    dcfHasLoadedData = false;
    explain.textContent = `Error: ${err.message}`;
    console.error(err);
  }
}

async function loadDCFData() {
  return runDCF();
}

function calculateDCFAction() {
  const explain = document.getElementById("dcfExplain");
  if (!dcfLoadedPayload || !dcfHasLoadedData) {
    explain.textContent = "Load data first.";
    return;
  }
  try {
    const inputs = getDCFInputs();
    const result = calculateDCF(dcfLoadedPayload, inputs);
    renderDCFResult(result);
    explain.textContent = `${safeText(dcfLoadedPayload.symbol)} valuation complete. Based on a ${inputs.forecastYears}-year model.`;
  } catch (err) {
    explain.textContent = `Error: ${err.message}`;
    console.error(err);
  }
}

function resetDCFToSource() {
  const explain = document.getElementById("dcfExplain");
  if (dcfLoadedPayload && dcfHasLoadedData) {
    fillDCFInputs(dcfLoadedPayload);
    explain.textContent = `Assumptions reset to loaded source data for ${safeText(dcfLoadedPayload.symbol)}.`;
    return;
  }
  resetDCFInputs();
  explain.textContent = "Assumptions reset to defaults. Load data to source assumptions.";
}

document.addEventListener("DOMContentLoaded", () => {
  bindDCFButton();
  initDCFUI();
});

// Keep inline onclick handlers stable across refactors.
window.openDCF = openDCF;
window.closeDCF = closeDCF;
window.resetDCFInputs = resetDCFInputs;
window.loadDCFData = loadDCFData;
window.calculateDCFAction = calculateDCFAction;
window.resetDCFToSource = resetDCFToSource;
window.bindDCFButton = bindDCFButton;
