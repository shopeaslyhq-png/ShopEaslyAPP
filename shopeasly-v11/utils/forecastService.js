// forecastService.js
// Simple moving average forecast for daily sales
const { getAllDocuments } = require('../config/firebase');

function toDateOnly(d) {
  if (!d) return '';
  try { const dt = new Date(d); if (Number.isNaN(dt.getTime())) return ''; return dt.toISOString().slice(0,10); } catch { return ''; }
}

async function dailySalesHistory(days = 14) {
  const orders = await getAllDocuments('orders', 10000).catch(() => []);
  const today = new Date();
  const map = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    map.set(d.toISOString().slice(0,10), 0);
  }
  for (const o of orders) {
    const key = toDateOnly(o.date || o.createdAt);
    if (!map.has(key)) continue;
    const qty = Number(o.quantity || o.qty || 0);
    const unit = Number(o.price || 0);
    const total = o.total != null ? Number(o.total) : (unit * qty);
    if (Number.isFinite(total)) map.set(key, map.get(key) + total);
  }
  return Array.from(map.entries()).map(([date, sales]) => ({ date, sales: Number(sales.toFixed(2)) }));
}

async function forecastNextDay({ window = 7 } = {}) {
  const hist = await dailySalesHistory(window);
  if (!hist.length) return { forecast: 0, window };
  const avg = hist.reduce((s, r) => s + r.sales, 0) / hist.length;
  return { forecast: Number(avg.toFixed(2)), window, basis: hist };
}

module.exports = { dailySalesHistory, forecastNextDay };
