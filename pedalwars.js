/* Pedal Wars – external JS bundle for Big Cartel (with Roadie overlay fix) */
(function () {
  // ===== Utilities =====
  const gi = (id) => document.getElementById(id);
  const fmt = (n) => "$" + Math.floor(Number(n || 0)).toLocaleString();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ===== Overlay Fix =====
  function ensureOverlay() {
    const ov = gi("startOverlay");
    if (!ov) return;
    if (!document.body.contains(ov)) document.body.appendChild(ov);
    ov.style.position = "fixed";
    ov.style.inset = "0";
    ov.style.zIndex = "2147483647";
    ov.style.pointerEvents = "auto";
  }
  document.addEventListener("DOMContentLoaded", ensureOverlay);
  const obs = new MutationObserver(ensureOverlay);
  obs.observe(document.documentElement, { childList: true, subtree: true });

  // Also reset button styles inside overlay
  const style = document.createElement("style");
  style.textContent = `
    #startOverlay button {
      pointer-events: auto !important;
      cursor: pointer !important;
      z-index: 2147483647 !important;
    }
  `;
  document.head.appendChild(style);

  // ===== Game State & Logic (same as your last good version) =====
  let DAYS_LIMIT = 30;
  let state = null;

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
    { id: "hamilton", name: "Hamilton", flavor: "Local scene" },
    { id: "toronto", name: "Toronto", flavor: "Big market" },
    { id: "montreal", name: "Montreal", flavor: "Trendy boutique" },
    { id: "nash", name: "Nashville", flavor: "Session demand" },
    { id: "reverb", name: "Reverb.com", flavor: "Online — fees & scams" },
  ];

  // ===== Start Buttons =====
  function bindStartButtons() {
    const qb = gi("quickBtn"), nb = gi("normalBtn");
    if (qb) qb.onclick = () => { DAYS_LIMIT = 7; startGame(); };
    if (nb) nb.onclick = () => { DAYS_LIMIT = 30; startGame(); };
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", bindStartButtons, { once: true });
  else bindStartButtons();

  function startGame() {
    if (state) return;
    const name = (prompt("Enter player name:", "Player") || "Player").trim().slice(0, 16);
    state = { day: 1, playerName: name, cash: 1500, debt: 1000, rep: 0.1, cap: 24, inv: {}, prices: {} };
    ITEMS.forEach(i => state.inv[i.id] = 0);
    gi("startOverlay").style.display = "none";
    gi("gameControls").style.display = "flex";
    genPrices(); renderAll("New game started.");
  }

  // ===== Render =====
  function renderAll(msg) { renderStats(); renderMarket(); if (msg) console.log(msg); }
  function renderStats() { gi("day").textContent = state.day + "/" + DAYS_LIMIT; }

  function renderMarket() {
    const tb = gi("marketBody"); tb.innerHTML = "";
    ITEMS.forEach(it => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${it.name}</td><td>${fmt(state.prices[it.id]||0)}</td>`;
      tb.appendChild(tr);
    });
  }

  // ===== Economy =====
  function genPrices() {
    ITEMS.forEach(it => {
      const [lo, hi] = it.base;
      state.prices[it.id] = Math.floor(lo + Math.random() * (hi - lo));
    });
  }

  // ===== End Day =====
  gi("nextBtn").onclick = () => {
    state.day++;
    if (state.day > DAYS_LIMIT) return alert("Game Over");
    genPrices(); renderAll("Day advanced");
  };

})();
