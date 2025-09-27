const express = require('express');
const router = express.Router();
const { collections, createDocument, getAllDocuments, updateDocument, deleteDocument } = require('../config/firebase');
const { emitEvent } = require('../utils/securityMiddleware');
const { generateOrderNumber } = require('../utils/orderNumber');

// Helpers to classify inventory categories
function isMaterialsCat(c) { return /^(materials|raw\s*materials?)$/i.test(String(c||'')); }
function isPackingCat(c) { return /^packing\s*materials?$/i.test(String(c||'')); }

// Basic validation helper
function validateOrderPayload(body, { partial = false } = {}) {
  const errors = [];
  const data = {};

  const setIfPresent = (key, transform = v => v) => {
    if (body[key] !== undefined && body[key] !== null && body[key] !== '') {
      data[key] = transform(body[key]);
    }
  };

  // Required fields on create (not on partial update)
  if (!partial) {
    if (!body.customerName) errors.push('customerName is required');
    if (!body.product) errors.push('product is required');
    if (body.quantity === undefined || body.quantity === null || body.quantity === '') errors.push('quantity is required');
  }

  setIfPresent('customerName', v => String(v).trim());
  setIfPresent('product', v => String(v).trim());
  setIfPresent('quantity', v => Number.parseInt(v, 10));
  setIfPresent('price', v => (v === '' || v === null ? null : Number.parseFloat(v)));
  setIfPresent('status', v => String(v));
  setIfPresent('notes', v => String(v).trim());

  if (data.quantity !== undefined && (Number.isNaN(data.quantity) || data.quantity < 0)) {
    errors.push('quantity must be a non-negative integer');
  }
  if (data.price !== undefined && data.price !== null && (Number.isNaN(data.price) || data.price < 0)) {
    errors.push('price must be a non-negative number');
  }
  if (data.status !== undefined && !['Pending','Processing','Shipped','Delivered'].includes(data.status)) {
    errors.push('status must be one of Pending, Processing, Shipped, Delivered');
  }

  return { errors, data };
}

// Orders routes
router.get('/', async (req, res) => {
  try {
    const orders = await getAllDocuments('orders', 200);
    res.render('orders', { orders });
  } catch (error) {
    console.error('Error loading orders from data store:', error);
    res.status(500).render('layout', {
      body: `
        <h1>Orders Management</h1>
        <div class="alert alert-error">
          <h4>Error Loading Orders</h4>
          <p>There was an error accessing the local data store. Please check your configuration.</p>
          <p><strong>Error:</strong> ${error.message}</p>
        </div>
        <div class="mt-3">
          <a href="/" class="btn btn-primary">Back to Dashboard</a>
        </div>
      `
    });
  }
});

// JSON list of orders for programmatic access
router.get('/api', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(2000, Number(req.query.limit || 500)));
    const items = await getAllDocuments('orders', limit);
    res.json(items);
  } catch (error) {
    console.error('Error loading orders list:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/new', (req, res) => {
  // Render create order page to match the modal
  res.render('layout', {
    body: `
      <h1>Create New Order</h1>
      <div class="card">
        <div class="card-body">
          <form method="POST" action="/orders" id="orderForm" autocomplete="off">
            <div class="form-row">
              <div class="form-group">
                <label>Customer Name *</label>
                <input type="text" name="customerName" class="form-input" required>
              </div>
              <div class="form-group">
                <label>Order Number</label>
                <input type="text" name="orderNumber" class="form-input" placeholder="Auto-generated">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Product *</label>
                <select name="product" class="form-input" id="productSelect" required>
                  <option value="">— Select product —</option>
                </select>
              </div>
              <div class="form-group">
                <label>Quantity *</label>
                <input type="number" name="quantity" id="quantityInput" class="form-input" min="1" value="1" required>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Price ($)</label>
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                  <span><strong>Unit:</strong> $<span id="unit-price-value">0.00</span></span>
                  <span><strong>Total:</strong> $<span id="price-value">0.00</span></span>
                  <button type="button" class="btn btn-secondary" id="update-price-btn">Update Price</button>
                  <!-- Backend expects 'price' to be unit price -->
                  <input type="hidden" name="price" id="hidden-price-input" value="0.00" />
                  <!-- Also send total for reference (server will compute too) -->
                  <input type="hidden" name="total" id="hidden-total-input" value="0.00" />
                </div>
              </div>
              <div class="form-group">
                <label>Status</label>
                <select name="status" class="form-input">
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Delivered">Delivered</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Notes</label>
              <textarea name="notes" class="form-input" rows="3" placeholder="Optional notes about this order..."></textarea>
            </div>
            <div class="form-actions">
              <a href="/orders" class="btn btn-secondary">Cancel</a>
              <button type="submit" class="btn btn-primary">Create Order</button>
            </div>
          </form>
        </div>
      </div>
      <script>
      // JS to populate product select and handle price display, matching modal
      document.addEventListener('DOMContentLoaded', function() {
        var products = window.products || [];
        var select = document.getElementById('productSelect');
        var qtyInput = document.getElementById('quantityInput');
        var unitPriceSpan = document.getElementById('unit-price-value');
        var totalPriceSpan = document.getElementById('price-value');
        var hiddenUnitPrice = document.getElementById('hidden-price-input');
        var hiddenTotalPrice = document.getElementById('hidden-total-input');
        var unitPrice = 0.0;
        if (select && products.length) {
          products.forEach(function(p) {
            var opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name + ' - $' + Number(p.price).toFixed(2);
            opt.setAttribute('data-price', p.price);
            select.appendChild(opt);
          });
        }
        function recalc() {
          var qty = qtyInput ? parseInt(qtyInput.value || '1', 10) : 1;
          if (!Number.isFinite(qty) || qty < 1) qty = 1;
          var total = (Number(unitPrice) || 0) * qty;
          if (unitPriceSpan) unitPriceSpan.textContent = (Number(unitPrice) || 0).toFixed(2);
          if (totalPriceSpan) totalPriceSpan.textContent = total.toFixed(2);
          if (hiddenUnitPrice) hiddenUnitPrice.value = (Number(unitPrice) || 0).toFixed(2);
          if (hiddenTotalPrice) hiddenTotalPrice.value = total.toFixed(2);
        }
        function updateUnitPriceFromSelection() {
          if (!select) return;
          var selectedOption = select.options[select.selectedIndex];
          var p = selectedOption ? (selectedOption.getAttribute('data-price') || '0.00') : '0.00';
          unitPrice = parseFloat(p) || 0;
          recalc();
        }
        function showUpdatePricePrompt() {
          var current = unitPriceSpan ? unitPriceSpan.textContent : (unitPrice.toFixed(2));
          var newPrice = prompt('Enter new UNIT price for this product:', current);
          if (newPrice !== null && !isNaN(parseFloat(newPrice))) {
            unitPrice = parseFloat(newPrice);
            recalc();
          }
        }
        if (select) {
          select.addEventListener('change', updateUnitPriceFromSelection);
          updateUnitPriceFromSelection();
        }
        var updatePriceBtn = document.getElementById('update-price-btn');
        if (updatePriceBtn) {
          updatePriceBtn.addEventListener('click', showUpdatePricePrompt);
        }
        // Sync price before submit
        var orderForm = document.getElementById('orderForm');
        if (orderForm) {
          orderForm.addEventListener('submit', function() {
            recalc();
          });
        }
        if (qtyInput) qtyInput.addEventListener('input', recalc);
      });
      </script>
    `
  });
});

// Orders API backed by local JSON data store


// Create new order in local store
router.post('/', async (req, res) => {
  try {
    const { customerName, product, productId, productSku, quantity, price, status, notes } = req.body || {};

    if (!customerName || (!product && !productId && !productSku) || quantity === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const qty = Number.parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      return res.status(400).json({ error: 'quantity must be an integer >= 1' });
    }

    // Resolve product by ID, SKU, or Name (case-insensitive)
    const inventoryItems = await getAllDocuments('inventory', 2000);
    const byId = new Map(inventoryItems.map(i => [String(i.id), i]));
    const bySku = new Map(inventoryItems.filter(i => i.sku).map(i => [String(i.sku).toUpperCase(), i]));
    const byName = new Map(inventoryItems.filter(i => i.name).map(i => [String(i.name).toLowerCase(), i]));

    const productInput = product != null ? String(product).trim() : '';
    let invMatch = null;
    if (productId && byId.has(String(productId))) invMatch = byId.get(String(productId));
    if (!invMatch && productSku && bySku.has(String(productSku).toUpperCase())) invMatch = bySku.get(String(productSku).toUpperCase());
    if (!invMatch && productInput) {
      // Try id → SKU → exact name
      if (byId.has(productInput)) invMatch = byId.get(productInput);
      else if (bySku.has(productInput.toUpperCase())) invMatch = bySku.get(productInput.toUpperCase());
      else if (byName.has(productInput.toLowerCase())) invMatch = byName.get(productInput.toLowerCase());
    }

    if (!invMatch) {
      return res.status(400).json({ error: 'Selected product not found in inventory' });
    }
    if (isMaterialsCat(invMatch.category) || isPackingCat(invMatch.category)) {
      return res.status(400).json({ error: 'Only finished Products can be ordered (not Materials or Packing Materials)' });
    }

    const orderNumber = await generateOrderNumber();
    const unitPrice = price !== undefined && price !== null && String(price) !== ''
      ? Number.parseFloat(price)
      : (Number.isFinite(Number(invMatch.price)) ? Number(invMatch.price) : null);

    const nowIso = new Date().toISOString();
    const orderData = {
      customerName: String(customerName).trim(),
      // Keep original product field as name for backward-compatibility
      product: String(invMatch.name || '').trim(),
      // New explicit fields for robustness
      productId: invMatch.id,
      productName: String(invMatch.name || '').trim(),
      productSku: invMatch.sku || null,
      quantity: qty,
      price: unitPrice,
      total: unitPrice != null ? Number((unitPrice * qty).toFixed(2)) : null,
      status: status || 'Pending',
      notes: notes ? String(notes).trim() : '',
      date: nowIso.split('T')[0],
      createdAt: nowIso,
      orderNumber,
    };

  const docRef = await createDocument('orders', orderData);
  try { emitEvent('order.created', { id: docRef.id, orderNumber, customerName: orderData.customerName, total: orderData.total, status: orderData.status }); } catch(_) {}
  res.json({ id: docRef.id, ...orderData });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update order status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Missing status' });
  await updateDocument('orders', req.params.id, { status });
  try { emitEvent('order.updated', { id: req.params.id, status }); } catch(_) {}
    res.json({ ok: true });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete order
router.delete('/:id', async (req, res) => {
  try {
    await deleteDocument('orders', req.params.id);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: error.message });
  }
});

// Edit/Update order
const { editOrder } = require('../utils/ordersService');
router.put('/:id', async (req, res) => {
  try {
    const applied = await editOrder(req.params.id, req.body || {});
    res.json({ ok: true, applied });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(400).json({ error: error.message });
  }
});

// Bulk actions on orders
router.post('/bulk', async (req, res) => {
  try {
    const { action, ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No order IDs provided' });
    }
    const allowed = ['mark-processing','mark-shipped','mark-delivered','delete'];
    if (!allowed.includes(action)) {
      return res.status(400).json({ error: 'Invalid bulk action' });
    }

    let updated = 0;
    for (const id of ids) {
      try {
        if (action === 'delete') {
          await deleteDocument('orders', id);
          try { emitEvent('order.deleted', { id }); } catch(_) {}
        } else if (action === 'mark-processing') {
          await updateDocument('orders', id, { status: 'Processing' });
          try { emitEvent('order.updated', { id, status: 'Processing' }); } catch(_) {}
        } else if (action === 'mark-shipped') {
          await updateDocument('orders', id, { status: 'Shipped' });
          try { emitEvent('order.updated', { id, status: 'Shipped' }); } catch(_) {}
        } else if (action === 'mark-delivered') {
          await updateDocument('orders', id, { status: 'Delivered' });
          try { emitEvent('order.updated', { id, status: 'Delivered' }); } catch(_) {}
        }
        updated++;
      } catch (inner) {
        console.warn(`Bulk action failed for ${id}:`, inner.message);
      }
    }

    res.json({ ok: true, count: updated });
  } catch (error) {
    console.error('Error performing bulk action:', error);
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;
