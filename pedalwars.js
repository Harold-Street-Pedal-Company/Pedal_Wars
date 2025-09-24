/* Pedal Wars – external JS bundle for Big Cartel (CSP-safe) */
(function () {
  // ===== Utilities =====
  // Scope all DOM queries to the #pedalwars container to avoid theme ID collisions
  const root = document.getElementById('pedalwars') || document;
  const gi = (id) => root.querySelector(`#${id}`);
  const fmt = (n) => "$" + Math.floor(Number(n || 0)).toLocaleString();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }

  let seed = Date.now() % 2147483647; // game seed basis
  let rng = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  function log(msg, kind) {
    const ul = gi("log");
    if (!ul) { console.log("[Pedal Wars]", kind ? "[" + kind + "]" : "", msg); return; }
    const li = document.createElement("li"); if (kind) li.className = kind; li.textContent = msg; ul.prepend(li);
  }

  // ===== Data =====
  const ITEMS = [
    { id: "overdrive", name: "Overdrive", base: [90, 220], weight: 1 },
    { id: "fuzz",      name: "Fuzz",      base: [60, 260], weight: 1 },
    { id: "delay",     name: "Delay",     base: [180, 520], weight: 2 },
    { id: "reverb",    name: "Reverb",    base: [150, 560], weight: 2 },
    { id: "mod",       name: "Modulation",base: [120, 380], weight: 1 },
    { id: "synth",     name: "Synth/Weird", base: [220, 740], weight: 2 },
    { id: "kit",       name: "DIY Kit",   base: [45, 160], weight: 1 },
  ];
  const LOCATIONS = [
    { id: "hamilton", name: "Hamilton",  flavor: "Local scene, steady buyers", bias: { overdrive: 0.95, fuzz: 0.9, kit: 0.9 } },
    { id: "toronto",  name: "Toronto",   flavor: "Big market, hype spikes",    bias: { delay: 1.1, reverb: 1.1, mod: 1.05 } },
    { id: "montreal", name: "Montreal",  flavor: "Trendy boutique tastes",     bias: { synth: 1.15, mod: 1.1 } },
    { id: "nash",     name: "Nashville", flavor: "Session demand, good money", bias: { overdrive: 1.1, delay: 1.1, reverb: 1.05 } },
    { id: "reverb",   name: "Reverb.com",flavor: "Online—fees & scams",        bias: { all: 1.0 } },
  ];

  // ===== State =====
  let DAYS_LIMIT = 30;
  let state = null;
  // Cache of computed prices per (day->location->itemId)
  let dailyCache = {}; // { [day]: { [locId]: { itemId: price } } }

  // Build location select ASAP (safe even if called before start)
  (function buildSelect() {
    const sel = gi("locationSelect");
    if (!sel || sel.options.length) return;
    LOCATIONS.forEach((l) => { const o = document.createElement("option"); o.value = l.id; o.textContent = l.name; sel.appendChild(o); });
  })();

  // Robust start button wiring (direct + delegated with closest)
  function bindStartButtons() {
    const qb = gi("quickBtn"), nb = gi("normalBtn");
    if (qb) qb.addEventListener("click", onStartQuick);
    if (nb) nb.addEventListener("click", onStartNormal);
    document.addEventListener("click", (e) => {
      if (!root.contains(e.target)) return;
      const el = e && e.target && e.target.closest ? e.target.closest("#quickBtn, #normalBtn") : null;
      if (!el) return;
      if (el.id === "quickBtn") onStartQuick();
      else if (el.id === "normalBtn") onStartNormal();
    });
    function onStartQuick(){ DAYS_LIMIT = 7;  startGame(); }
    function onStartNormal(){ DAYS_LIMIT = 30; startGame(); }
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", bindStartButtons, { once: true }); }
  else { bindStartButtons(); }

  // ===== Deterministic pricing per (day, location) =====
  function priceRNG(day, locId){
    // combine the game seed, day, and location to create a stable per-day/per-location generator
    const s = (seed ^ (day * 2654435761) ^ hashStr(String(locId))) >>> 0;
    return mulberry32(s);
  }
  function computePricesFor(day, locId) {
    const loc = LOCATIONS.find(l => l.id === locId) || LOCATIONS[0];
    const prng = priceRNG(day, locId);
    // choose 1–2 shock items for the day at this location
    const shockCount = prng() < 0.55 ? 1 : 2;
    const shockIdxs = new Set();
    while (shockIdxs.size < shockCount) shockIdxs.add(Math.floor(prng() * ITEMS.length));

    const repBoost = 1 + (state ? state.rep * 0.1 : 0); // rep lowers prices a touch

    const map = {};
    ITEMS.forEach((it, idx) => {
      const [lo, hi] = it.base;
      const bias = (loc.bias && (loc.bias[it.id] || loc.bias.all)) || 1;
      // smooth random in [0,1] around mid
      const roll = (prng() + prng() + prng()) / 3;
      // base within item range
      let price = (lo + (hi - lo) * roll) * bias;
      // normal daily volatility: ~ -10%..+20%
      price *= (0.9 + prng() * 0.3);
      // occasional shock
      if (shockIdxs.has(idx)) {
        if (prng() < 0.5) { // spike
          price *= (1.6 + prng() * 0.6);  // 1.6x..2.2x
        } else {            // crash
          price *= (0.45 + prng() * 0.25); // 0.45x..0.70x
        }
      }
      // rep affects buy price slightly
      price = Math.round(Math.max(5, price / repBoost));
      map[it.id] = price;
    });
    return map;
  }
  function getPricesFor(day, locId){
    dailyCache[day] ||= {};
    if (!dailyCache[day][locId]) dailyCache[day][locId] = computePricesFor(day, locId);
    return dailyCache[day][locId];
  }

  // ===== Start Game =====
  function startGame() {
    if (state) return; // prevent double-start + double prompt
    const name = (prompt("Enter player name:", "Player") || "Player").trim().slice(0, 16);
    state = initState(name);
    const ov = gi("startOverlay"); if (ov) ov.style.display = "none";
    const gc = gi("gameControls"); if (gc) gc.style.display = "flex";

    // initialize day-1 prices for starting location; stable during day
    state.prices     = { ...getPricesFor(state.day, state.location) };
    state.lastPrices = { ...state.prices };

    renderAll("New game started.");
  }
  function initState(playerName) {
    dailyCache = {}; // new run → fresh cache
    return {
      day: 1, location: "hamilton", cash: 1500, debt: 1000, rate: 0.18, rep: 0.10, cap: 24,
      inv: Object.fromEntries(ITEMS.map((i) => [i.id, 0])),
      prices: {}, lastPrices: {}, playerName
    };
  }

  // ===== Render =====
  function renderAll(msg) {
    try { renderStats(); } catch(e){ console.warn('[PW] renderStats error', e); }
    try { renderMarket(); } catch(e){ console.warn('[PW] renderMarket error', e); }
    try { renderTravelCosts(); } catch(e){ console.warn('[PW] renderTravelCosts error', e); }
    if (msg) log(msg);
  }
  function renderStats() {
    const used = Object.values(state.inv).reduce((a, b) => a + b, 0);
    const dayEl = gi("day"); if (dayEl) dayEl.textContent = `${state.day}/${DAYS_LIMIT}`;
    const cashEl = gi("cash"); if (cashEl) cashEl.textContent = fmt(state.cash);
    const debtEl = gi("debt"); if (debtEl) debtEl.textContent = fmt(state.debt);
    const rateEl = gi("rate"); if (rateEl) rateEl.textContent = (state.rate * 100).toFixed(1) + "% APR";
    const repEl = gi("rep"); if (repEl) repEl.textContent = Math.round(state.rep * 100) + "%";
    const usedEl = gi("used"); if (usedEl) usedEl.textContent = used;
    const capEl = gi("cap"); if (capEl) capEl.textContent = state.cap;
    const leftEl = gi("daysLeft"); if (leftEl) leftEl.textContent = `${DAYS_LIMIT - state.day + 1} days left`;
    const loc = LOCATIONS.find((l) => l.id === state.location);
    const locInfo = gi("locInfo"); if (locInfo) locInfo.textContent = `${loc.name} — ${loc.flavor}`;
    const repMeter = gi("repMeter"); if (repMeter) repMeter.style.width = Math.round(state.rep * 100) + "%";
  }
  function renderMarket() {
    const tb = gi("marketBody"); if (!tb) return; tb.innerHTML = "";
    ITEMS.forEach((it) => {
      const owned = state.inv[it.id] || 0; const p = state.prices[it.id]; const last = state.lastPrices[it.id] || p;
      const delta = p - last; const cls = delta > 0 ? "price up" : delta < 0 ? "price down" : "";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td align="left"><strong>${it.name}</strong><br/><small>Weight ${it.weight}</small></td>
        <td class="${cls}">${fmt(p)}<br/><small>${delta === 0 ? 'stable' : (delta > 0 ? '↑ ' + fmt(delta) : '↓ ' + fmt(Math.abs(delta)))}</small></td>
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
            <button data-id="${it.id}" data-act="sell" ${owned ? '' : 'disabled'}>Sell</button>
          </div>
          ${state.location === 'reverb' ? '<div><span class="pill">Reverb fee: $50</span></div>' : ''}
        </td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id"); const act = btn.getAttribute("data-act");
        const qty = parseInt((gi((act === "buy" ? "b_" : "s_") + id).value) || 0, 10);
        if (qty <= 0) return; if (act === "buy") buy(id, qty); else sell(id, qty);
      };
    });
  }

  // ===== Economy glue (stable within day, change on end day) =====
  function refreshPricesForCurrentDayAndLocation({compareToPrevDay=false, destLocation=null}={}) {
    const locId = destLocation || state.location;
    const todays = getPricesFor(state.day, locId);

    if (compareToPrevDay) {
      // Compare to previous day (same location) to show daily deltas
      const prev = getPricesFor(Math.max(1, state.day - 1), locId);
      state.lastPrices = { ...prev };
    } else {
      // Same-day travel or first render: deltas should be 0 (stable)
      state.lastPrices = { ...todays };
    }
    state.prices = { ...todays };
  }

  // ===== Capacity / Cash / Reputation helpers =====
  function capacityUsed() { return Object.values(state.inv).reduce((a, b) => a + b, 0); }
  function addCash(v) { state.cash = Math.max(0, Math.floor(state.cash + v)); }
  function adjustDebt(v) { state.debt = Math.max(0, Math.floor(state.debt + v)); }
  function bumpRep(d) { state.rep = clamp(state.rep + d, 0, 1); }

  // ===== Actions =====
  gi("borrowBtn").onclick = () => { adjustDebt(+500); addCash(+500); log("Borrowed $500 at current APR.", "warn"); renderStats(); };
  gi("repayBtn").onclick = () => {
    if (state?.debt <= 0) { log("No debt to repay.", "warn"); return; }
    if (state.cash <= 0) { log("No cash to repay.", "bad"); return; }
    const pay = Math.min(500, state.debt, state.cash);
    adjustDebt(-pay); addCash(-pay); log("Repaid " + fmt(pay) + ".", "good"); renderStats();
  };

  function buy(id, qty) {
    const cost = state.prices[id] * qty;
    if (capacityUsed() + qty > state.cap) { log("Not enough space.", "bad"); return; }
    if (cost > state.cash) { log("Not enough cash.", "bad"); return; }
    addCash(-cost); state.inv[id] += qty; bumpRep(+0.002 * qty);
    log("Bought " + qty + " × " + ITEMS.find((x) => x.id === id).name + " for " + fmt(cost) + ".", "good");
    renderStats(); renderMarket();
  }
  function sell(id, qty) {
    const have = state.inv[id] || 0;
    if (qty > have) { log("You do not own that many.", "bad"); return; }
    const gross = state.prices[id] * qty;
    const fee = state.location === "reverb" ? 50 : 0; // $50 fee per sale on Reverb, travel to Reverb is free
    const net = Math.max(0, gross - fee);
    state.inv[id] -= qty; addCash(net); bumpRep(+0.001 * qty);
    log(
      fee ? "Sold " + qty + " × " + ITEMS.find((x) => x.id === id).name + " for " + fmt(gross) + " (−" + fmt(fee) + " fee) → " + fmt(net) + "."
          : "Sold " + qty + " × " + ITEMS.find((x) => x.id === id).name + " for " + fmt(net) + "."
    );
    renderStats(); renderMarket();
  }

  gi("sellAllBtn").onclick = () => {
    let total = 0, sold = false;
    Object.keys(state.inv).forEach((k) => { const q = state.inv[k]; if (q > 0) { total += q * state.prices[k]; state.inv[k] = 0; sold = true; } });
    if (!sold) { log("Nothing to sell.", "warn"); return; }
    const fee = state.location === "reverb" ? 50 : 0;
    const net = Math.max(0, total - fee);
    addCash(net);
    log("Quick sold everything for " + fmt(total) + (fee ? " (−" + fmt(fee) + " fee)" : "") + " → " + fmt(net) + " net.", "good");
    renderAll();
  };
  gi("dumpBtn").onclick = () => {
    const owned = ITEMS.filter((it) => state.inv[it.id] > 0);
    if (!owned.length) { log("You own nothing to dump.", "warn"); return; }
    const it = pick(owned); state.inv[it.id] -= 1; log("Dumped 1 " + it.name + " to free space.", "warn");
    renderStats(); renderMarket();
  };

  // ===== Travel & Costs (prices stable within day; per-location tables) =====
  gi("travelBtn").onclick = () => { travel(gi("locationSelect").value); };
  function travelCostFor(dest) {
    if (dest === "reverb") return 0; // free to Reverb.com
    let h = 0; for (let i = 0; i < dest.length; i++) h = (h * 31 + dest.charCodeAt(i)) >>> 0;
    const r = mulberry32((state.day * 2654435761 ^ h) >>> 0)();
    return Math.floor(50 + r * 100);
  }
  function renderTravelCosts() {
    const s = LOCATIONS.map((l) => l.name + ": " + fmt(travelCostFor(l.id))).join(" | ");
    const el = gi("travelCosts"); if (el) el.textContent = "Travel Costs: " + s;
  }
  function travel(dest) {
    if (dest === state.location) { log("You are already there.", "warn"); return; }
    const cost = travelCostFor(dest);
    if (state.cash < cost) { log("Travel costs " + fmt(cost) + ". You need more cash.", "bad"); return; }
    addCash(-cost);
    const from = LOCATIONS.find((l) => l.id === state.location).name;
    const to = LOCATIONS.find((l) => l.id === dest).name;
    state.location = dest;

    // Same-day travel → keep prices stable (delta = 0)
    refreshPricesForCurrentDayAndLocation({ compareToPrevDay:false, destLocation:dest });

    log("Traveled " + from + " → " + to + " (" + (cost ? "cost " + fmt(cost) : "free") + ")", cost ? "warn" : "good");
    const n = 2 + Math.floor(mulberry32(Date.now() >>> 0)() * 2);
    for (let i = 0; i < n; i++) travelEvent();
    renderAll();
  }
  function travelEvent() {
    const r = mulberry32(((Date.now() % 1e9) + Math.floor(rng() * 1e9)) >>> 0)();
    if (r < 0.2) { const gain = Math.floor(50 + r * 250); addCash(gain); log("Scored a pop-up flip on arrival: +" + fmt(gain) + ".", "good"); }
    else if (r < 0.4) { const loss = Math.min(state.cash, Math.floor(30 + r * 200)); addCash(-loss); log("Road fees hit: −" + fmt(loss) + ".", "bad"); }
    else if (r < 0.6) { bumpRep(+0.02); log("Met a demo artist — reputation up.", "good"); }
    else if (r < 0.75) { const interest = Math.floor(state.debt * 0.001 * (1 + Math.floor(r * 3))); adjustDebt(+interest); log("Travel delays increased costs: +" + fmt(interest) + " debt.", "warn"); }
    else if (r < 0.9) { const refund = Math.floor(20 + r * 120); addCash(refund); log("Returned a defective part and got " + fmt(refund) + " back.", "good"); }
    else { bumpRep(-0.015); log("Buyer flaked on meetup — tiny rep hit.", "warn"); }
  }

  // ===== End Day (recompute per-location tables, show daily deltas) =====
  gi("nextBtn").onclick = endDay;
  function endDay() {
    if (!state) return;
    if (state.day >= DAYS_LIMIT) { gameOver(); return; }

    const prevDay = state.day;
    state.day = prevDay + 1; // increment first for visible tick

    if (state.debt > 0) {
      const daily = state.rate / 365; const inc = Math.floor(state.debt * daily);
      adjustDebt(+inc); if (inc > 0) log("Interest accrued " + fmt(inc) + ".", "warn");
    }
    const fee = Math.floor(capacityUsed() * 2);
    if (fee > 0) { addCash(-fee); log("Storage fees " + fmt(fee) + ".", "warn"); }

    // New day: rebuild price table for current location and compare vs previous day
    refreshPricesForCurrentDayAndLocation({ compareToPrevDay:true });

    // Daily event after prices are set
    dailyEvent();

    renderAll("Day " + prevDay + " → " + state.day + " complete.");
    setTimeout(renderStats, 0); // theme-safety tick

    if (state.day >= DAYS_LIMIT) { log("Final day reached. Next press ends the game.", "warn"); }
  }
  function dailyEvent() {
    const roll = rng();
    if (roll < 0.2) { bumpRep(+0.02); footer("Hype building…"); }
    else if (roll < 0.35) { bumpRep(-0.01); footer("Market feels soft."); }
    else if (roll < 0.45) { const loss = Math.min(state.cash, Math.floor(50 + rng() * 200)); addCash(-loss); bumpRep(-0.015); footer("Account took a ding."); }
    else if (roll < 0.55) { const owned = ITEMS.filter((i) => state.inv[i.id] > 0); if (owned.length) { const it = pick(owned); const take = Math.max(1, Math.floor(state.inv[it.id] * (0.25 + rng() * 0.5))); state.inv[it.id] = Math.max(0, state.inv[it.id] - take); footer("Paperwork error."); } }
    else if (roll < 0.7) { footer("Buzz is in the air."); }
    else { footer("Quiet day."); }
  }
  function footer(text) { const el = gi("eventFooter"); if (el) el.textContent = text; }

  // ===== Save/Load/Reset & Scores =====
  const SAVE_KEY = "pedalwars_save_v1", SCORE_KEY = "pedalwars_scores_v1";
  gi("saveBtn").onclick = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ state, DAYS_LIMIT })); log("Game saved."); } catch (e) { console.warn("Save failed", e); } };
  gi("loadBtn").onclick = () => {
    try {
      const s = localStorage.getItem(SAVE_KEY);
      if (!s) { log("No save found.", "warn"); return; }
      const obj = JSON.parse(s);
      DAYS_LIMIT = obj.DAYS_LIMIT || 30; state = obj.state;

      // Rehydrate cache lazily; refresh current view for (day, location)
      refreshPricesForCurrentDayAndLocation({ compareToPrevDay:false });

      const ov = gi("startOverlay"); if (ov) ov.style.display = "none";
      const gc = gi("gameControls"); if (gc) gc.style.display = "flex";
      renderAll("Loaded save.");
      setTimeout(renderStats, 0);
    } catch (e) { console.warn("Load failed", e); }
  };
  gi("resetBtn").onclick = () => {
    if (confirm("Reset game?")) {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
      // Fully reset runtime state so start buttons work again
      state = null; DAYS_LIMIT = 30; dailyCache = {};
      const ov = gi("startOverlay"); if (ov) ov.style.display = "";
      const gc = gi("gameControls"); if (gc) gc.style.display = "none";
      const ul = gi("log"); if (ul) ul.innerHTML = "";
      renderTravelCosts();
      log("Game reset. Choose a mode to start.");
      setTimeout(renderStats, 0);
    }
  };
  function loadScores() { try { return JSON.parse(localStorage.getItem(SCORE_KEY) || "[]"); } catch (e) { return []; } }
  function saveScores(arr) { localStorage.setItem(SCORE_KEY, JSON.stringify(arr)); }
  function addScore(name, score, mode) {
    const arr = loadScores(); arr.push({ name, score, mode, date: new Date().toLocaleDateString() });
    arr.sort((a, b) => b.score - a.score); saveScores(arr.slice(0, 10));
  }
  function gameOver() {
    let liquidation = 0; for (const k in state.inv) liquidation += state.inv[k] * state.prices[k];
    const net = state.cash + liquidation - state.debt;
    const grade = net > 10000 ? "Legend" : net > 5000 ? "Pro" : net > 2000 ? "Hobbyist" : "Weekend Warrior";
    addScore(state.playerName || "Player", Math.max(0, net), DAYS_LIMIT === 7 ? "Quick" : "Normal");
    alert("Game Over\nPlayer: " + state.playerName + "\nNet Worth: " + fmt(net) + "\nReputation: " + Math.round(state.rep * 100) + "%\nRank: " + grade);
  }

  // ===== Self-test (non-invasive) =====
  try { console.assert(typeof log === "function", "log() defined"); } catch (e) {}
})();
