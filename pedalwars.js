/* Pedal Wars – external JS bundle for Big Cartel (CSP-safe) */
(function () {
  // ===== Utilities =====
  const root = document.getElementById('pedalwars') || document;
  const gi = (id) => root.querySelector(`#${id}`);
  const fmt = (n) => "$" + Math.floor(Number(n || 0)).toLocaleString();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function mulberry32(a){return function(){let t=(a+=0x6d2b79f5);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
  function hashStr(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }

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
  // City base factors (spread lever)
  const LOC_FACTOR = { hamilton:0.95, toronto:1.06, montreal:1.00, nash:1.10, reverb:1.02 };

  // ===== State =====
  let DAYS_LIMIT=30, state=null;
  // Cache prices per (day -> location -> itemId)
  let dailyCache = {};

  // Build select
  (function buildSelect(){ const sel=gi('locationSelect'); if(!sel||sel.options.length) return; LOCATIONS.forEach(l=>{const o=document.createElement('option'); o.value=l.id; o.textContent=l.name; sel.appendChild(o);}); })();

  // Start buttons
  function bindStartButtons(){
    const qb=gi('quickBtn'), nb=gi('normalBtn');
    if(qb) qb.addEventListener('click', ()=>{DAYS_LIMIT=7;  startGame();});
    if(nb) nb.addEventListener('click', ()=>{DAYS_LIMIT=30; startGame();});
    document.addEventListener('click', (e)=>{ if(!root.contains(e.target)) return; const el=e.target.closest?.('#quickBtn,#normalBtn'); if(!el) return; el.id==='quickBtn'? (DAYS_LIMIT=7,startGame()) : (DAYS_LIMIT=30,startGame()); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', bindStartButtons, {once:true}); else bindStartButtons();

  // ===== Deterministic per-(day,location) pricing with divergence =====
  function priceRNG(day, locId){ const s = (seed ^ (day*2654435761) ^ hashStr(String(locId)))>>>0; return mulberry32(s); }

  function computePricesFor(day, locId){
    const loc = LOCATIONS.find(l=>l.id===locId)||LOCATIONS[0];
    const pr  = priceRNG(day, locId);

    // City-wide daily mood (same for all items that city/day)
    const mood    = 0.90 + pr()*0.30;        // 0.90 .. 1.20
    const locBase = LOC_FACTOR[locId] || 1;  // fixed per city

    // 1–2 shock items for this city/day
    const shockCount = pr() < 0.55 ? 1 : 2;
    const shockIdxs = new Set();
    while(shockIdxs.size < shockCount) shockIdxs.add(Math.floor(pr()*ITEMS.length));

    const repBoost = 1 + (state ? state.rep*0.1 : 0);

    const out = {};
    ITEMS.forEach((it, idx)=>{
      const [lo,hi]=it.base;
      const bias = (loc.bias?.[it.id] ?? loc.bias?.all ?? 1);

      // Base within item range, then apply city mood & base factor
      let roll  = (pr()+pr()+pr())/3;                       // smooth 0..1
      let price = (lo + (hi-lo)*roll) * bias * locBase * mood;

      // Per-item local noise (same city/day)
      price *= (0.92 + pr()*0.28);                          // 0.92 .. 1.20

      // Shock (spike/crash) — larger spreads version
      if (shockIdxs.has(idx)) {
        if (pr() < 0.5) price *= (2.0 + pr()*0.5);          // spike ×2.0..2.5
        else            price *= (0.40 + pr()*0.20);        // crash ×0.40..0.60
      }

      // Reputation lowers buy price slightly
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

  // ===== Game start / init =====
  function startGame(){
    if(state) return;
    const name=(prompt('Enter player name:','Player')||'Player').trim().slice(0,16);
    state=initState(name);
    const ov=gi('startOverlay'); if(ov) ov.style.display='none';
    const gc=gi('gameControls'); if(gc) gc.style.display='flex';

    // Day 1: stable (no yesterday)
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
  function renderAll(msg){ try{renderStats();}catch(e){} try{renderMarket();}catch(e){} try{renderTravelCosts();}catch(e){} if(msg) log(msg); }
  function renderStats(){
    const used=Object.values(state.inv).reduce((a,b)=>a+b,0);
    gi('day')?.textContent        = `${state.day}/${DAYS_LIMIT}`;
    gi('cash')?.textContent       = fmt(state.cash);
    gi('debt')?.textContent       = fmt(state.debt);
    gi('rate')?.textContent       = (state.rate*100).toFixed(1)+'% APR';
    gi('rep')?.textContent        = Math.round(state.rep*100)+'%';
    gi('used')?.textContent       = used;
    gi('cap')?.textContent        = state.cap;
    gi('daysLeft')?.textContent   = `${DAYS_LIMIT-state.day+1} days left`;
    const loc=LOCATIONS.find(l=>l.id===state.location);
    gi('locInfo')?.textContent    = `${loc.name} — ${loc.flavor}`;
    const bar=gi('repMeter'); if(bar) bar.style.width=Math.round(state.rep*100)+'%';
  }
  function renderMarket(){
    const tb=gi('marketBody'); if(!tb) return; tb.innerHTML='';
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
            <button data-id="${it.id}" data-act="buy">Buy</button>
          </div>
        </td>
        <td>
          <div class="qty">
            <input type="number" min="0" step="1" value="1" id="s_${it.id}" />
            <button data-id="${it.id}" data-act="sell" ${owned?'':'disabled'}>Sell</button>
          </div>
          ${state.location==='reverb'?'<div><span class="pill">Reverb fee: $50</span></div>':''}
        </td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll('button[data-act]').forEach(btn=>{
      btn.onclick=()=>{ const id=btn.getAttribute('data-id'); const act=btn.getAttribute('data-act'); const qty=parseInt((gi((act==='buy'?'b_':'s_')+id).value)||0,10); if(qty<=0) return; if(act==='buy') buy(id,qty); else sell(id,qty); };
    });
  }

  // ===== Price glue =====
  function refreshPricesForCurrentDayAndLocation({compareToPrevDay=false, destLocation=null}={}){
    const locId = destLocation || state.location;
    const todays = getPricesFor(state.day, locId);
    if(compareToPrevDay){
      const prev = getPricesFor(Math.max(1,state.day-1), locId);
      state.lastPrices = {...prev};
    }else{
      state.lastPrices = {...todays};
    }
    state.prices = {...todays};
  }

  // ===== Helpers =====
  function capacityUsed(){ return Object.values(state.inv).reduce((a,b)=>a+b,0); }
  function addCash(v){ state.cash=Math.max(0,Math.floor(state.cash+v)); }
  function adjustDebt(v){ state.debt=Math.max(0,Math.floor(state.debt+v)); }
  function bumpRep(d){ state.rep=clamp(state.rep+d,0,1); }

  // ===== Actions =====
  gi('borrowBtn').onclick=()=>{ adjustDebt(+500); addCash(+500); log('Borrowed $500 at current APR.','warn'); renderStats(); };
  gi('repayBtn').onclick =()=>{ if(state?.debt<=0){ log('No debt to repay.','warn'); return; } if(state.cash<=0){ log('No cash to repay.','bad'); return; } const pay=Math.min(500,state.debt,state.cash); adjustDebt(-pay); addCash(-pay); log('Repaid '+fmt(pay)+'.','good'); renderStats(); };

  function buy(id,qty){ const cost=state.prices[id]*qty; if(capacityUsed()+qty>state.cap){ log('Not enough space.','bad'); return; } if(cost>state.cash){ log('Not enough cash.','bad'); return; } addCash(-cost); state.inv[id]+=qty; bumpRep(+0.002*qty); log('Bought '+qty+' × '+ITEMS.find(x=>x.id===id).name+' for '+fmt(cost)+'.','good'); renderStats(); renderMarket(); }
  function sell(id,qty){ const have=state.inv[id]||0; if(qty>have){ log('You do not own that many.','bad'); return; } const gross=state.prices[id]*qty; const fee=(state.location==='reverb')?50:0; const net=Math.max(0,gross-fee); state.inv[id]-=qty; addCash(net); bumpRep(+0.001*qty); log(fee?'Sold '+qty+' × '+ITEMS.find(x=>x.id===id).name+' for '+fmt(gross)+' (−'+fmt(fee)+' fee) → '+fmt(net)+'.':'Sold '+qty+' × '+ITEMS.find(x=>x.id===id).name+' for '+fmt(net)+'.'); renderStats(); renderMarket(); }

  gi('sellAllBtn').onclick=()=>{ let total=0,sold=false; Object.keys(state.inv).forEach(k=>{ const q=state.inv[k]; if(q>0){ total+=q*state.prices[k]; state.inv[k]=0; sold=true; }}); if(!sold){ log('Nothing to sell.','warn'); return; } const fee=(state.location==='reverb')?50:0; const net=Math.max(0,total-fee); addCash(net); log('Quick sold everything for '+fmt(total)+(fee?' (−'+fmt(fee)+' fee)':'')+' → '+fmt(net)+' net.','good'); renderAll(); };

  gi('dumpBtn').onclick=()=>{ const owned=ITEMS.filter(it=>state.inv[it.id]>0); if(!owned.length){ log('You own nothing to dump.','warn'); return; } const it=pick(owned); state.inv[it.id]-=1; log('Dumped 1 '+it.name+' to free space.','warn'); renderStats(); renderMarket(); };

  // ===== Travel (now shows delta vs that city's previous day) =====
  gi('travelBtn').onclick=()=>{ travel(gi('locationSelect').value); };
  function travelCostFor(dest){ if(dest==='reverb') return 0; let h=0; for(let i=0;i<dest.length;i++){ h=(h*31+dest.charCodeAt(i))>>>0; } const r=mulberry32((state.day*2654435761 ^ h)>>>0)(); return Math.floor(50 + r*100); }
  function renderTravelCosts(){ const s=LOCATIONS.map(l=>l.name+': '+fmt(travelCostFor(l.id))).join(' | '); const el=gi('travelCosts'); if(el) el.textContent='Travel Costs: '+s; }
  function travel(dest){
    if(dest===state.location){ log('You are already there.','warn'); return; }
    const cost=travelCostFor(dest);
    if(state.cash<cost){ log('Travel costs '+fmt(cost)+'. You need more cash.','bad'); return; }
    addCash(-cost);
    const from=LOCATIONS.find(l=>l.id===state.location).name; const to=LOCATIONS.find(l=>l.id===dest).name;
    state.location=dest;

    // *** Change: show deltas vs that city's previous day ***
    refreshPricesForCurrentDayAndLocation({ compareToPrevDay:true, destLocation:dest });

    log('Traveled '+from+' → '+to+' ('+(cost?('cost '+fmt(cost)):'free')+')', cost?'warn':'good');
    const n=2+Math.floor(mulberry32(Date.now()>>>0)()*2); for(let i=0;i<n;i++) travelEvent();
    renderAll();
  }
  function travelEvent(){ const r=mulberry32(((Date.now()%1e9)+Math.floor(rng()*1e9))>>>0)(); if(r<0.20){ const gain=Math.floor(50+r*250); addCash(gain); log('Scored a pop-up flip on arrival: +'+fmt(gain)+'.','good'); } else if(r<0.40){ const loss=Math.min(state.cash,Math.floor(30+r*200)); addCash(-loss); log('Road fees hit: −'+fmt(loss)+'.','bad'); } else if(r<0.60){ bumpRep(+0.02); log('Met a demo artist — reputation up.','good'); } else if(r<0.75){ const interest=Math.floor(state.debt*0.001*(1+Math.floor(r*3))); adjustDebt(+interest); log('Travel delays increased costs: +'+fmt(interest)+' debt.','warn'); } else if(r<0.90){ const refund=Math.floor(20+r*120); addCash(refund); log('Returned a defective part and got '+fmt(refund)+' back.','good'); } else { bumpRep(-0.015); log('Buyer flaked on meetup — tiny rep hit.','warn'); } }

  // ===== End Day (compare vs previous day for current city) =====
  gi('nextBtn').onclick=endDay;
  function endDay(){
    if(!state) return;
    if(state.day>=DAYS_LIMIT){ gameOver(); return; }
    const prevDay=state.day; state.day=prevDay+1;

    if(state.debt>0){ const daily=state.rate/365; const inc=Math.floor(state.debt*daily); adjustDebt(+inc); if(inc>0) log('Interest accrued '+fmt(inc)+'.','warn'); }
    const fee=Math.floor(capacityUsed()*2); if(fee>0){ addCash(-fee); log('Storage fees '+fmt(fee)+'.','warn'); }

    // New day for current city → compare vs yesterday
    refreshPricesForCurrentDayAndLocation({ compareToPrevDay:true });

    dailyEvent();
    renderAll('Day '+prevDay+' → '+state.day+' complete.');
    setTimeout(renderStats, 0);
    if(state.day>=DAYS_LIMIT){ log('Final day reached. Next press ends the game.','warn'); }
  }

  // ===== Daily events & footer =====
  function dailyEvent(){ const roll=rng(); if(roll<0.20){ bumpRep(+0.02); footer('Hype building…'); } else if(roll<0.35){ bumpRep(-0.01); footer('Market feels soft.'); } else if(roll<0.45){ const loss=Math.min(state.cash, Math.floor(50+rng()*200)); addCash(-loss); bumpRep(-0.015); footer('Account took a ding.'); } else if(roll<0.55){ const owned=ITEMS.filter(i=>state.inv[i.id]>0); if(owned.length){ const it=pick(owned); const take=Math.max(1,Math.floor(state.inv[it.id]*(0.25+rng()*0.5))); state.inv[it.id]=Math.max(0,state.inv[it.id]-take); footer('Paperwork error.'); } } else if(roll<0.70){ footer('Buzz is in the air.'); } else { footer('Quiet day.'); } }
  function footer(text){ const el=gi('eventFooter'); if(el) el.textContent=text; }

  // ===== Save/Load/Reset =====
  const SAVE_KEY='pedalwars_save_v1', SCORE_KEY='pedalwars_scores_v1';
  gi('saveBtn').onclick=()=>{ try{ localStorage.setItem(SAVE_KEY, JSON.stringify({state,DAYS_LIMIT})); log('Game saved.'); }catch(e){ console.warn('Save failed',e); } };
  gi('loadBtn').onclick=()=>{ try{
      const s=localStorage.getItem(SAVE_KEY); if(!s){ log('No save found.','warn'); return; }
      const obj=JSON.parse(s); DAYS_LIMIT=obj.DAYS_LIMIT||30; state=obj.state;
      // After load, show current city's prices with deltas vs yesterday:
      refreshPricesForCurrentDayAndLocation({ compareToPrevDay:true });
      const ov=gi('startOverlay'); if(ov) ov.style.display='none';
      const gc=gi('gameControls'); if(gc) gc.style.display='flex';
      renderAll('Loaded save.'); setTimeout(renderStats,0);
    }catch(e){ console.warn('Load failed',e); } };
  gi('resetBtn').onclick=()=>{ if(confirm('Reset game?')){ try{ localStorage.removeItem(SAVE_KEY);}catch(e){} state=null; DAYS_LIMIT=30; dailyCache={}; const ov=gi('startOverlay'); if(ov) ov.style.display=''; const gc=gi('gameControls'); if(gc) gc.style.display='none'; const ul=gi('log'); if(ul) ul.innerHTML=''; renderTravelCosts(); log('Game reset. Choose a mode to start.'); setTimeout(renderStats,0); } };

  function loadScores(){ try { return JSON.parse(localStorage.getItem(SCORE_KEY)||'[]'); } catch(e){ return []; } }
  function saveScores(arr){ localStorage.setItem(SCORE_KEY, JSON.stringify(arr)); }
  function addScore(name, score, mode){ const arr=loadScores(); arr.push({name,score,mode,date:new Date().toLocaleDateString()}); arr.sort((a,b)=>b.score-a.score); saveScores(arr.slice(0,10)); }
  function gameOver(){ let liquidation=0; for(const k in state.inv) liquidation+=state.inv[k]*state.prices[k]; const net=state.cash+liquidation-state.debt; const grade= net>10000?'Legend': net>5000?'Pro': net>2000?'Hobbyist':'Weekend Warrior'; addScore(state.playerName||'Player', Math.max(0,net), (DAYS_LIMIT===7?'Quick':'Normal')); alert(`Game Over\nPlayer: ${state.playerName}\nNet Worth: ${fmt(net)}\nReputation: ${Math.round(state.rep*100)}%\nRank: ${grade}`); }

  try{ console.assert(typeof log==='function','log() defined'); }catch(e){}
})();
