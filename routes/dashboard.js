const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

router.get('/', (req, res) => {
  const orders = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/orders.json')));
  res.render('layout', { body: `<h1>Dashboard</h1><pre>${JSON.stringify(orders, null, 2)}</pre>` });
});

module.exports = router;
