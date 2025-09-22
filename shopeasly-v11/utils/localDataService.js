import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'shopeasly-v11', 'data');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

/**
 * Read JSON array file safely
 * @param {string} filePath
 * @returns {Promise<Array<object>>}
 */
export async function readJsonFile(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn(`[localDataService] readJsonFile error for ${filePath}: ${err.message}`);
    return [];
  }
}

/**
 * Filter inventory items
 */
export async function findInventoryItems({ sku, name, status } = {}) {
  const items = await readJsonFile(INVENTORY_FILE);
  const toStr = v => (v == null ? '' : String(v));
  const skuQ = toStr(sku).trim().toUpperCase();
  const nameQ = toStr(name).trim().toLowerCase();
  const stat = toStr(status).trim().toLowerCase();

  return items.filter(it => {
    if (skuQ && String(it.sku || '').toUpperCase() !== skuQ) return false;
    if (nameQ && !String(it.name || '').toLowerCase().includes(nameQ)) return false;
    if (stat) {
      const stock = Number(it.stock || 0);
      const threshold = Number(it.threshold || 0);
      if (stat === 'out-of-stock' && stock > 0) return false;
      if (stat === 'low-stock' && !(stock > 0 && threshold > 0 && stock <= threshold)) return false;
      if (stat === 'active' && String(it.status || 'active').toLowerCase() !== 'active') return false;
    }
    return true;
  });
}

/**
 * Filter orders
 */
export async function findOrders({ productSku, customerName, status } = {}) {
  const orders = await readJsonFile(ORDERS_FILE);
  const skuQ = (productSku || '').trim().toUpperCase();
  const custQ = (customerName || '').trim().toLowerCase();
  const stat = (status || '').trim().toLowerCase();

  return orders.filter(o => {
    if (skuQ) {
      const sku = String(o.productSku || o.sku || '').toUpperCase();
      if (sku !== skuQ) return false;
    }
    if (custQ && !String(o.customerName || '').toLowerCase().includes(custQ)) return false;
    if (stat && String(o.status || '').toLowerCase() !== stat) return false;
    return true;
  });
}
