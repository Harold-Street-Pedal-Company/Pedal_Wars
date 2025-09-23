/* Pedal Wars – external JS bundle for Big Cartel (CSP-safe) */
(function () {
  // utilities...
  const gi = id => document.getElementById(id);
  const fmt = n => "$" + Math.floor(Number(n || 0)).toLocaleString();
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  function mulberry32(a){return function(){let t=a+=0x6d2b79f5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
  let seed = Date.now()%2147483647; let rng = mulberry32(seed);
  const pick = arr => arr[Math.floor(rng()*arr.length)];
  function log(msg,kind){const ul=gi("log");if(!ul){console.log("[Pedal Wars]",kind?("["+kind+"]"):"",msg);return;}const li=document.createElement("li");if(kind)li.className=kind;li.textContent=msg;ul.prepend(li);}

  // data...
  const ITEMS=[{id:"overdrive",name:"Overdrive",base:[90,220],weight:1}, … ];
  const LOCATIONS=[{id:"hamilton",name:"Hamilton",flavor:"Local scene, steady buyers",bias:{overdrive:.95,fuzz:.9,kit:.9}}, … ];

  let DAYS_LIMIT=30; let state=null;

  // build select
  (function(){const sel=gi("locationSelect");if(!sel||sel.options.length)return;LOCATIONS.forEach(l=>{const o=document.createElement("option");o.value=l.id;o.textContent=l.name;sel.appendChild(o);});})();

  // start buttons
  function bindStartButtons(){…}
  if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",bindStartButtons,{once:true});}else{bindStartButtons();}

  function startGame(){…}
  function initState(playerName){…}

  function renderAll(msg){…}
  function renderStats(){…}
  function renderMarket(){…}

  function genPrices(){…} // <-- now always nudges if unchanged

  // actions (buy, sell, repay, borrow, etc.)
  // travel() / travelEvent()
  // endDay() with genPrices() and dailyEvent()

  // reset handler clears state = null so buttons work again
  gi("resetBtn").onclick=()=>{if(confirm("Reset game?")){try{localStorage.removeItem("pedalwars_save_v1");}catch(e){}state=null;DAYS_LIMIT=30;gi("startOverlay").style.display="";gi("gameControls").style.display="none";gi("log").innerHTML="";renderTravelCosts();log("Game reset. Choose a mode to start.");}}

  // gameOver() and score saving
  // ...
})();
