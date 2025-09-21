// Quick smoke test for order creation logic
// Usage: node scripts/smoke-create-order.js
const { getAllDocuments, createDocument, deleteDocument } = require('../config/firebase');
const { generateOrderNumber } = require('../utils/orderNumber');

(async () => {
  try {
    const inventory = await getAllDocuments('inventory', 100);
    if (!inventory.length) throw new Error('No inventory items found. Add a product first.');
    // Pick the first non-material, non-packing product
    const product = inventory.find(i => !/^(materials|raw\s*materials?)$/i.test(i.category||'') && !/^packing\s*materials?$/i.test(i.category||''));
    if (!product) throw new Error('No finished product found.');

    const orderNumber = await generateOrderNumber();
    const nowIso = new Date().toISOString();
    const order = {
      customerName: 'Smoke Test Customer',
      product: String(product.name),
      productId: product.id,
      productName: String(product.name),
      productSku: product.sku || null,
      quantity: 2,
      price: Number.isFinite(Number(product.price)) ? Number(product.price) : null,
      status: 'Pending',
      notes: 'Automated smoke test order',
      date: nowIso.split('T')[0],
      createdAt: nowIso,
      orderNumber
    };
    const docRef = await createDocument('orders', order);
    console.log('Created order:', { id: docRef.id, orderNumber, product: order.product, qty: order.quantity });
    // Clean up so smoke test is idempotent
    await deleteDocument('orders', docRef.id);
    console.log('Deleted test order:', docRef.id);
  } catch (e) {
    console.error('Smoke test failed:', e.message);
    process.exit(1);
  }
})();
