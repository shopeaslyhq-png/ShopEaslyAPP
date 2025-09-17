const { getAllDocuments } = require('../config/firebase');

function parseDateOnly(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeRange(start, end) {
  const s = parseDateOnly(start);
  const e = parseDateOnly(end);
  if (!s || !e) throw new Error('start and end must be YYYY-MM-DD');
  // inclusive end-of-day by adding one day and subtracting 1 ms
  const endInclusive = new Date(e.getTime() + 24*60*60*1000 - 1);
  return { startDate: s, endDate: endInclusive };
}

function toNum(v, d=0) { const n = Number(v); return Number.isFinite(n) ? n : d; }

// Build a map from product name (lowercased) to inventory item for joins
function makeInventoryIndex(inventory) {
  const byName = new Map();
  const byId = new Map();
  for (const it of inventory) {
    if (it?.name) byName.set(String(it.name).toLowerCase(), it);
    if (it?.id) byId.set(String(it.id), it);
  }
  return { byName, byId };
}

// Summarize inventory usage from orders between start and end (YYYY-MM-DD)
// Returns: { timeframe, totals, products, packagingUsage }
async function getInventoryUsageReport({ start, end, limit = 5000 } = {}) {
  const { startDate, endDate } = normalizeRange(start, end);

  const [orders, inventory] = await Promise.all([
    getAllDocuments('orders', limit),
    getAllDocuments('inventory', 2000)
  ]);

  const idx = makeInventoryIndex(inventory);

  // Filter orders by createdAt (ISO) or date (YYYY-MM-DD)
  const inRange = (o) => {
    let t = null;
    if (o.createdAt) {
      const d = new Date(o.createdAt);
      if (!Number.isNaN(d.getTime())) t = d;
    }
    if (!t && o.date) {
      const d = parseDateOnly(o.date);
      if (d) t = d;
    }
    if (!t) return false;
    return t >= startDate && t <= endDate;
  };

  const filtered = orders.filter(inRange);

  const productAgg = new Map(); // key = product name (lower)
  let totalOrders = 0;
  let totalUnits = 0;
  let totalRevenue = 0;

  for (const o of filtered) {
    totalOrders++;
    const name = String(o.product || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const qty = toNum(o.quantity, 0);
    const price = o.price == null ? null : toNum(o.price, null);

    totalUnits += qty;
    if (price != null) totalRevenue += price * qty;

    const inv = idx.byName.get(key) || { category: 'Products' };
    const rec = productAgg.get(key) || {
      name,
      sku: inv.sku || null,
      category: inv.category || 'Products',
      quantity: 0,
      orders: 0,
      revenue: 0,
      packagingId: inv.packagingId || ''
    };
    rec.quantity += qty;
    rec.orders += 1;
    if (price != null) rec.revenue += price * qty;
    productAgg.set(key, rec);
  }

  // Packaging usage: sum quantities for products referencing a packagingId
  const packagingAgg = new Map(); // key = packaging id
  for (const [, rec] of productAgg) {
    if (rec.packagingId) {
      const pkg = idx.byId.get(String(rec.packagingId));
      if (pkg) {
        const cur = packagingAgg.get(pkg.id) || { id: pkg.id, name: pkg.name, sku: pkg.sku, quantity: 0 };
        cur.quantity += rec.quantity; // assume 1 packaging per product unit
        packagingAgg.set(pkg.id, cur);
      }
    }
  }

  const products = [...productAgg.values()].sort((a, b) => b.quantity - a.quantity);
  const packagingUsage = [...packagingAgg.values()].sort((a, b) => b.quantity - a.quantity);

  return {
    timeframe: { start, end },
    totals: {
      orders: totalOrders,
      units: totalUnits,
      revenue: Number(totalRevenue.toFixed(2))
    },
    products,
    packagingUsage
  };
}

module.exports = { getInventoryUsageReport };
