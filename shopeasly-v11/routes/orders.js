const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Orders routes
router.get('/', (req, res) => {
  try {
    const orders = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/orders.json')));
    res.render('layout', {
      body: `
        <h1>Orders Management</h1>
        <div class="mb-3">
          <a href="/orders/new" class="btn btn-primary">Create New Order</a>
        </div>
        ${orders.length > 0 ? `
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">All Orders (${orders.length})</h3>
            </div>
            <div class="card-body">
              <table class="table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${orders.map(order => `
                    <tr>
                      <td>${order.id || 'N/A'}</td>
                      <td>${order.status || 'Pending'}</td>
                      <td>${order.date || new Date().toLocaleDateString()}</td>
                      <td>
                        <button class="btn btn-secondary btn-sm">View</button>
                        <button class="btn btn-primary btn-sm">Edit</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : `
          <div class="alert alert-info">
            <h4>No Orders Found</h4>
            <p>You haven't created any orders yet. Click "Create New Order" to get started!</p>
          </div>
        `}
      `
    });
  } catch (error) {
    console.error('Error reading orders:', error);
    res.render('layout', {
      body: `
        <h1>Orders Management</h1>
        <div class="alert alert-error">
          <h4>Error Loading Orders</h4>
          <p>There was an error loading the orders data. Please try again.</p>
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

module.exports = router;
