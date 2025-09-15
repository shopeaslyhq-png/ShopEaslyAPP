const express = require('express');
const router = express.Router();
const { getAllDocuments } = require('../config/firebase');

// Dashboard routes
router.get('/', async (req, res) => {
  try {
    // Get recent orders from local data store
    const orders = await getAllDocuments('orders', 10);

    // Calculate some basic stats
    const stats = {
      totalOrders: orders.length,
      pendingOrders: orders.filter(order => order.status === 'Pending').length,
      processingOrders: orders.filter(order => order.status === 'Processing').length,
      deliveredOrders: orders.filter(order => order.status === 'Delivered').length,
      storage: 'local'
    };

    res.render('dashboard', {
      orders: orders,
      stats: stats
    });
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    res.render('dashboard', {
      orders: [],
      stats: {
        totalOrders: 0,
        pendingOrders: 0,
        processingOrders: 0,
        deliveredOrders: 0,
        storage: 'local'
      },
      error: error.message
    });
  }
});

module.exports = router;
