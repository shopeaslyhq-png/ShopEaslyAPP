const express = require('express');
const router = express.Router();
const handleAICoPilot = require('../easly/aiHandler');

// Easly AI routes
router.get('/', (req, res) => {
    res.render('easly');
});

router.post('/co-pilot', handleAICoPilot);

module.exports = router;
