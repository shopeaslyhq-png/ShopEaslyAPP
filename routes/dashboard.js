const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

router.get('/', (req, res) => {
  const orders = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/orders.json')));
  const orderList = orders.map(order => `<tr><td>${order.id}</td><td>${order.item}</td><td>${order.quantity}</td><td>${order.price}</td></tr>`).join('');
  const createOrderButton = `<div style='margin-bottom:20px;'><a href="/orders/new" class="btn btn-primary">Create Order</a></div>`;
  res.render('layout', { body: `<h1>Dashboard</h1>${createOrderButton}<table class='dashboard-table'><thead><tr><th>ID</th><th>Item</th><th>Quantity</th><th>Price</th></tr></thead><tbody>${orderList}</tbody></table>` });
});

module.exports = router;
