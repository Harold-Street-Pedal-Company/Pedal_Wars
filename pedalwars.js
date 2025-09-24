/* Pedal Wars – external JS bundle for Big Cartel (CSP-safe) */
(function () {
  // ===== Utilities =====
  const gi = (id) => document.getElementById(id);
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
  let seed = Date.now() % 2147483647;
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

  // ===== State =====
  let DAYS_LIMIT = 30;
  let state = null;

  // Build location select
  (function buildSelect() {
    const sel = gi("locationSelect");
    if (!sel || sel.options.length) return;
    LOCATIONS.forEach((l) => { const o = document.createElement("option"); o.value = l.id; o.textContent = l.name; sel.appendChild(o); });
  })();

  // ===== Start Button Binding =====
  function bindStartButtons() {
    const qb = gi("quickBtn"), nb = gi("normalBtn");
    if (qb) qb.addEventListener("click", () => { DAYS_LIMIT = 7; startGame(); });
    if (nb) nb.addEventListener("click", () => { DAYS_LIMIT = 30; startGame(); });
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", bindStartButtons, { once: true }); }
  else { bindStartButtons(); }

  // ===== Start Game =====
  function startGame() {
    if (state) return;
    const name = (prompt("Enter player name:", "Player") || "Player").trim().slice(0, 16);
    state = initState(name);
    gi("startOverlay").style.display = "none";
    gi("gameControls").style.display = "flex";
    genPrices();
    renderAll("New game started.");
  }
  function initState(playerName) {
    return { day: 1, location: "hamilton", cash: 1500, debt: 1000, rate: 0.18, rep: 0.1, cap: 24,
             inv: Object.fromEntries(ITEMS.map((i) => [i.id, 0])), prices: {}, lastPrices: {}, playerName };
  }

  // ===== Render =====
  function renderAll(msg) { renderStats(); renderMarket(); renderTravelCosts(); if (msg) log(msg); }
  function renderStats() {
    const used = Object.values(state.inv).reduce((a, b) => a + b, 0);
    gi("day").textContent = `${state.day}/${DAYS_LIMIT}`;
    gi("cash").textContent = fmt(state.cash);
    gi("debt").textContent = fmt(state.debt);
    gi("rate").textContent = (state.rate * 100).toFixed(1) + "% APR";
    gi("rep").textContent = Math.round(state.rep * 100) + "%";
    gi("used").textContent = used; gi("cap").textContent = state.cap;
    gi("daysLeft").textContent = `${DAYS_LIMIT - state.day + 1} days left`;
    const loc = LOCATIONS.find((l) => l.id === state.location);
    gi("locInfo").textContent = `${loc.name} — ${loc.flavor}`;
    gi("repMeter").style.width = Math.round(state.rep * 100) + "%";
  }
  function renderMarket() {
    const tb = gi("marketBody"); tb.innerHTML = "";
    ITEMS.forEach((it) => {
      const owned = state.inv[it.id] || 0;
      const p = state.prices[it.id];
      const last = state.lastPrices[it.id] || p;
      const delta = p - last;
      const cls = delta > 0 ? "price up" : delta < 0 ? "price down" : "";
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

  // ===== Economy =====
  function genPrices() {
    state.lastPrices = { ...state.prices };
    const loc = LOCATIONS.find((l) => l.id === state.location);
    const repBoost = 1 + state.rep * 0.1;

    // Normal prices
    ITEMS.forEach((it) => {
      const [lo, hi] = it.base;
      const bias = loc.bias?.[it.id] || loc.bias?.all || 1;
      let roll = (rng() + rng() + rng()) / 3;
      let price = Math.round((lo + (hi - lo) * roll) * bias);
      // wider daily spread
      price = Math.round(price * (0.75 + rng() * 1.0));
      price = Math.round(price / repBoost);
      price = Math.max(5, price);
      state.prices[it.id] = price;
    });

    // Add 1–2 shocks
    const numShocks = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < numShocks; i++) {
      const it = pick(ITEMS);
      const dir = rng() < 0.5 ? "up" : "down";
      if (dir === "up") {
        state.prices[it.id] = Math.round(state.prices[it.id] * (2.0 + rng() * 0.5));
      } else {
        state.prices[it.id] = Math.max(5, Math.round(state.prices[it.id] * (0.4 + rng() * 0.2)));
      }
    }
  }

  // ===== Rest of game unchanged =====
  // (buy/sell, travel, endDay, save/load, etc… same as last version)

  // ...
})();
