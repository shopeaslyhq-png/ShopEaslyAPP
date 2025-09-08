const express = require('express');
const router = express.Router();
const handleAICoPilot = require('../easly/aiHandler');

// Easly AI routes
router.get('/', (req, res) => {
    res.send('Easly AI route - Welcome to AI features');
});

router.post('/co-pilot', handleAICoPilot);

module.exports = router;
