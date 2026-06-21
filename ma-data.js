async function fetchWithTimeout(url, timeout = 10000) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    const data = await r.json();
    return { ok: r.ok, status: r.status, data };
  } catch(e) {
    let type = 'network_error';
    if (e.name === 'TimeoutError') type = 'timeout';
    return { ok: false, status: 0, type, error: e.message, data: null };
  }
}

async function fetchSym(sym){
  if(!sym) return null;
  if (DEAD_SYMS.has(sym)) return null;

  const chartUrl=`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(decodeURIComponent(sym))}?interval=1d&range=1mo`;
  try{
    const chartResp=await pfetch(chartUrl);
    const j=await chartResp.json();
    const res=j?.chart?.result?.[0]; if(!res) return null;
    const m=res.meta;
    const closes=(res.indicators?.quote?.[0]?.close||[]).filter(v=>v!=null);
    const price=m.regularMarketPrice??closes[closes.length-1]??m.chartPreviousClose??m.previousClose??0;
    const lastClose=closes.length?closes[closes.length-1]:null;
    const prevSeries=closes.length>1?closes[closes.length-2]:null;
    const relDiff=(a,b)=>Math.abs(a-b)/Math.max(1,Math.abs(a),Math.abs(b));

    // Global previous-close picker:
    // - If price approximately equals last series close, that close is "today/last print",
    //   so previous session is series[-2].
    // - Otherwise series[-1] is typically previous session close.
    let seriesPrev=null;
    if(lastClose!=null&&!isNaN(lastClose)&&lastClose>0){
      seriesPrev = relDiff(price,lastClose) < 0.0005
        ? (prevSeries??null)
        : lastClose;
    }

    const prevCandidates=[
      seriesPrev,
      m.regularMarketPreviousClose,
      m.previousClose,
      prevSeries,
      m.chartPreviousClose
    ].filter(v=>v!=null&&!isNaN(v)&&v>0);

    // Guard against stale/outlier previous-close values by choosing candidate closest to seriesPrev.
    let prev=price;
    if(prevCandidates.length){
      if(seriesPrev!=null){
        prev=prevCandidates.reduce((best,cur)=>relDiff(cur,seriesPrev)<relDiff(best,seriesPrev)?cur:best,prevCandidates[0]);
      }else{
        prev=prevCandidates[0];
      }
    }
    const chg=price-prev;
    const pct=prev?(chg/prev)*100:0;
    return{
      price,
      chg,
      pct,
      high:m.regularMarketDayHigh,
      low:m.regularMarketDayLow,
      vol:m.regularMarketVolume,
      closes
    };
  }catch{return null;}
}
async function fetchAll(syms){
  const out={};
  for(let i=0;i<syms.length;i+=6){
    const batch=syms.slice(i,i+6);
    const res=await Promise.allSettled(batch.map(s=>fetchSym(s)));
    res.forEach((r,idx)=>{if(r.status==='fulfilled'&&r.value)out[batch[idx]]=r.value;});
    if(i+6<syms.length) await new Promise(r=>setTimeout(r,180));
  }
  return out;
}

function fp(v,fx,yld){
  if(v==null||isNaN(v))return'—';
  if(yld)return v.toFixed(3)+'%';
  if(fx) return v.toFixed(4);
  return v>=1000?v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):v.toFixed(2);
}
function fc(v,fx){
  if(v==null||isNaN(v))return'<span class="nc">—</span>';
  const c=v>=0?'up':'dn',a=v>=0?'▲':'▼';
  return`<span class="${c}">${a} ${Math.abs(fx?v.toFixed(4):v.toFixed(2))}</span>`;
}
function fpc(v){
  if(v==null||isNaN(v))return'<span class="nc">—</span>';
  const c=v>=0?'up':'dn';
  return`<span class="${c}">${v>=0?'+':''}${v.toFixed(2)}%</span>`;
}
function fv(v,em){
  if(!v)return'—';
  const s=v>=1e9?(v/1e9).toFixed(1)+'B':v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(0)+'K':String(v);
  return em?`<span class="vo-em ${v>1e8?'up':''}">${s}</span>`:s;
}
function fhl(h,l,fx){
  if(!h||!l)return'<span class="nc">—</span>';
  const d=fx?4:2;
  return`<span class="up" style="font-size:9px">${h.toFixed(d)}</span><span class="nc"> / </span><span class="dn" style="font-size:9px">${l.toFixed(d)}</span>`;
}
function fmc(v){
  if(!v)return'—';
  if(v>=1e12)return'$'+(v/1e12).toFixed(2)+'T';
  if(v>=1e9) return'$'+(v/1e9).toFixed(1)+'B';
  if(v>=1e6) return'$'+(v/1e6).toFixed(1)+'M';
  return'$'+v.toFixed(0);
}
function fp2(v){if(v==null||isNaN(v))return'—';return(v*100).toFixed(2)+'%';}
function fn2(v){if(v==null||isNaN(v))return'—';return v.toFixed(2);}

function spark(closes,pct,W=52,H=18){
  if(!closes||closes.length<3)return'<span class="nc">—</span>';
  const col=pct>=0?'#1a7a4a':'#c0392b';
  const gid='g'+Math.random().toString(36).slice(2,8);
  const mn=Math.min(...closes),mx=Math.max(...closes),rng=mx-mn||1;
  const xy=closes.map((v,i)=>[(i/(closes.length-1))*W,H-((v-mn)/rng)*(H-4)-2]);
  const pts=xy.map(([x,y])=>`${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const f0=`0,${xy[0][1].toFixed(1)}`,lp=`${xy[xy.length-1][0].toFixed(1)},${xy[xy.length-1][1].toFixed(1)}`;
  return`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${col}" stop-opacity=".18"/>
      <stop offset="100%" stop-color="${col}" stop-opacity=".01"/>
    </linearGradient></defs>
    <polygon points="${f0} ${pts} ${lp} ${W},${H} 0,${H}" fill="url(#${gid})"/>
    <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}
function sparkLg(c,p){return spark(c,p,600,60);}

function escapeRdHtml(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function fmtMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

function fmtPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

function safeText(v) {
  return v == null || v === "" ? "—" : String(v);
}

window.fmtMoney = fmtMoney;
window.fmtPct = fmtPct;
window.safeText = safeText;
window.escapeRdHtml = escapeRdHtml;
