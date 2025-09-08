const express = require('express');
const router = express.Router();
const { collections, createDocument, getAllDocuments } = require('../config/firebase');

// Orders routes
router.get('/', async (req, res) => {
  try {
    // Get orders from Firestore
    const orders = await getAllDocuments('orders', 50);

    res.render('layout', {
      body: `
        <h1>Orders Management</h1>
        <div class="mb-3">
          <a href="/orders/new" class="btn btn-primary">Create New Order</a>
          <button onclick="location.reload()" class="btn btn-secondary">Refresh</button>
        </div>
        ${orders.length > 0 ? `
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">All Orders (${orders.length}) - From Firestore</h3>
            </div>
            <div class="card-body">
              <table class="table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${orders.map(order => `
                    <tr>
                      <td>${order.id.substring(0, 8)}...</td>
                      <td>${order.customerName || 'N/A'}</td>
                      <td>${order.product || 'N/A'}</td>
                      <td>${order.quantity || 'N/A'}</td>
                      <td><span class="badge ${order.status === 'Delivered' ? 'bg-success' : order.status === 'Processing' ? 'bg-warning' : 'bg-secondary'}">${order.status || 'Pending'}</span></td>
                      <td>${order.date || (order.createdAt ? new Date(order.createdAt._seconds * 1000).toLocaleDateString() : 'N/A')}</td>
                      <td>
                        <button class="btn btn-secondary btn-sm" onclick="viewOrder('${order.id}')">View</button>
                        <button class="btn btn-primary btn-sm" onclick="editOrder('${order.id}')">Edit</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : `
          <div class="alert alert-info">
            <h4>No Orders Found in Firestore</h4>
            <p>You haven't created any orders yet. Click "Create New Order" to get started!</p>
            <p><small>Connected to Firestore project: shopeasly-talk-sos-37743</small></p>
          </div>
        `}

        <script>
          function viewOrder(orderId) {
            alert('View order: ' + orderId);
            // TODO: Implement order view functionality
          }

          function editOrder(orderId) {
            alert('Edit order: ' + orderId);
            // TODO: Implement order edit functionality
          }
        </script>
      `
    });
  } catch (error) {
    console.error('Error loading orders from Firestore:', error);
    res.render('layout', {
      body: `
        <h1>Orders Management</h1>
        <div class="alert alert-error">
          <h4>Error Loading Orders from Firestore</h4>
          <p>There was an error connecting to Firestore. Please check your configuration.</p>
          <p><strong>Error:</strong> ${error.message}</p>
          <p><small>Project: shopeasly-talk-sos-37743</small></p>
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
              <button type="submit" class="btn btn-primary">Create Order in Firestore</button>
              <a href="/orders" class="btn btn-secondary">Cancel</a>
            </div>
          </form>
        </div>
      </div>
    `
  });
});

router.post('/', (req, res) => {
  try {
    const orders = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/orders.json')));
    const newOrder = {
      id: Date.now().toString(),
      customerName: req.body.customerName,
      product: req.body.product,
      quantity: parseInt(req.body.quantity),
      status: req.body.status,
      date: new Date().toISOString().split('T')[0]
    };

    orders.push(newOrder);
    fs.writeFileSync(path.join(__dirname, '../data/orders.json'), JSON.stringify(orders, null, 2));

    res.redirect('/orders');
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).render('layout', {
      body: `
        <h1>Error</h1>
        <div class="alert alert-error">
          <p>There was an error creating the order. Please try again.</p>
        </div>
        <a href="/orders" class="btn btn-primary">Back to Orders</a>
      `
    });
  }
});

// POST route to create new order in Firestore
router.post('/', async (req, res) => {
  try {
    const { customerName, product, quantity, price, status, notes } = req.body;

    // Validate required fields
    if (!customerName || !product || !quantity) {
      return res.render('layout', {
        body: `
          <h1>Create New Order</h1>
          <div class="alert alert-error">
            <h4>Validation Error</h4>
            <p>Please fill in all required fields: Customer Name, Product, and Quantity.</p>
          </div>
          <a href="/orders/new" class="btn btn-primary">Try Again</a>
        `
      });
    }

    // Create order object
    const orderData = {
      customerName: customerName.trim(),
      product: product.trim(),
      quantity: parseInt(quantity),
      price: price ? parseFloat(price) : null,
      status: status || 'Pending',
      notes: notes ? notes.trim() : '',
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      orderNumber: `ORD-${Date.now()}`, // Simple order number generation
    };

    // Save to Firestore
    const docRef = await createDocument('orders', orderData);

    res.render('layout', {
      body: `
        <h1>Order Created Successfully!</h1>
        <div class="alert alert-success">
          <h4>✅ Order Created in Firestore</h4>
          <p><strong>Order ID:</strong> ${docRef.id}</p>
          <p><strong>Customer:</strong> ${orderData.customerName}</p>
          <p><strong>Product:</strong> ${orderData.product}</p>
          <p><strong>Quantity:</strong> ${orderData.quantity}</p>
          <p><strong>Status:</strong> ${orderData.status}</p>
          ${orderData.price ? `<p><strong>Price:</strong> $${orderData.price}</p>` : ''}
          ${orderData.notes ? `<p><strong>Notes:</strong> ${orderData.notes}</p>` : ''}
        </div>
        <div class="mt-3">
          <a href="/orders" class="btn btn-primary">View All Orders</a>
          <a href="/orders/new" class="btn btn-secondary">Create Another Order</a>
          <a href="/" class="btn btn-outline">Back to Dashboard</a>
        </div>
      `
    });

  } catch (error) {
    console.error('Error creating order in Firestore:', error);
    res.render('layout', {
      body: `
        <h1>Error Creating Order</h1>
        <div class="alert alert-error">
          <h4>❌ Failed to Create Order</h4>
          <p>There was an error saving the order to Firestore.</p>
          <p><strong>Error:</strong> ${error.message}</p>
        </div>
        <div class="mt-3">
          <a href="/orders/new" class="btn btn-primary">Try Again</a>
          <a href="/orders" class="btn btn-secondary">Back to Orders</a>
        </div>
      `
    });
  }
});

module.exports = router;
