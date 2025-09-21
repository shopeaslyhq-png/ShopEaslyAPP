const { getAllDocuments, updateDocument } = require('../config/firebase');

function isMaterialsCat(c) { return /^(materials|raw\s*materials?)$/i.test(String(c||'')); }
function isPackingCat(c) { return /^packing\s*materials?$/i.test(String(c||'')); }

// Allowed fields to update via edit
const ALLOWED_FIELDS = new Set(['customerName','product','quantity','price','status','notes']);

// Edit an order with validation; returns sanitized update object actually applied
async function editOrder(id, updates) {
  if (!id) throw new Error('Order ID is required');
  if (!updates || typeof updates !== 'object') throw new Error('Updates payload required');

  const data = {};

  if (updates.customerName != null) {
    const v = String(updates.customerName).trim();
    if (!v) throw new Error('customerName cannot be empty');
    data.customerName = v;
  }

  if (updates.quantity != null) {
    const q = Number.parseInt(updates.quantity, 10);
    if (!Number.isFinite(q) || q < 0) throw new Error('quantity must be a non-negative integer');
    data.quantity = q;
  }

  if (updates.price !== undefined) {
    if (updates.price === null || updates.price === '') {
      data.price = null;
    } else {
      const p = Number.parseFloat(updates.price);
      if (!Number.isFinite(p) || p < 0) throw new Error('price must be a non-negative number');
      data.price = p;
    }
  }

  if (updates.status != null) {
    const s = String(updates.status);
    const allowed = ['Pending','Processing','Shipped','Delivered'];
    if (!allowed.includes(s)) throw new Error('status must be one of Pending, Processing, Shipped, Delivered');
    data.status = s;
  }

  if (updates.notes != null) {
    data.notes = String(updates.notes).trim();
  }

  // Product change: accept product, productId, or productSku
  if (updates.product != null || updates.productId != null || updates.productSku != null) {
    const inventoryItems = await getAllDocuments('inventory', 2000);
    const byId = new Map(inventoryItems.map(i => [String(i.id), i]));
    const bySku = new Map(inventoryItems.filter(i => i.sku).map(i => [String(i.sku).toUpperCase(), i]));
    const byName = new Map(inventoryItems.filter(i => i.name).map(i => [String(i.name).toLowerCase(), i]));

    let invMatch = null;
    const prodId = updates.productId != null ? String(updates.productId).trim() : '';
    const prodSku = updates.productSku != null ? String(updates.productSku).trim() : '';
    const prodName = updates.product != null ? String(updates.product).trim() : '';

    if (prodId && byId.has(prodId)) invMatch = byId.get(prodId);
    if (!invMatch && prodSku && bySku.has(prodSku.toUpperCase())) invMatch = bySku.get(prodSku.toUpperCase());
    if (!invMatch && prodName) {
      if (byId.has(prodName)) invMatch = byId.get(prodName);
      else if (bySku.has(prodName.toUpperCase())) invMatch = bySku.get(prodName.toUpperCase());
      else if (byName.has(prodName.toLowerCase())) invMatch = byName.get(prodName.toLowerCase());
    }

    if (!invMatch) throw new Error('Selected product not found in inventory');
    if (isMaterialsCat(invMatch.category) || isPackingCat(invMatch.category)) {
      throw new Error('Only finished Products can be ordered (not Materials or Packing Materials)');
    }

    // Keep existing `product` for compatibility but also set explicit product fields
    data.product = String(invMatch.name || '').trim();
    data.productId = invMatch.id;
    data.productName = String(invMatch.name || '').trim();
    data.productSku = invMatch.sku || null;

    // If caller cleared price explicitly to null/empty, default to inventory price
    if (updates.price === '' || updates.price === null) {
      const invPrice = Number(invMatch.price);
      data.price = Number.isFinite(invPrice) ? invPrice : null;
    }
  }

  // Filter to allowed fields (defense-in-depth)
  Object.keys(data).forEach(k => { if (!ALLOWED_FIELDS.has(k)) delete data[k]; });

  if (Object.keys(data).length === 0) {
    throw new Error('No valid fields provided for update');
  }

  await updateDocument('orders', id, data);
  return data;
}

module.exports = { editOrder };
