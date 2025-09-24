/* Pedal Wars — Roadie-hardened start: move overlay to <body>, direct+delegated+observer, keyboard, fail-safe autostart */
(function () {
  // ===== Scoped helpers =====
  const root = document.getElementById('pedalwars') || document;
  const gi = (id) => (root === document ? document.getElementById(id) : root.querySelector(`#${id}`));
  const fmt = (n) => "$" + Math.floor(Number(n || 0)).toLocaleString();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function mulberry32(a){return function(){let t=(a+=0x6d2b79f5);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
  function hashStr(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
  const stop = (e)=>{ try{ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }catch(_){} };

  // Keep our overlay clickable/above everything
  (function(){ const st=document.createElement('style');
    st.textContent = `
      #pedalwars button{pointer-events:auto!important}
      #pedalwars .overlay{position:fixed!important; inset:0!important; z-index:2147483647!important; pointer-events:auto!important}
      #pedalwars .overlay[aria-hidden="true"]{display:none!important}
    `;
    (root===document?document.head:root).appendChild(st);
  })();

  // ===== RNG / logging =====
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
  let dailyCache = {};
  let lastCity = 'hamilton';

  // Build location select ASAP
  (function(){ const sel=gi('locationSelect'); if(!sel||sel.options.length) return;
    LOCATIONS.forEach(l=>{ const o=document.createElement('option'); o.value=l.id; o.textContent=l.name; sel.appendChild(o); });
  })();

  // ===== Deterministic pricing =====
  function priceRNG(day, locId){ const s=(seed^(day*2654435761)^hashStr(String(locId)))>>>0; return mulberry32(s); }
  function computePricesFor(day, locId){
    const loc = LOCATIONS.find(l=>l.id===locId)||LOCATIONS[0];
    const pr  = priceRNG(day, locId);
    const mood    = 0.90 + pr()*0.30;
    const locBase = LOC_FACTOR[locId] || 1;
    const shocks  = pr() < 0.55 ? 1 : 2;
    const shockIdxs = new Set(); while(shockIdxs.size<shocks) shockIdxs.add(Math.floor(pr()*ITEMS.length));
    const repBoost = 1 + (state ? state.rep*0.1 : 0);
    const out = {};
    ITEMS.forEach((it, idx)=>{
      const [lo,hi] = it.base;
      const bias = (loc.bias?.[it.id] ?? loc.bias?.all ?? 1);
      let roll  = (pr()+pr()+pr())/3;
      let price = (lo + (hi-lo)*roll) * bias * locBase * mood;
      price *= (0.92 + pr()*0.28);
      if (shockIdxs.has(idx)) price *= (pr()<0.5 ? (2.0+pr()*0.5) : (0.40+pr()*0.20));
      price = Math.round(Math.max(5, price/repBoost));
      out[it.id]=price;
    });
    return out;
  }
  function getPricesFor(day, locId){ dailyCache[day] ||= {}; return dailyCache[day][locId] || (dailyCache[day][locId]=computePricesFor(day,locId)); }

  // ===== Start wiring (Roadie proof) =====
  let _startWired = false;
  function wireStartDirect(){
    const qb=gi('quickBtn'), nb=gi('normalBtn');
    if(qb && !qb._pw){ qb.addEventListener('click', ()=>{DAYS_LIMIT=7;  startGame();}); qb._pw=1; _startWired=true; }
    if(nb && !nb._pw){ nb.addEventListener('click', ()=>{DAYS_LIMIT=30; startGame();}); nb._pw=1; _startWired=true; }
    // Move overlay to <body> so it always sits on top of theme wrappers
    const ov=gi('startOverlay');
    if(ov && ov.parentNode !== document.body){ document.body.appendChild(ov); }
    if(ov){ ov.style.zIndex = '2147483647'; ov.style.position='fixed'; }
  }
  function startDelegated(e){
    const t = e.target && e.target.closest && e.target.closest('#quickBtn,#normalBtn');
    if(!t) return;
    stop(e);
    DAYS_LIMIT = (t.id==='quickBtn')?7:30;
    startGame();
  }
  // DOM ready + microtask fallback
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', wireStartDirect, {once:true}); }
  else { wireStartDirect(); }
  setTimeout(wireStartDirect, 0);

  // Delegated capture-phase listeners (beat theme handlers)
  document.addEventListener('click', startDelegated, true);
  document.addEventListener('pointerdown', startDelegated, true);
  document.addEventListener('touchstart', startDelegated, {capture:true, passive:false});

  // MutationObserver: rebind if theme re-renders overlay
  const mo = new MutationObserver(wireStartDirect);
  mo.observe(document.documentElement, {subtree:true, childList:true});

  // Keyboard fallback: 1 = quick, 2 = normal
  document.addEventListener('keydown', (e)=>{
    if(!gi('startOverlay')) return;
    if(e.key==='1'){ DAYS_LIMIT=7;  startGame(); }
    if(e.key==='2'){ DAYS_LIMIT=30; startGame(); }
  });

  // Fail-safe autostart if Roadie keeps eating clicks
  setTimeout(()=>{
    if(!state && gi('startOverlay')){
      console.warn('[Pedal Wars] Autostart fallback fired (theme swallowed clicks).');
      DAYS_LIMIT=7; startGame();
    }
  }, 1500);

  // ===== Start / Init =====
  function startGame(){
    if(state) return; // already started
    const name=(prompt('Enter player name:','Player')||'Player').trim().slice(0,16);
    state=initState(name);
    gi('startOverlay')?.remove();
    gi('gameControls') && (gi('gameControls').style.display='flex');
    state.prices = {...getPricesFor(state.day, state.location)};
    state.lastPrices = {...state.prices};
    lastCity = state.location;
    randomFooter();
    renderAll('New game started.');
  }
  function initState(playerName){
    dailyCache={};
    return { day:1, location:'hamilton', cash:1500, debt:1000, rate:0.18, rep:0.10, cap:24,
             inv:Object.fromEntries(ITEMS.map(i=>[i.id,0])), prices:{}, lastPrices:{}, playerName };
  }

  // ===== Footer messages =====
  function randomFooter(){
    const name = state?.playerName || 'Player';
    const options = [
      `${name} hears rumor of a limited drop.`,
      `A local blog mentions ${name}'s shop—small spike in interest.`,
      `${name} posts a board shot; comments say “take my money.”`,
      `Quiet scuttlebutt about clones; ${name} watches the listings.`,
      `${name} spots a touring act in town—buyers might pay a premium.`,
      `${name} gets tagged on IG; inbox warms up.`,
      `Hype building around a boutique run ${name} has eyes on.`,
      `${name} sees a few lowballers circling. Market feels soft.`,
    ];
    gi('eventFooter').textContent = pick(options);
  }

  // ===== Render =====
  function renderAll(msg){ renderStats(); renderMarket(); renderTravelCosts(); if(msg) log(msg); }
  function renderStats(){
    const used=Object.values(state.inv).reduce((a,b)=>a+b,0);
    const loc=LOCATIONS.find(l=>l.id===state.location);
    const locBlurb = (state.location==='reverb')
      ? `${loc.name} — listing from ${LOCATIONS.find(l=>l.id===lastCity)?.name || 'Unknown'}`
      : `${loc.name} — ${loc.flavor}`;
    gi('day').textContent   = `${state.day}/${DAYS_LIMIT}`;
    gi('cash').textContent  = fmt(state.cash);
    gi('debt').textContent  = fmt(state.debt);
    gi('rate').textContent  = (state.rate*100).toFixed(1)+'% APR';
    gi('rep').textContent   = Math.round(state.rep*100)+'%';
    gi('used').textContent  = used; gi('cap').textContent = state.cap;
    gi('daysLeft').textContent = `${DAYS_LIMIT-state.day+1} days left`;
    gi('locInfo').textContent  = locBlurb;
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

  // ===== Pricing glue =====
  function refreshPricesForCurrentDayAndLocation({compareToPrevDay=false, destLocation=null}={}){
    const locId = destLocation || state.location;
    const todays = getPricesFor(state.day, locId);
    state.lastPrices = compareToPrevDay ? {...getPricesFor(Math.max(1,state.day-1), locId)} : {...todays};
    state.prices = {...todays};
  }

  // ===== Economy helpers =====
  function capacityUsed(){ return Object.values(state.inv).reduce((a,b)=>a+b,0); }
  function addCash(v){ state.cash=Math.max(0,Math.floor(state.cash+v)); }
  function adjustDebt(v){ state.debt=Math.max(0,Math.floor(state.debt+v)); }
  function bumpRep(d){ state.rep=clamp(state.rep+d,0,1); }

  // ===== Actions =====
  gi('borrowBtn').addEventListener('click', ()=>{ adjustDebt(+500); addCash(+500); log(`${state.playerName} borrowed $500 at current APR.`,'warn'); renderStats(); });
  gi('repayBtn').addEventListener('click', ()=>{ if(state?.debt<=0){ log(`${state.playerName} has no debt to repay.`,'warn'); return; } if(state.cash<=0){ log(`${state.playerName} has no cash to repay.`,'bad'); return; } const pay=Math.min(500,state.debt,state.cash); adjustDebt(-pay); addCash(-pay); log(`${state.playerName} repaid `+fmt(pay)+'.','good'); renderStats(); });

  function buy(id,qty){ const cost=state.prices[id]*qty; if(capacityUsed()+qty>state.cap){ log('Not enough space.','bad'); return; } if(cost>state.cash){ log('Not enough cash.','bad'); return; } addCash(-cost); state.inv[id]+=qty; bumpRep(+0.002*qty); log(`${state.playerName} bought ${qty} × ${ITEMS.find(x=>x.id===id).name} for ${fmt(cost)}.`,'good'); renderStats(); renderMarket(); }
  function sell(id,qty){ const have=state.inv[id]||0; if(qty>have){ log(`${state.playerName} tried to sell more than they own.`,'bad'); return; } const gross=state.prices[id]*qty; const fee=(state.location==='reverb')?50:0; const net=Math.max(0,gross-fee); state.inv[id]-=qty; addCash(net); bumpRep(+0.001*qty); log(fee?`${state.playerName} sold ${qty} × ${ITEMS.find(x=>x.id===id).name} for ${fmt(gross)} (−${fmt(fee)} fee) → ${fmt(net)}.`:`${state.playerName} sold ${qty} × ${ITEMS.find(x=>x.id===id).name} for ${fmt(net)}.`); renderStats(); renderMarket(); });

  gi('sellAllBtn').addEventListener('click', ()=>{ let total=0,sold=false; Object.keys(state.inv).forEach(k=>{ const q=state.inv[k]; if(q>0){ total+=q*state.prices[k]; state.inv[k]=0; sold=true; }}); if(!sold){ log(`${state.playerName} has nothing to sell.`,'warn'); return; } const fee=(state.location==='reverb')?50:0; const net=Math.max(0,total-fee); addCash(net); log(`${state.playerName} quick sold everything for ${fmt(total)}${fee?` (−${fmt(fee)} fee)`:''} → ${fmt(net)} net.`,'good'); renderAll(); });

  gi('dumpBtn').addEventListener('click', ()=>{ const owned=ITEMS.filter(it=>state.inv[it.id]>0); if(!owned.length){ log(`${state.playerName} owns nothing to dump.`,'warn'); return; } const it=pick(owned); state.inv[it.id]-=1; log(`${state.playerName} dumped 1 ${it.name} to free space.`,'warn'); renderStats(); renderMarket(); });

  // ===== Travel & Costs (FREE to/from Reverb) =====
  gi('travelBtn').addEventListener('click', ()=> travel(gi('locationSelect').value) );
  function travelCostFor(origin, dest){
    if(origin === dest) return 0;
    if(origin === 'reverb' || dest === 'reverb') return 0;
    let h=0; for(let i=0;i<dest.length;i++) h=(h*31+dest.charCodeAt(i))>>>0;
    const r=mulberry32((state.day*2654435761 ^ h)>>>0)();
    return Math.floor(50 + r*100);
  }
  function renderTravelCosts(){
    const cur = state ? state.location : 'hamilton';
    const s = LOCATIONS.map(l=>l.name+': '+fmt(travelCostFor(cur, l.id))).join(' | ');
    gi('travelCosts').textContent = 'Travel Costs: '+s;
  }
  function travel(dest){
    if(dest===state.location){ log('You are already there.','warn'); return; }
    const cost=travelCostFor(state.location, dest);
    if(state.cash<cost){ log(`Travel costs ${fmt(cost)}. ${state.playerName} needs more cash.`,'bad'); return; }
    addCash(-cost);
    const from=LOCATIONS.find(l=>l.id===state.location).name; const to=LOCATIONS.find(l=>l.id===dest).name;
    if(dest !== 'reverb') lastCity = dest;
    state.location=dest;
    refreshPricesForCurrentDayAndLocation({ compareToPrevDay:true, destLocation:dest });
    randomFooter();
    log(`${state.playerName} traveled ${from} → ${to} (${cost?('cost '+fmt(cost)):'free'})`, cost?'warn':'good');
    const n=2+Math.floor(mulberry32(Date.now()>>>0)()*2); for(let i=0;i<n;i++) travelEvent();
    renderAll();
  }
  function travelEvent(){ const r=mulberry32(((Date.now()%1e9)+Math.floor(rng()*1e9))>>>0)(); if(r<0.20){ const gain=Math.floor(50+r*250); addCash(gain); log(`${state.playerName} scored a pop-up flip on arrival: +${fmt(gain)}.`,'good'); } else if(r<0.40){ const loss=Math.min(state.cash,Math.floor(30+r*200)); addCash(-loss); log(`${state.playerName} hit road fees: −${fmt(loss)}.`,'bad'); } else if(r<0.60){ bumpRep(+0.02); log(`${state.playerName} met a demo artist — reputation up.`,'good'); } else if(r<0.75){ const interest=Math.floor(state.debt*0.001*(1+Math.floor(r*3))); adjustDebt(+interest); log(`Travel delays increased ${state.playerName}'s costs: +${fmt(interest)} debt.`,'warn'); } else if(r<0.90){ const refund=Math.floor(20+r*120); addCash(refund); log(`${state.playerName} returned a defective part and got ${fmt(refund)} back.`,'good'); } else { bumpRep(-0.015); log(`Buyer flaked on ${state.playerName} — tiny rep hit.`,'warn'); } }

  // ===== End Day (single tick; debounce) =====
  let _endDayLock=false, _endDayLastTs=0;
  function endDay(){
    if(!state) return;
    const now=Date.now();
    if(_endDayLock || (now-_endDayLastTs)<250) return;
    _endDayLock=true; _endDayLastTs=now;

    if(state.day>=DAYS_LIMIT){ _endDayLock=false; gameOver(); return; }
    const prev=state.day; state.day = prev + 1;

    if(state.debt>0){ const daily=state.rate/365; const inc=Math.floor(state.debt*daily); adjustDebt(+inc); if(inc>0) log(`Interest accrued ${fmt(inc)}.`,'warn'); }
    const fee=Math.floor(capacityUsed()*2); if(fee>0){ addCash(-fee); log(`Storage fees ${fmt(fee)}.`,'warn'); }

    refreshPricesForCurrentDayAndLocation({ compareToPrevDay:true });
    randomFooter();
    renderAll(`Day ${prev} → ${state.day} complete.`);
    if(state.day>=DAYS_LIMIT){ log('Final day reached. Next press ends the game.','warn'); }

    setTimeout(()=>{ _endDayLock=false; }, 250);
  }
  gi('nextBtn').addEventListener('click', endDay);

  // ===== Save/Load/Reset =====
  const SAVE_KEY='pedalwars_save_v1';
  gi('saveBtn').addEventListener('click', ()=>{ try{ localStorage.setItem(SAVE_KEY, JSON.stringify({state,DAYS_LIMIT,lastCity})); log('Game saved.'); }catch(e){ console.warn('Save failed',e); }});
  gi('loadBtn').addEventListener('click', ()=>{ try{ const s=localStorage.getItem(SAVE_KEY); if(!s){ log('No save found.','warn'); return; } const obj=JSON.parse(s); DAYS_LIMIT=obj.DAYS_LIMIT||30; state=obj.state; lastCity=obj.lastCity||lastCity; gi('gameControls').style.display='flex'; refreshPricesForCurrentDayAndLocation({ compareToPrevDay:true }); randomFooter(); renderAll('Loaded save.'); }catch(e){ console.warn('Load failed',e); }});
  gi('resetBtn').addEventListener('click', ()=>{ if(!confirm('Reset game?')) return; try{ localStorage.removeItem(SAVE_KEY); }catch(e){} state=null; DAYS_LIMIT=30; dailyCache={}; lastCity='hamilton'; gi('gameControls').style.display='none'; gi('log').innerHTML=''; const ov=document.createElement('div'); ov.id='startOverlay'; ov.className='overlay'; ov.innerHTML=`<div class="panel" style="background:#171a21;padding:20px;border-radius:12px;text-align:center;border:1px solid #232735;min-width:320px"><h2>🎛️ Pedal Wars</h2><p>Choose a mode:</p><button id="quickBtn" class="primary" type="button">Quick Play (7 Days)</button> <button id="normalBtn" class="primary" type="button">Normal Play (30 Days)</button></div>`; document.body.prepend(ov); _startWired=false; wireStartDirect(); renderTravelCosts(); randomFooter(); log('Game reset. Choose a mode to start.'); });

  // Pre-start visuals
  renderTravelCosts();
  console.log('[Pedal Wars] bundle loaded (Roadie-hardened)');
})();
