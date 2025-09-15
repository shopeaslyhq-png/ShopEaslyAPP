const express = require('express');
const router = express.Router();
const { collections, createDocument, getAllDocuments, updateDocument, deleteDocument } = require('../config/firebase');

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

router.get('/new', (req, res) => {
  res.render('layout', {
    body: `
      <h1>Create New Order</h1>
      <div class="card">
        <div class="card-body">
          <form method="POST" action="/orders">
            <div class="form-group">
              <label class="form-label">Customer Name</label>
              <input type="text" name="customerName" class="form-input" required>
            </div>
            <div class="form-group">
              <label class="form-label">Product</label>
              <input type="text" name="product" class="form-input" required>
            </div>
            <div class="form-group">
              <label class="form-label">Quantity</label>
              <input type="number" name="quantity" class="form-input" required>
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              <select name="status" class="form-input">
                <option value="Pending">Pending</option>
                <option value="Processing">Processing</option>
                <option value="Shipped">Shipped</option>
                <option value="Delivered">Delivered</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Price ($)</label>
              <input type="number" name="price" class="form-input" min="0" step="0.01">
            </div>
            <div class="form-group">
              <label class="form-label">Notes (Optional)</label>
              <textarea name="notes" class="form-input" rows="3"></textarea>
            </div>
            <div class="mt-3">
              <button type="submit" class="btn btn-primary">Create Order</button>
              <a href="/orders" class="btn btn-secondary">Cancel</a>
            </div>
          </form>
        </div>
      </div>
    `
  });
});

// Orders API backed by local JSON data store


// Create new order in local store
router.post('/', async (req, res) => {
  try {
    const { customerName, product, quantity, price, status, notes } = req.body;

    if (!customerName || !product || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const orderData = {
      customerName: customerName.trim(),
      product: product.trim(),
      quantity: parseInt(quantity),

      price: price ? parseFloat(price) : null,
      status: status || 'Pending',
      notes: notes ? notes.trim() : '',
      date: new Date().toISOString().split('T')[0],
      orderNumber: `ORD-${Date.now()}`,
    };

    const docRef = await createDocument('orders', orderData);
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
router.put('/:id', async (req, res) => {
  try {
    const { errors, data } = validateOrderPayload(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ errors });

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    await updateDocument('orders', req.params.id, data);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: error.message });
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
        } else if (action === 'mark-processing') {
          await updateDocument('orders', id, { status: 'Processing' });
        } else if (action === 'mark-shipped') {
          await updateDocument('orders', id, { status: 'Shipped' });
        } else if (action === 'mark-delivered') {
          await updateDocument('orders', id, { status: 'Delivered' });
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
