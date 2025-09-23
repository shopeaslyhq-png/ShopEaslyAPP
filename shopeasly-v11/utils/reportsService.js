// reportsService.js
// Summary reporting utilities for ShopEasly
// Calculates daily sales totals, low stock counts, and pending orders using the JSON-backed data layer

const { getAllDocuments } = require('../config/firebase');
const { forecastNextDay } = require('./forecastService');

function toDateOnly(d) {
  if (!d) return '';
  try {
    if (typeof d === 'string' && d.length === 10 && /\d{4}-\d{2}-\d{2}/.test(d)) return d;
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toISOString().slice(0,10);
  } catch (_) { return ''; }
}

async function summary({ date } = {}) {
  const day = toDateOnly(date) || new Date().toISOString().slice(0,10);

  // Orders
  const orders = await getAllDocuments('orders', 5000).catch(() => []);
  const dayOrders = orders.filter(o => toDateOnly(o.date || o.createdAt) === day);
  const dailySales = dayOrders.reduce((sum, o) => {
    const qty = Number(o.quantity || o.qty || 0);
    const unit = Number(o.price || 0);
    const total = o.total != null ? Number(o.total) : (unit * qty);
    return sum + (Number.isFinite(total) ? total : 0);
  }, 0);
  const pendingOrders = orders.filter(o => /pending/i.test(String(o.status || ''))).length;

  // Inventory
  const inventory = await getAllDocuments('inventory', 10000).catch(() => []);
  const lowStock = inventory.filter(i => {
    const stock = Number(i.stock || 0);
    const thr = Number(i.threshold || 0);
    return thr > 0 && stock > 0 && stock <= thr;
  }).length;

  const fc = await forecastNextDay({ window: 7 }).catch(() => ({ forecast: 0, window: 7 }));

  return {
    date: day,
    dailySales: Number(dailySales.toFixed(2)),
    lowStock,
    pendingOrders,
    forecast: fc
  };
}

module.exports = { summary };
