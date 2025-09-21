const express = require('express');
const router = express.Router();
const { createDocument, updateDocument, deleteDocument, getAllDocuments } = require('../config/firebase');
const { initiateProductCreation, addPackingMaterial, generatePackingLowStockAlerts } = require('../utils/inventoryService');
const { getInventoryUsageReport } = require('../utils/usageReport');
const fs = require('fs');
const path = require('path');

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
      // Relationships for products
      materials: Array.isArray(b.materials) ? b.materials.map(String) : [], // array of material IDs
      packagingId: b.packagingId ? String(b.packagingId) : '',
      dateAdded: new Date().toISOString().split('T')[0]
    };
    const docRef = await createDocument('inventory', item);
    res.json({ id: docRef.id, ...item });
  } catch (err) {
    console.error('Error creating inventory item:', err);
    res.status(500).json({ error: err.message });
  }
});

// Initiate product creation with validation of materials/packaging
router.post('/api/initiate-product', async (req, res) => {
  try {
    const { name, price, quantity, materialsIds, materialsUsage, packagingId, category, sku } = req.body || {};
    const created = await initiateProductCreation({ name, price, quantity, materialsIds, materialsUsage, packagingId, category, sku });
    res.json(created);
  } catch (err) {
    console.error('Error initiating product creation:', err);
    res.status(400).json({ error: err.message });
  }
});

// Create a new Packing Material
router.post('/api/packing', async (req, res) => {
  try {
    const { name, dimensions, stock, sku, price, threshold, status, description } = req.body || {};
    const created = await addPackingMaterial({ name, dimensions, stock, sku, price, threshold, status, description });
    res.json(created);
  } catch (err) {
    console.error('Error creating packing material:', err);
    res.status(400).json({ error: err.message });
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
    if (b.materials !== undefined) patch.materials = Array.isArray(b.materials) ? b.materials.map(String) : [];
    if (b.packagingId !== undefined) patch.packagingId = b.packagingId ? String(b.packagingId) : '';
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

// --- Image Attachments & Links ---
router.post('/api/:id/image', async (req, res) => {
  try {
    const id = req.params.id;
    const { imageBase64, imageUrl } = req.body || {};
    let storedUrl = null;
    if (imageBase64) {
      const dir = path.join(__dirname, '..', 'public', 'images', 'inventory');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filename = `inv-${id}-${Date.now()}.png`;
      const data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(path.join(dir, filename), Buffer.from(data, 'base64'));
      storedUrl = `/images/inventory/${filename}`;
    } else if (imageUrl) {
      storedUrl = imageUrl;
    } else {
      return res.status(400).json({ error: 'Provide imageBase64 or imageUrl' });
    }
    await updateDocument('inventory', id, { imageUrl: storedUrl });
    res.json({ ok: true, imageUrl: storedUrl });
  } catch (err) {
    console.error('Error attaching image:', err);
    res.status(500).json({ error: err.message });
  }
});

// General image upload (pre-product) -> returns public URL for use in wizards
router.post('/api/images/upload', async (req, res) => {
  try {
    const { imageBase64 } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });
    const dir = path.join(__dirname, '..', 'public', 'images', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const b64 = String(imageBase64).startsWith('data:') ? String(imageBase64).split(',')[1] : String(imageBase64);
    const filename = `upload-${Date.now()}.png`;
    fs.writeFileSync(path.join(dir, filename), Buffer.from(b64, 'base64'));
    const imageUrl = `/images/uploads/${filename}`;
    res.json({ ok: true, imageUrl });
  } catch (err) {
    console.error('Error uploading image:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/:id/ninjatransfer', async (req, res) => {
  try {
    const id = req.params.id;
    const { link } = req.body || {};
    if (!link) return res.status(400).json({ error: 'link is required' });
    await updateDocument('inventory', id, { ninjatransferLink: link });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error setting NinjaTransfer link:', err);
    res.status(500).json({ error: err.message });
  }
});

// Packing Materials low-stock alerts
router.get('/api/packing/alerts', async (req, res) => {
  try {
    const defaultThreshold = req.query.threshold ? Number(req.query.threshold) : undefined;
    const alerts = await generatePackingLowStockAlerts({ defaultThreshold });
    res.json(alerts);
  } catch (err) {
    console.error('Error generating packing low-stock alerts:', err);
    res.status(500).json({ error: err.message });
  }
});

// Inventory usage report for a date range
router.get('/api/usage', async (req, res) => {
  try {
    const { start, end } = req.query || {};
    if (!start || !end) return res.status(400).json({ error: 'start and end are required (YYYY-MM-DD)' });
    const report = await getInventoryUsageReport({ start, end });
    res.json(report);
  } catch (err) {
    console.error('Error generating usage report:', err);
    res.status(400).json({ error: err.message });
  }
});
