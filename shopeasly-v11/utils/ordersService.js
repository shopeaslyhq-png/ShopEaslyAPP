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

  if (updates.product != null) {
    const productName = String(updates.product).trim();
    if (!productName) throw new Error('product cannot be empty');
    // Validate that product exists and is a finished good
    const inventoryItems = await getAllDocuments('inventory', 500);
    const invMatch = inventoryItems.find(i => String(i.name).toLowerCase() === productName.toLowerCase());
    if (!invMatch) throw new Error('Selected product not found in inventory');
    if (isMaterialsCat(invMatch.category) || isPackingCat(invMatch.category)) {
      throw new Error('Only finished Products can be ordered (not Materials or Packing Materials)');
    }
    data.product = invMatch.name.trim();
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
