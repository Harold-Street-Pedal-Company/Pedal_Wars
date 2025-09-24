/* Pedal Wars — hardened JS bundle (per-city/day prices, capture-phase clicks) */
(function () {
  const root = document.getElementById('pedalwars') || document;
  const gi = (id) => (root === document ? document.getElementById(id) : root.querySelector(`#${id}`));
  const fmt = (n) => "$" + Math.floor(Number(n || 0)).toLocaleString();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function mulberry32(a){return function(){let t=(a+=0x6d2b79f5);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
  function hashStr(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  const stop = (e)=>{try{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();}catch(_){}};

  // Anti-theme CSS
  (function(){const st=document.createElement('style');st.textContent="#pedalwars button{pointer-events:auto!important}";(root===document?document.head:root).appendChild(st);})();

  let seed=Date.now()%2147483647, rng=mulberry32(seed);
  const pick=(arr)=>arr[Math.floor(rng()*arr.length)];
  function log(msg,kind){const ul=gi('log');if(!ul){console.log('[Pedal Wars]',msg);return;}const li=document.createElement('li');if(kind)li.className=kind;li.textContent=msg;ul.prepend(li);}

  const ITEMS=[{id:"overdrive",name:"Overdrive",base:[90,220],weight:1},
    {id:"fuzz",name:"Fuzz",base:[60,260],weight:1},
    {id:"delay",name:"Delay",base:[180,520],weight:2},
    {id:"reverb",name:"Reverb",base:[150,560],weight:2},
    {id:"mod",name:"Modulation",base:[120,380],weight:1},
    {id:"synth",name:"Synth/Weird",base:[220,740],weight:2},
    {id:"kit",name:"DIY Kit",base:[45,160],weight:1}];

  const LOCATIONS=[{id:"hamilton",name:"Hamilton",flavor:"Local scene",bias:{overdrive:.95,fuzz:.9,kit:.9}},
    {id:"toronto",name:"Toronto",flavor:"Big market",bias:{delay:1.1,reverb:1.1,mod:1.05}},
    {id:"montreal",name:"Montreal",flavor:"Trendy boutique",bias:{synth:1.15,mod:1.1}},
    {id:"nash",name:"Nashville",flavor:"Session demand",bias:{overdrive:1.1,delay:1.1,reverb:1.05}},
    {id:"reverb",name:"Reverb.com",flavor:"Online—fees & scams",bias:{all:1.0}}];
  const LOC_FACTOR={hamilton:0.95,toronto:1.06,montreal:1.00,nash:1.10,reverb:1.02};

  let DAYS_LIMIT=30,state=null,dailyCache={};

  (function(){const sel=gi('locationSelect');if(sel&&!sel.options.length){LOCATIONS.forEach(l=>{const o=document.createElement('option');o.value=l.id;o.textContent=l.name;sel.appendChild(o);});}})();

  function priceRNG(day,loc){const s=(seed^(day*2654435761)^hashStr(String(loc)))>>>0;return mulberry32(s);}
  function computePricesFor(day,locId){const loc=LOCATIONS.find(l=>l.id===locId)||LOCATIONS[0];const pr=priceRNG(day,locId);const mood=0.9+pr()*0.3;const locBase=LOC_FACTOR[locId]||1;const shockCt=pr()<0.55?1:2;const shockIdxs=new Set();while(shockIdxs.size<shockCt)shockIdxs.add(Math.floor(pr()*ITEMS.length));const repBoost=1+(state?state.rep*0.1:0);const out={};ITEMS.forEach((it,idx)=>{const[lo,hi]=it.base;const bias=(loc.bias?.[it.id]??loc.bias?.all??1);let roll=(pr()+pr()+pr())/3;let price=(lo+(hi-lo)*roll)*bias*locBase*mood;price*=0.9+pr()*0.3;if(shockIdxs.has(idx))price*=pr()<0.5?2+pr()*0.5:0.4+pr()*0.2;price=Math.round(Math.max(5,price/repBoost));out[it.id]=price;});return out;}
  function getPricesFor(day,loc){dailyCache[day]??={};if(!dailyCache[day][loc])dailyCache[day][loc]=computePricesFor(day,loc);return dailyCache[day][loc];}

  function startGame(){if(state)return;const name=(prompt('Enter player name:','Player')||'Player').trim().slice(0,16);state=initState(name);gi('startOverlay')?.remove();gi('gameControls').style.display='flex';state.prices={...getPricesFor(state.day,state.location)};state.lastPrices={...state.prices};renderAll('New game started.');}
  function initState(playerName){dailyCache={};return{day:1,location:'hamilton',cash:1500,debt:1000,rate:0.18,rep:0.1,cap:24,inv:Object.fromEntries(ITEMS.map(i=>[i.id,0])),prices:{},lastPrices:{},playerName};}

  function renderAll(msg){renderStats();renderMarket();renderTravelCosts();if(msg)log(msg);}
  function renderStats(){gi('day').textContent=`${state.day}/${DAYS_LIMIT}`;gi('cash').textContent=fmt(state.cash);gi('debt').textContent=fmt(state.debt);gi('rate').textContent=(state.rate*100).toFixed(1)+"% APR";gi('rep').textContent=Math.round(state.rep*100)+"%";gi('used').textContent=Object.values(state.inv).reduce((a,b)=>a+b,0);gi('cap').textContent=state.cap;gi('daysLeft').textContent=`${DAYS_LIMIT-state.day+1} days left`;const loc=LOCATIONS.find(l=>l.id===state.location);gi('locInfo').textContent=`${loc.name} — ${loc.flavor}`;gi('repMeter').style.width=Math.round(state.rep*100)+"%";}
  function renderMarket(){const tb=gi('marketBody');tb.innerHTML='';ITEMS.forEach(it=>{const owned=state.inv[it.id]||0;const p=state.prices[it.id];const last=state.lastPrices[it.id]||p;const delta=p-last;const cls=delta>0?'price up':delta<0?'price down':'';const tr=document.createElement('tr');tr.innerHTML=`<td><strong>${it.name}</strong><br/><small>Weight ${it.weight}</small></td><td class="${cls}">${fmt(p)}<br/><small>${delta===0?'stable':(delta>0?'↑ '+fmt(delta):'↓ '+fmt(Math.abs(delta)))}</small></td><td align="center">${owned}</td><td><div class="qty"><input type="number" min="0" step="1" value="1" id="b_${it.id}" /><button data-id="${it.id}" data-act="buy" type="button">Buy</button></div></td><td><div class="qty"><input type="number" min="0" step="1" value="1" id="s_${it.id}" /><button data-id="${it.id}" data-act="sell" type="button" ${owned?'':'disabled'}>Sell</button></div>${state.location==='reverb'?'<div><span class="pill">Reverb fee: $50</span></div>':''}</td>`;tb.appendChild(tr);});}

  function refreshPrices(comparePrev=false,dest=null){const loc=dest||state.location;const todays=getPricesFor(state.day,loc);state.lastPrices=comparePrev?{...getPricesFor(Math.max(1,state.day-1),loc)}:{...todays};state.prices={...todays};}

  function capacityUsed(){return Object.values(state.inv).reduce((a,b)=>a+b,0);}
  function addCash(v){state.cash=Math.max(0,Math.floor(state.cash+v));}
  function adjustDebt(v){state.debt=Math.max(0,Math.floor(state.debt+v));}
  function bumpRep(d){state.rep=clamp(state.rep+d,0,1);}

  function doBorrow(){adjustDebt(500);addCash(500);log("Borrowed $500.","warn");renderStats();}
  function doRepay(){if(state.debt<=0){log("No debt.","warn");return;}if(state.cash<=0){log("No cash.","bad");return;}const pay=Math.min(500,state.debt,state.cash);adjustDebt(-pay);addCash(-pay);log("Repaid "+fmt(pay)+".","good");renderStats();}
