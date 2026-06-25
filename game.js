const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const SAVE_KEY = "economy-mobile-v02";
const world = { w: 460, h: 920 };

const buildings = [
  {
    id: "farm",
    name: "Plantación de Maíz",
    short: "Maíz",
    kind: "producer",
    icon: "🌽",
    x: 135,
    y: 330,
    stock: 0,
    capacity: 20,
    baseProduceEvery: 2.0,
    produceTimer: 0,
    resource: "corn"
  },
  {
    id: "depot",
    name: "Depósito",
    short: "Depósito",
    kind: "storage",
    icon: "📦",
    x: 230,
    y: 560,
    stock: 0,
    capacity: 100,
    resource: "corn"
  },
  {
    id: "market",
    name: "Mercado",
    short: "Mercado",
    kind: "market",
    icon: "🏪",
    x: 335,
    y: 330,
    stock: 0,
    capacity: 9999,
    resource: "corn"
  }
];

const upgrades = {
  production: {
    id: "production",
    title: "🌽 Producción de maíz",
    description: "La plantación produce más rápido.",
    level: 0,
    max: 5,
    baseCost: 20,
    costGrowth: 1.75
  },
  transport: {
    id: "transport",
    title: "🚚 Transporte",
    description: "Los vehículos viajan más rápido y pueden salir más a la vez.",
    level: 0,
    max: 5,
    baseCost: 25,
    costGrowth: 1.8
  },
  market: {
    id: "market",
    title: "🏪 Precio del mercado",
    description: "El mercado paga más por cada maíz.",
    level: 0,
    max: 5,
    baseCost: 30,
    costGrowth: 2
  },
  storage: {
    id: "storage",
    title: "📦 Capacidad del depósito",
    description: "El depósito puede guardar más maíz.",
    level: 0,
    max: 5,
    baseCost: 18,
    costGrowth: 1.65
  }
};

const state = {
  money: 0,
  xp: 180,
  routes: [],
  vehicles: [],
  selected: null,
  drag: null,
  floatingTexts: [],
  lastTime: performance.now(),
  activeTab: "market"
};

loadGame();
applyUpgradeEffects();

function getProductionSeconds() {
  return Math.max(0.55, 2.0 - upgrades.production.level * 0.25);
}

function getMarketPrice() {
  return 2 + upgrades.market.level;
}

function getVehicleSpeed(routeTo) {
  const base = routeTo === "market" ? 0.26 : 0.24;
  return base + upgrades.transport.level * 0.045;
}

function getMaxVehiclesPerRoute() {
  return 2 + Math.floor((upgrades.transport.level + 1) / 2);
}

function getUpgradeCost(upgrade) {
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costGrowth, upgrade.level));
}

function applyUpgradeEffects() {
  const depot = getBuilding("depot");
  depot.capacity = 100 + upgrades.storage.level * 60;
}

function buyUpgrade(id) {
  const upgrade = upgrades[id];
  if (!upgrade || upgrade.level >= upgrade.max) return;

  const cost = getUpgradeCost(upgrade);
  if (state.money < cost) {
    showToast("Faltan monedas");
    return;
  }

  state.money -= cost;
  upgrade.level++;
  applyUpgradeEffects();
  addFloat("MEJORA ↑", 230, 215);
  showToast(`${upgrade.title} nivel ${upgrade.level}`);
  saveGame();
  renderUpgradePanel();
}

function saveGame() {
  const data = {
    money: state.money,
    xp: state.xp,
    routes: state.routes,
    upgrades: Object.fromEntries(Object.entries(upgrades).map(([key, u]) => [key, u.level])),
    buildings: buildings.map(b => ({ id: b.id, stock: b.stock }))
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    if (typeof saved.money === "number") state.money = saved.money;
    if (typeof saved.xp === "number") state.xp = saved.xp;
    if (Array.isArray(saved.routes)) state.routes = saved.routes;
    if (saved.upgrades) {
      for (const [key, level] of Object.entries(saved.upgrades)) {
        if (upgrades[key] && typeof level === "number") upgrades[key].level = Math.min(level, upgrades[key].max);
      }
    }
    if (Array.isArray(saved.buildings)) {
      for (const item of saved.buildings) {
        const b = buildings.find(x => x.id === item.id);
        if (b && typeof item.stock === "number") b.stock = item.stock;
      }
    }
  } catch {}
}

function resetGame() {
  state.money = 0;
  state.xp = 180;
  state.routes = [];
  state.vehicles = [];
  for (const key of Object.keys(upgrades)) upgrades[key].level = 0;
  for (const b of buildings) {
    b.stock = 0;
    b.produceTimer = 0;
  }
  applyUpgradeEffects();
  saveGame();
  renderUpgradePanel();
  showToast("Partida reiniciada");
}

document.getElementById("menuBtn").addEventListener("click", resetGame);
document.getElementById("closeUpgrades").addEventListener("click", () => setActiveTab("market"));
document.getElementById("marketTab").addEventListener("click", () => setActiveTab("market"));
document.getElementById("routesTab").addEventListener("click", () => setActiveTab("routes"));
document.getElementById("upgradesTab").addEventListener("click", () => setActiveTab("upgrades"));
document.getElementById("storageTab").addEventListener("click", () => setActiveTab("storage"));

function setActiveTab(tab) {
  state.activeTab = tab;
  for (const btn of document.querySelectorAll(".tab")) btn.classList.remove("active");

  const map = {
    market: "marketTab",
    routes: "routesTab",
    upgrades: "upgradesTab",
    storage: "storageTab"
  };
  document.getElementById(map[tab]).classList.add("active");

  document.getElementById("upgradePanel").classList.toggle("hidden", tab !== "upgrades");

  if (tab === "routes") showToast("Arrastrá edificio → destino");
  if (tab === "storage") {
    state.selected = "depot";
    showToast("Depósito seleccionado");
  }
  if (tab === "market") {
    state.selected = "market";
    showToast(`Precio actual: ${getMarketPrice()} 🪙`);
  }

  renderUpgradePanel();
}

function renderUpgradePanel() {
  const list = document.getElementById("upgradeList");
  list.innerHTML = "";

  for (const upgrade of Object.values(upgrades)) {
    const cost = getUpgradeCost(upgrade);
    const maxed = upgrade.level >= upgrade.max;
    const canBuy = state.money >= cost && !maxed;

    const card = document.createElement("article");
    card.className = "upgrade-card";
    card.innerHTML = `
      <h3>${upgrade.title} · Nivel ${upgrade.level}/${upgrade.max}</h3>
      <p>${upgrade.description}</p>
      <button ${canBuy ? "" : "disabled"}>
        ${maxed ? "Máximo" : `Mejorar por ${cost} 🪙`}
      </button>
    `;
    card.querySelector("button").addEventListener("click", () => buyUpgrade(upgrade.id));
    list.appendChild(card);
  }
}

function resize() {
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  canvas.width = world.w * dpr;
  canvas.height = world.h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener("resize", resize);

function loop(now) {
  const dt = Math.min((now - state.lastTime) / 1000, 0.05);
  state.lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  updateProduction(dt);
  updateTransport(dt);
  updateFloatingTexts(dt);
  updateUI();
}

function updateProduction(dt) {
  const farm = getBuilding("farm");
  const hasOutput = state.routes.some(r => r.from === "farm");
  const canStore = farm.stock < farm.capacity;

  if (!hasOutput && !canStore) return;

  farm.produceTimer += dt;
  if (farm.produceTimer >= getProductionSeconds()) {
    farm.produceTimer = 0;

    if (hasOutput) {
      spawnVehicleFromRoute("farm");
    } else if (canStore) {
      farm.stock++;
      addFloat("+1 🌽", farm.x, farm.y - 80);
    }
  }
}

function updateTransport(dt) {
  for (const v of state.vehicles) {
    v.t += dt * v.speed;
  }

  const arrived = state.vehicles.filter(v => v.t >= 1);
  state.vehicles = state.vehicles.filter(v => v.t < 1);

  for (const v of arrived) {
    const to = getBuilding(v.to);

    if (to.kind === "market") {
      const price = getMarketPrice();
      state.money += price;
      state.xp += 2;
      addFloat(`+${price} 🪙`, to.x, to.y - 95);
      showToast(`Maíz vendido +${price}`);
    } else if (to.kind === "storage") {
      if (to.stock < to.capacity) {
        to.stock++;
        addFloat("+1 🌽", to.x, to.y - 95);
      }
    }

    if (to.kind === "storage") {
      dispatchFromStorage(to.id);
    }
  }

  for (const route of state.routes) {
    if (route.from === "depot") dispatchFromStorage("depot");
  }
}

function dispatchFromStorage(storageId) {
  const storage = getBuilding(storageId);
  const route = state.routes.find(r => r.from === storageId);
  if (!route) return;
  if (storage.stock <= 0) return;

  const alreadyOnRoute = state.vehicles.filter(v => v.from === storageId).length;
  if (alreadyOnRoute >= getMaxVehiclesPerRoute()) return;

  storage.stock--;
  state.vehicles.push({
    from: route.from,
    to: route.to,
    resource: "corn",
    t: 0,
    speed: getVehicleSpeed(route.to)
  });
}

function spawnVehicleFromRoute(fromId) {
  const route = state.routes.find(r => r.from === fromId);
  if (!route) {
    const from = getBuilding(fromId);
    if (from.stock < from.capacity) from.stock++;
    return;
  }

  const target = getBuilding(route.to);
  if (target.kind === "storage" && target.stock >= target.capacity) {
    const farm = getBuilding(fromId);
    if (farm.stock < farm.capacity) farm.stock++;
    return;
  }

  const alreadyOnRoute = state.vehicles.filter(v => v.from === fromId).length;
  if (alreadyOnRoute >= getMaxVehiclesPerRoute()) {
    const farm = getBuilding(fromId);
    if (farm.stock < farm.capacity) farm.stock++;
    return;
  }

  state.vehicles.push({
    from: route.from,
    to: route.to,
    resource: "corn",
    t: 0,
    speed: getVehicleSpeed(route.to)
  });
}

function updateFloatingTexts(dt) {
  for (const f of state.floatingTexts) {
    f.life -= dt;
    f.y -= dt * 28;
  }
  state.floatingTexts = state.floatingTexts.filter(f => f.life > 0);
}

function updateUI() {
  document.getElementById("money").textContent = state.money;
  document.getElementById("xpText").textContent = `${state.xp} / 500`;

  const panel = document.getElementById("selectedPanel");
  if (!state.selected || state.activeTab === "upgrades") {
    panel.classList.add("hidden");
    return;
  }

  const b = getBuilding(state.selected);
  panel.classList.remove("hidden");
  document.getElementById("selectedName").textContent = `${b.icon} ${b.name}`;

  let details = "";
  if (b.kind === "producer") {
    details = `<p>Stock: <b>${b.stock} / ${b.capacity}</b></p><p>Produce: <b>+1 maíz cada ${getProductionSeconds().toFixed(2)}s</b></p><p>Mejora producción para acelerar.</p>`;
  } else if (b.kind === "storage") {
    details = `<p>Almacenado: <b>${b.stock} / ${b.capacity}</b></p><p>Transporte: <b>${getMaxVehiclesPerRoute()} vehículos por ruta</b></p><p>Mejorá almacén y transporte.</p>`;
  } else {
    details = `<p>Compra: <b>${getMarketPrice()} monedas por maíz</b></p><p>Mejorá el mercado para vender más caro.</p>`;
  }
  document.getElementById("selectedData").innerHTML = details;
}

function draw() {
  drawBackground();
  drawMap();
  drawRoutes();
  if (state.drag) drawDragLine();
  drawBuildings();
  drawVehicles();
  drawFloatingTexts();
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, world.h);
  g.addColorStop(0, "#0caee0");
  g.addColorStop(1, "#0875aa");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, world.w, world.h);

  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 14; i++) {
    const x = (i * 97) % world.w;
    const y = 80 + ((i * 131) % 710);
    ctx.beginPath();
    ctx.arc(x, y, 38, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMap() {
  const hexes = [
    [95, 220], [195, 220], [295, 220], [395, 220],
    [45, 305], [145, 305], [245, 305], [345, 305],
    [95, 390], [195, 390], [295, 390], [395, 390],
    [45, 475], [145, 475], [245, 475], [345, 475],
    [95, 560], [195, 560], [295, 560], [395, 560],
    [145, 645], [245, 645], [345, 645]
  ];

  for (const [x, y] of hexes) drawHex(x, y, 64);

  drawDecoration(72, 248, "🌲");
  drawDecoration(245, 245, "🌳");
  drawDecoration(390, 215, "🌼");
  drawDecoration(78, 610, "🌲");
  drawDecoration(360, 610, "🌲");
  drawDecoration(250, 405, "🪨");
}

function drawHex(x, y, r) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i + 30);
    const px = x + r * Math.cos(a);
    const py = y + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  ctx.fillStyle = "#89d746";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(85, 143, 33, .75)";
  ctx.stroke();

  ctx.globalAlpha = .12;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x - 18, y - 18, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDecoration(x, y, icon) {
  ctx.font = "30px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(icon, x, y);
}

function drawRoutes() {
  for (const r of state.routes) {
    const a = getBuilding(r.from);
    const b = getBuilding(r.to);
    drawRoad(a.x, a.y + 20, b.x, b.y + 20, r.from === "farm" ? "#74f43d" : "#35bdf7");
  }
}

function drawRoad(x1, y1, x2, y2, color) {
  ctx.save();
  ctx.lineCap = "round";

  ctx.strokeStyle = "#2f343b";
  ctx.lineWidth = 28;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 4;
  ctx.setLineDash([18, 18]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.setLineDash([]);
  drawArrowDots(x1, y1, x2, y2, color);
  ctx.restore();
}

function drawArrowDots(x1, y1, x2, y2, color) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const nx = dx / len;
  const ny = dy / len;

  ctx.fillStyle = color;
  for (let d = 62; d < len - 50; d += 34) {
    const x = x1 + nx * d;
    const y = y1 + ny * d;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDragLine() {
  const a = getBuilding(state.drag.from);
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 7;
  ctx.setLineDash([10, 10]);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y + 20);
  ctx.lineTo(state.drag.x, state.drag.y);
  ctx.stroke();
  ctx.restore();
}

function drawBuildings() {
  for (const b of buildings) {
    const selected = state.selected === b.id;
    drawBuildingBase(b.x, b.y, selected);
    drawBuildingIcon(b);
    drawBuildingBubble(b);
  }
}

function drawBuildingBase(x, y, selected) {
  ctx.save();
  ctx.fillStyle = selected ? "#d9f99d" : "#d8f6c6";
  roundRect(x - 55, y + 32, 110, 50, 16);
  ctx.fill();
  ctx.lineWidth = selected ? 5 : 3;
  ctx.strokeStyle = selected ? "#22c55e" : "#6ab85a";
  ctx.stroke();
  ctx.restore();
}

function drawBuildingIcon(b) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "70px system-ui";
  ctx.shadowColor = "rgba(0,0,0,.3)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 6;
  ctx.fillText(b.icon, b.x, b.y + 35);
  ctx.restore();
}

function drawBuildingBubble(b) {
  ctx.save();
  const w = b.kind === "producer" ? 176 : 150;
  const h = b.kind === "market" ? 84 : 74;
  const x = b.x - w / 2;
  const y = b.y - 116;

  ctx.fillStyle = "rgba(23, 68, 26, .94)";
  roundRect(x, y, w, h, 14);
  ctx.fill();

  ctx.lineWidth = 3;
  ctx.strokeStyle = "#b8f78f";
  ctx.stroke();

  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.font = "bold 18px system-ui";
  ctx.fillText(b.short.toUpperCase(), b.x, y + 25);

  ctx.font = "bold 21px system-ui";
  if (b.kind === "market") {
    ctx.fillText(`Compra: ${getMarketPrice()} 🪙`, b.x, y + 58);
  } else {
    ctx.fillText(`${b.stock} / ${b.capacity}`, b.x, y + 56);
  }
  ctx.restore();
}

function drawVehicles() {
  for (const v of state.vehicles) {
    const a = getBuilding(v.from);
    const b = getBuilding(v.to);
    const x = lerp(a.x, b.x, smooth(v.t));
    const y = lerp(a.y + 20, b.y + 20, smooth(v.t));

    ctx.save();
    ctx.translate(x, y);
    ctx.font = "34px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(v.from === "farm" ? "🚜" : "🚚", 0, 10);
    ctx.font = "22px system-ui";
    ctx.fillText("🌽", 0, -18);
    ctx.restore();
  }
}

function drawFloatingTexts() {
  for (const f of state.floatingTexts) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = "white";
    ctx.strokeStyle = "rgba(0,0,0,.45)";
    ctx.lineWidth = 4;
    ctx.font = "bold 24px system-ui";
    ctx.textAlign = "center";
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
}

function addFloat(text, x, y) {
  state.floatingTexts.push({ text, x, y, life: 1 });
}

function showToast(text) {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 1100);
}

function getPointer(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (world.w / rect.width),
    y: (e.clientY - rect.top) * (world.h / rect.height)
  };
}

function hitBuilding(x, y) {
  return buildings.find(b => Math.hypot(x - b.x, y - b.y) < 75);
}

canvas.addEventListener("pointerdown", e => {
  if (state.activeTab === "upgrades") return;

  const p = getPointer(e);
  const b = hitBuilding(p.x, p.y);

  if (!b) {
    state.selected = null;
    return;
  }

  state.selected = b.id;

  if (b.kind !== "market") {
    state.drag = { from: b.id, x: p.x, y: p.y };
    canvas.setPointerCapture(e.pointerId);
  }
});

canvas.addEventListener("pointermove", e => {
  if (!state.drag) return;
  const p = getPointer(e);
  state.drag.x = p.x;
  state.drag.y = p.y;
});

canvas.addEventListener("pointerup", e => {
  if (!state.drag) return;

  const p = getPointer(e);
  const target = hitBuilding(p.x, p.y);
  const from = getBuilding(state.drag.from);

  if (target && target.id !== from.id && validRoute(from, target)) {
    state.routes = state.routes.filter(r => r.from !== from.id);
    state.routes.push({ from: from.id, to: target.id, resource: "corn" });
    showToast(`Ruta: ${from.short} → ${target.short}`);
    saveGame();
  } else {
    showToast("Ruta no válida");
  }

  state.drag = null;
});

function validRoute(from, to) {
  if (from.id === "farm") return to.id === "depot" || to.id === "market";
  if (from.id === "depot") return to.id === "market";
  return false;
}

function getBuilding(id) {
  return buildings.find(b => b.id === id);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

renderUpgradePanel();
setInterval(saveGame, 10000);
requestAnimationFrame(loop);
