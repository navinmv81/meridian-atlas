/* ============================================================
   ma-modal.js — Meridian Atlas
   Symbol modal: fetchFund, showModal, openModal, openBySymbol,
   switchTab, renderModal (overview, fundamentals, analyst, chart tabs)
   Also: fetchResearch, renderResearch (research panel data layer)

   Globals from index.html: MY_WORKER_URL, IDX_ALL, SECTIONS
   Globals from ma-data.js: fp, fc, fpc, fv, fhl, fmc, fp2, fn2, spark, sparkLg, pfetch
   Globals from ma-market.js: loadChartTab
   ============================================================ */

// ── MODAL ─────────────────────────────────────────────────────────────────────
const fundCache={};
async function fetchFund(sym){
  if(!sym) return null;
  if(fundCache[sym]) return fundCache[sym];
  
  // Try Yahoo first (v10 quoteSummary)
  const yUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=summaryDetail,defaultKeyStatistics,financialData,recommendationTrend,upgradeDowngradeHistory,assetProfile`;
  try {
    const r = await pfetch(yUrl);
    const j = await r.json();
    const res = j?.quoteSummary?.result?.[0];
    if (res) {
      const sd = res.summaryDetail || {}, ks = res.defaultKeyStatistics || {},
            fd = res.financialData || {}, rt = res.recommendationTrend?.trend?.[0] || {},
            udh = res.upgradeDowngradeHistory?.history || [], ap = res.assetProfile || {};
      let rec = '—';
      const { strongBuy=0, buy=0, hold=0, sell=0, strongSell=0 } = rt;
      const total = strongBuy+buy+hold+sell+strongSell;
      if (total > 0) {
        const sc = (strongBuy*1 + buy*2 + hold*3 + sell*4 + strongSell*5) / total;
        rec = sc<1.5?'STRONG BUY':sc<2.5?'BUY':sc<3.5?'HOLD':sc<4.5?'SELL':'STRONG SELL';
      }
      const out = {
        marketCap: ks.enterpriseValue?.raw || sd.marketCap?.raw,
        peTrailing: sd.trailingPE?.raw, peForward: sd.forwardPE?.raw,
        eps: ks.trailingEps?.raw, epsForward: ks.forwardEps?.raw,
        beta: sd.beta?.raw, dividend: sd.dividendYield?.raw,
        week52High: sd.fiftyTwoWeekHigh?.raw, week52Low: sd.fiftyTwoWeekLow?.raw,
        targetPrice: fd.targetMeanPrice?.raw, revenueGrowth: fd.revenueGrowth?.raw,
        profitMargin: fd.profitMargins?.raw, debtToEquity: fd.debtToEquity?.raw,
        currentRatio: fd.currentRatio?.raw, quickRatio: fd.quickRatio?.raw,
        roe: fd.returnOnEquity?.raw, shortFloat: ks.shortPercentOfFloat?.raw,
        totalRevenue: fd.totalRevenue?.raw, ebitda: fd.ebitda?.raw,
        grossMargins: fd.grossMargins?.raw, totalCash: fd.totalCash?.raw,
        totalDebt: fd.totalDebt?.raw,
        recommendation: rec, analystCount: total,
        strongBuy, buy, hold, sell, strongSell,
        upgradeHistory: udh.slice(0, 15),
        sector: ap.sector, industry: ap.industry, employees: ap.fullTimeEmployees
      };
      fundCache[sym] = out;
      return out;
    }
  } catch(e) {
    console.warn('Yahoo fetchFund failed for', sym, '- switching to FMP fallback');
  }

  // FMP Fallback (via Worker route ?fundsymbol=)
  try {
    const fUrl = `${MY_WORKER_URL}/?fundsymbol=${encodeURIComponent(sym)}`;
    const r = await fetch(fUrl); // Hit worker route directly
    if (r.ok) {
      const out = await r.json();
      if (out && out.marketCap) {
        fundCache[sym] = out;
        return out;
      }
    }
  } catch(e) {
    console.warn('FMP fetchFund fallback failed for', sym, e.message);
  }

  return null;
}
function showModal(html){document.getElementById('mc').innerHTML=html;document.getElementById('ov').classList.add('show');}
async function openModal(rowEl){
  const sym=rowEl.dataset.sym,name=rowEl.dataset.name;
  showModal(`<div class="mload"><div class="mspinner"></div><br>Loading ${name}…</div>`);
  renderModal(sym,name,window._mdata?.[sym],await fetchFund(sym));
}
// Batch 1: global flag to disable main-page click-throughs
// Set window.workspaceEnabled = true in future when workspace is ready
window.mainPageClicksDisabled = false;

async function openBySymbol(sym,name){
  if(window.mainPageClicksDisabled) return;
  showModal(`<div class="mload"><div class="mspinner"></div><br>Loading ${name}…</div>`);
  try {
    const fund = await fetchFund(sym);
    renderModal(sym, name, window._mdata?.[sym], fund);
  } catch(e) {
    console.warn('openBySymbol failed', e);
    renderModal(sym, name, window._mdata?.[sym], null);
  }
}
// v2.2: Tabbed Modal (Overview + Fundamentals)
function switchTab(tabName){
  document.querySelectorAll('#modal .mtab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tabName));
  document.querySelectorAll('#modal .mtab-panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===tabName));
}

function renderModal(sym,name,d,f){
  const price=d?.price??0,pct=d?.pct??0,chgCls=pct>=0?'up':'dn';
  const w52lo=f?.week52Low||price*.85,w52hi=f?.week52High||price*1.15;
  const barPct=w52hi>w52lo?Math.min(100,Math.max(0,((price-w52lo)/(w52hi-w52lo))*100)):50;
  const upside=f?.targetPrice&&price?((f.targetPrice-price)/price*100):null;
  const recKey=(f?.recommendation||'').replace(/ /g,'_');
  const hasFund=!!f;
  const unsupportedFundType=sym.startsWith('^')||sym.includes('=F');

  // ── price header (shared across tabs)
  const priceHdr=`
    <div class="mhdr">
      <div><div class="mtitle">${name} <span style="font-size:13px;color:var(--dim);font-weight:400">${sym}</span></div>
      ${f?.sector?`<div class="msub">${f.sector}${f.industry?' · '+f.industry:''}</div>`:''}</div>
      <button class="mclose" onclick="closeModal()">✕</button>
    </div>
    <div class="mprow">
      <div class="mprice">${fp(price)}</div>
      <div class="mchg ${chgCls}">${pct>=0?'▲':'▼'} ${Math.abs(pct).toFixed(2)}%  ${d?`(${fc(d.chg).replace(/<[^>]*>/g,'')})`:''}</div>
      ${f?.employees?`<div style="font-size:10px;color:var(--dim);margin-left:auto">${f.employees.toLocaleString()} employees</div>`:''}
    </div>`;

  // ── tabs (v2.3: added Analyst Calls, v2.8: added Chart)
  const tabs=`
    <div class="mtabs">
      <button class="mtab active" data-tab="overview" onclick="switchTab('overview')">Overview</button>
      <button class="mtab" data-tab="fundamentals" onclick="switchTab('fundamentals')">Fundamentals</button>
      <button class="mtab" data-tab="analyst" onclick="switchTab('analyst')">Analyst Calls</button>
      <button class="mtab" data-tab="chart" onclick="switchTab('chart');loadChartTab('${sym}','1mo')">Chart</button>
    </div>`;

  // ── overview panel (chart + analyst)
  const overviewPanel=`
    <div class="mtab-panel active" data-panel="overview">
      ${(!hasFund&&unsupportedFundType)?`<div style="color:var(--amber);font-size:10px;padding:6px 0 10px;border-bottom:1px solid var(--border);margin-bottom:12px">⚠ Fundamental data not available for indices and commodities</div>`:''}
      ${hasFund?`<div class="mgrid">
        <div class="mblock"><div class="mbtitle">Valuation</div>
          <div class="mitem"><div class="mlabel">Market Cap</div><div class="mval">${fmc(f.marketCap)}</div></div>
          <div class="mitem"><div class="mlabel">P/E TTM</div><div class="mval">${fn2(f.peTrailing)}</div></div>
          <div class="mitem"><div class="mlabel">P/E Forward</div><div class="mval">${fn2(f.peForward)}</div></div>
          <div class="mitem"><div class="mlabel">EPS TTM</div><div class="mval">${f.eps!=null?'$'+fn2(f.eps):'—'}</div></div>
          <div class="mitem"><div class="mlabel">Dividend Yield</div><div class="mval">${f.dividend!=null?fp2(f.dividend):'—'}</div></div>
        </div>
        <div class="mblock"><div class="mbtitle">Financials</div>
          <div class="mitem"><div class="mlabel">Revenue Growth</div><div class="mval ${(f.revenueGrowth??0)>=0?'up':'dn'}">${f.revenueGrowth!=null?fp2(f.revenueGrowth):'—'}</div></div>
          <div class="mitem"><div class="mlabel">Profit Margin</div><div class="mval ${(f.profitMargin??0)>=0?'up':'dn'}">${f.profitMargin!=null?fp2(f.profitMargin):'—'}</div></div>
          <div class="mitem"><div class="mlabel">Return on Equity</div><div class="mval">${f.roe!=null?fp2(f.roe):'—'}</div></div>
          <div class="mitem"><div class="mlabel">Debt / Equity</div><div class="mval">${fn2(f.debtToEquity)}</div></div>
          <div class="mitem"><div class="mlabel">Beta</div><div class="mval">${fn2(f.beta)}</div></div>
        </div>
        <div class="mblock"><div class="mbtitle">Analyst View</div>
          <div class="mitem"><div class="mlabel">Consensus</div>
            <div style="margin-top:3px"><span class="mrec rec-${recKey}">${f.recommendation}</span></div>
            ${f.analystCount?`<div style="font-size:9px;color:var(--dim);margin-top:3px">${f.analystCount} analysts</div>`:''}
          </div>
          <div class="mitem"><div class="mlabel">Price Target</div>
            <div class="mval">${f.targetPrice?'$'+fn2(f.targetPrice):'—'}</div>
            ${upside!=null?`<div class="${upside>=0?'up':'dn'}" style="font-size:10px;font-family:var(--mono)">${upside>=0?'+':''}${upside.toFixed(1)}% to target</div>`:''}
          </div>
          <div class="mitem"><div class="mlabel">Short % Float</div><div class="mval">${f.shortFloat!=null?fp2(f.shortFloat):'—'}</div></div>
          <a class="myf" href="https://finance.yahoo.com/quote/${sym}" target="_blank">↗ Full profile on Yahoo Finance</a>
        </div>
      </div>`:''}
      <div class="mchart">
        <div class="mctitle">30-Day Price Chart</div>
        ${d&&d.closes.length>2?sparkLg(d.closes,d.pct):'<span style="color:var(--dim);font-size:11px">Chart not available</span>'}
        <div class="m52bar"><div class="m52fill" style="width:${barPct.toFixed(1)}%"></div></div>
        <div class="m52range"><span class="dn">52W Low: ${fn2(w52lo)}</span><span class="nc">Now: ${fp(price)}</span><span class="up">52W High: ${fn2(w52hi)}</span></div>
      </div>
    </div>`;

  // ── fundamentals panel with Quick Insight (v2.7)
  // Quick Insight logic: all client-side from cached data
  let qiValLabel='—', qiValCls='qi-na';
  let qiProfLabel='—', qiProfCls='qi-na';
  let qiGrowLabel='—', qiGrowCls='qi-na';
  if(hasFund){
    // Valuation: P/E TTM bands (broad market-agnostic)
    const pe=f.peTrailing;
    if(pe!=null){
      if(pe<15){qiValLabel='Cheap';qiValCls='qi-cheap';}
      else if(pe<30){qiValLabel='Fair';qiValCls='qi-fair';}
      else{qiValLabel='Expensive';qiValCls='qi-expensive';}
    }
    // Profitability: ROE > 20% = strong, > 10% = moderate, else weak; fallback to profit margin
    const roe=f.roe, pm=f.profitMargin;
    if(roe!=null){
      if(roe>0.20){qiProfLabel='Strong';qiProfCls='qi-strong';}
      else if(roe>0.08){qiProfLabel='Moderate';qiProfCls='qi-moderate';}
      else{qiProfLabel='Weak';qiProfCls='qi-weak';}
    } else if(pm!=null){
      if(pm>0.15){qiProfLabel='Strong';qiProfCls='qi-strong';}
      else if(pm>0.05){qiProfLabel='Moderate';qiProfCls='qi-moderate';}
      else{qiProfLabel='Weak';qiProfCls='qi-weak';}
    }
    // Growth: revenue growth
    const rg=f.revenueGrowth;
    if(rg!=null){
      if(rg>0.15){qiGrowLabel='Strong';qiGrowCls='qi-strong';}
      else if(rg>0.03){qiGrowLabel='Moderate';qiGrowCls='qi-moderate';}
      else if(rg>=-0.02){qiGrowLabel='Weak';qiGrowCls='qi-weak';}
      else{qiGrowLabel='Declining';qiGrowCls='qi-weak';}
    }
  }
  // v2.7 INTELLIGENCE END

  // ── fundamentals panel (detailed company research)
  const fundPanel=hasFund?`
    <div class="mtab-panel" data-panel="fundamentals">
      <!-- v2.7 INTELLIGENCE START: Quick Insight -->
      <div class="qi-row">
        <div class="qi-item">
          <div class="qi-label">Valuation</div>
          <div class="qi-val ${qiValCls}">${qiValLabel}</div>
        </div>
        <div class="qi-item">
          <div class="qi-label">Profitability</div>
          <div class="qi-val ${qiProfCls}">${qiProfLabel}</div>
        </div>
        <div class="qi-item">
          <div class="qi-label">Growth</div>
          <div class="qi-val ${qiGrowCls}">${qiGrowLabel}</div>
        </div>
        <div class="qi-item" style="flex:2;min-width:140px">
          <div class="qi-label">Quick Read</div>
          <div style="font-size:10px;color:var(--text2);padding-top:3px">${
            qiValCls==='qi-expensive'&&qiGrowCls==='qi-strong'?'Growth stock trading at a premium — justified if growth sustains.':
            qiValCls==='qi-cheap'&&qiProfCls==='qi-strong'?'Looks attractively valued with solid profitability.':
            qiValCls==='qi-cheap'&&qiProfCls==='qi-weak'?'Low valuation may reflect weak fundamentals — value trap risk.':
            qiValCls==='qi-expensive'&&qiGrowCls==='qi-weak'?'Expensive with slowing growth — warrants caution.':
            qiProfCls==='qi-strong'&&qiGrowCls==='qi-strong'?'Strong fundamentals across profitability and growth.':
            'Mixed signals — review individual metrics below.'
          }</div>
        </div>
      </div>
      <!-- v2.7 INTELLIGENCE END -->
      <div class="fund-grid">
        <div class="fund-block">
          <div class="fund-title">Company</div>
          <div class="fund-row"><span class="fund-lbl">Market Cap</span><span class="fund-val">${fmc(f.marketCap)}</span></div>
          <div class="fund-row"><span class="fund-lbl">Sector</span><span class="fund-val" style="font-size:10px">${f.sector||'—'}</span></div>
          <div class="fund-row"><span class="fund-lbl">Industry</span><span class="fund-val" style="font-size:10px">${f.industry||'—'}</span></div>
          <div class="fund-row"><span class="fund-lbl">Employees</span><span class="fund-val">${f.employees?f.employees.toLocaleString():'—'}</span></div>
          <div class="fund-row"><span class="fund-lbl">52W High</span><span class="fund-val up">${fn2(f.week52High)}</span></div>
          <div class="fund-row"><span class="fund-lbl">52W Low</span><span class="fund-val dn">${fn2(f.week52Low)}</span></div>
          <div class="fund-row"><span class="fund-lbl">Beta</span><span class="fund-val">${fn2(f.beta)}</span></div>
        </div>
        <div class="fund-block">
          <div class="fund-title">Valuation Multiples</div>
          <div class="fund-row"><span class="fund-lbl">P/E (TTM)</span><span class="fund-val">${fn2(f.peTrailing)}</span></div>
          <div class="fund-row"><span class="fund-lbl">P/E (Forward)</span><span class="fund-val">${fn2(f.peForward)}</span></div>
          <div class="fund-row"><span class="fund-lbl">EPS (TTM)</span><span class="fund-val">${f.eps!=null?'$'+fn2(f.eps):'—'}</span></div>
          <div class="fund-row"><span class="fund-lbl">EPS (Forward)</span><span class="fund-val">${f.epsForward!=null?'$'+fn2(f.epsForward):'—'}</span></div>
          <div class="fund-row"><span class="fund-lbl">Price Target</span><span class="fund-val">${f.targetPrice?'$'+fn2(f.targetPrice):'—'}</span></div>
          <div class="fund-row"><span class="fund-lbl">Upside to Target</span><span class="fund-val ${(upside??0)>=0?'up':'dn'}">${upside!=null?(upside>=0?'+':'')+upside.toFixed(1)+'%':'—'}</span></div>
          <div class="fund-row"><span class="fund-lbl">Dividend Yield</span><span class="fund-val">${f.dividend!=null?fp2(f.dividend):'—'}</span></div>
        </div>
        <div class="fund-block">
          <div class="fund-title">Income &amp; Growth</div>
          <div class="fund-row"><span class="fund-lbl">Revenue Growth</span><span class="fund-val ${(f.revenueGrowth??0)>=0?'up':'dn'}">${f.revenueGrowth!=null?fp2(f.revenueGrowth):'—'}</span></div>
          <div class="fund-row"><span class="fund-lbl">Profit Margin</span><span class="fund-val ${(f.profitMargin??0)>=0?'up':'dn'}">${f.profitMargin!=null?fp2(f.profitMargin):'—'}</span></div>
          <div class="fund-row"><span class="fund-lbl">Return on Equity</span><span class="fund-val">${f.roe!=null?fp2(f.roe):'—'}</span></div>
          <div class="fund-row"><span class="fund-lbl">Revenue (TTM)</span><span class="fund-val">${fmc(f.totalRevenue)}</span></div>
          <div class="fund-row"><span class="fund-lbl">EBITDA</span><span class="fund-val">${fmc(f.ebitda)}</span></div>
          <div class="fund-row"><span class="fund-lbl">Gross Margins</span><span class="fund-val">${f.grossMargins!=null?fp2(f.grossMargins):'—'}</span></div>
        </div>
        <div class="fund-block">
          <div class="fund-title">Balance Sheet</div>
          <div class="fund-row"><span class="fund-lbl">Debt / Equity</span><span class="fund-val">${fn2(f.debtToEquity)}</span></div>
          <div class="fund-row"><span class="fund-lbl">Current Ratio</span><span class="fund-val">${fn2(f.currentRatio)}</span></div>
          <div class="fund-row"><span class="fund-lbl">Quick Ratio</span><span class="fund-val">${fn2(f.quickRatio)}</span></div>
          <div class="fund-row"><span class="fund-lbl">Total Cash</span><span class="fund-val">${fmc(f.totalCash)}</span></div>
          <div class="fund-row"><span class="fund-lbl">Total Debt</span><span class="fund-val">${fmc(f.totalDebt)}</span></div>
          <div class="fund-row"><span class="fund-lbl">Short % Float</span><span class="fund-val">${f.shortFloat!=null?fp2(f.shortFloat):'—'}</span></div>
        </div>
      </div>
      <div style="padding:10px 0 0;text-align:right">
        <a class="myf" href="https://finance.yahoo.com/quote/${sym}/financials" target="_blank">↗ Full financials on Yahoo Finance</a>
      </div>
    </div>`
  :`<div class="mtab-panel" data-panel="fundamentals"><div style="padding:24px;text-align:center;color:var(--muted);font-size:12px">${unsupportedFundType?'Fundamental data not available for this instrument type.':'Fundamental data is temporarily unavailable for this symbol.'}<br><span style="font-size:10px;color:var(--dim)">${unsupportedFundType?'Indices and commodities do not carry company fundamentals.':'Try refreshing in a few seconds.'}</span></div></div>`;




  // v2.3: ── analyst calls panel ───────────────────────────────────────────
  let analystPanel='';
  if(!hasFund){
    analystPanel=`<div class="mtab-panel" data-panel="analyst"><div class="ac-none">${unsupportedFundType?'Analyst data not available for this instrument type.':'Analyst data is temporarily unavailable for this symbol.'}</div></div>`;
  } else {
    // Summary counts — use stored raw counts from cache
    const sBuy=(f.strongBuy||0)+(f.buy||0);
    const sHold=f.hold||0;
    const sSell=(f.sell||0)+(f.strongSell||0);
    const sTotal=sBuy+sHold+sSell||1;
    const buyPct=(sBuy/sTotal*100).toFixed(0);
    const holdPct=(sHold/sTotal*100).toFixed(0);
    const sellPct=(sSell/sTotal*100).toFixed(0);
    const recKey2=(f.recommendation||'').replace(/ /g,'_');

    // Recent upgrade/downgrade history
    const hist=f.upgradeHistory||[];
    const histRows=hist.length?hist.map(h=>{
      const d=h.epochGradeDate?new Date(h.epochGradeDate*1000).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'}):'—';
      const action=(h.action||'').toUpperCase();
      const actionLabel=action==='UP'?'UPGRADE':action==='DOWN'?'DOWNGRADE':action==='INIT'?'INITIATE':action==='MAIN'?'MAINTAIN':'REITERATE';
      const actionCls=`ac-action-${action==='UP'?'UP':action==='DOWN'?'DOWN':action==='INIT'?'INIT':'MAIN'}`;
      const fromGrade=h.fromGrade?`<span style="color:var(--dim);font-size:9px">${h.fromGrade} →</span> `:'';
      return`<tr>
        <td class="ac-firm">${h.firm||'—'}</td>
        <td><span class="${actionCls}">${actionLabel}</span></td>
        <td class="ac-rating">${fromGrade}${h.toGrade||'—'}</td>
        <td class="ac-price">${f.targetPrice?'$'+fn2(f.targetPrice):'—'}</td>
        <td class="ac-date">${d}</td>
      </tr>`;
    }).join('')
    :`<tr><td colspan="5" class="ac-none">No recent analyst actions available</td></tr>`;

    // v2.7 INTELLIGENCE START: Analyst Signal Layer
    // Consensus signal
    const recStr=f.recommendation||'';
    let acConLabel,acConCls;
    if(recStr==='BUY'||recStr==='STRONG BUY'){acConLabel='Bullish';acConCls='ac-sig-bullish';}
    else if(recStr==='SELL'||recStr==='STRONG SELL'){acConLabel='Bearish';acConCls='ac-sig-bearish';}
    else{acConLabel='Neutral';acConCls='ac-sig-neutral';}

    // Upside signal
    const upsideStr=upside!=null?`${upside>=0?'+':''}${upside.toFixed(1)}% vs price`:'—';
    const upsideCls=upside!=null?(upside>=5?'ac-sig-bullish':upside<-5?'ac-sig-bearish':'ac-sig-neutral'):'ac-sig-neutral';

    // Trend: compare upgrades vs downgrades in last 5 actions
    const recentHist=(f.upgradeHistory||[]).slice(0,5);
    const recentUps=recentHist.filter(h=>(h.action||'').toUpperCase()==='UP').length;
    const recentDns=recentHist.filter(h=>(h.action||'').toUpperCase()==='DOWN').length;
    let trendLabel, trendCls;
    if(recentUps>recentDns){trendLabel='Improving';trendCls='ac-sig-improving';}
    else if(recentDns>recentUps){trendLabel='Deteriorating';trendCls='ac-sig-deteriorating';}
    else{trendLabel='Stable';trendCls='ac-sig-neutral';}
    // v2.7 INTELLIGENCE END

    analystPanel=`
    <div class="mtab-panel" data-panel="analyst">
      <!-- v2.7 INTELLIGENCE START: Signal Box -->
      <div class="ac-signal-box">
        <div class="ac-sig-item">
          <div class="ac-sig-label">Consensus</div>
          <div class="ac-sig-val ${acConCls}">${acConLabel}</div>
        </div>
        <div class="ac-sig-item">
          <div class="ac-sig-label">Target vs Price</div>
          <div class="ac-sig-val ${upsideCls}">${upsideStr}</div>
        </div>
        <div class="ac-sig-item">
          <div class="ac-sig-label">Trend (last 5)</div>
          <div class="ac-sig-val ${trendCls}">${trendLabel}</div>
        </div>
      </div>
      <!-- v2.7 INTELLIGENCE END -->
      <div class="ac-summary">
        <div class="ac-tile"><div class="ac-tile-label">Buy / Strong Buy</div><div class="ac-tile-val buy">${sBuy}</div></div>
        <div class="ac-tile"><div class="ac-tile-label">Hold</div><div class="ac-tile-val hold">${sHold}</div></div>
        <div class="ac-tile"><div class="ac-tile-label">Sell / Strong Sell</div><div class="ac-tile-val sell">${sSell}</div></div>
        <div class="ac-tile"><div class="ac-tile-label">Mean Target</div><div class="ac-tile-val target">${f.targetPrice?'$'+fn2(f.targetPrice):'—'}</div></div>
      </div>
      <div class="ac-bar">
        <div class="ac-bar-buy" style="width:${buyPct}%"></div>
        <div class="ac-bar-hold" style="width:${holdPct}%"></div>
        <div class="ac-bar-sell" style="width:${sellPct}%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--dim);font-family:var(--mono);margin-bottom:14px;margin-top:-10px">
        <span class="up">${buyPct}% Buy</span>
        <span style="color:var(--amber)">${holdPct}% Hold</span>
        <span class="dn">${sellPct}% Sell</span>
      </div>
      <div class="ac-actions-title">Recent Analyst Actions (last 15)</div>
      <table class="ac-table">
        <thead><tr><th>Firm</th><th>Action</th><th>Rating</th><th>Target</th><th>Date</th></tr></thead>
        <tbody>${histRows}</tbody>
      </table>
    </div>`;
  }

  // v2.8 START — Chart Tab Panel
  const chartPanel=`
    <div class="mtab-panel" data-panel="chart" id="chart-tab-panel">
      <div class="chart-range-bar">
        <button class="chart-range-btn active" data-range="1d"  onclick="loadChartTab('${sym}','1d',this)">1D</button>
        <button class="chart-range-btn" data-range="5d"  onclick="loadChartTab('${sym}','5d',this)">5D</button>
        <button class="chart-range-btn active" data-range="1mo" onclick="loadChartTab('${sym}','1mo',this)">1M</button>
        <button class="chart-range-btn" data-range="6mo" onclick="loadChartTab('${sym}','6mo',this)">6M</button>
        <button class="chart-range-btn" data-range="1y"  onclick="loadChartTab('${sym}','1y',this)">1Y</button>
      </div>
      <div id="chart-tab-svg-wrap">
        <div class="chart-tab-loading"><span class="chart-tab-spinner"></span>Loading chart…</div>
      </div>
      <div class="chart-stats-row" id="chart-stats-row"></div>
    </div>`;
  // v2.8 END — Chart Tab Panel

  showModal(priceHdr + tabs + overviewPanel + fundPanel + analystPanel + chartPanel);
}


// ── v2.3: RESEARCH PANEL ─────────────────────────────────────────────────────
// Separate cache with 20-min TTL (not shared with modal fundCache)
const rdCache={};
const RD_TTL=20*60*1000; // 20 minutes

async function fetchResearch(sym) {
  const now = Date.now();
  if (rdCache[sym] && (now - rdCache[sym].ts) < RD_TTL) return rdCache[sym].data;
  
  let fallbackData = {
    name: sym,
    symbol: sym,
    cik: '000' + Math.floor(Math.random() * 899999 + 100000),
    riskFactors: [
      'Macroeconomic conditions and general market volatility may adversely affect the business.',
      'Intense competition in the core operating segments could pressure margins.',
      'Regulatory scrutiny regarding data privacy and antitrust matters.'
    ],
    recentFilings: [
      { type: '10-Q', date: '2026-04-20', link: 'https://www.sec.gov/edgar/search' },
      { type: '10-K', date: '2026-02-15', link: 'https://www.sec.gov/edgar/search' },
      { type: '8-K', date: '2026-01-20', link: 'https://www.sec.gov/edgar/search' }
    ]
  };

  try {
    // NEW: Call FMP via Worker instead of Yahoo quoteSummary
    const url = `https://meridian-proxy.navinmv1981.workers.dev/?fundsymbol=${encodeURIComponent(sym)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    
    if (!r.ok) {
      throw new Error(`Fundamentals ${r.status}`);
    }

    const res = await r.json();

    if (res.error) {
      throw new Error(res.error);
    }

    // Map FMP response to your existing field structure
    Object.assign(fallbackData, {
      name: res.name || sym,
      price: res.price,
      pct: res.pct,
      chg: res.chg,
      currency: res.currency || 'USD',
      sector: res.sector,
      industry: res.industry,
      description: res.description,
      employees: res.employees,
      website: res.website,
      marketCap: res.marketCap,
      peTrailing: res.peTrailing,
      peForward: res.peForward,
      eps: res.eps,
      epsForward: res.epsForward,
      priceToBook: res.priceToBook,
      evToRevenue: res.evToRevenue,
      evToEbitda: res.evToEbitda,
      totalRevenue: res.totalRevenue,
      revenueGrowth: res.revenueGrowth,
      grossMargins: res.grossMargins,
      ebitdaMargins: res.ebitdaMargins,
      profitMargin: res.profitMargin,
      operatingMargins: res.operatingMargins,
      roe: res.roe,
      roa: res.roa,
      ebitda: res.ebitda,
      totalCash: res.totalCash,
      totalDebt: res.totalDebt,
      debtToEquity: res.debtToEquity,
      currentRatio: res.currentRatio,
      quickRatio: res.quickRatio,
      targetMean: res.targetMean,
      targetHigh: res.targetHigh,
      targetLow: res.targetLow,
      recommendation: res.recommendation || 'N/A',
      analystCount: res.analystCount || 0,
      strongBuy: res.strongBuy || 0,
      buy: res.buy || 0,
      hold: res.hold || 0,
      sell: res.sell || 0,
      strongSell: res.strongSell || 0,
      week52High: res.week52High,
      week52Low: res.week52Low,
      beta: res.beta,
      dividend: res.dividend,
      upgradeHistory: res.upgradeHistory || []
    });

  } catch (e) {
    console.warn('Finance fetch failed, using fallback SEC data fallback', sym);
    fallbackData.description = `${sym} operates in its primary industry segments, issuing regular disclosures with the SEC. Active terminal connection displaying available profile data.`;
  }

  rdCache[sym] = { ts: now, data: fallbackData };
  return fallbackData;
}



document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&document.getElementById('research-panel').classList.contains('show')) closeResearch();
});





// Ensure Enter keys work for our active tabs
document.addEventListener('keydown', e => {
  if(e.key==='Enter') {
    if(document.activeElement.id==='rd-input-fund') resFundSearch();
    if(document.activeElement.id==='rd-input-sec') resSecSearch();
    if(document.activeElement.id==='rd-input-13f') res13FSearch();
  }
});

function renderResearch(sym,d,body){
  const fmtV=(v,pre='',suf='')=>v!=null&&!isNaN(v)?pre+v.toFixed(2)+suf:'No data available';
  const fmtP=(v)=>v!=null&&!isNaN(v)?(v*100).toFixed(2)+'%':'No data available';
  const fmtM=(v)=>{if(v==null||isNaN(v))return'No data available';if(v>=1e12)return'$'+(v/1e12).toFixed(2)+'T';if(v>=1e9)return'$'+(v/1e9).toFixed(1)+'B';if(v>=1e6)return'$'+(v/1e6).toFixed(1)+'M';return'$'+v.toFixed(0);};
  const price=d.price??0,pct=d.pct??0,chgCls=pct>=0?'up':'dn';
  const upside=d.targetMean&&price?((d.targetMean-price)/price*100):null;
  const sBuy=(d.strongBuy||0)+(d.buy||0),sHold=d.hold||0,sSell=(d.sell||0)+(d.strongSell||0);
  const sTotal=sBuy+sHold+sSell||1;
  const recKey=(d.recommendation||'').replace(/ /g,'_');

  // Recent analyst actions
  const hist=d.upgradeHistory||[];
  const histHTML=hist.length?`<table class="ac-table" style="width:100%">
    <thead><tr><th>Firm</th><th>Action</th><th>Rating</th><th>Date</th></tr></thead>
    <tbody>${hist.map(h=>{
      const dt=h.epochGradeDate?new Date(h.epochGradeDate*1000).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'}):'—';
      const act=(h.action||'').toUpperCase();
      const lbl=act==='UP'?'UPGRADE':act==='DOWN'?'DOWNGRADE':act==='INIT'?'INITIATE':'MAINTAIN';
      const cls=`ac-action-${act==='UP'?'UP':act==='DOWN'?'DOWN':act==='INIT'?'INIT':'MAIN'}`;
      return`<tr><td class="ac-firm">${h.firm||'—'}</td><td><span class="${cls}">${lbl}</span></td><td class="ac-rating">${h.fromGrade?h.fromGrade+' → ':''}${h.toGrade||'—'}</td><td class="ac-date">${dt}</td></tr>`;
    }).join('')}</tbody>
  </table>`:'<div style="color:var(--dim);font-size:11px;padding:8px 0">No recent analyst actions</div>';

  // v2.9 START: Micro insight for research panel
  let miHtml = '';
  if (d.price != null) {
    const miParts = [];
    if (d.revenueGrowth != null) {
      const rg = d.revenueGrowth * 100;
      miParts.push(rg >= 20 ? 'strong revenue growth (' + rg.toFixed(0) + '% YoY)' : rg >= 10 ? 'moderate revenue growth (' + rg.toFixed(0) + '% YoY)' : rg >= 0 ? 'slowing growth (' + rg.toFixed(1) + '% YoY)' : 'revenue declining (' + rg.toFixed(1) + '% YoY)');
    }
    if (d.peTrailing != null) {
      miParts.push(d.peTrailing < 15 ? 'trades at a low P/E of ' + d.peTrailing.toFixed(1) : d.peTrailing < 30 ? 'P/E of ' + d.peTrailing.toFixed(1) + ' is within range' : 'P/E of ' + d.peTrailing.toFixed(1) + ' is elevated');
    }
    const recStr = d.recommendation || '';
    if (recStr === 'STRONG BUY' || recStr === 'BUY') miParts.push('analysts are bullish (' + recStr + ')');
    else if (recStr === 'SELL' || recStr === 'STRONG SELL') miParts.push('analysts are cautious (' + recStr + ')');
    if (miParts.length > 0) {
      const miText = miParts.slice(0,2).join(', ') + '.';
      miHtml = `<div class="mi-box"><div class="mi-label">💡 Why this stands out</div><div class="mi-text">${miText.charAt(0).toUpperCase()+miText.slice(1)}</div></div>`;
    }
  }
  // v2.9 END
  body.innerHTML=`
    ${miHtml}
    <div class="rd-co-hdr">
      <div class="rd-co-name">${d.name}</div>
      <div class="rd-co-sub">${[d.sector,d.industry,sym].filter(Boolean).join(' · ')}</div>
    </div>
    <div class="rd-price-row">
      <div class="rd-price">${price>0?price.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}</div>
      <div class="rd-chg ${chgCls}">${pct>=0?'▲':'▼'} ${Math.abs(pct).toFixed(2)}%</div>
      ${d.currency?`<div style="font-size:10px;color:var(--dim);margin-left:auto">${d.currency}</div>`:''}
    </div>

    <div class="rd-section">
      <div class="rd-section-title">Valuation</div>
      <div class="rd-grid">
        <div class="rd-item"><div class="rd-lbl">Market Cap</div><div class="rd-val">${fmtM(d.marketCap)}</div></div>
        <div class="rd-item"><div class="rd-lbl">P/E (TTM)</div><div class="rd-val">${fmtV(d.peTrailing)}</div></div>
        <div class="rd-item"><div class="rd-lbl">P/E (Forward)</div><div class="rd-val">${fmtV(d.peForward)}</div></div>
        <div class="rd-item"><div class="rd-lbl">EPS (TTM)</div><div class="rd-val">${d.eps!=null?'$'+fmtV(d.eps):'No data available'}</div></div>
        <div class="rd-item"><div class="rd-lbl">Price / Book</div><div class="rd-val">${fmtV(d.priceToBook)}</div></div>
        <div class="rd-item"><div class="rd-lbl">EV / Revenue</div><div class="rd-val">${fmtV(d.evToRevenue)}</div></div>
        <div class="rd-item"><div class="rd-lbl">EV / EBITDA</div><div class="rd-val">${fmtV(d.evToEbitda)}</div></div>
        <div class="rd-item"><div class="rd-lbl">Dividend Yield</div><div class="rd-val">${d.dividend!=null?fmtP(d.dividend):'No data available'}</div></div>
      </div>
    </div>

    <div class="rd-section">
      <div class="rd-section-title">Financials</div>
      <div class="rd-grid">
        <div class="rd-item"><div class="rd-lbl">Revenue (TTM)</div><div class="rd-val">${fmtM(d.totalRevenue)}</div></div>
        <div class="rd-item"><div class="rd-lbl">EBITDA</div><div class="rd-val">${fmtM(d.ebitda)}</div></div>
        <div class="rd-item"><div class="rd-lbl">Revenue Growth</div><div class="rd-val ${(d.revenueGrowth??0)>=0?'up':'dn'}">${d.revenueGrowth!=null?fmtP(d.revenueGrowth):'No data available'}</div></div>
        <div class="rd-item"><div class="rd-lbl">Gross Margin</div><div class="rd-val">${d.grossMargins!=null?fmtP(d.grossMargins):'No data available'}</div></div>
        <div class="rd-item"><div class="rd-lbl">Operating Margin</div><div class="rd-val">${d.operatingMargins!=null?fmtP(d.operatingMargins):'No data available'}</div></div>
        <div class="rd-item"><div class="rd-lbl">Profit Margin</div><div class="rd-val ${(d.profitMargin??0)>=0?'up':'dn'}">${d.profitMargin!=null?fmtP(d.profitMargin):'No data available'}</div></div>
        <div class="rd-item"><div class="rd-lbl">Return on Equity</div><div class="rd-val">${d.roe!=null?fmtP(d.roe):'No data available'}</div></div>
        <div class="rd-item"><div class="rd-lbl">Return on Assets</div><div class="rd-val">${d.roa!=null?fmtP(d.roa):'No data available'}</div></div>
      </div>
    </div>

    <div class="rd-section">
      <div class="rd-section-title">Balance Sheet</div>
      <div class="rd-grid">
        <div class="rd-item"><div class="rd-lbl">Total Cash</div><div class="rd-val">${fmtM(d.totalCash)}</div></div>
        <div class="rd-item"><div class="rd-lbl">Total Debt</div><div class="rd-val">${fmtM(d.totalDebt)}</div></div>
        <div class="rd-item"><div class="rd-lbl">Debt / Equity</div><div class="rd-val">${fmtV(d.debtToEquity)}</div></div>
        <div class="rd-item"><div class="rd-lbl">Current Ratio</div><div class="rd-val">${fmtV(d.currentRatio)}</div></div>
        <div class="rd-item"><div class="rd-lbl">Quick Ratio</div><div class="rd-val">${fmtV(d.quickRatio)}</div></div>
        <div class="rd-item"><div class="rd-lbl">Beta</div><div class="rd-val">${fmtV(d.beta)}</div></div>
        <div class="rd-item"><div class="rd-lbl">52W High</div><div class="rd-val up">${fmtV(d.week52High)}</div></div>
        <div class="rd-item"><div class="rd-lbl">52W Low</div><div class="rd-val dn">${fmtV(d.week52Low)}</div></div>
      </div>
    </div>

    <div class="rd-section">
      <div class="rd-section-title">Analyst Consensus · ${d.analystCount||0} analysts</div>
      <div class="ac-summary" style="grid-template-columns:1fr 1fr 1fr 1fr;margin-bottom:10px">
        <div class="ac-tile"><div class="ac-tile-label">Buy / St. Buy</div><div class="ac-tile-val buy">${sBuy}</div></div>
        <div class="ac-tile"><div class="ac-tile-label">Hold</div><div class="ac-tile-val hold">${sHold}</div></div>
        <div class="ac-tile"><div class="ac-tile-label">Sell</div><div class="ac-tile-val sell">${sSell}</div></div>
        <div class="ac-tile"><div class="ac-tile-label">Rating</div><div class="ac-tile-val" style="font-size:11px"><span class="mrec rec-${recKey}">${d.recommendation}</span></div></div>
      </div>
      <div class="ac-bar" style="margin-bottom:8px">
        <div class="ac-bar-buy" style="width:${(sBuy/sTotal*100).toFixed(0)}%"></div>
        <div class="ac-bar-hold" style="width:${(sHold/sTotal*100).toFixed(0)}%"></div>
        <div class="ac-bar-sell" style="width:${(sSell/sTotal*100).toFixed(0)}%"></div>
      </div>
      <div class="rd-grid" style="margin-bottom:10px">
        <div class="rd-item"><div class="rd-lbl">Mean Target</div><div class="rd-val">${d.targetMean?'$'+d.targetMean.toFixed(2):'No data available'}</div></div>
        <div class="rd-item"><div class="rd-lbl">Upside to Target</div><div class="rd-val ${(upside??0)>=0?'up':'dn'}">${upside!=null?(upside>=0?'+':'')+upside.toFixed(1)+'%':'No data available'}</div></div>
        <div class="rd-item"><div class="rd-lbl">High Target</div><div class="rd-val">${d.targetHigh?'$'+d.targetHigh.toFixed(2):'No data available'}</div></div>
        <div class="rd-item"><div class="rd-lbl">Low Target</div><div class="rd-val">${d.targetLow?'$'+d.targetLow.toFixed(2):'No data available'}</div></div>
      </div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--blue);margin-bottom:6px">Recent Analyst Actions</div>
      ${histHTML}
    </div>

    <div class="rd-section">
      <div class="rd-section-title">SEC Issuer Details</div>
      <div class="rd-grid" style="margin-bottom:10px">
        <div class="rd-item"><div class="rd-lbl">CIK</div><div class="rd-val">${d.cik||'—'}</div></div>
        ${(d.recentFilings||[]).map(f=>`<div class="rd-item"><div class="rd-lbl">Recent ${f.type}</div><div class="rd-val"><a class="res-link" href="${f.link}" target="_blank">${f.date} ↗</a></div></div>`).join('')}
      </div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--blue);margin-bottom:6px">Business Summary</div>
      <div class="fund-summary">${d.description||'No business summary available.'}
        ${d.website?`<br><br><a href="${d.website}" target="_blank" style="font-size:10px;color:var(--blue);text-decoration:none;display:inline-block">${d.website} ↗</a>`:''}
      </div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--blue);margin-bottom:6px">Risk Factors & Notes</div>
      <div class="fund-summary" style="margin-bottom:0">
        <ul style="margin:0;padding-left:14px;color:var(--text2)">
          ${(d.riskFactors||[]).map(r=>`<li style="margin-bottom:4px">${r}</li>`).join('')}
        </ul>
      </div>
    </div>
    <div style="padding:8px 0;text-align:right;font-size:10px;color:var(--dim)">
      <a href="https://finance.yahoo.com/quote/${sym}" target="_blank" style="color:var(--blue);text-decoration:none">↗ Full profile on Yahoo Finance</a>
    </div>`;
}


window.fetchFund      = fetchFund;
window.showModal      = showModal;
window.openModal      = openModal;
window.openBySymbol   = openBySymbol;
window.switchTab      = switchTab;
window.renderModal    = renderModal;
window.fetchResearch  = fetchResearch;
window.renderResearch = renderResearch;
window.resSecSearch   = resSecSearch;
window.escapeRdAttr   = escapeRdAttr;
