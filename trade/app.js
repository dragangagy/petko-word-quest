"use strict";

/* =========================================================
   G-Lab Trade - paper trading simulator
   Prices are a deterministic function of wall-clock time:
   the market keeps moving while the app is closed, and every
   device sees the same market. No backend required.
   ========================================================= */

const STORAGE_KEY = "glt-state-v1";
const STARTING_CASH = 10000;
const FEE_RATE = 0.001; // 0.1% commission per trade
const MAX_TRADES = 100;
const TICK_MS = 2000;
const GENESIS = Date.UTC(2026, 0, 1); // market epoch

const ASSETS = [
  { sym: "GLAB", name: "G-Lab Industries", cat: "Stock", base: 128, vol: 0.05, trend: 0.22, seed: 101, color: "linear-gradient(135deg,#38bdf8,#16e68a)" },
  { sym: "PETK", name: "Petko Games", cat: "Stock", base: 46, vol: 0.07, trend: 0.18, seed: 202, color: "linear-gradient(135deg,#ffd700,#f7b731)" },
  { sym: "NEON", name: "Neon Motors", cat: "Stock", base: 212, vol: 0.09, trend: 0.1, seed: 303, color: "linear-gradient(135deg,#a855f7,#38bdf8)" },
  { sym: "QNTM", name: "Quantum Core", cat: "Stock", base: 87, vol: 0.11, trend: 0.25, seed: 404, color: "linear-gradient(135deg,#0ea5e9,#a855f7)" },
  { sym: "SOLR", name: "Solar Grid", cat: "Stock", base: 33, vol: 0.06, trend: 0.12, seed: 505, color: "linear-gradient(135deg,#ffd700,#16e68a)" },
  { sym: "MEDL", name: "Medal Works", cat: "Stock", base: 15.5, vol: 0.045, trend: 0.08, seed: 606, color: "linear-gradient(135deg,#94a3b8,#38bdf8)" },
  { sym: "BITZ", name: "Bitzen", cat: "Crypto", base: 64000, vol: 0.22, trend: 0.3, seed: 707, color: "linear-gradient(135deg,#f7b731,#f87171)" },
  { sym: "ETHR", name: "Etherra", cat: "Crypto", base: 3400, vol: 0.26, trend: 0.2, seed: 808, color: "linear-gradient(135deg,#38bdf8,#a855f7)" },
  { sym: "DOGZ", name: "Dogezilla", cat: "Meme", base: 0.42, vol: 0.5, trend: 0, seed: 909, color: "linear-gradient(135deg,#16e68a,#ffd700)" },
  { sym: "AURM", name: "Aurum Gold", cat: "Metal", base: 2400, vol: 0.015, trend: 0.04, seed: 111, color: "linear-gradient(135deg,#ffd700,#fff7cc)" }
];

const TIMEFRAMES = {
  "1H": 3600e3,
  "1D": 86400e3,
  "1W": 7 * 86400e3,
  "1M": 30 * 86400e3,
  "1Y": 365 * 86400e3
};

/* ---------- deterministic noise ---------- */

function hash01(seed, i) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ i, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// smooth value noise in [-1, 1] at continuous coordinate x >= 0
function cnoise(seed, x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash01(seed, i);
  const b = hash01(seed, i + 1);
  return (a + (b - a) * u) * 2 - 1;
}

// price layers: month waves down to second-level ticks
const LAYERS = [
  { period: 30 * 86400e3, amp: 2.2, salt: 1 },
  { period: 3 * 86400e3, amp: 1.2, salt: 2 },
  { period: 86400e3, amp: 0.8, salt: 3 },
  { period: 2 * 3600e3, amp: 0.45, salt: 4 },
  { period: 20 * 60e3, amp: 0.22, salt: 5 },
  { period: 2 * 60e3, amp: 0.1, salt: 6 },
  { period: 15e3, amp: 0.04, salt: 7 }
];

function priceAt(asset, tMs) {
  const dt = Math.max(0, tMs - GENESIS);
  let logP = Math.log(asset.base);
  logP += asset.trend * (dt / (365 * 86400e3));
  for (const layer of LAYERS) {
    logP += asset.vol * layer.amp * cnoise(asset.seed * 31 + layer.salt, dt / layer.period);
  }
  return Math.exp(logP);
}

function seriesFor(asset, spanMs, points, endMs) {
  const out = new Array(points);
  const start = endMs - spanMs;
  for (let i = 0; i < points; i += 1) {
    const t = start + (spanMs * i) / (points - 1);
    out[i] = priceAt(asset, t);
  }
  return out;
}

/* ---------- state ---------- */

function freshState() {
  return { cash: STARTING_CASH, positions: {}, trades: [], startedAt: Date.now() };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const data = JSON.parse(raw);
    if (typeof data.cash !== "number" || !data.positions) return freshState();
    return { cash: data.cash, positions: data.positions, trades: data.trades || [], startedAt: data.startedAt || Date.now() };
  } catch {
    return freshState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode) - play in memory */
  }
}

let state = loadState();

/* ---------- formatting ---------- */

const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdFmt4 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 4 });
const qtyFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });

function fmtPrice(value) {
  return value < 1 ? usdFmt4.format(value) : usdFmt.format(value);
}

function fmtSigned(value) {
  const sign = value >= 0 ? "+" : "-";
  return sign + usdFmt.format(Math.abs(value)).replace("$", "$");
}

function fmtPct(value) {
  const sign = value >= 0 ? "+" : "";
  return sign + (value * 100).toFixed(2) + "%";
}

function gainClass(value) {
  return value >= 0 ? "gain" : "loss";
}

function fmtCompact(value) {
  if (value >= 1e6) return "$" + (value / 1e6).toFixed(2) + "M";
  if (value >= 1e4) return "$" + (value / 1e3).toFixed(1) + "K";
  return usdFmt.format(value);
}

/* ---------- dom ---------- */

const el = (id) => document.getElementById(id);

const dom = {
  splash: el("tradeSplash"),
  splashButton: el("tradeSplashButton"),
  equityPill: el("equityPill"),
  message: el("message"),
  statusEyebrow: el("statusEyebrow"),
  summaryEquity: el("summaryEquity"),
  summaryCash: el("summaryCash"),
  summaryPnl: el("summaryPnl"),
  summaryReturn: el("summaryReturn"),
  tabButtons: Array.from(document.querySelectorAll(".tab-button")),
  marketPanel: el("marketPanel"),
  assetList: el("assetList"),
  assetPanel: el("assetPanel"),
  assetBackButton: el("assetBackButton"),
  assetName: el("assetName"),
  assetSymbol: el("assetSymbol"),
  assetPrice: el("assetPrice"),
  assetChange: el("assetChange"),
  assetChart: el("assetChart"),
  timeframeRow: el("timeframeRow"),
  positionStrip: el("positionStrip"),
  positionQty: el("positionQty"),
  positionValue: el("positionValue"),
  positionAvg: el("positionAvg"),
  positionPnl: el("positionPnl"),
  sideBuyButton: el("sideBuyButton"),
  sideSellButton: el("sideSellButton"),
  amountInput: el("amountInput"),
  orderPreview: el("orderPreview"),
  confirmButton: el("confirmButton"),
  portfolioPanel: el("portfolioPanel"),
  positionList: el("positionList"),
  historyPanel: el("historyPanel"),
  historyList: el("historyList"),
  resetButton: el("resetButton"),
  helpButton: el("helpButton"),
  helpModal: el("helpModal"),
  helpCloseButton: el("helpCloseButton"),
  confirmModal: el("confirmModal"),
  confirmCancelButton: el("confirmCancelButton"),
  confirmResetButton: el("confirmResetButton"),
  toast: el("toast")
};

/* ---------- ui state ---------- */

let activeTab = "market";
let activeAsset = null; // symbol or null
let activeTimeframe = "1D";
let orderSide = "buy";
let sellAllIntent = false; // "Max" on the sell side closes the whole position even if the price drifts
let toastTimer = 0;
const sparkCanvases = new Map();

const assetBySym = new Map(ASSETS.map((a) => [a.sym, a]));

function positionQty(sym) {
  const pos = state.positions[sym];
  return pos ? pos.qty : 0;
}

function equityNow(now) {
  let total = state.cash;
  for (const sym of Object.keys(state.positions)) {
    const asset = assetBySym.get(sym);
    if (asset) total += state.positions[sym].qty * priceAt(asset, now);
  }
  return total;
}

/* ---------- toast ---------- */

function showToast(text) {
  dom.toast.textContent = text;
  dom.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    dom.toast.hidden = true;
  }, 2000);
}

/* ---------- summary ---------- */

function renderSummary(now) {
  const equity = equityNow(now);
  const pnl = equity - STARTING_CASH;
  const ret = pnl / STARTING_CASH;
  dom.equityPill.textContent = fmtCompact(equity);
  dom.summaryEquity.textContent = usdFmt.format(equity);
  dom.summaryCash.textContent = usdFmt.format(state.cash);
  dom.summaryPnl.textContent = fmtSigned(pnl);
  dom.summaryPnl.className = gainClass(pnl);
  dom.summaryReturn.textContent = fmtPct(ret);
  dom.summaryReturn.className = gainClass(ret);
}

/* ---------- market list ---------- */

function buildMarketList() {
  dom.assetList.innerHTML = "";
  sparkCanvases.clear();
  for (const asset of ASSETS) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "asset-row";
    row.dataset.sym = asset.sym;

    const badge = document.createElement("span");
    badge.className = "asset-badge";
    badge.style.background = asset.color;
    badge.textContent = asset.sym.slice(0, 2);

    const meta = document.createElement("span");
    meta.className = "asset-meta";
    const name = document.createElement("strong");
    name.textContent = asset.name;
    const sub = document.createElement("small");
    sub.dataset.role = "sub";
    meta.append(name, sub);

    const spark = document.createElement("canvas");
    spark.className = "asset-spark";
    sparkCanvases.set(asset.sym, spark);

    const quote = document.createElement("span");
    quote.className = "asset-quote";
    const price = document.createElement("strong");
    price.dataset.role = "price";
    const change = document.createElement("small");
    change.dataset.role = "change";
    quote.append(price, change);

    row.append(badge, meta, spark, quote);
    row.addEventListener("click", () => openAsset(asset.sym));
    dom.assetList.appendChild(row);
  }
}

function renderMarketList(now) {
  for (const row of dom.assetList.children) {
    const asset = assetBySym.get(row.dataset.sym);
    const p = priceAt(asset, now);
    const p24 = priceAt(asset, now - 86400e3);
    const change = p / p24 - 1;
    row.querySelector('[data-role="price"]').textContent = fmtPrice(p);
    const changeEl = row.querySelector('[data-role="change"]');
    changeEl.textContent = fmtPct(change);
    changeEl.className = gainClass(change);
    const qty = positionQty(asset.sym);
    const sub = row.querySelector('[data-role="sub"]');
    if (qty > 0) {
      sub.textContent = asset.cat + " · you hold " + qtyFmt.format(qty);
      sub.classList.add("asset-held");
    } else {
      sub.textContent = asset.cat + " · " + asset.sym;
      sub.classList.remove("asset-held");
    }
    drawSparkline(sparkCanvases.get(asset.sym), asset, now, change >= 0);
  }
}

function drawSparkline(canvas, asset, now, up) {
  const dpr = window.devicePixelRatio || 1;
  const w = 64;
  const h = 26;
  if (canvas.width !== w * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const data = seriesFor(asset, TIMEFRAMES["1D"], 40, now);
  let min = Infinity;
  let max = -Infinity;
  for (const v of data) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  ctx.beginPath();
  for (let i = 0; i < data.length; i += 1) {
    const x = (w * i) / (data.length - 1);
    const y = h - 2 - ((data[i] - min) / range) * (h - 4);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = up ? "#16e68a" : "#f87171";
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  ctx.stroke();
}

/* ---------- asset detail ---------- */

function openAsset(sym) {
  activeAsset = sym;
  dom.amountInput.value = "";
  setOrderSide(positionQty(sym) > 0 && orderSide === "sell" ? "sell" : "buy");
  showTab("market");
  dom.marketPanel.hidden = true;
  dom.assetPanel.hidden = false;
  renderAssetDetail(Date.now());
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeAsset() {
  activeAsset = null;
  dom.assetPanel.hidden = true;
  dom.marketPanel.hidden = activeTab !== "market";
  renderAll(Date.now());
}

function renderAssetDetail(now) {
  if (!activeAsset) return;
  const asset = assetBySym.get(activeAsset);
  const price = priceAt(asset, now);
  const span = TIMEFRAMES[activeTimeframe];
  const prev = priceAt(asset, now - span);
  const change = price / prev - 1;

  dom.assetName.textContent = asset.name;
  dom.assetSymbol.textContent = asset.sym + " · " + asset.cat;
  dom.assetPrice.textContent = fmtPrice(price);
  dom.assetChange.textContent = fmtPct(change) + " · " + activeTimeframe;
  dom.assetChange.className = gainClass(change);

  drawChart(asset, now, change >= 0);
  renderPositionStrip(asset, price);
  renderOrderPreview(asset, price);
}

function renderPositionStrip(asset, price) {
  const pos = state.positions[asset.sym];
  if (!pos || pos.qty <= 0) {
    dom.positionStrip.hidden = true;
    return;
  }
  dom.positionStrip.hidden = false;
  const value = pos.qty * price;
  const avg = pos.cost / pos.qty;
  const pnl = value - pos.cost;
  dom.positionQty.textContent = qtyFmt.format(pos.qty);
  dom.positionValue.textContent = usdFmt.format(value);
  dom.positionAvg.textContent = fmtPrice(avg);
  dom.positionPnl.textContent = fmtSigned(pnl);
  dom.positionPnl.className = gainClass(pnl);
}

function drawChart(asset, now, up) {
  const canvas = dom.assetChart;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(200, rect.width);
  const h = Math.max(120, rect.height);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const data = seriesFor(asset, TIMEFRAMES[activeTimeframe], 150, now);
  let min = Infinity;
  let max = -Infinity;
  for (const v of data) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const pad = (max - min) * 0.08 || max * 0.01 || 1;
  min -= pad;
  max += pad;
  const range = max - min;

  const left = 6;
  const right = w - 6;
  const top = 8;
  const bottom = h - 18;
  const plotW = right - left;
  const plotH = bottom - top;

  const xAt = (i) => left + (plotW * i) / (data.length - 1);
  const yAt = (v) => bottom - ((v - min) / range) * plotH;

  // grid lines
  ctx.strokeStyle = "rgba(56, 189, 248, 0.1)";
  ctx.lineWidth = 1;
  for (let g = 0; g <= 3; g += 1) {
    const y = top + (plotH * g) / 3;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }

  const lineColor = up ? "#16e68a" : "#f87171";

  // area fill
  const fill = ctx.createLinearGradient(0, top, 0, bottom);
  fill.addColorStop(0, up ? "rgba(22, 230, 138, 0.22)" : "rgba(248, 113, 113, 0.22)");
  fill.addColorStop(1, "rgba(2, 8, 23, 0)");
  ctx.beginPath();
  ctx.moveTo(xAt(0), yAt(data[0]));
  for (let i = 1; i < data.length; i += 1) ctx.lineTo(xAt(i), yAt(data[i]));
  ctx.lineTo(right, bottom);
  ctx.lineTo(left, bottom);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  // price line
  ctx.beginPath();
  ctx.moveTo(xAt(0), yAt(data[0]));
  for (let i = 1; i < data.length; i += 1) ctx.lineTo(xAt(i), yAt(data[i]));
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.shadowColor = lineColor;
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // last price dot
  const lastX = xAt(data.length - 1);
  const lastY = yAt(data[data.length - 1]);
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3.4, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // min / max labels
  ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
  ctx.font = "10px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(fmtPrice(max - pad), left + 2, top + 10);
  ctx.fillText(fmtPrice(min + pad), left + 2, bottom - 4);
}

/* ---------- order box ---------- */

function setOrderSide(side) {
  orderSide = side;
  sellAllIntent = false;
  dom.sideBuyButton.classList.toggle("active", side === "buy");
  dom.sideSellButton.classList.toggle("active", side === "sell");
  dom.confirmButton.classList.toggle("buy", side === "buy");
  dom.confirmButton.classList.toggle("sell", side === "sell");
  if (activeAsset) {
    const asset = assetBySym.get(activeAsset);
    renderOrderPreview(asset, priceAt(asset, Date.now()));
  }
}

function orderCap(asset, price) {
  if (orderSide === "buy") return state.cash;
  return positionQty(asset.sym) * price;
}

function renderOrderPreview(asset, price) {
  const cap = orderCap(asset, price);
  const amount = sellAllIntent && orderSide === "sell" ? cap : parseFloat(dom.amountInput.value);
  const verb = orderSide === "buy" ? "Buy" : "Sell";

  if (!Number.isFinite(amount) || amount <= 0) {
    dom.orderPreview.textContent =
      orderSide === "buy"
        ? "Available cash: " + usdFmt.format(state.cash)
        : "Position value: " + usdFmt.format(cap);
    dom.confirmButton.textContent = verb + " " + asset.sym;
    dom.confirmButton.disabled = true;
    return;
  }

  if (amount > cap + 0.005) {
    dom.orderPreview.textContent = orderSide === "buy" ? "Not enough cash. Max " + usdFmt.format(cap) : "Position too small. Max " + usdFmt.format(cap);
    dom.confirmButton.textContent = verb + " " + asset.sym;
    dom.confirmButton.disabled = true;
    return;
  }

  const fee = amount * FEE_RATE;
  const qty = orderSide === "buy" ? (amount - fee) / price : Math.min(amount / price, positionQty(asset.sym));
  dom.orderPreview.textContent =
    verb + " " + qtyFmt.format(qty) + " " + asset.sym + " @ " + fmtPrice(price) + " · fee " + usdFmt.format(fee);
  dom.confirmButton.textContent = verb + " " + asset.sym + " for " + usdFmt.format(amount);
  dom.confirmButton.disabled = false;
}

function executeOrder() {
  if (!activeAsset) return;
  const asset = assetBySym.get(activeAsset);
  const now = Date.now();
  const price = priceAt(asset, now);
  const amount = sellAllIntent && orderSide === "sell" ? orderCap(asset, price) : parseFloat(dom.amountInput.value);
  if (!Number.isFinite(amount) || amount <= 0) return;

  if (orderSide === "buy") {
    const spend = Math.min(amount, state.cash);
    if (spend <= 0) return;
    const fee = spend * FEE_RATE;
    const qty = (spend - fee) / price;
    state.cash -= spend;
    const pos = state.positions[asset.sym] || { qty: 0, cost: 0 };
    pos.qty += qty;
    pos.cost += spend - fee;
    state.positions[asset.sym] = pos;
    recordTrade({ t: now, side: "buy", sym: asset.sym, qty, price, usd: spend });
    showToast("Bought " + qtyFmt.format(qty) + " " + asset.sym);
  } else {
    const pos = state.positions[asset.sym];
    if (!pos || pos.qty <= 0) return;
    const heldValue = pos.qty * price;
    const sellValue = sellAllIntent ? heldValue : Math.min(amount, heldValue);
    let qty = sellValue / price;
    if (qty > pos.qty - 1e-9 || heldValue - sellValue < 0.01) qty = pos.qty; // close out dust
    const gross = qty * price;
    const fee = gross * FEE_RATE;
    const proceeds = gross - fee;
    const costShare = (pos.cost * qty) / pos.qty;
    pos.qty -= qty;
    pos.cost -= costShare;
    if (pos.qty <= 1e-9) delete state.positions[asset.sym];
    state.cash += proceeds;
    recordTrade({ t: now, side: "sell", sym: asset.sym, qty, price, usd: proceeds });
    const pnl = proceeds - costShare;
    showToast("Sold " + asset.sym + " · " + (pnl >= 0 ? "profit " : "loss ") + usdFmt.format(Math.abs(pnl)));
  }

  dom.amountInput.value = "";
  sellAllIntent = false;
  saveState();
  renderAll(now);
}

function recordTrade(trade) {
  state.trades.unshift(trade);
  if (state.trades.length > MAX_TRADES) state.trades.length = MAX_TRADES;
}

/* ---------- portfolio ---------- */

function renderPortfolio(now) {
  dom.positionList.innerHTML = "";
  const syms = Object.keys(state.positions).filter((sym) => state.positions[sym].qty > 0);
  if (!syms.length) {
    const note = document.createElement("div");
    note.className = "empty-note";
    note.textContent = "No positions yet. Open the Market tab and make your first trade.";
    dom.positionList.appendChild(note);
    return;
  }
  syms.sort((a, b) => {
    const pa = state.positions[a].qty * priceAt(assetBySym.get(a), now);
    const pb = state.positions[b].qty * priceAt(assetBySym.get(b), now);
    return pb - pa;
  });
  for (const sym of syms) {
    const asset = assetBySym.get(sym);
    const pos = state.positions[sym];
    const price = priceAt(asset, now);
    const value = pos.qty * price;
    const pnl = value - pos.cost;
    const pct = pos.cost > 0 ? pnl / pos.cost : 0;

    const row = document.createElement("button");
    row.type = "button";
    row.className = "position-row";

    const badge = document.createElement("span");
    badge.className = "asset-badge";
    badge.style.background = asset.color;
    badge.textContent = sym.slice(0, 2);

    const mid = document.createElement("span");
    mid.className = "pos-mid";
    const name = document.createElement("strong");
    name.textContent = asset.name;
    const info = document.createElement("small");
    info.textContent = qtyFmt.format(pos.qty) + " @ " + fmtPrice(pos.cost / pos.qty);
    mid.append(name, info);

    const rightBox = document.createElement("span");
    rightBox.className = "pos-right";
    const val = document.createElement("strong");
    val.textContent = usdFmt.format(value);
    const delta = document.createElement("small");
    delta.textContent = fmtSigned(pnl) + " (" + fmtPct(pct) + ")";
    delta.className = gainClass(pnl);
    rightBox.append(val, delta);

    row.append(badge, mid, rightBox);
    row.addEventListener("click", () => openAsset(sym));
    dom.positionList.appendChild(row);
  }
}

/* ---------- history ---------- */

const timeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function renderHistory() {
  dom.historyList.innerHTML = "";
  if (!state.trades.length) {
    const note = document.createElement("li");
    note.className = "empty-note";
    note.textContent = "No trades yet. Your history will show up here.";
    dom.historyList.appendChild(note);
    return;
  }
  for (const trade of state.trades) {
    const item = document.createElement("li");
    item.className = "history-item";

    const side = document.createElement("span");
    side.className = "history-side " + trade.side;
    side.textContent = trade.side;

    const mid = document.createElement("span");
    mid.className = "history-mid";
    const line = document.createElement("strong");
    line.textContent = qtyFmt.format(trade.qty) + " " + trade.sym + " @ " + fmtPrice(trade.price);
    const when = document.createElement("small");
    when.textContent = timeFmt.format(new Date(trade.t));
    mid.append(line, when);

    const amount = document.createElement("span");
    amount.className = "history-amount " + (trade.side === "buy" ? "loss" : "gain");
    amount.textContent = (trade.side === "buy" ? "-" : "+") + usdFmt.format(trade.usd);

    item.append(side, mid, amount);
    dom.historyList.appendChild(item);
  }
}

/* ---------- tabs ---------- */

function showTab(tab) {
  activeTab = tab;
  for (const button of dom.tabButtons) {
    button.classList.toggle("active", button.dataset.tab === tab);
  }
  dom.marketPanel.hidden = tab !== "market" || Boolean(activeAsset);
  dom.assetPanel.hidden = !(tab === "market" && activeAsset);
  dom.portfolioPanel.hidden = tab !== "portfolio";
  dom.historyPanel.hidden = tab !== "history";
  renderAll(Date.now());
}

/* ---------- render loop ---------- */

function renderAll(now) {
  renderSummary(now);
  if (!dom.marketPanel.hidden) renderMarketList(now);
  if (!dom.assetPanel.hidden) renderAssetDetail(now);
  if (!dom.portfolioPanel.hidden) renderPortfolio(now);
  if (!dom.historyPanel.hidden) renderHistory();
}

function tick() {
  if (document.visibilityState === "hidden") return;
  renderAll(Date.now());
}

/* ---------- events ---------- */

dom.splashButton.addEventListener("click", () => {
  dom.splash.hidden = true;
});

for (const button of dom.tabButtons) {
  button.addEventListener("click", () => {
    if (button.dataset.tab === "market" && activeTab === "market" && activeAsset) closeAsset();
    else showTab(button.dataset.tab);
  });
}

dom.assetBackButton.addEventListener("click", closeAsset);

dom.timeframeRow.addEventListener("click", (event) => {
  const button = event.target.closest(".tf-button");
  if (!button) return;
  activeTimeframe = button.dataset.tf;
  for (const b of dom.timeframeRow.querySelectorAll(".tf-button")) {
    b.classList.toggle("active", b === button);
  }
  renderAssetDetail(Date.now());
});

dom.sideBuyButton.addEventListener("click", () => setOrderSide("buy"));
dom.sideSellButton.addEventListener("click", () => setOrderSide("sell"));

dom.amountInput.addEventListener("input", () => {
  sellAllIntent = false;
  if (!activeAsset) return;
  const asset = assetBySym.get(activeAsset);
  renderOrderPreview(asset, priceAt(asset, Date.now()));
});

document.querySelectorAll(".quick-button").forEach((button) => {
  button.addEventListener("click", () => {
    if (!activeAsset) return;
    const asset = assetBySym.get(activeAsset);
    const cap = orderCap(asset, priceAt(asset, Date.now()));
    const part = parseFloat(button.dataset.part);
    sellAllIntent = orderSide === "sell" && part === 1;
    dom.amountInput.value = (Math.floor(cap * part * 100) / 100).toString();
    renderOrderPreview(asset, priceAt(asset, Date.now()));
  });
});

dom.confirmButton.addEventListener("click", executeOrder);

dom.helpButton.addEventListener("click", () => {
  dom.helpModal.hidden = false;
});
dom.helpCloseButton.addEventListener("click", () => {
  dom.helpModal.hidden = true;
});
dom.helpModal.addEventListener("click", (event) => {
  if (event.target === dom.helpModal) dom.helpModal.hidden = true;
});

dom.resetButton.addEventListener("click", () => {
  dom.confirmModal.hidden = false;
});
dom.confirmCancelButton.addEventListener("click", () => {
  dom.confirmModal.hidden = true;
});
dom.confirmModal.addEventListener("click", (event) => {
  if (event.target === dom.confirmModal) dom.confirmModal.hidden = true;
});
dom.confirmResetButton.addEventListener("click", () => {
  state = freshState();
  saveState();
  dom.confirmModal.hidden = true;
  activeAsset = null;
  showTab("market");
  showToast("Fresh start: " + usdFmt.format(STARTING_CASH));
});

window.addEventListener("resize", () => {
  if (!dom.assetPanel.hidden) renderAssetDetail(Date.now());
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") renderAll(Date.now());
});

/* ---------- boot ---------- */

buildMarketList();
showTab("market");
setInterval(tick, TICK_MS);

if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
