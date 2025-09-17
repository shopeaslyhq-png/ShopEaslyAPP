const { getAllDocuments, createDocument, updateDocument } = require('../config/firebase');

function isMaterialsCat(c) { return /^(materials|raw\s*materials?)$/i.test(String(c||'')); }
function isPackingCat(c) { return /^packing\s*materials?$/i.test(String(c||'')); }

function makeSkuFromName(name) {
  const base = String(name || 'PRODUCT').trim().toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'PRODUCT';
  return base;
}

function makePkgSkuFromName(name) {
  const base = makeSkuFromName(name);
  const pref = 'PKG-';
  // Ensure total length is reasonable
  const trimmed = (pref + base).slice(0, 24);
  return trimmed.replace(/-+$/,'');
}

async function uniqueSku(skuBase, existing) {
  const taken = new Set((existing || []).map(i => String(i.sku || '').toUpperCase()));
  let sku = skuBase.toUpperCase();
  if (!taken.has(sku)) return sku;
  let n = 1;
  while (n < 10000) {
    const candidate = `${skuBase}-${String(n).padStart(3,'0')}`.toUpperCase();
    if (!taken.has(candidate)) return candidate;
    n++;
  }
  // Fallback with timestamp suffix
  return `${skuBase}-${Date.now().toString().slice(-5)}`.toUpperCase();
}

// Initiate product creation: validates relationships and assigns name, price, stock (quantity), and SKU
async function initiateProductCreation({ name, price, quantity, materialsIds = [], packagingId = '', category = 'Products', sku, imageUrl }) {
  // Basic validation
  if (!name || !String(name).trim()) throw new Error('name is required');
  const stock = Number.parseInt(quantity ?? 0, 10);
  if (!Number.isFinite(stock) || stock < 0) throw new Error('quantity must be a non-negative integer');
  const priceNum = Number(price);
  if (!Number.isFinite(priceNum) || priceNum < 0) throw new Error('price must be a non-negative number');

  // Load inventory for validation and SKU uniqueness
  const all = await getAllDocuments('inventory', 1000);

  // Validate materials
  const idSet = new Set((materialsIds || []).map(String));
  const foundMaterials = all.filter(i => idSet.has(String(i.id)));
  const validMaterialIds = foundMaterials.filter(i => isMaterialsCat(i.category)).map(i => i.id);
  if (idSet.size && validMaterialIds.length !== idSet.size) {
    throw new Error('One or more material IDs are invalid');
  }

  // Validate packaging (optional)
  let finalPackagingId = '';
  if (packagingId) {
    const pkg = all.find(i => String(i.id) === String(packagingId));
    if (!pkg || !isPackingCat(pkg.category)) {
      throw new Error('Invalid packaging item');
    }
    finalPackagingId = pkg.id;
  }

  // SKU
  const base = sku ? String(sku).trim().toUpperCase() : makeSkuFromName(name);
  const finalSku = await uniqueSku(base, all);

  const item = {
    name: String(name).trim(),
    sku: finalSku,
    stock,
    price: priceNum,
    status: 'active',
    threshold: 5,
    category: String(category || 'Products').trim(),
    description: '',
    materials: validMaterialIds,
    packagingId: finalPackagingId,
    imageUrl: imageUrl ? String(imageUrl) : undefined,
    dateAdded: new Date().toISOString().split('T')[0]
  };

  const docRef = await createDocument('inventory', item);
  return { id: docRef.id, ...item };
}

// Create a new Packing Material item with name, dimensions, and stock level
// dimensions can be a string like "6x9 in" or an object { length, width, height?, unit? }
async function addPackingMaterial({ name, dimensions, stock, sku, price, threshold, status, description }) {
  if (!name || !String(name).trim()) throw new Error('name is required');
  if (dimensions == null || (typeof dimensions === 'string' && !dimensions.trim())) {
    throw new Error('dimensions is required');
  }
  const qty = Number.parseInt(stock ?? 0, 10);
  if (!Number.isFinite(qty) || qty < 0) throw new Error('stock must be a non-negative integer');

  const all = await getAllDocuments('inventory', 1000);

  // SKU handling
  let base = '';
  if (sku && String(sku).trim()) base = String(sku).trim().toUpperCase();
  else base = makePkgSkuFromName(name);
  const finalSku = await uniqueSku(base, all);

  // Normalize dimensions: store as string for simplicity
  let dimString = '';
  if (typeof dimensions === 'string') {
    dimString = dimensions.trim();
  } else if (dimensions && typeof dimensions === 'object') {
    const L = dimensions.length != null ? String(dimensions.length) : '';
    const W = dimensions.width != null ? String(dimensions.width) : '';
    const H = dimensions.height != null ? String(dimensions.height) : '';
    const U = dimensions.unit ? String(dimensions.unit) : '';
    dimString = [L, W, H].filter(Boolean).join('x') + (U ? ` ${U}` : '');
    dimString = dimString.trim();
  }
  if (!dimString) throw new Error('dimensions is required');

  const item = {
    name: String(name).trim(),
    sku: finalSku,
    stock: qty,
    price: Number.isFinite(Number(price)) && Number(price) >= 0 ? Number(price) : 0,
    status: status ? String(status) : 'active',
    threshold: Number.isFinite(Number(threshold)) && Number(threshold) >= 0 ? Number(threshold) : 5,
    category: 'Packing Materials',
    description: description ? String(description) : '',
    dimensions: dimString,
    materials: [],
    packagingId: '',
    dateAdded: new Date().toISOString().split('T')[0]
  };

  const docRef = await createDocument('inventory', item);
  return { id: docRef.id, ...item };
}

// Create a new raw Material item
async function addMaterial({ name, stock, price, sku, threshold, status, description, unit }) {
  if (!name || !String(name).trim()) throw new Error('name is required');
  const qty = Number.parseInt(stock ?? 0, 10);
  if (!Number.isFinite(qty) || qty < 0) throw new Error('stock must be a non-negative integer');
  const all = await getAllDocuments('inventory', 1000);
  const base = (sku && String(sku).trim()) ? String(sku).trim().toUpperCase() : makeSkuFromName(name).replace(/^PKG-/, '');
  const finalSku = await uniqueSku(base, all);
  const item = {
    name: String(name).trim(),
    sku: finalSku,
    stock: qty,
    price: Number.isFinite(Number(price)) && Number(price) >= 0 ? Number(price) : 0,
    status: status ? String(status) : 'active',
    threshold: Number.isFinite(Number(threshold)) && Number(threshold) >= 0 ? Number(threshold) : 5,
    category: 'Materials',
    description: description ? String(description) : '',
    unit: unit ? String(unit) : undefined,
    materials: [],
    packagingId: '',
    dateAdded: new Date().toISOString().split('T')[0]
  };
  const docRef = await createDocument('inventory', item);
  return { id: docRef.id, ...item };
}

// Adjust inventory item stock by delta (can be negative). Clamps at 0.
async function adjustInventoryItemStock(id, delta) {
  const items = await getAllDocuments('inventory', 2000);
  const it = items.find(x => String(x.id) === String(id));
  if (!it) throw new Error('inventory item not found');
  const cur = Number.isFinite(Number(it.stock)) ? Number(it.stock) : 0;
  const next = Math.max(0, cur + Number(delta || 0));
  await updateDocument('inventory', id, { stock: next });
  return { id, from: cur, to: next };
}

// Apply order-based stock decrements for product and its packaging (if any)
async function applyOrderInventoryAdjustment(order) {
  if (!order) throw new Error('order is required');
  const items = await getAllDocuments('inventory', 2000);
  const name = String(order.product || '').toLowerCase();
  const product = items.find(x => String(x.name || '').toLowerCase() === name);
  const qty = Number.parseInt(order.quantity ?? 0, 10) || 0;
  const adjusted = [];
  if (product && qty > 0) {
    const res = await adjustInventoryItemStock(product.id, -qty);
    adjusted.push({ type: 'product', ...res });
    if (product.packagingId) {
      try {
        const resP = await adjustInventoryItemStock(product.packagingId, -qty);
        adjusted.push({ type: 'packaging', ...resP });
      } catch (e) {
        // ignore missing packaging item
      }
    }
  }
  return { adjusted };
}

module.exports = { initiateProductCreation, addPackingMaterial, addMaterial, adjustInventoryItemStock, applyOrderInventoryAdjustment };
 
// Generate low-stock alerts specifically for Packing Materials
// Returns { low: Array, out: Array, counts: { low, out, totalPacking } }
async function generatePackingLowStockAlerts({ defaultThreshold = 5 } = {}) {
  const items = await getAllDocuments('inventory', 1000);
  const packing = (items || []).filter(i => isPackingCat(i.category));
  const toNum = (v, d=0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const low = [];
  const out = [];
  for (const it of packing) {
    const stock = toNum(it.stock, 0);
    const threshold = toNum(it.threshold, defaultThreshold);
    if (stock <= 0) out.push({ id: it.id, name: it.name, sku: it.sku, stock, threshold, dimensions: it.dimensions });
    else if (stock <= threshold) low.push({ id: it.id, name: it.name, sku: it.sku, stock, threshold, dimensions: it.dimensions });
  }
  return { low, out, counts: { low: low.length, out: out.length, totalPacking: packing.length } };
}

module.exports.generatePackingLowStockAlerts = generatePackingLowStockAlerts;
