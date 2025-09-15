const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const handleAICoPilot = require('../easly/aiHandler');

// AI chat endpoint
router.post('/co-pilot', handleAICoPilot);

// Chat history endpoints
router.get('/history', (req, res) => {
  try {
    const clientId = String(req.query.clientId||'').trim();
    const limit = Math.max(1, Math.min(200, Number(req.query.limit||50)));
    const file = path.join(__dirname, '..', 'data', 'ai_history.json');
    const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')||'[]') : [];
    const items = clientId ? all.filter(e => e.clientId === clientId) : all;
    const slice = items.slice(-limit);
    res.json({ items: slice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/history', (req, res) => {
  try {
    const clientId = String(req.query.clientId||'').trim();
    const file = path.join(__dirname, '..', 'data', 'ai_history.json');
    const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')||'[]') : [];
    const kept = clientId ? all.filter(e => e.clientId !== clientId) : [];
    fs.writeFileSync(file, JSON.stringify(kept, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
