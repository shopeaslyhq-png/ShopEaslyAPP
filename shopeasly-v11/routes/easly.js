const express = require('express');
const router = express.Router();
// Use enhanced AI handler to support direct actions (orders/inventory)
const handleAICoPilot = require('../easly/aiHandlerEnhanced');

// Easly AI routes
router.get('/', (req, res) => {
    res.render('easly');
});

router.post('/co-pilot', handleAICoPilot);

module.exports = router;
