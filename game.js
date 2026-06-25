window.addEventListener("error", function(event) {
  const box = document.getElementById("errorBox");
  if (box) {
    box.textContent = "Error: " + event.message;
    box.classList.remove("hidden");
  }
});

const shell = document.getElementById("gameShell");
const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");
const buildingsLayer = document.getElementById("buildingsLayer");
const routesLayer = document.getElementById("routesLayer");
const vehiclesLayer = document.getElementById("vehiclesLayer");
const effectsLayer = document.getElementById("effectsLayer");

const SAVE_KEY = "economy-mobile-v021-fixed";

const buildings = [
  { id: "farm", name: "Plantación de Maíz", short: "Maíz", kind: "producer", icon: "🌽", x: 0.30, y: 0.36, stock: 0, capacity: 20, timer: 0 },
  { id: "depot", name: "Depósito", short: "Depósito", kind: "storage", icon: "📦", x: 0.50, y: 0.60, stock: 0, capacity: 100, timer: 0 },
  { id: "market", name: "Mercado", short: "Mercado", kind: "market", icon: "🏪", x: 0.72, y: 0.36, stock: 0, capacity: 9999, timer: 0 }
];

const upgrades = {
  production: { id: "production", title: "🌽 Producción", description: "La plantación produce más rápido.", level: 0, max: 5, baseCost: 20, growth: 1.75 },
  transport: { id: "transport", title: "🚚 Transporte", description: "Los vehículos viajan más rápido y salen más a la vez.", level: 0, max: 5, baseCost: 25, growth: 1.8 },
  market: { id: "market", title: "🏪 Mercado", description: "El mercado paga más por cada maíz.", level: 0, max: 5, baseCost: 30, growth: 2 },
  storage: { id: "storage", title: "📦 Almacén", description: "El depósito guarda más maíz.", level: 0, max: 5, baseCost: 18, growth: 1.65 }
};

const state = {
  money: 0,
  xp: 180,
  routes: [],
  vehicles: [],
  selected: null,
  dragging: null,
  activeTab: "market",
  last: performance.now()
};

loadGame();
applyEffects();

function pxX(v) { return v * shell.clientWidth; }
function pxY(v) { return v * shell.clientHeight; }
function getB(id) { return buildings.find(b => b.id === id); }
function price() { return 2 + upgrades.market.level; }
function prodTime() { return Math.max(0.55, 2 - upgrades.production.level * 0.25); }
function vehicleSpeed() { return 0.28 + upgrades.transport.level * 0.055; }
function maxVehicles() { return 2 + Math.floor((upgrades.transport.level + 1) / 2); }
function upgradeCost(u) { return Math.floor(u.baseCost * Math.pow(u.growth, u.level)); }

function applyEffects() {
  getB("depot").capacity = 100 + upgrades.storage.level * 60;
}

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    if (typeof saved.money === "number") state.money = saved.money;
    if (typeof saved.xp === "number") state.xp = saved.xp;
    if (Array.isArray(saved.routes)) state.routes = saved.routes;
    if (saved.upgrades) {
      for (const [k, v] of Object.entries(saved.upgrades)) {
        if (upgrades[k]) upgrades[k].level = Math.min(Number(v) || 0, upgrades[k].max);
      }
    }
    if (Array.isArray(saved.buildings)) {
      for (const item of saved.buildings) {
        const b = getB(item.id);
        if (b) b.stock = Number(item.stock) || 0;
      }
    }
  } catch {}
}

function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    money: state.money,
    xp: state.xp,
    routes: state.routes,
    upgrades: Object.fromEntries(Object.entries(upgrades).map(([k, u]) => [k, u.level])),
    buildings: buildings.map(b => ({ id: b.id, stock: b.stock }))
  }));
}

function resetGame() {
  state.money = 0;
  state.xp = 180;
  state.routes = [];
  state.vehicles = [];
  state.selected = null;
  for (const u of Object.values(upgrades)) u.level = 0;
  for (const b of buildings) { b.stock = 0; b.timer = 0; }
  applyEffects();
  saveGame();
  renderAll();
  toast("Reiniciado");
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = shell.clientWidth * dpr;
  canvas.height = shell.clientHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawMap();
  renderAll();
}

function drawMap() {
  const w = shell.clientWidth;
  const h = shell.clientHeight;
  ctx.clearRect(0, 0, w, h);

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#13bce0");
  g.addColorStop(1, "#0876a6");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const hexes = [
    [0.22,0.23],[0.45,0.23],[0.68,0.23],
    [0.10,0.32],[0.33,0.32],[0.56,0.32],[0.79,0.32],
    [0.22,0.41],[0.45,0.41],[0.68,0.41],
    [0.10,0.50],[0.33,0.50],[0.56,0.50],[0.79,0.50],
    [0.22,0.59],[0.45,0.59],[0.68,0.59],
    [0.33,0.68],[0.56,0.68],[0.79,0.68]
  ];

  for (const [x,y] of hexes) drawHex(pxX(x), pxY(y), Math.min(w * 0.145, 64));

  drawText("🌲", pxX(0.18), pxY(0.28), 28);
  drawText("🌳", pxX(0.53), pxY(0.25), 30);
  drawText("🪨", pxX(0.55), pxY(0.44), 26);
  drawText("🌲", pxX(0.82), pxY(0.64), 28);
}

function drawHex(x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i + 30);
    const nx = x + r * Math.cos(a);
    const ny = y + r * Math.sin(a);
    if (i === 0) ctx.moveTo(nx, ny);
    else ctx.lineTo(nx, ny);
  }
  ctx.closePath();
  ctx.fillStyle = "#8bd84b";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(71, 125, 31, .78)";
  ctx.stroke();
}

function drawText(text, x, y, size) {
  ctx.font = size + "px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function renderAll() {
  renderHud();
  renderRoutes();
  renderBuildings();
  renderVehicles();
  renderSelected();
  renderUpgrades();
}

function renderHud() {
  document.getElementById("money").textContent = state.money;
  document.getElementById("xpText").textContent = state.xp + " / 500";
}

function renderBuildings() {
  buildingsLayer.innerHTML = "";
  for (const b of buildings) {
    const el = document.createElement("div");
    el.className = "building" + (state.selected === b.id ? " selected" : "");
    el.dataset.id = b.id;
    el.style.left = pxX(b.x) + "px";
    el.style.top = pxY(b.y) + "px";
    el.innerHTML = `
      <div class="bubble">
        <h3>${b.short}</h3>
        <strong>${b.kind === "market" ? "Compra: " + price() + " 🪙" : b.stock + " / " + b.capacity}</strong>
      </div>
      <div class="base"></div>
      <div class="icon">${b.icon}</div>
    `;
    el.addEventListener("pointerdown", buildingPointerDown);
    buildingsLayer.appendChild(el);
  }
}

function renderRoutes() {
  routesLayer.innerHTML = "";
  for (const r of state.routes) {
    const a = getB(r.from);
    const b = getB(r.to);
    drawRouteEl(a, b, r.from);
  }
  if (state.dragging) drawDragEl();
}

function drawRouteEl(a, b, cls) {
  const x1 = pxX(a.x), y1 = pxY(a.y) + 18;
  const x2 = pxX(b.x), y2 = pxY(b.y) + 18;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const el = document.createElement("div");
  el.className = "route-line " + cls;
  el.style.left = x1 + "px";
  el.style.top = (y1 - 13) + "px";
  el.style.width = len + "px";
  el.style.transform = "rotate(" + Math.atan2(dy, dx) + "rad)";
  routesLayer.appendChild(el);
}

function drawDragEl() {
  const a = getB(state.dragging.from);
  const x1 = pxX(a.x), y1 = pxY(a.y) + 18;
  const x2 = state.dragging.x, y2 = state.dragging.y;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const el = document.createElement("div");
  el.className = "drag-line";
  el.style.left = x1 + "px";
  el.style.top = (y1 - 4) + "px";
  el.style.width = len + "px";
  el.style.transform = "rotate(" + Math.atan2(dy, dx) + "rad)";
  routesLayer.appendChild(el);
}

function renderVehicles() {
  vehiclesLayer.innerHTML = "";
  for (const v of state.vehicles) {
    const a = getB(v.from);
    const b = getB(v.to);
    const t = smooth(v.t);
    const x = lerp(pxX(a.x), pxX(b.x), t);
    const y = lerp(pxY(a.y)+18, pxY(b.y)+18, t);
    const el = document.createElement("div");
    el.className = "vehicle";
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.innerHTML = `<span>🌽</span>${v.from === "farm" ? "🚜" : "🚚"}`;
    vehiclesLayer.appendChild(el);
  }
}

function renderSelected() {
  const panel = document.getElementById("selectedPanel");
  if (!state.selected || state.activeTab === "upgrades") {
    panel.classList.add("hidden");
    return;
  }

  const b = getB(state.selected);
  panel.classList.remove("hidden");
  document.getElementById("selectedName").textContent = b.icon + " " + b.name;

  let html = "";
  if (b.kind === "producer") html = `<p>Stock: <b>${b.stock} / ${b.capacity}</b></p><p>Produce: <b>+1 maíz cada ${prodTime().toFixed(2)}s</b></p>`;
  if (b.kind === "storage") html = `<p>Almacenado: <b>${b.stock} / ${b.capacity}</b></p><p>Vehículos por ruta: <b>${maxVehicles()}</b></p>`;
  if (b.kind === "market") html = `<p>Compra: <b>${price()} monedas por maíz</b></p><p>Mejorá el mercado para vender más caro.</p>`;

  document.getElementById("selectedData").innerHTML = html;
}

function renderUpgrades() {
  const list = document.getElementById("upgradeList");
  list.innerHTML = "";
  for (const u of Object.values(upgrades)) {
    const cost = upgradeCost(u);
    const maxed = u.level >= u.max;
    const card = document.createElement("article");
    card.className = "upgrade-card";
    card.innerHTML = `
      <h3>${u.title} · Nivel ${u.level}/${u.max}</h3>
      <p>${u.description}</p>
      <button ${state.money >= cost && !maxed ? "" : "disabled"}>
        ${maxed ? "Máximo" : "Mejorar por " + cost + " 🪙"}
      </button>
    `;
    card.querySelector("button").addEventListener("click", () => buyUpgrade(u.id));
    list.appendChild(card);
  }
}

function buyUpgrade(id) {
  const u = upgrades[id];
  const cost = upgradeCost(u);
  if (!u || u.level >= u.max || state.money < cost) {
    toast("Faltan monedas");
    return;
  }
  state.money -= cost;
  u.level++;
  applyEffects();
  floatText("MEJORA ↑", pxX(0.5), pxY(0.24));
  toast(u.title + " nivel " + u.level);
  saveGame();
  renderAll();
}

function update(dt) {
  const farm = getB("farm");
  const farmRoute = state.routes.find(r => r.from === "farm");
  farm.timer += dt;
  if (farm.timer >= prodTime()) {
    farm.timer = 0;
    if (farmRoute) {
      spawnVehicle("farm", farmRoute.to);
    } else if (farm.stock < farm.capacity) {
      farm.stock++;
      floatText("+1 🌽", pxX(farm.x), pxY(farm.y)-80);
    }
  }

  const depotRoute = state.routes.find(r => r.from === "depot");
  if (depotRoute) tryDispatchDepot(depotRoute.to);

  for (const v of state.vehicles) v.t += dt * v.speed;

  const arrived = state.vehicles.filter(v => v.t >= 1);
  state.vehicles = state.vehicles.filter(v => v.t < 1);

  for (const v of arrived) {
    const to = getB(v.to);
    if (to.kind === "market") {
      state.money += price();
      state.xp += 2;
      floatText("+" + price() + " 🪙", pxX(to.x), pxY(to.y)-88);
    } else if (to.kind === "storage" && to.stock < to.capacity) {
      to.stock++;
      floatText("+1 🌽", pxX(to.x), pxY(to.y)-88);
    }
  }
}

function spawnVehicle(fromId, toId) {
  const to = getB(toId);
  if (to.kind === "storage" && to.stock >= to.capacity) {
    const from = getB(fromId);
    if (from.stock < from.capacity) from.stock++;
    return;
  }

  const count = state.vehicles.filter(v => v.from === fromId).length;
  if (count >= maxVehicles()) {
    const from = getB(fromId);
    if (from.kind === "producer" && from.stock < from.capacity) from.stock++;
    return;
  }

  state.vehicles.push({ from: fromId, to: toId, t: 0, speed: vehicleSpeed() });
}

function tryDispatchDepot(toId) {
  const depot = getB("depot");
  if (depot.stock <= 0) return;
  const count = state.vehicles.filter(v => v.from === "depot").length;
  if (count >= maxVehicles()) return;
  depot.stock--;
  state.vehicles.push({ from: "depot", to: toId, t: 0, speed: vehicleSpeed() });
}

function gameLoop(now) {
  const dt = Math.min((now - state.last) / 1000, 0.05);
  state.last = now;
  update(dt);
  renderHud();
  renderRoutes();
  renderBuildings();
  renderVehicles();
  renderSelected();
  requestAnimationFrame(gameLoop);
}

function buildingPointerDown(e) {
  const id = e.currentTarget.dataset.id;
  const b = getB(id);
  state.selected = id;

  if (state.activeTab !== "upgrades" && b.kind !== "market") {
    const p = getPointer(e);
    state.dragging = { from: id, x: p.x, y: p.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  renderAll();
}

window.addEventListener("pointermove", e => {
  if (!state.dragging) return;
  const p = getPointer(e);
  state.dragging.x = p.x;
  state.dragging.y = p.y;
  renderRoutes();
});

window.addEventListener("pointerup", e => {
  if (!state.dragging) return;
  const p = getPointer(e);
  const target = hitBuilding(p.x, p.y);
  const from = getB(state.dragging.from);

  if (target && target.id !== from.id && validRoute(from, target)) {
    state.routes = state.routes.filter(r => r.from !== from.id);
    state.routes.push({ from: from.id, to: target.id });
    toast("Ruta: " + from.short + " → " + target.short);
    saveGame();
  } else {
    toast("Ruta no válida");
  }

  state.dragging = null;
  renderAll();
});

function getPointer(e) {
  const rect = shell.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function hitBuilding(x, y) {
  return buildings.find(b => Math.hypot(x - pxX(b.x), y - pxY(b.y)) < 80);
}

function validRoute(from, to) {
  if (from.id === "farm") return to.id === "depot" || to.id === "market";
  if (from.id === "depot") return to.id === "market";
  return false;
}

function setTab(tab) {
  state.activeTab = tab;
  for (const btn of document.querySelectorAll(".tab")) btn.classList.remove("active");

  const ids = { market: "marketTab", routes: "routesTab", upgrades: "upgradesTab", storage: "storageTab" };
  document.getElementById(ids[tab]).classList.add("active");

  document.getElementById("upgradePanel").classList.toggle("hidden", tab !== "upgrades");
  if (tab === "market") state.selected = "market";
  if (tab === "storage") state.selected = "depot";
  if (tab === "routes") toast("Arrastrá una ruta");
  renderAll();
}

document.getElementById("menuBtn").addEventListener("click", resetGame);
document.getElementById("marketTab").addEventListener("click", () => setTab("market"));
document.getElementById("routesTab").addEventListener("click", () => setTab("routes"));
document.getElementById("upgradesTab").addEventListener("click", () => setTab("upgrades"));
document.getElementById("storageTab").addEventListener("click", () => setTab("storage"));
document.getElementById("closeUpgrades").addEventListener("click", () => setTab("market"));

function toast(text) {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add("hidden"), 1000);
}

function floatText(text, x, y) {
  const el = document.createElement("div");
  el.className = "float";
  el.textContent = text;
  el.style.left = x + "px";
  el.style.top = y + "px";
  effectsLayer.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function lerp(a,b,t) { return a + (b-a)*t; }
function smooth(t) { return t*t*(3-2*t); }

window.addEventListener("resize", resize);
setInterval(saveGame, 10000);

resize();
renderAll();
requestAnimationFrame(gameLoop);
