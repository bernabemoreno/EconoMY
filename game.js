const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const world = {
  width: 900,
  height: 1400
};

const state = {
  money: 0,
  stock: {
    corn: 0,
    tomato: 0,
    milk: 0
  },
  routes: [],
  packets: [],
  drag: null,
  message: "Arrastrá desde un edificio al mercado"
};

const resources = {
  corn: { icon: "🌽", price: 2, color: "#facc15", label: "Maíz" },
  tomato: { icon: "🍅", price: 3, color: "#ef4444", label: "Tomate" },
  milk: { icon: "🥛", price: 4, color: "#dbeafe", label: "Leche" }
};

const buildings = [
  {
    id: "cornFarm",
    type: "producer",
    name: "Maíz",
    resource: "corn",
    icon: "🌽",
    x: 230,
    y: 430,
    produceEvery: 2100,
    lastProduced: 0
  },
  {
    id: "tomatoFarm",
    type: "producer",
    name: "Tomates",
    resource: "tomato",
    icon: "🍅",
    x: 600,
    y: 500,
    produceEvery: 2800,
    lastProduced: 0
  },
  {
    id: "dairy",
    type: "producer",
    name: "Tambo",
    resource: "milk",
    icon: "🥛",
    x: 315,
    y: 790,
    produceEvery: 3500,
    lastProduced: 0
  },
  {
    id: "market",
    type: "market",
    name: "Mercado",
    icon: "🏦",
    x: 485,
    y: 685
  }
];

const hexes = [
  [155, 365, "land"], [300, 365, "land"], [445, 365, "snow"], [590, 365, "snow"], [735, 365, "blocked"],
  [85, 490, "land"], [230, 490, "land"], [375, 490, "land"], [520, 490, "land"], [665, 490, "snow"],
  [155, 615, "land"], [300, 615, "land"], [445, 615, "land"], [590, 615, "land"], [735, 615, "blocked"],
  [85, 740, "waterEdge"], [230, 740, "land"], [375, 740, "land"], [520, 740, "land"], [665, 740, "land"],
  [155, 865, "blocked"], [300, 865, "land"], [445, 865, "land"], [590, 865, "land"], [735, 865, "blocked"],
  [230, 990, "blocked"], [375, 990, "blocked"], [520, 990, "blocked"], [665, 990, "blocked"]
];

let lastFrame = performance.now();

function resizeCanvasForDevice() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = world.width;
  canvas.height = world.height;
}

function hexPath(x, y, r = 93) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (60 * i + 30);
    const px = x + r * Math.cos(angle);
    const py = y + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawHex(x, y, kind) {
  const colors = {
    land: ["#4ade3e", "#3ed436"],
    snow: ["#dfe5ff", "#cfd8ff"],
    blocked: ["#404045", "#34343a"],
    waterEdge: ["#31d456", "#28c14c"]
  };

  const [fill, stroke] = colors[kind] || colors.land;
  hexPath(x, y);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = kind === "blocked" ? "#5b5b62" : "#e5ffff";
  ctx.stroke();

  if (kind === "snow") {
    ctx.font = "34px system-ui";
    ctx.fillText("❄️", x - 20, y + 12);
  }
}

function drawWater() {
  const g = ctx.createLinearGradient(0, 0, 0, world.height);
  g.addColorStop(0, "#15c9ce");
  g.addColorStop(1, "#0879a7");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, world.width, world.height);

  ctx.globalAlpha = .12;
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    ctx.arc((i * 113) % 900, 220 + (i * 71) % 1050, 55, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawRoutes() {
  for (const route of state.routes) {
    const a = getBuilding(route.from);
    const b = getBuilding(route.to);

    drawRouteLine(a.x, a.y, b.x, b.y, resources[route.resource].color);
  }

  if (state.drag) {
    const a = getBuilding(state.drag.from);
    drawRouteLine(a.x, a.y, state.drag.x, state.drag.y, resources[state.drag.resource].color, true);
  }
}

function drawRouteLine(x1, y1, x2, y2, color, dashed = false) {
  ctx.save();
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(20, 30, 38, .45)";
  if (dashed) ctx.setLineDash([18, 14]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawBuilding(b) {
  ctx.save();

  ctx.shadowColor = "rgba(0,0,0,.28)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 8;

  ctx.fillStyle = b.type === "market" ? "#faf5ff" : "#ffffff";
  roundRect(b.x - 56, b.y - 58, 112, 112, 24);
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.lineWidth = 6;
  ctx.strokeStyle = b.type === "market" ? "#a855f7" : "#16a34a";
  roundRect(b.x - 56, b.y - 58, 112, 112, 24);
  ctx.stroke();

  ctx.font = "58px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(b.icon, b.x, b.y - 10);

  ctx.fillStyle = "#17351e";
  ctx.font = "bold 24px system-ui";
  ctx.fillText(b.name, b.x, b.y + 51);

  if (b.type === "producer") {
    const progress = Math.min((performance.now() - b.lastProduced) / b.produceEvery, 1);
    ctx.fillStyle = "rgba(0,0,0,.18)";
    roundRect(b.x - 50, b.y + 70, 100, 14, 7);
    ctx.fill();
    ctx.fillStyle = resources[b.resource].color;
    roundRect(b.x - 50, b.y + 70, 100 * progress, 14, 7);
    ctx.fill();
  }

  ctx.restore();
}

function drawPackets() {
  for (const p of state.packets) {
    const from = getBuilding(p.from);
    const to = getBuilding(p.to);
    const t = p.progress;

    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;

    ctx.save();
    ctx.globalAlpha = .95;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "30px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(resources[p.resource].icon, x, y + 1);
    ctx.restore();
  }
}

function drawLabels() {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.strokeStyle = "rgba(0,0,0,.2)";
  ctx.lineWidth = 2;
  roundRect(330, 250, 255, 150, 20);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#172554";
  ctx.textAlign = "center";
  ctx.font = "bold 34px system-ui";
  ctx.fillText("LEVEL 1", 457, 292);

  ctx.fillStyle = "#2563eb";
  ctx.font = "bold 20px system-ui";
  ctx.fillText("Trade Bonus", 457, 325);

  ctx.fillStyle = "#111827";
  ctx.font = "bold 20px system-ui";
  ctx.fillText("Conectá rutas al mercado", 457, 358);
  ctx.restore();
}

function drawToast() {
  if (!state.message) return;
  ctx.save();
  ctx.fillStyle = "rgba(0, 44, 62, .55)";
  roundRect(130, 1185, 640, 64, 26);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 25px system-ui";
  ctx.fillText(state.message, 450, 1226);
  ctx.restore();
}

function update(dt, now) {
  for (const b of buildings) {
    if (b.type !== "producer") continue;

    if (now - b.lastProduced >= b.produceEvery) {
      b.lastProduced = now;
      state.stock[b.resource]++;

      const route = state.routes.find(r => r.from === b.id && r.resource === b.resource);
      if (route && state.stock[b.resource] > 0) {
        state.stock[b.resource]--;
        state.packets.push({
          from: route.from,
          to: route.to,
          resource: route.resource,
          progress: 0,
          speed: 0.32
        });
      }
    }
  }

  for (const p of state.packets) {
    p.progress += dt * p.speed;
  }

  const arrived = state.packets.filter(p => p.progress >= 1);
  state.packets = state.packets.filter(p => p.progress < 1);

  for (const p of arrived) {
    if (p.to === "market") {
      state.money += resources[p.resource].price;
      state.message = `Vendiste ${resources[p.resource].label} +$${resources[p.resource].price}`;
    }
  }

  renderTopbar();
}

function renderTopbar() {
  document.getElementById("money").textContent = state.money;
  document.getElementById("corn").textContent = state.stock.corn;
  document.getElementById("tomato").textContent = state.stock.tomato;
  document.getElementById("milk").textContent = state.stock.milk;
}

function draw() {
  drawWater();

  for (const h of hexes) drawHex(h[0], h[1], h[2]);

  drawLabels();
  drawRoutes();

  for (const b of buildings) drawBuilding(b);

  drawPackets();
  drawToast();
}

function loop(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;

  update(dt, now);
  draw();

  requestAnimationFrame(loop);
}

function getBuilding(id) {
  return buildings.find(b => b.id === id);
}

function getPointerPos(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (world.width / rect.width),
    y: (event.clientY - rect.top) * (world.height / rect.height)
  };
}

function hitBuilding(x, y) {
  return buildings.find(b => {
    const dx = x - b.x;
    const dy = y - b.y;
    return Math.sqrt(dx * dx + dy * dy) < 70;
  });
}

canvas.addEventListener("pointerdown", event => {
  const pos = getPointerPos(event);
  const b = hitBuilding(pos.x, pos.y);

  if (!b || b.type !== "producer") return;

  state.drag = {
    from: b.id,
    resource: b.resource,
    x: pos.x,
    y: pos.y
  };
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", event => {
  if (!state.drag) return;
  const pos = getPointerPos(event);
  state.drag.x = pos.x;
  state.drag.y = pos.y;
});

canvas.addEventListener("pointerup", event => {
  if (!state.drag) return;

  const pos = getPointerPos(event);
  const target = hitBuilding(pos.x, pos.y);

  if (target && target.type === "market") {
    state.routes = state.routes.filter(r => r.from !== state.drag.from);
    state.routes.push({
      from: state.drag.from,
      to: target.id,
      resource: state.drag.resource
    });
    state.message = "Ruta creada al mercado ✅";
  } else {
    state.message = "Soltá la línea sobre el mercado";
  }

  state.drag = null;
});

document.getElementById("clearRoutes").addEventListener("click", () => {
  state.routes = [];
  state.message = "Rutas borradas";
});

function roundRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

resizeCanvasForDevice();
for (const b of buildings) {
  if (b.type === "producer") b.lastProduced = performance.now();
}

renderTopbar();
requestAnimationFrame(loop);
