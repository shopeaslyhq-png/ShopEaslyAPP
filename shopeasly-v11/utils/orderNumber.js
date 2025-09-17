const { getAllDocuments } = require('../config/firebase');

// Generates a unique, human-friendly order number like: ORD-20250916-0001
// Strategy: per-day sequence; scan existing orders for today and increment.
async function generateOrderNumber(date = new Date()) {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const yyyymmdd = `${y}${m}${d}`;

  // Load a reasonable number of recent orders; our local store is small
  const orders = await getAllDocuments('orders', 1000);
  const prefix = `ORD-${yyyymmdd}-`;
  let maxSeq = 0;

  for (const o of orders) {
    const num = o.orderNumber;
    if (typeof num === 'string' && num.startsWith(prefix)) {
      const suffix = num.slice(prefix.length);
      const n = parseInt(suffix, 10);
      if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
    }
  }

  const next = maxSeq + 1;
  const seq = String(next).padStart(4, '0');
  return `${prefix}${seq}`;
}

module.exports = { generateOrderNumber };
