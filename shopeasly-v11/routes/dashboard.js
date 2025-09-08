const express = require('express');
const router = express.Router();
const { getAllDocuments } = require('../config/firebase');

// Dashboard routes
router.get('/', async (req, res) => {
  try {
    // Get recent orders from Firestore
    const orders = await getAllDocuments('orders', 10);

    // Calculate some basic stats
    const stats = {
      totalOrders: orders.length,
      pendingOrders: orders.filter(order => order.status === 'Pending').length,
      processingOrders: orders.filter(order => order.status === 'Processing').length,
      deliveredOrders: orders.filter(order => order.status === 'Delivered').length,
      firestoreConnected: true
    };

    res.render('dashboard', {
      orders: orders,
      stats: stats,
      projectId: 'shopeasly-talk-sos-37743'
    });
  } catch (error) {
    console.error('Error connecting to Firestore:', error);
    res.render('dashboard', {
      orders: [],
      stats: {
        totalOrders: 0,
        pendingOrders: 0,
        processingOrders: 0,
        deliveredOrders: 0,
        firestoreConnected: false
      },
      projectId: 'shopeasly-talk-sos-37743',
      error: error.message
    });
  }
});

module.exports = router;
