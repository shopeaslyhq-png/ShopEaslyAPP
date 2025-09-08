const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Dashboard routes
router.get('/', (req, res) => {
  try {
    const orders = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/orders.json')));
    res.render('dashboard', { orders: orders });
  } catch (error) {
    console.error('Error reading orders:', error);
    res.render('dashboard', { orders: [] });
  }
});

module.exports = router;
