/* Pedal Wars — hardened JS bundle (per-city/day prices, capture-phase clicks, deltas on travel) */
(function () {
  // ===== Root helpers =====
  const root = document.getElementById('pedalwars') || document;
  const gi = (id) => (root === document ? document.getElementById(id) : root.querySelector(`#${id}`));
  const fmt = (n) => "$" + Math.floor(Number(n || 0)).toLocaleString();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function mulberry32(a){return function(){let t=(a+=0x6d2b79f5);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
  function hashStr(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
  const stop = (e)=>{ try{ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }catch(_){} };

  // ===== Anti-theme CSS (prevents theme from swallowing clicks) =====
  (function(){
    const st=document.createElement('style');
    st.textContent = `
      #pedalwars button, #pedalwars .controls * { pointer-events: auto !important; }
      #pedalwars .overlay[aria-hidden="true"] { display: none !important; }
      #pedalwars button { -webkit-user-select: none; user-select: none; }
    `;
    (root === document ? document.head : root).appendChild(st);
  })();

  // ===== RNG, logs =====
  let seed = Date.now() % 2147483647;
  let rng  = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rng()*arr.length)];
  function log(msg, kind){ const ul=gi('log'); if(!ul){ console.log('[Pedal Wars]', kind?('['+kind+']'):'', msg); return; } const li=document.createElement('li'); if(kind) li.className=kind; li.textContent=msg; ul.prepend(li); }

  // ===== Data =====
  const ITEMS=[
    {id:"overdrive", name:"Overdrive", base:[90,220],  weight:1},
    {id:"fuzz",      name:"Fuzz",      base:[60,260],  weight:1},
    {id:"delay",     name:"Delay",     base:[180,520], weight:2},
    {id:"reverb",    name:"Reverb",    base:[150,560], weight:2},
    {id:"mod",       name:"Modulation",base:[120,380], weight:1},
    {id:"synth",     name:"Synth/Weird", base:[220,740], weight:2},
    {id:"kit",       name:"DIY Kit",   base:[45,160],  weight:1},
  ];
  const LOCATIONS=[
    {id:'hamilton', name:'Hamilton',  flavor:"Local scene, steady buyers", bias:{overdrive:.95,fuzz:.9,kit:.9}},
    {id:'toronto',  name:'Toronto',   flavor:"Big market, hype spikes",    bias:{delay:1.1,reverb:1.1,mod:1.05}},
    {id:'montreal', name:'Montreal',  flavor:"Trendy boutique tastes",     bias:{synth:1.15,mod:1.1}},
    {id:'nash',     name:'Nashville', flavor:"Session demand, good money", bias:{overdrive:1.1,delay:1.1,reverb:1.05}},
    {id:'reverb',   name:'Reverb.com',flavor:"Online—fees & scams",        bias:{all:1.0}},
  ];
  const LOC_FACTOR = { hamilton:0.95, toronto:1.06, montreal:1.00, nash:1.10, reverb:1.02 };

  // ===== State =====
  let DAYS_LIMIT=30, state=null;
  let dailyCache = {}; // day → loc → prices

  // Build select early
  (function(){ const sel=gi('locationSelect'); if(!sel||sel.options.length) return;
    LOCATIONS.forEach(l=>{const o=document.createElement('option'); o.value=l.id; o.textContent=l.name; sel.appendChild(o);});
  })();

  // ===== Deterministic pricing per (day,location) with shocks =====
  function priceRNG(day, locId){ const s = (seed ^ (day*2654435761) ^ hashStr(String(locId)))>>>0; return mulberry32(s); }
  function computePricesFor(day, locId){
    const loc = LOCATIONS.find(l=>l.id===locId)||LOCATIONS[0];
    const pr  = priceRNG(day, locId);
    const mood    = 0.90 + pr()*0.30;
    const locBase = LOC_FACTOR[locId] || 1;
    const shockCount = pr() < 0.55 ? 1 : 2;
    const shockIdxs = new Set(); while(shockIdxs.size < shockCount) shockIdxs.add(Math.floor(pr()*ITEMS.length));
    const repBoost = 1 + (state ? state.rep*0.1 : 0);
    const out = {};
    ITEMS.forEach((it, idx)=>{
      const [lo,hi]=it.base;
      const bias = (loc.bias?.[it.id] ?? loc.bias?.all ?? 1);
      let roll  = (pr()+pr()+pr())/3;
      let price = (lo + (hi-lo)*roll) * bias * locBase * mood;
      price *= (0.92 + pr()*0.28); // local noise
      if (shockIdxs.has(idx)) price *= (pr() < 0.5) ? (2.0 + pr()*0.5) : (0.40 + pr()*0.20);
      price = Math.round(Math.max(5, price / repBoost));
      out[it.id]=price;
    });
    return out;
  }
  function getPricesFor(day, locId){
    dailyCache[day] ||= {};
    if(!dailyCache[day][locId]) dailyCache[day][locId] = computePricesFor(day, locId);
    return dailyCache[day][locId];
  }

  // ===== Start buttons (direct + delegated) =====
  function wireStartButtons(){
    const qb=gi('quickBtn'), nb=gi('normalBtn');
    qb && qb.addEventListener('click', ()=>{DAYS_LIMIT=7; startGame();});
    nb && nb.addEventListener('click', ()=>{DAYS_LIMIT=30; startGame();});
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', wireStartButtons, {once:true}); } else { wireStartButtons(); }

  // ===== Game start / init =====
  function startGame(){
    if(state) return;
    const name=(prompt('Enter player name:','Player')||'Player').trim().slice(0,16);
    state=initState(name);
    const ov=gi('startOverlay'); if(ov){ ov.setAttribute('aria-hidden','true'); ov.remove(); }
    gi('gameControls')?.style && (gi('gameControls').style.display='flex');
    // Day 1 prices
    state.prices     = {...getPricesFor(state.day, state.location)};
    state.lastPrices = {...state.prices};
    renderAll('New game started.');
  }
  function initState(playerName){
    dailyCache={};
    return { day:1, location:'hamilton', cash:1500, debt:1000, rate:0.18, rep:0.10, cap:24,
             inv:Object.fromEntries(ITEMS.map(i=>[i.id,0])), prices:{}, lastPrices:{}, playerName };
  }

  // ===== Render =====
  function renderAll(msg){ renderStats(); renderMarket(); renderTravelCosts(); if(msg) log(msg); }
  function renderStats(){
    const used = Object.values(state.inv).reduce((a,b)=>a+b,0);
    const loc  = LOCATIONS.find(l=>l.id===state.location);
    gi('day').textContent   = `${state.day}/${DAYS_LIMIT}`;
    gi('cash').textContent  = fmt(state.cash);
    gi('debt').textContent  = fmt(state.debt);
    gi('rate').textContent  = (state.rate*100).toFixed(1)+'% APR';
    gi('rep').textContent   = Math.round(state.rep*100)+'%';
    gi('used').textContent  = used;
    gi('cap').textContent   = state.cap;
    gi('daysLeft').textContent = `${DAYS_LIMIT-state.day+1} days left`;
    gi('locInfo').textContent  = `${loc.name} — ${loc.flavor}`;
    gi('repMeter').style.width = Math.round(state.rep*100)+'%';
  }
  function renderMarket(){
    const tb=gi('marketBody'); tb.innerHTML='';
    ITEMS.forEach(it=>{
      const owned=state.inv[it.id]||0; const p=state.prices[it.id]; const last=state.lastPrices[it.id]||p;
      const delta=p-last; const cls=delta>0?'price up':delta<0?'price down':'';
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td align="left"><strong>${it.name}</strong><br/><small>Weight ${it.weight}</small></td>
        <td class="${cls}">${fmt(p)}<br/><small>${delta===0?'stable':(delta>0?'↑ '+fmt(delta):'↓ '+fmt(Math.abs(delta)))}</small></td>
        <td align="center">${owned}</td>
        <td>
          <div class="qty">
            <input type="number" min="0" step="1" value="1" id="b_${it.id}" />
            <button data-id="${it.id}" data-act="buy" type="button">Buy</button>
          </div>
        </td>
        <td>
          <div class="qty">
            <input type="number" min="0" step="1" value="1" id="s_${it.id}" />
            <button data-id="${it.id}" data-act="sell" type="button" ${owned?'':'disabled'}>Sell</button>
          </div>
          ${state.location==='reverb' ? '<div><span class="pill">Reverb fee: $50</span></div>' : ''}
        </td>`;
      tb.appendChild(tr);
    });
  }

  // ===== Price refresh glue =====
  function refreshPricesForCurrentDayAndLocation({compareToPrevDay=false, destLocation=null}={}){
    const locId = destLocation || state.location;
    const todays = getPricesFor(state.day, locId);
    state.lastPrices = compareToPrevDay ? {...getPricesFor(Math.max(1,state.day-1), locId)} : {...todays};
    state.prices = {...todays};
  }

  // ===== Helpers =====
  function capacityUsed(){ return Object.values(state.inv).reduce((a,b)=>a+b,0); }
  function addCash(v){ state.cash=Math.max(0,Math.floor(state.cash+v)); }
  function adjustDebt(v){ state.debt=Math.max(0,Math.floor(state.debt+v)); }
  function bumpRep(d){ state.rep=clamp(state.rep+d,0,1); }

  // ===== Actions =====
  function doBorrow(){ adjustDebt(+500); addCash(+500); log('Borrowed $500 at current APR.','warn'); renderStats(); }
  function doRepay(){ if(state?.debt<=0){ log('No debt to repay.','warn'); return; } if(state.cash<=0){ log('No cash to repay.','bad'); return; } const pay=Math.min(500,state.debt,state.cash); adjustDebt(-pay); addCash(-pay); log('Repaid '+fmt(pay)+'.','good'); renderStats(); }
  function buy(id,qty){ const cost=state.prices[id]*qty; if(capacityUsed()+qty>state.cap){ log('Not enough space.','bad'); return; } if(cost>state.cash){ log('Not enough cash.','bad'); return; } addCash(-cost); state.inv[id]+=qty; bumpRep(+0.002*qty); log('Bought '+qty+' × '+ITEMS.find(x=>x.id===id).name+' for '+fmt(cost)+'.','good'); renderStats(); renderMarket(); }
  function sell(id,qty){ const have=state.inv[id]||0; if(qty>have){ log('You do not own that many.','bad'); return; } const gross=state.prices[id]*qty; const fee=(state.location==='reverb')?50:0; const net=Math.max(0,gross-fee); state.inv[id]-=qty; addCash(net); bumpRep(+0.001*qty); log(fee?'Sold '+qty+' × '+ITEMS.find(x=>x.id===id).name+' for '+fmt(gross)+' (−'+fmt(fee)+' fee) → '+fmt(net)+'.':'Sold '+qty+' × '+ITEMS.find(x=>x.id===id).name+' for '+fmt(net)+'.'); renderStats(); renderMarket(); }
  function quickSellAll(){ let total=0,sold=false; Object.keys(state.inv).forEach(k=>{ const q=state.inv[k]; if(q>0){ total+=q*state.prices[k]; state.inv[k]=0; sold=true; }}); if(!sold){ log('Nothing to sell.','warn'); return; } const fee=(state.location==='reverb')?50:0; const net=Math.max(0,total-fee); addCash(net); log('Quick sold everything for '+fmt(total)+(fee?' (−'+fmt(fee)+' fee)':'')+' → '+fmt(net)+' net.','good'); renderAll(); }

  // Travel & costs (no price change mid-day; deltas vs that city’s yesterday)
  function travelCostFor(dest){ if(dest==='reverb') return 0; let h=0; for(let i=0;i<dest.length;i++){ h=(h*31+dest.charCodeAt(i))>>>0; } const r=mulberry32((state.day*2654435761 ^ h)>>>0)(); return Math.floor(50 + r*100); }
  function renderTravelCosts(){ const s=LOCATIONS.map(l=>l.name+': '+fmt(travelCostFor(l.id))).join(' | '); const el=gi('travelCosts'); if(el) el.textContent='Travel Costs: '+s; }
  function travel(dest){
    if(dest===state.location){ log('You are already there.','warn'); return; }
    const cost=travelCostFor(dest);
    if(state.cash<cost){ log('Travel costs '+fmt(cost)+'. You need more cash.','bad'); return; }
    addCash(-cost);
    const from=LOCATIONS.find(l=>l.id===state.location).name; const to=LOCATIONS.find(l=>l.id===dest).name;
    state.location=dest;
    refreshPricesForCurrentDayAndLocation({ compareToPrevDay:true, destLocation:dest });
    log('Traveled '+from+' → '+to+' ('+(cost?('cost '+fmt(cost)):'free')+')', cost?'warn':'good');
    const n=2+Math.floor(mulberry32(Date.now()>>>0)()*2); for(let i=0;i<n;i++) travelEvent();
    renderAll();
  }
  function travelEvent(){ const r=mulberry32(((Date.now()%1e9)+Math.floor(rng()*1e9))>>>0)(); if(r<0.20){ const gain=Math.floor(50+r*250); addCash(gain); log('Scored a pop-up flip on arrival: +'+fmt(gain)+'.','good'); } else if(r<0.40){ const loss=Math.min(state.cash,Math.floor(30+r*200)); addCash(-loss); log('Road fees hit: −'+fmt(loss)+'.','bad'); } else if(r<0.60){ bumpRep(+0.02); log('Met a demo artist — reputation up.','good'); } else if(r<0.75){ const interest=Math.floor(state.debt*0.001*(1+Math.floor(r*3))); adjustDebt(+interest); log('Travel delays increased costs: +'+fmt(interest)+' debt.','warn'); } else if(r<0.90){ const refund=Math.floor(20+r*120); addCash(refund); log('Returned a defective part and got '+fmt(refund)+' back.','good'); } else { bumpRep(-0.015); log('Buyer flaked on meetup — tiny rep hit.','warn'); } }

  // End Day (prices change; deltas vs yesterday)
  function endDay(){
    if(!state) return;
    if(state.day>=DAYS_LIMIT){ gameOver(); return; }
    const prevDay=state.day; state.day=prevDay+1;
    if(state.debt>0){ const daily=state.rate/365; const inc=Math.floor(state.debt*daily); adjustDebt(+inc); if(inc>0) log('Interest accrued '+fmt(inc)+'.','warn'); }
    const fee=Math.floor(capacityUsed()*2); if(fee>0){ addCash(-fee); log('Storage fees '+fmt(fee)+'.','warn'); }
    refreshPricesForCurrentDayAndLocation({ compareToPrevDay:true });
    dailyEvent();
    renderAll('Day '+prevDay+' → '+state.day+' complete.');
    if(state.day>=DAYS_LIMIT){ log('Final day reached. Next press ends the game.','warn'); }
  }
  function dailyEvent(){ const roll=rng(); if(roll<0.20){ bumpRep(+0.02); footer('Hype building…'); } else if(roll<0.35){ bumpRep(-0.01); footer('Market feels soft.'); } else if(roll<0.45){ const loss=Math.min(state.cash, Math.floor(50+rng()*200)); addCash(-loss); bumpRep(-0.015); footer('Account took a ding.'); } else if(roll<0.55){ const owned=ITEMS.filter(i=>state.inv[i.id]>0); if(owned.length){ const it=pick(owned); const take=Math.max(1,Math.floor(state.inv[it.id]*(0.25+rng()*0.5))); state.inv[it.id]=Math.max(0,state.inv[it.id]-take); footer('Paperwork error.'); } } else if(roll<0.70){ footer('Buzz is in the air.'); } else { footer('Quiet day.'); } }
  function footer(text){ gi('eventFooter').textContent = text; }

  // Save/Load/Reset
  function save(){ try{ localStorage.setItem('pedalwars_save_v1', JSON.stringify({state,DAYS_LIMIT})); log('Game saved.'); }catch(e){ console.warn('Save failed',e); } }
  function load(){ try{
      const s=localStorage.getItem('pedalwars_save_v1'); if(!s){ log('No save found.','warn'); return; }
      const obj=JSON.parse(s); DAYS_LIMIT=obj.DAYS_LIMIT||30; state=obj.state;
      refreshPricesForCurrentDayAndLocation({ compareToPrevDay:true });
      gi('gameControls')?.style && (gi('gameControls').style.display='flex');
      renderAll('Loaded save.'); setTimeout(()=>renderStats(),0);
    }catch(e){ console.warn('Load failed',e); } }
  function resetGame(){ if(confirm('Reset game?')){ try{ localStorage.removeItem('pedalwars_save_v1'); }catch(e){} state=null; DAYS_LIMIT=30; dailyCache={}; const gc=gi('gameControls'); if(gc) gc.style.display='none'; const ul=gi('log'); if(ul) ul.innerHTML=''; const ov=document.createElement('div'); ov.id='startOverlay'; ov.className='overlay'; ov.innerHTML=`<div class="panel"><h2>🎛️ Pedal Wars</h2><p>Choose a mode:</p><button id="quickBtn" class="primary" type="button">Quick Play (7 Days)</button><button id="normalBtn" class="primary" type="button">Normal Play (30 Days)</button></div>`; if(root===document){document.body.prepend(ov);}else{root.prepend(ov);} wireStartButtons(); renderTravelCosts(); log('Game reset. Choose a mode to start.'); } }
  function gameOver(){ let liquidation=0; for(const k in state.inv) liquidation+=state.inv[k]*state.prices[k]; const net=state.cash+liquidation-state.debt; const grade= net>10000?'Legend': net>5000?'Pro': net>2000?'Hobbyist':'Weekend Warrior'; alert(`Game Over\nPlayer: ${state.playerName}\nNet Worth: ${fmt(net)}\nReputation: ${Math.round(state.rep*100)}%\nRank: ${grade}`); }

  // Global delegated handlers (capture-phase)
  function getQtyFor(act, id){ const input = gi(`${act === 'buy' ? 'b_' : 's_'}${id}`); const v = parseInt(input && input.value || '0', 10); return isNaN(v) ? 0 : v; }
  function handleAnyPointer(e){
    if (!(root.contains ? root.contains(e.target) : true)) return;
    const btn = e.target.closest && e.target.closest('button'); if(!btn) return;
    stop(e);
    if(btn.id === 'quickBtn'){ DAYS_LIMIT=7; startGame(); return; }
    if(btn.id === 'normalBtn'){ DAYS_LIMIT=30; startGame(); return; }
    const act = btn.getAttribute('data-act');
    if(act === 'buy' || act === 'sell'){ const id = btn.getAttribute('data-id'); const qty = getQtyFor(act, id); if(qty > 0){ act === 'buy' ? buy(id, qty) : sell(id, qty); } return; }
    switch(btn.id){
      case 'borrowBtn': return void doBorrow();
      case 'repayBtn' : return void doRepay();
      case 'sellAllBtn': return void quickSellAll();
      case 'travelBtn' : return void travel(gi('locationSelect')?.value || state?.location || 'hamilton');
      case 'nextBtn'   : return void endDay();
      case 'saveBtn'   : return void save();
      case 'loadBtn'   : return void load();
      case 'resetBtn'  : return void resetGame();
    }
  }
  document.addEventListener('click', handleAnyPointer, true);
  document.addEventListener('pointerdown', handleAnyPointer, true);
  document.addEventListener('touchstart', handleAnyPointer, { capture:true, passive:false });
  document.addEventListener('keydown', (e)=>{
    if(e.key !== 'Enter' && e.key !== ' ') return;
    const el = document.activeElement;
    if(!el || el.tagName !== 'BUTTON' || !(root.contains ? root.contains(el) : true)) return;
    stop(e); el.click();
  }, true);

  // Pre-start UI
  renderTravelCosts();

  try{ console.assert(typeof log==='function','log() defined'); }catch(e){}
})();
