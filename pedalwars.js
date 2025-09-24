/* Pedal Wars – external JS bundle */
(function () {
  const gi = (id) => document.getElementById(id);
  const fmt = (n) => "$" + Math.floor(Number(n || 0)).toLocaleString();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function mulberry32(a) { return function () { let t = (a += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  let seed = Date.now() % 2147483647; let rng = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  function log(msg, kind) { const ul = gi("log"); if (!ul) return; const li = document.createElement("li"); if (kind) li.className = kind; li.textContent = msg; ul.prepend(li); }

  const ITEMS = [
    { id: "overdrive", name: "Overdrive", base: [90, 220], weight: 1 },
    { id: "fuzz", name: "Fuzz", base: [60, 260], weight: 1 },
    { id: "delay", name: "Delay", base: [180, 520], weight: 2 },
    { id: "reverb", name: "Reverb", base: [150, 560], weight: 2 },
    { id: "mod", name: "Modulation", base: [120, 380], weight: 1 },
    { id: "synth", name: "Synth/Weird", base: [220, 740], weight: 2 },
    { id: "kit", name: "DIY Kit", base: [45, 160], weight: 1 },
  ];
  const LOCATIONS = [
    { id: "hamilton", name: "Hamilton", flavor: "Local scene, steady buyers", bias: { overdrive: 0.95, fuzz: 0.9, kit: 0.9 } },
    { id: "toronto", name: "Toronto", flavor: "Big market, hype spikes", bias: { delay: 1.1, reverb: 1.1, mod: 1.05 } },
    { id: "montreal", name: "Montreal", flavor: "Trendy boutique tastes", bias: { synth: 1.15, mod: 1.1 } },
    { id: "nash", name: "Nashville", flavor: "Session demand, good money", bias: { overdrive: 1.1, delay: 1.1, reverb: 1.05 } },
    { id: "reverb", name: "Reverb.com", flavor: "Online—fees & scams", bias: { all: 1.0 } },
  ];

  let DAYS_LIMIT = 30; let state = null; let globalPrices = {};

  function buildSelect() { const sel = gi("locationSelect"); if (!sel || sel.options.length) return; LOCATIONS.forEach((l) => { const o = document.createElement("option"); o.value = l.id; o.textContent = l.name; sel.appendChild(o); }); }
  buildSelect();

  document.addEventListener("DOMContentLoaded", () => { gi("quickBtn").onclick = () => { DAYS_LIMIT = 7; startGame(); }; gi("normalBtn").onclick = () => { DAYS_LIMIT = 30; startGame(); }; });

  function startGame() {
    const name = (prompt("Enter player name:", "Player") || "Player").trim().slice(0, 16);
    state = initState(name);
    gi("startOverlay").style.display = "none"; gi("gameControls").style.display = "flex";
    genGlobalPrices(); renderAll("New game started.");
  }
  function initState(playerName) { return { day: 1, location: "hamilton", cash: 1500, debt: 1000, rate: 0.18, rep: 0.1, cap: 24, inv: Object.fromEntries(ITEMS.map((i) => [i.id, 0])), playerName }; }

  function renderAll(msg) { renderStats(); renderMarket(); renderTravelCosts(); if (msg) log(msg); }
  function renderStats() {
    gi("day").textContent = `${state.day}/${DAYS_LIMIT}`;
    gi("cash").textContent = fmt(state.cash); gi("debt").textContent = fmt(state.debt);
    gi("rate").textContent = (state.rate * 100).toFixed(1) + "% APR"; gi("rep").textContent = Math.round(state.rep * 100) + "%";
    gi("used").textContent = Object.values(state.inv).reduce((a, b) => a + b, 0); gi("cap").textContent = state.cap;
    gi("daysLeft").textContent = `${DAYS_LIMIT - state.day + 1} days left`;
    const loc = LOCATIONS.find((l) => l.id === state.location);
    gi("locInfo").textContent = state.location === "reverb" ? `Reverb.com (visiting ${loc.name})` : `${loc.name} — ${loc.flavor}`;
    gi("repMeter").style.width = Math.round(state.rep * 100) + "%";
  }

  function renderMarket() {
    const tb = gi("marketBody"); tb.innerHTML = "";
    const todaysPrices = globalPrices[state.day][state.location];
    ITEMS.forEach((it) => {
      const p = todaysPrices[it.id]; const delta = (state.day > 1 ? p - globalPrices[state.day - 1][state.location][it.id] : 0);
      const cls = delta > 0 ? "price up" : delta < 0 ? "price down" : "";
      const owned = state.inv[it.id] || 0;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${it.name}</strong><br/><small>Weight ${it.weight}</small></td>
        <td class="${cls}">${fmt(p)}<br/><small>${delta === 0 ? 'stable' : (delta > 0 ? '↑ ' + fmt(delta) : '↓ ' + fmt(Math.abs(delta)))}</small></td>
        <td align="center">${owned}</td>
        <td><div class="qty"><input type="number" min="0" step="1" value="1" id="b_${it.id}"/><button data-id="${it.id}" data-act="buy">Buy</button></div></td>
        <td><div class="qty"><input type="number" min="0" step="1" value="1" id="s_${it.id}"/><button data-id="${it.id}" data-act="sell" ${owned ? '' : 'disabled'}>Sell</button></div>${state.location==='reverb' ? '<div><span class="pill">Reverb fee: $50</span></div>' : ''}</td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll("button[data-act]").forEach((btn) => { btn.onclick = () => { const id = btn.getAttribute("data-id"); const act = btn.getAttribute("data-act"); const qty = parseInt((gi((act==="buy"?"b_":"s_")+id).value)||0,10); if (qty<=0) return; if (act==="buy") buy(id, qty); else sell(id, qty); }; });
  }

  function genGlobalPrices() {
    globalPrices = {};
    for (let d = 1; d <= DAYS_LIMIT; d++) {
      globalPrices[d] = {};
      LOCATIONS.forEach((loc) => {
        globalPrices[d][loc.id] = {};
        ITEMS.forEach((it) => {
          const [lo, hi] = it.base;
          let roll = (rng() + rng() + rng()) / 3;
          let price = Math.round((lo + (hi - lo) * roll) * (loc.bias[it.id] || loc.bias.all || 1));
          if (rng() < 0.15) price *= 1.5 + rng(); // sometimes big jump
          price = Math.max(5, Math.round(price));
          globalPrices[d][loc.id][it.id] = price;
        });
      });
    }
  }

  function buy(id, qty) { const cost = globalPrices[state.day][state.location][id] * qty; if (cost > state.cash) return log("Not enough cash.", "bad"); if (qty + Object.values(state.inv).reduce((a, b) => a + b, 0) > state.cap) return log("Not enough space.", "bad"); state.cash -= cost; state.inv[id] += qty; renderAll(`Bought ${qty} × ${ITEMS.find(x=>x.id===id).name}`); }
  function sell(id, qty) { if (state.inv[id] < qty) return log("You don't own that many.", "bad"); const gross = globalPrices[state.day][state.location][id]*qty; const fee = state.location==="reverb"?50:0; const net=gross-fee; state.inv[id]-=qty; state.cash+=net; renderAll(`Sold ${qty} × ${ITEMS.find(x=>x.id===id).name} for ${fmt(net)}`); }

  gi("travelBtn").onclick = () => { const dest = gi("locationSelect").value; if (dest===state.location) return log("Already here."); state.location=dest; renderAll(`Traveled to ${LOCATIONS.find(l=>l.id===dest).name}`); };

  gi("nextBtn").onclick = () => { if (state.day < DAYS_LIMIT) { state.day++; renderAll(`${state.playerName}'s day advanced to ${state.day}.`); randomFooter(); } else { log("Game Over."); }
