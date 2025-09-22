<!-- ===============================
 Full Big Cartel Embeddable Version (IDs aligned with JS, fixed day/progress)
================================== -->

<div id="pedalwars">
  <style>
    :root { --bg:#0f0f1b; --panel:#171a21; --text:#e6e9f2; --accent:#7dd3fc; }
    #pedalwars *{box-sizing:border-box}
    #pedalwars{background:var(--bg);color:var(--text);font:14px system-ui;padding:12px;border-radius:12px}
    #pedalwars button{background:#1d283a;border:1px solid #29415a;color:var(--text);cursor:pointer;padding:8px 10px;border-radius:6px}
    #pedalwars button.primary{background:#2563eb;border-color:#1e40af}
    #pedalwars .card{background:var(--panel);padding:10px;border-radius:8px;margin-bottom:12px}
    #pedalwars .overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:1000}
    #pedalwars .overlay .panel{background:var(--panel);padding:20px;border-radius:12px;text-align:center;min-width:280px}
    #pedalwars ul{list-style:none;margin:0;padding:0;max-height:200px;overflow-y:auto}
    #pedalwars ul li{padding:4px;border-bottom:1px solid #232735;font-size:12px}
    #pedalwars .meter{height:10px;background:#0d1119;border-radius:999px;overflow:hidden;border:1px solid #232735;margin-top:8px}
    #pedalwars .meter>div{height:100%;background:linear-gradient(90deg,#6ee7b7,#3b82f6);width:0%}
    #pedalwars .pill{display:inline-block;padding:2px 8px;border-radius:999px;border:1px solid #2a3040;background:#121520;color:#8b93a7;font-size:12px;margin-right:6px}
    #pedalwars table{width:100%;border-collapse:collapse}
    #pedalwars th,#pedalwars td{padding:6px;border-bottom:1px solid #232735}
    #pedalwars .row{display:flex;justify-content:space-between;margin:4px 0}
  </style>

  <div id="startOverlay" class="overlay" role="dialog" aria-modal="true">
    <div class="panel">
      <h2>🎛️ Pedal Wars</h2>
      <p>Choose a mode:</p>
      <button id="quickBtn" class="primary" type="button">Quick Play (7 Days)</button>
      <button id="normalBtn" class="primary" type="button">Normal Play (30 Days)</button>
    </div>
  </div>

  <header>
    <h1>🎛️ Pedal Wars — Boutique Flip Sim</h1>
    <div id="gameControls" style="display:none">
      <label>Location <select id="locationSelect"></select></label>
      <span id="travelCosts" class="pill"></span>
      <button id="travelBtn" class="primary" type="button">Travel</button>
      <button id="nextBtn" type="button">End Day</button>
      <button id="saveBtn" type="button">Save</button>
      <button id="loadBtn" type="button">Load</button>
      <button id="resetBtn" type="button">Reset</button>
    </div>
  </header>

  <main>
    <section class="card">
      <h2>Stats</h2>
      <div class="row"><span>Day</span><strong id="day"></strong></div>
      <div class="row"><span>Cash</span><strong id="cash"></strong></div>
      <div class="row"><span>Debt</span><strong id="debt"></strong></div>
      <div class="row"><span>Interest</span><strong id="rate"></strong></div>
      <div class="row"><span>Reputation</span><strong id="rep"></strong></div>
      <div class="row"><span>Capacity</span><strong><span id="used"></span>/<span id="cap"></span></strong></div>
      <div class="meter" title="Reputation"><div id="repMeter"></div></div>
      <div style="margin-top:8px">
        <span class="pill" id="daysLeft"></span>
        <span class="pill" id="locInfo"></span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">
        <button id="borrowBtn" class="primary" type="button">Borrow +$500</button>
        <button id="repayBtn" type="button">Repay $500</button>
        <button id="sellAllBtn" type="button">Quick Sell (All)</button>
        <button id="dumpBtn" type="button">Dump 1 Random</button>
      </div>
    </section>

    <section class="card">
      <h2>Market</h2>
      <table>
        <thead><tr><th>Pedal</th><th>Price</th><th>Owned</th><th>Buy</th><th>Sell</th></tr></thead>
        <tbody id="marketBody"></tbody>
      </table>
      <footer id="eventFooter">No events yet.</footer>
    </section>

    <section class="card">
      <h2>Feed</h2>
      <ul id="log"></ul>
    </section>
  </main>
</div>

<!-- In-canvas JS (runs after DOM ready) -->
<script>
(function(){
  'use strict';
  // ===== Utilities =====
  const gi = id => document.getElementById(id);
  const fmt = n => "$" + Math.floor(Number(n||0)).toLocaleString();
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
  let seed = Date.now()%2147483647; let rng = mulberry32(seed);
  const pick = arr => arr[Math.floor(rng()*arr.length)];
  function log(msg, kind){ const ul=gi('log'); if(!ul){ console.log('[Pedal Wars]', kind?('['+kind+']'):'', msg); return; } const li=document.createElement('li'); if(kind) li.className=kind; li.textContent=msg; ul.prepend(li); }

  // ===== Data =====
  const ITEMS=[
    {id:"overdrive", name:"Overdrive", base:[90,220], weight:1},
    {id:"fuzz",      name:"Fuzz",      base:[60,260], weight:1},
    {id:"delay",     name:"Delay",     base:[180,520], weight:2},
    {id:"reverb",    name:"Reverb",    base:[150,560], weight:2},
    {id:"mod",       name:"Modulation",base:[120,380], weight:1},
    {id:"synth",     name:"Synth/Weird",base:[220,740],weight:2},
    {id:"kit",       name:"DIY Kit",   base:[45,160], weight:1}
  ];
  const LOCATIONS=[
    {id:'hamilton', name:'Hamilton',  flavor:"Local scene, steady buyers", bias:{overdrive:.95,fuzz:.9,kit:.9}},
    {id:'toronto',  name:'Toronto',   flavor:"Big market, hype spikes",    bias:{delay:1.1,reverb:1.1,mod:1.05}},
    {id:'montreal', name:'Montreal',  flavor:"Trendy boutique tastes",     bias:{synth:1.15,mod:1.1}},
    {id:'nash',     name:'Nashville', flavor:"Session demand, good money", bias:{overdrive:1.1,delay:1.1,reverb:1.05}},
    {id:'reverb',   name:'Reverb.com',flavor:"Online—fees & scams",        bias:{all:1.0}}
  ];

  // ===== State =====
  let DAYS_LIMIT=30; let state=null; let bound=false;

  function buildSelect(){ const sel=gi('locationSelect'); if(!sel || sel.options.length) return; LOCATIONS.forEach(l=>{ const o=document.createElement('option'); o.value=l.id; o.textContent=l.name; sel.appendChild(o); }); }

  function startGame(){
    const name=(prompt('Enter player name:','Player')||'Player').trim().slice(0,16);
    state=initState(name);
    gi('startOverlay').style.display='none';
    gi('gameControls').style.display='block';
    genPrices();
    renderAll('New game started.');
  }
  function initState(playerName){
    return { day:1, location:'hamilton', cash:1500, debt:1000, rate:0.18, rep:0.10, cap:24,
             inv:Object.fromEntries(ITEMS.map(i=>[i.id,0])), prices:{}, lastPrices:{}, playerName };
  }

  function renderAll(msg){ renderStats(); renderMarket(); renderTravelCosts(); if(msg) log(msg); }
  function renderStats(){
    const used=Object.values(state.inv).reduce((a,b)=>a+b,0);
    gi('day').textContent=`${state.day}/${DAYS_LIMIT}`;
    gi('cash').textContent=fmt(state.cash);
    gi('debt').textContent=fmt(state.debt);
    gi('rate').textContent=(state.rate*100).toFixed(1)+'% APR';
    gi('rep').textContent=Math.round(state.rep*100)+'%';
    gi('used').textContent=used; gi('cap').textContent=state.cap;
    gi('daysLeft').textContent=`${DAYS_LIMIT-state.day+1} days left`;
    const loc=LOCATIONS.find(l=>l.id===state.location); gi('locInfo').textContent=`${loc.name} — ${loc.flavor}`;
    gi('repMeter').style.width=Math.round(state.rep*100)+'%';
  }
  function renderMarket(){
    const tb=gi('marketBody'); tb.innerHTML='';
    ITEMS.forEach(it=>{
      const owned=state.inv[it.id]||0; const p=state.prices[it.id]; const last=state.lastPrices[it.id]||p;
      const delta=p-last; const cls=delta>0?'price up':delta<0?'price down':'';
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td><strong>${it.name}</strong><br/><small>Weight ${it.weight}</small></td>
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
          ${state.location==='reverb' ? '<div><span class="pill">Reverb fee: $50</span></div>' : ''}
        </td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll('button[data-act]').forEach(btn=>{
      btn.onclick=()=>{ const id=btn.getAttribute('data-id'); const act=btn.getAttribute('data-act'); const qty=parseInt((gi((act==='buy'?'b_':'s_')+id).value)||0,10); if(qty<=0) return; if(act==='buy') buy(id,qty); else sell(id,qty); };
    });
  }

  function genPrices(){
    state.lastPrices={...state.prices};
    const loc=LOCATIONS.find(l=>l.id===state.location);
    const repBoost=1+(state.rep*0.1);
    ITEMS.forEach(it=>{
      const [lo,hi]=it.base; const bias=(loc.bias?.[it.id]||loc.bias?.all||1);
      let price = Math.round( (lo+(hi-lo)*(((rng()+rng()+rng())/3))) * bias );
      price = Math.round(price*(0.75 + rng()*0.8));
      price = Math.round(price/repBoost);
      state.prices[it.id]=Math.max(5,price);
    });
  }

  function capacityUsed(){ return Object.values(state.inv).reduce((a,b)=>a+b,0); }
  function addCash(v){ state.cash=Math.max(0,Math.floor(state.cash+v)); }
  function adjustDebt(v){ state.debt=Math.max(0,Math.floor(state.debt+v)); }
  function bumpRep(d){ state.rep=clamp(state.rep+d,0,1); }

  function buy(id,qty){ const cost=state.prices[id]*qty; if(capacityUsed()+qty>state.cap){ log('Not enough space.','bad'); return; } if(cost>state.cash){ log('Not enough cash.','bad'); return; } addCash(-cost); state.inv[id]+=qty; bumpRep(+0.002*qty); log('Bought '+qty+' × '+ITEMS.find(x=>x.id===id).name+' for '+fmt(cost)+'.','good'); renderStats(); renderMarket(); }
  function sell(id,qty){ const have=state.inv[id]||0; if(qty>have){ log('You do not own that many.','bad'); return; } const gross=state.prices[id]*qty; const fee=(state.location==='reverb')?50:0; const net=Math.max(0,gross-fee); state.inv[id]-=qty; addCash(net); bumpRep(+0.001*qty); log(fee?'Sold '+qty+' × '+ITEMS.find(x=>x.id===id).name+' for '+fmt(gross)+' (−'+fmt(fee)+' fee) → '+fmt(net)+'.':'Sold '+qty+' × '+ITEMS.find(x=>x.id===id).name+' for '+fmt(net)+'.'); renderStats(); renderMarket(); }

  function travelCostFor(dest){ if(dest==='reverb') return 0; let h=0; for(let i=0;i<dest.length;i++){ h=(h*31+dest.charCodeAt(i))>>>0; } const r=mulberry32((state.day*2654435761 ^ h)>>>0)(); return Math.floor(50 + r*100); }
  function renderTravelCosts(){ const s=LOCATIONS.map(l=>l.name+': '+fmt(travelCostFor(l.id))).join(' | '); gi('travelCosts').textContent='Travel Costs: '+s; }
  function travel(dest){ if(!dest){ log('Pick a destination first.','warn'); return; } if(dest===state.location){ log('You are already there.','warn'); return; } const cost=travelCostFor(dest); if(state.cash<cost){ log('Travel costs '+fmt(cost)+'. You need more cash.','bad'); return; } addCash(-cost); const from=LOCATIONS.find(l=>l.id===state.location).name; const to=LOCATIONS.find(l=>l.id===dest).name; state.location=dest; log('Traveled '+from+' → '+to+' ('+(cost?('cost '+fmt(cost)):'free')+')', cost?'warn':'good'); const n=2+Math.floor(mulberry32((Date.now()>>>0))()*2); for(let i=0;i<n;i++) travelEvent(); renderAll(); }
  function travelEvent(){ const r=mulberry32(((Date.now()%1e9)+Math.floor(rng()*1e9))>>>0)(); if(r<0.20){ const gain=Math.floor(50+r*250); addCash(gain); log('Scored a pop-up flip on arrival: +'+fmt(gain)+'.','good'); } else if(r<0.40){ const loss=Math.min(state.cash,Math.floor(30+r*200)); addCash(-loss); log('Road fees hit: −'+fmt(loss)+'.','bad'); } else if(r<0.60){ bumpRep(+0.02); log('Met a demo artist — reputation up.','good'); } else if(r<0.75){ const interest=Math.floor(state.debt*0.001*(1+Math.floor(r*3))); adjustDebt(+interest); log('Travel delays increased costs: +'+fmt(interest)+' debt.','warn'); } else if(r<0.90){ const refund=Math.floor(20+r*120); addCash(refund); log('Returned a defective part and got '+fmt(refund)+' back.','good'); } else { bumpRep(-0.015); log('Buyer flaked on meetup — tiny rep hit.','warn'); } }

  function endDay(){ if(state.debt>0){ const daily=state.rate/365; const inc=Math.floor(state.debt*daily); adjustDebt(+inc); if(inc>0) log('Interest accrued '+fmt(inc)+'.','warn'); } const fee=Math.floor(capacityUsed()*2); if(fee>0){ addCash(-fee); log('Storage fees '+fmt(fee)+'.','warn'); } dailyEvent(); if(state.day<DAYS_LIMIT){ state.day++; genPrices(); renderAll(); } else { gameOver(); } }
  function dailyEvent(){ const roll=rng(); if(roll<0.20){ bumpRep(+0.02); footer('Hype building…'); } else if(roll<0.35){ bumpRep(-0.01); footer('Market feels soft.'); } else if(roll<0.45){ const loss=Math.min(state.cash, Math.floor(50+rng()*200)); addCash(-loss); bumpRep(-0.015); footer('Account took a ding.'); } else if(roll<0.55){ const owned=ITEMS.filter(i=>state.inv[i.id]>0); if(owned.length){ const it=pick(owned); const take=Math.max(1,Math.floor(state.inv[it.id]*(0.25+rng()*0.5))); state.inv[it.id]=Math.max(0,state.inv[it.id]-take); footer('Paperwork error.'); } } else if(roll<0.70){ footer('Buzz is in the air.'); } else { footer('Quiet day.'); } }
  function footer(text){ gi('eventFooter').textContent=text; }

  function gameOver(){ let liquidation=0; for(const k in state.inv){ liquidation+=state.inv[k]*state.prices[k]; } const net=state.cash+liquidation-state.debt; const grade = net>10000?'Legend': net>5000?'Pro': net>2000?'Hobbyist':'Weekend Warrior'; alert(`Game Over
Player: ${state.playerName}
Net Worth: ${fmt(net)}
Reputation: ${Math.round(state.rep*100)}%
Rank: ${grade}`); }

  function bind(){ if(bound) return; bound=true; // Start buttons
    gi('quickBtn').addEventListener('click', ()=>{DAYS_LIMIT=7; startGame();});
    gi('normalBtn').addEventListener('click', ()=>{DAYS_LIMIT=30; startGame();});
    // Controls
    gi('travelBtn').addEventListener('click', ()=> travel(gi('locationSelect').value));
    gi('nextBtn').addEventListener('click', endDay);
    gi('borrowBtn').addEventListener('click', ()=>{ adjustDebt(+500); addCash(+500); log('Borrowed $500 at current APR.','warn'); renderStats(); });
    gi('repayBtn').addEventListener('click', ()=>{ if(state?.debt<=0){ log('No debt to repay.','warn'); return; } if(state.cash<=0){ log('No cash to repay.','bad'); return; } const pay=Math.min(500,state.debt,state.cash); adjustDebt(-pay); addCash(-pay); log('Repaid '+fmt(pay)+'.','good'); renderStats(); });
    gi('sellAllBtn').addEventListener('click', ()=>{ let total=0,sold=false; Object.keys(state.inv).forEach(k=>{ const q=state.inv[k]; if(q>0){ total+=q*state.prices[k]; state.inv[k]=0; sold=true; }}); if(!sold){ log('Nothing to sell.','warn'); return; } const fee=(state.location==='reverb')?50:0; const net=Math.max(0,total-fee); addCash(net); log('Quick sold everything for '+fmt(total)+(fee?' (−'+fmt(fee)+' fee)':'')+' → '+fmt(net)+' net.','good'); renderAll(); });
    gi('dumpBtn').addEventListener('click', ()=>{ const owned=ITEMS.filter(it=>state.inv[it.id]>0); if(!owned.length){ log('You own nothing to dump.','warn'); return; } const it=pick(owned); state.inv[it.id]-=1; log('Dumped 1 '+it.name+' to free space.','warn'); renderStats(); renderMarket(); });
  }

  function init(){ buildSelect(); bind(); console.log('[Pedal Wars] init complete'); }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
</script>
