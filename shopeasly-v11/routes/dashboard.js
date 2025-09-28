const express = require('express');
const router = express.Router();
const { getAllDocuments } = require('../config/firebase');
const { getDashboardSummary } = require('../utils/dashboardSummary');

// Dashboard routes
router.get('/', async (req, res) => {
  try {
    // Compute dashboard summary
    const summary = await getDashboardSummary({ recentOrdersLimit: 10 });

    // Maintain existing vars for backward compat in the view
    const orders = summary.orders.recent;
    const stats = {
      totalOrders: summary.orders.total,
      pendingOrders: summary.orders.byStatus.Pending || 0,
      processingOrders: summary.orders.byStatus.Processing || 0,
      deliveredOrders: summary.orders.byStatus.Delivered || 0,
      storage: summary.storage,
      inventory: {
        totalSkus: summary.inventory.totalSkus,
        lowStockCount: summary.inventory.lowStockCount,
        outOfStockCount: summary.inventory.outOfStockCount,
      }
    };

    res.render('dashboard', {
      orders,
      stats,
      summary
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
        storage: 'local',
        inventory: { totalSkus: 0, lowStockCount: 0, outOfStockCount: 0 }
      },
      summary: {
        storage: 'local',
        orders: { total: 0, byStatus: {}, recent: [] },
        inventory: { totalSkus: 0, lowStockCount: 0, outOfStockCount: 0, lowStockItems: [], outOfStockItems: [] },
        notifications: []
      },
      error: error.message
    });
  }
});

module.exports = router;
