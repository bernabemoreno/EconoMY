const STORAGE_KEY = "mini-state-builder-save-v1";

const baseState = {
  resources: {
    money: 80,
    population: 0,
    food: 20,
    energy: 10,
    materials: 40
  },
  buildings: {
    house: 0,
    farm: 0,
    workshop: 0,
    powerPlant: 0,
    market: 0
  },
  upgrades: {},
  cityLevel: 1,
  lastTick: Date.now(),
  log: ["Bienvenido. Construí tu primera casa para empezar."]
};

let state = loadGame();

const buildings = {
  house: {
    name: "Casa",
    icon: "🏠",
    desc: "Aumenta población con el tiempo.",
    cost: { money: 25, materials: 10 },
    produces: { population: 0.06 },
    max: 8
  },
  farm: {
    name: "Granja",
    icon: "🌾",
    desc: "Produce comida para sostener la ciudad.",
    cost: { money: 35, materials: 15, population: 1 },
    produces: { food: 0.22 },
    max: 8
  },
  workshop: {
    name: "Taller",
    icon: "🧰",
    desc: "Genera materiales.",
    cost: { money: 55, materials: 25, population: 2, energy: 1 },
    produces: { materials: 0.15 },
    max: 6
  },
  powerPlant: {
    name: "Central",
    icon: "⚡",
    desc: "Produce energía.",
    cost: { money: 75, materials: 35, population: 3 },
    produces: { energy: 0.12 },
    max: 5
  },
  market: {
    name: "Mercado",
    icon: "🏪",
    desc: "Genera dinero usando población y energía.",
    cost: { money: 90, materials: 45, population: 5, energy: 2 },
    produces: { money: 0.42 },
    max: 5
  }
};

const upgrades = {
  betterTools: {
    name: "Herramientas mejores",
    desc: "Los talleres producen 50% más materiales.",
    cost: { money: 160, materials: 80 },
    requires: () => state.buildings.workshop >= 2,
    effect: "workshopBoost"
  },
  irrigation: {
    name: "Riego simple",
    desc: "Las granjas producen 50% más comida.",
    cost: { money: 130, materials: 60 },
    requires: () => state.buildings.farm >= 2,
    effect: "farmBoost"
  },
  cityPlanning: {
    name: "Plan urbano",
    desc: "Sube la ciudad a nivel 2 y desbloquea más espacio.",
    cost: { money: 250, materials: 120, population: 12 },
    requires: () => state.cityLevel === 1,
    effect: "level2"
  },
  solarPanels: {
    name: "Paneles solares",
    desc: "Las centrales producen 50% más energía.",
    cost: { money: 300, materials: 150, energy: 12 },
    requires: () => state.buildings.powerPlant >= 2,
    effect: "energyBoost"
  }
};

function loadGame() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(baseState);

  try {
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(baseState),
      ...parsed,
      resources: { ...baseState.resources, ...parsed.resources },
      buildings: { ...baseState.buildings, ...parsed.buildings },
      upgrades: { ...parsed.upgrades },
      log: parsed.log || baseState.log
    };
  } catch {
    return structuredClone(baseState);
  }
}

function saveGame(manual = false) {
  state.lastTick = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const status = document.getElementById("saveStatus");
  status.textContent = manual ? "Guardado manualmente ✅" : "Guardado automático ✅";
}

function resetGame() {
  if (!confirm("¿Seguro que querés reiniciar la ciudad?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(baseState);
  addLog("Partida reiniciada.");
  render();
}

function addLog(text) {
  state.log.unshift(text);
  state.log = state.log.slice(0, 12);
}

function format(value) {
  if (value >= 1000) return Math.floor(value).toLocaleString("es-AR");
  return Math.floor(value).toString();
}

function canPay(cost) {
  return Object.entries(cost).every(([resource, amount]) => state.resources[resource] >= amount);
}

function pay(cost) {
  Object.entries(cost).forEach(([resource, amount]) => {
    state.resources[resource] -= amount;
  });
}

function costText(cost) {
  const names = {
    money: "$",
    population: "pob.",
    food: "comida",
    energy: "energía",
    materials: "mat."
  };

  return Object.entries(cost)
    .map(([key, amount]) => key === "money" ? `$${amount}` : `${amount} ${names[key]}`)
    .join(" · ");
}

function getRates() {
  const rates = {
    money: 0,
    population: 0,
    food: 0,
    energy: 0,
    materials: 0
  };

  for (const [id, amount] of Object.entries(state.buildings)) {
    const building = buildings[id];
    for (const [resource, rate] of Object.entries(building.produces)) {
      let multiplier = 1;

      if (resource === "food" && state.upgrades.irrigation) multiplier += 0.5;
      if (resource === "materials" && state.upgrades.betterTools) multiplier += 0.5;
      if (resource === "energy" && state.upgrades.solarPanels) multiplier += 0.5;

      rates[resource] += rate * amount * multiplier;
    }
  }

  const upkeep = {
    food: state.resources.population * -0.015,
    energy: state.buildings.workshop * -0.025 + state.buildings.market * -0.035,
    money: state.resources.population * 0.01
  };

  rates.food += upkeep.food;
  rates.energy += upkeep.energy;
  rates.money += upkeep.money;

  return rates;
}

function tick() {
  const now = Date.now();
  const seconds = Math.min((now - state.lastTick) / 1000, 10);
  state.lastTick = now;

  const rates = getRates();
  for (const [resource, rate] of Object.entries(rates)) {
    state.resources[resource] = Math.max(0, state.resources[resource] + rate * seconds);
  }

  render();
}

function buyBuilding(id) {
  const building = buildings[id];
  if (state.buildings[id] >= building.max + (state.cityLevel - 1) * 3) return;
  if (!canPay(building.cost)) return;

  pay(building.cost);
  state.buildings[id]++;
  addLog(`Construiste: ${building.name} ${building.icon}`);
  saveGame();
  render();
}

function buyUpgrade(id) {
  const upgrade = upgrades[id];
  if (state.upgrades[id] || !upgrade.requires() || !canPay(upgrade.cost)) return;

  pay(upgrade.cost);
  state.upgrades[id] = true;

  if (upgrade.effect === "level2") {
    state.cityLevel = 2;
    addLog("La ciudad subió a nivel 2. Hay más espacio disponible.");
  } else {
    addLog(`Mejora comprada: ${upgrade.name}`);
  }

  saveGame();
  render();
}

function renderStats() {
  const rates = getRates();
  for (const resource of Object.keys(state.resources)) {
    document.getElementById(resource).textContent =
      resource === "money" ? `$${format(state.resources[resource])}` : format(state.resources[resource]);

    const rateElement = document.getElementById(`${resource}Rate`);
    const rate = rates[resource];
    rateElement.textContent = `${rate >= 0 ? "+" : ""}${rate.toFixed(2)}/s`;
  }

  document.getElementById("cityLevel").textContent = `Nivel ${state.cityLevel}`;
}

function renderBuildings() {
  const list = document.getElementById("buildingsList");
  list.innerHTML = "";

  for (const [id, building] of Object.entries(buildings)) {
    const card = document.createElement("article");
    card.className = "card";

    const currentMax = building.max + (state.cityLevel - 1) * 3;
    const isMaxed = state.buildings[id] >= currentMax;
    const affordable = canPay(building.cost) && !isMaxed;

    card.innerHTML = `
      <div class="card-head">
        <div>
          <h3>${building.icon} ${building.name}</h3>
          <p>${building.desc}</p>
        </div>
        <span class="count">${state.buildings[id]}/${currentMax}</span>
      </div>
      <small class="cost">Costo: ${costText(building.cost)}</small>
      <button ${affordable ? "" : "disabled"}>${isMaxed ? "Máximo" : "Construir"}</button>
    `;

    card.querySelector("button").addEventListener("click", () => buyBuilding(id));
    list.appendChild(card);
  }
}

function renderUpgrades() {
  const list = document.getElementById("upgradesList");
  list.innerHTML = "";

  for (const [id, upgrade] of Object.entries(upgrades)) {
    const owned = state.upgrades[id];
    const available = upgrade.requires();
    const affordable = canPay(upgrade.cost);
    const card = document.createElement("article");
    card.className = "card";

    card.innerHTML = `
      <div class="card-head">
        <div>
          <h3>${owned ? "✅" : "✨"} ${upgrade.name}</h3>
          <p>${upgrade.desc}</p>
        </div>
      </div>
      <small class="cost">Costo: ${costText(upgrade.cost)}</small>
      <button ${!owned && available && affordable ? "" : "disabled"}>
        ${owned ? "Comprada" : available ? "Comprar mejora" : "Bloqueada"}
      </button>
    `;

    card.querySelector("button").addEventListener("click", () => buyUpgrade(id));
    list.appendChild(card);
  }
}

function renderCityMap() {
  const map = document.getElementById("cityMap");
  map.innerHTML = "";

  const icons = [];
  for (const [id, amount] of Object.entries(state.buildings)) {
    for (let i = 0; i < amount; i++) icons.push(buildings[id].icon);
  }

  const totalTiles = state.cityLevel === 1 ? 15 : 25;

  for (let i = 0; i < totalTiles; i++) {
    const tile = document.createElement("div");
    tile.className = icons[i] ? "tile active" : "tile";
    tile.textContent = icons[i] || "·";
    map.appendChild(tile);
  }
}

function renderLog() {
  document.getElementById("log").innerHTML = state.log.map(item => `<div>• ${item}</div>`).join("");
}

function render() {
  renderStats();
  renderBuildings();
  renderUpgrades();
  renderCityMap();
  renderLog();
}

document.getElementById("saveBtn").addEventListener("click", () => saveGame(true));
document.getElementById("resetBtn").addEventListener("click", resetGame);

setInterval(tick, 1000);
setInterval(() => saveGame(false), 30000);

window.addEventListener("beforeunload", () => saveGame(false));

render();
