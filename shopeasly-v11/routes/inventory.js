const express = require('express');
const router = express.Router();
const { createDocument, updateDocument, deleteDocument, getAllDocuments } = require('../config/firebase');

// Inventory page
router.get('/', async (req, res) => {
  try {
    res.render('inventory');
  } catch (err) {
    console.error('Error rendering inventory:', err);
    res.status(500).render('inventory', { error: err.message });
  }
});

// --- JSON API for Inventory (local JSON-backed via config/firebase) ---
router.get('/api', async (req, res) => {
  try {
    const items = await getAllDocuments('inventory', 500);
    res.json(items);
  } catch (err) {
    console.error('Error loading inventory:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name || !b.sku) return res.status(400).json({ error: 'name and sku are required' });
    const item = {
      name: String(b.name).trim(),
      sku: String(b.sku).trim().toUpperCase(),
      stock: Number.isFinite(Number(b.stock)) ? Number(b.stock) : 0,
      price: Number.isFinite(Number(b.price)) ? Number(b.price) : 0,
      status: b.status || 'active',
      threshold: Number.isFinite(Number(b.threshold)) ? Number(b.threshold) : 0,
      category: b.category ? String(b.category).trim() : '',
      description: b.description ? String(b.description).trim() : '',
      dateAdded: new Date().toISOString().split('T')[0]
    };
    const docRef = await createDocument('inventory', item);
    res.json({ id: docRef.id, ...item });
  } catch (err) {
    console.error('Error creating inventory item:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const b = req.body || {};
    const patch = {};
    ['name','sku','status','category','description'].forEach(k => {
      if (b[k] !== undefined) patch[k] = typeof b[k] === 'string' ? String(b[k]).trim() : b[k];
    });
    if (b.stock !== undefined) patch.stock = Number(b.stock);
    if (b.price !== undefined) patch.price = Number(b.price);
    if (b.threshold !== undefined) patch.threshold = Number(b.threshold);
    await updateDocument('inventory', id, patch);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error updating inventory item:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await deleteDocument('inventory', id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting inventory item:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
