/* Pedal Wars — external JS, Roadie-hardened, per-city daily markets with global YouTube features */
(function () {
  // ---------- Scoped helpers ----------
  const root = document.getElementById('pedalwars') || document;
  const gi = (id) => (root === document ? document.getElementById(id) : root.querySelector(`#${id}`));
  const fmt = (n) => "$" + Math.floor(Number(n || 0)).toLocaleString();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function mulberry32(a){return function(){let t=(a+=0x6d2b79f5);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
  function hashStr(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
  const pick = (arr, r=Math.random)=>arr[Math.floor(r()*arr.length)];
  const stop = (e)=>{ try{ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }catch(_){} };

  // ---------- Roadie overlay hardening ----------
  (function ensureOverlay(){
    const st=document.createElement('style');
    st.textContent = `
      #startOverlay, #pedalwars .overlay { position:fixed!important; inset:0!important; z-index:2147483647!important; pointer-events:auto!important; }
      #startOverlay button { pointer-events:auto!important; cursor:pointer!important; }
    `;
    (root===document?document.head:root).appendChild(st);

    function move(){
      const ov = gi('startOverlay');
      if (!ov) return;
      if (ov.parentNode !== document.body) document.body.prepend(ov);
      ov.style.zIndex = '2147483647';
      ov.style.position = 'fixed';
      ov.style.pointerEvents = 'auto';
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', move, {once:true}); else move();
    const mo = new MutationObserver(move);
    mo.observe(document.documentElement, {subtree:true, childList:true});
  })();

  // ---------- Game data ----------
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

  // ---------- Global state ----------
  let seed = Date.now() % 2147483647; let rng = mulberry32(seed);
  let DAYS_LIMIT = 30;
  let state = null;

  // Per-day, per-city market cache:
  // state.markets[day][locId] = { prices: {itemId: price}, last: {itemId: prevDayPrice} }
  // Featured items per-day (global): state.featured[day] = [itemId, ...]
  function initState(playerName){
    return {
      playerName, day:1, location:'hamilton',
      cash:1500, debt:1000, rate:0.18, rep:0.10, cap:24,
      inv:Object.fromEntries(ITEMS.map(i=>[i.id,0])),
      markets:{}, featured:{}, lastCity:'hamilton'
    };
  }

  // Build city select
  (function buildSelect(){
    const sel=gi('locationSelect'); if(!sel) return;
    if(sel.options.length===0){
      LOCATIONS.forEach(l=>{ const o=document.createElement('option'); o.value=l.id; o.textContent=l.name; sel.appendChild(o); });
    }
  })();

  // ---------- Deterministic daily pricing ----------
  function priceRNG(day, locId){ const s=(seed ^ (day*2654435761) ^ hashStr(String(locId)))>>>0; return mulberry32(s); }
  function computeFeaturedForDay(day){
    // 1–2 globally featured items per day
    const pr = mulberry32((seed ^ (day*11400714819323198485n % 0xffffffffn))>>>0);
    const count = (pr() < 0.6) ? 1 : 2;
    const idxs = new Set();
    while (idxs.size < count) idxs.add(Math.floor(pr()*ITEMS.length));
    return [...idxs].map(i=>ITEMS[i].id);
  }
  function computeCityPricesForDay(day, locId, featuredIds){
    const loc = LOCATIONS.find(l=>l.id===locId)||LOCATIONS[0];
    const pr = priceRNG(day, locId);
    const mood = 0.90 + pr()*0.30;       // city mood
    const locBase = LOC_FACTOR[locId] || 1;
    const repBoost = 1 + (state ? state.rep*0.1 : 0);
    const out = {};
    ITEMS.forEach(it=>{
      const [lo,hi]=it.base;
      const bias=(loc.bias?.[it.id] ?? loc.bias?.all ?? 1);
      let base = (lo + (hi-lo)*((pr()+pr()+pr())/3)) * bias * locBase * mood;
      base *= (0.92 + pr()*0.28); // local noise
      // Global daily swing if featured
      if (featuredIds.includes(it.id)) {
        // ±40–70% swing applied globally; favor upside a bit
        const up = pr() < 0.65;
        const mag = 0.40 + pr()*0.30; // 40–70%
        base = base * (up ? (1+mag) : (1-mag));
      }
      // Round and apply reputation discount (buyers like you)
      let price = Math.max(5, Math.round(base/repBoost));
      out[it.id]=price;
    });
    return out;
  }

  function ensureMarketsForDay(day){
    if (!state.markets[day]) {
      const featured = computeFeaturedForDay(day);
      state.featured[day] = featured;
      state.markets[day] = {};
      LOCATIONS.forEach(loc=>{
        const today = computeCityPricesForDay(day, loc.id, featured);
        const prev  = (day>1) ? state.markets[day-1]?.[loc.id]?.prices || today : today;
        state.markets[day][loc.id] = { prices: today, last: prev };
      });
    }
  }

  // ---------- Render ----------
  function renderAll(msg){ renderStats(); renderMarket(); renderTravelCosts(); if(msg) log(msg); }
  function log(msg, kind){ const ul=gi('log'); if(!ul){ console.log('[Pedal Wars]', msg); return; } const li=document.createElement('li'); if(kind) li.className=kind; li.textContent=msg; ul.prepend(li); }
  function footer(text){ gi('eventFooter').textContent = text; }

  function renderStats(){
    const used = Object.values(state.inv).reduce((a,b)=>a+b,0);
    const loc  = LOCATIONS.find(l=>l.id===state.location);
    const locBlurb = (state.location==='reverb')
      ? `Reverb.com (visiting ${LOCATIONS.find(l=>l.id===state.lastCity)?.name || 'Unknown'})`
      : `${loc.name} — ${loc.flavor}`;
    gi('day').textContent   = `${state.day}/${DAYS_LIMIT}`;
    gi('cash').textContent  = fmt(state.cash);
    gi('debt').textContent  = fmt(state.debt);
    gi('rate').textContent  = (state.rate*100).toFixed(1)+'% APR';
    gi('rep').textContent   = Math.round(state.rep*100)+'%';
    gi('used').textContent  = used; gi('cap').textContent = state.cap;
    gi('daysLeft').textContent = `${DAYS_LIMIT - state.day + 1} days left`;
    gi('locInfo').textContent  = locBlurb;
    gi('repMeter').style.width = Math.round(state.rep*100)+'%';
  }

  function renderMarket(){
    ensureMarketsForDay(state.day);
    const { prices, last } = state.markets[state.day][state.location];
    const tb=gi('marketBody'); tb.innerHTML='';
    ITEMS.forEach(it=>{
      const p = prices[it.id]; const prev = last[it.id] ?? p;
      const delta = p - prev; const cls = delta>0?'price up':delta<0?'price down':'';
      const owned = state.inv[it.id] || 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
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

    // bind buys/sells
    tb.querySelectorAll('button[data-act]').forEach(btn=>{
      btn.onclick = ()=>{
        const id = btn.getAttribute('data-id');
        const act = btn.getAttribute('data-act');
        const qty = parseInt((gi((act==='buy'?'b_':'s_')+id).value)||0,10);
        if(qty<=0) return;
        if(act==='buy') buy(id, qty); else sell(id, qty);
      };
    });

    // daily featured message
    const feats = state.featured[state.day] || [];
    if (feats.length) {
      const names = feats.map(id=>ITEMS.find(i=>i.id===id).name).join(' & ');
      footer(`${state.playerName}'s ${names} was featured on a big YouTube channel — prices swung everywhere today.`);
    } else {
      // fallback chatter
      const lines = [
        `${state.playerName} hears rumor of a limited drop.`,
        `A local blog mentions ${state.playerName}'s shop—small spike in interest.`,
        `${state.playerName} posts a board shot; comments say “take my money.”`,
        `Quiet scuttlebutt about clones; ${state.playerName} watches the listings.`,
      ];
      footer(pick(lines, rng));
    }
  }

  // ---------- Economy ----------
  function capacityUsed(){ return Object.values(state.inv).reduce((a,b)=>a+b,0); }
  function addCash(v){ state.cash=Math.max(0,Math.floor(state.cash+v)); }
  function adjustDebt(v){ state.debt=Math.max(0,Math.floor(state.debt+v)); }
  function bumpRep(d){ state.rep=clamp(state.rep+d,0,1); }

  function buy(id, qty){
    const price = state.markets[state.day][state.location].prices[id];
    const cost = price * qty;
    if (capacityUsed()+qty > state.cap) { log('Not enough space.','bad'); return; }
    if (cost > state.cash) { log('Not enough cash.','bad'); return; }
    addCash(-cost); state.inv[id]+=qty; bumpRep(+0.002*qty);
    log(`${state.playerName} bought ${qty} × ${ITEMS.find(x=>x.id===id).name} for ${fmt(cost)}.`, 'good');
    renderStats(); renderMarket();
  }
  function sell(id, qty){
    const have = state.inv[id]||0; if(qty>have){ log('You do not own that many.','bad'); return; }
    const gross = state.markets[state.day][state.location].prices[id] * qty;
    const fee = (state.location==='reverb')?50:0; const net = Math.max(0, gross-fee);
    state.inv[id]-=qty; addCash(net); bumpRep(+0.001*qty);
    log(fee?`${state.playerName} sold ${qty} × ${ITEMS.find(x=>x.id===id).name} for ${fmt(gross)} (−${fmt(fee)} fee) → ${fmt(net)}.`
            :`${state.playerName} sold ${qty} × ${ITEMS.find(x=>x.id===id).name} for ${fmt(net)}.`);
    renderStats(); renderMarket();
  }

  // ---------- Travel ----------
  function travelCostFor(origin, dest){
    if(origin === dest) return 0;
    if(origin === 'reverb' || dest === 'reverb') return 0; // free to/from Reverb
    let h=0; for(let i=0;i<dest.length;i++) h=(h*31+dest.charCodeAt(i))>>>0;
    const r=mulberry32((state.day*2654435761 ^ h)>>>0)();
    return Math.floor(50 + r*100);
  }
  function renderTravelCosts(){
    const cur = state ? state.location : 'hamilton';
    const s = LOCATIONS.map(l => `${l.name}: ${fmt(travelCostFor(cur, l.id))}`).join(' | ');
    gi('travelCosts').textContent = 'Travel Costs: ' + s;
  }
  gi('travelBtn').addEventListener('click', ()=>{
    const dest = gi('locationSelect').value;
    if(dest===state.location){ log('You are already there.','warn'); return; }
    const cost = travelCostFor(state.location, dest);
    if(state.cash < cost){ log(`Travel costs ${fmt(cost)}. Need more cash.`,'bad'); return; }
    addCash(-cost);
    const from=LOCATIONS.find(l=>l.id===state.location).name; const to=LOCATIONS.find(l=>l.id===dest).name;
    if(dest!=='reverb') state.lastCity = dest;
    state.location = dest;
    ensureMarketsForDay(state.day); // show dest’s snapshot (no re-rolls today)
    log(`${state.playerName} traveled ${from} → ${to} (${cost?('cost '+fmt(cost)):'free'})`, cost?'warn':'good');
    renderAll();
  });

  // ---------- Day advance (single tick, debounced) ----------
  let _endLock=false, _endTs=0;
  function endDay(){
    if(!state) return;
    const now=Date.now(); if(_endLock || (now-_endTs)<250) return; _endLock=true; _endTs=now;

    if (state.day >= DAYS_LIMIT) { _endLock=false; return gameOver(); }
    const prev = state.day; state.day = prev + 1;

    // finance effects
    if(state.debt>0){ const daily=state.rate/365; const inc=Math.floor(state.debt*daily); adjustDebt(+inc); if(inc>0) log(`Interest accrued ${fmt(inc)}.`,'warn'); }
    const storage = Math.floor(capacityUsed()*2); if(storage>0){ addCash(-storage); log(`Storage fees ${fmt(storage)}.`,'warn'); }

    // build markets for the new day (all cities)
    ensureMarketsForDay(state.day);
    // fun random event line (already set in renderMarket via featured)
    renderAll(`Day ${prev} → ${state.day} complete.`);

    if (state.day >= DAYS_LIMIT) log('Final day reached. Next press ends the game.','warn');
    setTimeout(()=>{ _endLock=false; }, 250);
  }
  gi('nextBtn').addEventListener('click', endDay);

  // ---------- Save/Load/Reset ----------
  const SAVE_KEY='pedalwars_save_v2';
  gi('saveBtn').addEventListener('click', ()=>{ try{ localStorage.setItem(SAVE_KEY, JSON.stringify({state, DAYS_LIMIT})); log('Game saved.'); }catch(e){ console.warn('Save failed',e); }});
  gi('loadBtn').addEventListener('click', ()=>{ try{ const s=localStorage.getItem(SAVE_KEY); if(!s){ log('No save found.','warn'); return; } const obj=JSON.parse(s); state=obj.state; DAYS_LIMIT=obj.DAYS_LIMIT||30; gi('gameControls').style.display='flex'; ensureMarketsForDay(state.day); renderAll('Loaded save.'); }catch(e){ console.warn('Load failed',e); }});
  gi('resetBtn').addEventListener('click', ()=>{
    if(!confirm('Reset game?')) return;
    try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
    state=null; DAYS_LIMIT=30;
    // recreate overlay
    const ov=document.createElement('div');
    ov.id='startOverlay'; ov.className='overlay';
    ov.innerHTML = `<div class="panel" style="background:#171a21;padding:20px;border-radius:12px;text-align:center;border:1px solid #232735;min-width:320px">
      <h2>🎛️ Pedal Wars</h2><p>Choose a mode:</p>
      <button id="quickBtn" class="primary" type="button">Quick Play (7 Days)</button>
      <button id="normalBtn" class="primary" type="button">Normal Play (30 Days)</button>
    </div>`;
    document.body.prepend(ov);
    wireStart(); renderTravelCosts(); gi('log').innerHTML=''; log('Game reset. Choose a mode to start.');
  });

  // ---------- Start wiring (direct + delegated + keyboard) ----------
  function wireStart(){
    const qb=gi('quickBtn'), nb=gi('normalBtn');
    if(qb && !qb._pw){ qb.addEventListener('click', ()=>{DAYS_LIMIT=7;  startGame();}); qb._pw=1; }
    if(nb && !nb._pw){ nb.addEventListener('click', ()=>{DAYS_LIMIT=30; startGame();}); nb._pw=1; }
  }
  function startDelegated(e){
    const t = e.target && e.target.closest && e.target.closest('#quickBtn,#normalBtn');
    if(!t) return;
    stop(e);
    DAYS_LIMIT = (t.id==='quickBtn') ? 7 : 30;
    startGame();
  }
  document.addEventListener('click', startDelegated, true);
  document.addEventListener('pointerdown', startDelegated, true);
  document.addEventListener('touchstart', startDelegated, {capture:true, passive:false});
  document.addEventListener('keydown', (e)=>{
    if(!gi('startOverlay')) return;
    if(e.key==='1'){ DAYS_LIMIT=7;  startGame(); }
    if(e.key==='2'){ DAYS_LIMIT=30; startGame(); }
  });
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', wireStart, {once:true}); else wireStart();

  function startGame(){
    if(state) return;
    const name=(prompt('Enter player name:','Player')||'Player').trim().slice(0,16);
    state = initState(name);
    const ov=gi('startOverlay'); if(ov) ov.remove();
    const gc=gi('gameControls'); if(gc) gc.style.display='flex';
    ensureMarketsForDay(state.day);
    renderAll('New game started.');
    renderTravelCosts();
  }

  // ---------- Initial UI ----------
  renderTravelCosts();
  console.log('[Pedal Wars] bundle loaded');
})();
