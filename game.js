const state = {
  money: 0,
  resources: {
    corn: 0,
    tomato: 0,
    milk: 0
  },
  progress: {
    corn: 0,
    tomato: 0,
    milk: 0
  },
  lastMoney: 0,
  log: ["Arrancó tu economía. Los edificios ya están produciendo."]
};

const config = {
  corn: {
    name: "maíz",
    icon: "🌽",
    bar: "cornBar",
    stock: "cornStock",
    info: "cornInfo",
    button: "sellCorn",
    seconds: 3,
    sellPrice: 2
  },
  tomato: {
    name: "tomate",
    icon: "🍅",
    bar: "tomatoBar",
    stock: "tomatoStock",
    info: "tomatoInfo",
    button: "sellTomato",
    seconds: 4,
    sellPrice: 3
  },
  milk: {
    name: "leche",
    icon: "🥛",
    bar: "milkBar",
    stock: "milkStock",
    info: "milkInfo",
    button: "sellMilk",
    seconds: 5,
    sellPrice: 4
  }
};

let lastTick = performance.now();

function tick(now) {
  const delta = (now - lastTick) / 1000;
  lastTick = now;

  for (const [resource, data] of Object.entries(config)) {
    state.progress[resource] += delta / data.seconds;

    if (state.progress[resource] >= 1) {
      const produced = Math.floor(state.progress[resource]);
      state.progress[resource] -= produced;
      state.resources[resource] += produced;
      createFloatingItem(resource);
      addLog(`+${produced} ${data.name}`);
    }
  }

  render();
  requestAnimationFrame(tick);
}

function sell(resource) {
  if (state.resources[resource] <= 0) return;

  const data = config[resource];
  const amount = state.resources[resource];
  const earned = amount * data.sellPrice;

  state.resources[resource] = 0;
  state.money += earned;
  createCoinEffect(earned);
  addLog(`Vendiste ${amount} ${data.name} por $${earned}.`);

  render();
}

function render() {
  document.getElementById("money").textContent = `$${state.money}`;

  const income = state.money - state.lastMoney;
  document.getElementById("income").textContent = income > 0 ? `+$${income} ahora` : "+$0/s";
  state.lastMoney = state.money;

  for (const [resource, data] of Object.entries(config)) {
    document.getElementById(data.bar).style.width = `${state.progress[resource] * 100}%`;
    document.getElementById(data.stock).textContent = state.resources[resource];
    document.getElementById(data.info).textContent = state.resources[resource];
    document.getElementById(data.button).disabled = state.resources[resource] <= 0;
  }

  document.getElementById("log").innerHTML = state.log.map(item => `<div>• ${item}</div>`).join("");
}

function addLog(text) {
  state.log.unshift(text);
  state.log = state.log.slice(0, 9);
}

function createFloatingItem(resource) {
  const building = document.querySelector(`[data-resource="${resource}"]`);
  const board = document.getElementById("board");
  const buildingRect = building.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();

  const item = document.createElement("div");
  item.className = "float-item";
  item.textContent = config[resource].icon;

  item.style.left = `${buildingRect.left - boardRect.left + buildingRect.width / 2 - 16}px`;
  item.style.top = `${buildingRect.top - boardRect.top + 95}px`;

  board.appendChild(item);
  setTimeout(() => item.remove(), 1400);
}

function createCoinEffect(amount) {
  const coin = document.createElement("div");
  coin.className = "coin";
  coin.textContent = `+$${amount}`;

  coin.style.right = "40px";
  coin.style.top = "110px";

  document.body.appendChild(coin);
  setTimeout(() => coin.remove(), 900);
}

for (const [resource, data] of Object.entries(config)) {
  document.getElementById(data.button).addEventListener("click", () => sell(resource));
}

render();
requestAnimationFrame(tick);
