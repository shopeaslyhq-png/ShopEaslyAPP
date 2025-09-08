const express = require('express');
const router = express.Router();
const handleAICoPilot = require('../easly/aiHandler');

// Easly AI routes placeholder
router.post('/co-pilot', handleAICoPilot);

module.exports = router;
