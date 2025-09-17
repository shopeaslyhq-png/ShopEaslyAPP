// Dashboard summary utility: aggregates inventory, orders, and notifications
const { getAllDocuments } = require('../config/firebase');

// Helper: normalize integer from possibly undefined or string
function toNumber(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

// Compute summary metrics
async function getDashboardSummary(options = {}) {
  const {
    recentOrdersLimit = 10,
    lowStockDefaultThreshold = 5,
  } = options;

  // Load data
  const [orders, inventory] = await Promise.all([
    getAllDocuments('orders', Math.max(recentOrdersLimit, 50)), // load more, we'll slice for recent
    getAllDocuments('inventory', 500),
  ]);

  // Orders metrics
  const byStatus = { Pending: 0, Processing: 0, Shipped: 0, Delivered: 0, Cancelled: 0 };
  for (const o of orders) {
    const s = o.status || 'Pending';
    if (byStatus[s] == null) byStatus[s] = 0;
    byStatus[s]++;
  }

  // Inventory metrics
  const items = Array.isArray(inventory) ? inventory : [];
  const totalSkus = items.length;
  const lowStockItems = [];
  const outOfStockItems = [];

  for (const it of items) {
    const stock = toNumber(it.stock, 0);
    const threshold = toNumber(it.threshold, lowStockDefaultThreshold);
    if (stock <= 0) {
      outOfStockItems.push(pickItemFields(it));
    } else if (stock <= threshold) {
      lowStockItems.push(pickItemFields(it));
    }
  }

  // Notifications: derive from inventory and orders
  const notifications = [];
  if (outOfStockItems.length) {
    notifications.push({
      type: 'out-of-stock',
      severity: 'error',
      message: `${outOfStockItems.length} item(s) are out of stock`,
      items: outOfStockItems.slice(0, 5),
    });
  }
  if (lowStockItems.length) {
    notifications.push({
      type: 'low-stock',
      severity: 'warning',
      message: `${lowStockItems.length} item(s) are low on stock`,
      items: lowStockItems.slice(0, 5),
    });
  }
  if ((byStatus.Pending || 0) > 0) {
    notifications.push({
      type: 'orders',
      severity: 'info',
      message: `${byStatus.Pending} order(s) pending`,
    });
  }

  // Sort orders by createdAt desc if present (string ISO) and pick recent
  const recent = [...orders].sort((a, b) => {
    const av = a?.createdAt || '';
    const bv = b?.createdAt || '';
    return av > bv ? -1 : av < bv ? 1 : 0;
  }).slice(0, recentOrdersLimit);

  return {
    storage: 'local',
    orders: {
      total: orders.length,
      byStatus,
      recent,
    },
    inventory: {
      totalSkus,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      lowStockItems,
      outOfStockItems,
    },
    notifications,
  };
}

function pickItemFields(it) {
  return {
    id: it.id,
    name: it.name,
    sku: it.sku,
    stock: toNumber(it.stock, 0),
    threshold: toNumber(it.threshold, 0),
    category: it.category,
  };
}

module.exports = { getDashboardSummary };
