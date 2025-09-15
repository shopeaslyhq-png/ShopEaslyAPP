const express = require('express');
const router = express.Router();
const { db, collections, createDocument, getDocument } = require('../config/firebase');
const speak = require('../easly/speak');

// --- Auth middleware: verify webhook secret ---
function verifyGoogleActionsAuth(req, res, next) {
  const headerSecret = req.headers['x-ga-webhook-secret'] || req.headers['x-google-actions-secret'];
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const expected = process.env.GOOGLE_ACTIONS_WEBHOOK_SECRET || process.env.GA_WEBHOOK_SECRET;
  if (!expected) {
    console.warn('Google Actions webhook secret not set. Set GOOGLE_ACTIONS_WEBHOOK_SECRET in .env');
  }
  if (expected && (headerSecret === expected || bearer === expected)) return next();
  if (!expected) return next(); // allow if not configured to avoid blocking local dev
  return res.status(401).json(speak.buildGoogleAssistantError('Unauthorized Google Actions request'));
}

router.get('/health', (req, res) => res.json({ ok: true }));

router.post('/', verifyGoogleActionsAuth, async (req, res) => {
  try {
    const { intent, params, text, queryResult } = normalizeIncoming(req.body);

    switch (intent) {
      case 'AddInventoryItem': {
        const { name, quantity, sku, price } = parseAddInventory(params, text);
        if (!name || quantity == null) {
          return res.json(speak.buildGoogleAssistantResponse(
            'I need an item name and quantity to add to inventory. For example: add 50 premium t-shirts.'
          ));
        }
        const item = {
          name,
          sku: sku || generateSku(name),
          stock: quantity,
          price: price ?? null,
          status: 'Active',
          dateAdded: new Date().toISOString().split('T')[0]
        };
        const docRef = await createDocument('inventory', item);
        return res.json(speak.buildGoogleAssistantResponse(
          `Added ${quantity} ${name} to inventory. SKU ${item.sku}.`
        ));
      }

      case 'CheckStockLevel': {
        const { sku, name } = parseCheckStock(params, text);
        if (!sku && !name) {
          return res.json(speak.buildGoogleAssistantResponse(
            'Tell me the SKU or product name, for example: what\'s the stock level for SKU-123?'
          ));
        }
        const record = await findInventoryRecord({ sku, name });
        if (!record) {
          return res.json(speak.buildGoogleAssistantResponse(
            sku ? `I couldn\'t find inventory for ${sku}.` : `I couldn\'t find inventory for ${name}.`
          ));
        }
        return res.json(speak.buildGoogleAssistantResponse(
          `${record.name} (SKU ${record.sku}) has ${record.stock ?? 0} units in stock.`
        ));
      }

      case 'CreateOrder': {
        const { customerName, product, quantity, price } = parseCreateOrder(params, text);
        if (!customerName) {
          return res.json(speak.buildGoogleAssistantResponse(
            'Please provide a customer name. For example: create an order for John Smith.'
          ));
        }
        const order = {
          customerName,
          product: product || 'Custom Item',
          quantity: quantity ?? 1,
          price: price ?? null,
          status: 'Pending',
          date: new Date().toISOString().split('T')[0],
          orderNumber: `ORD-${Date.now()}`,
        };
        const docRef = await createDocument('orders', order);
        return res.json(speak.buildGoogleAssistantResponse(
          `Created order ${order.orderNumber} for ${customerName}${product ? `: ${product}` : ''}.`
        ));
      }

      case 'CheckOrderStatus': {
        const { orderNumber } = parseCheckOrder(params, text);
        if (!orderNumber) {
          return res.json(speak.buildGoogleAssistantResponse(
            'Please provide the order number. For example: what\'s the status of order ORD-12345?'
          ));
        }
        const snapshot = await collections.orders().where('orderNumber', '==', orderNumber).limit(1).get();
        if (snapshot.empty) {
          return res.json(speak.buildGoogleAssistantResponse(
            `I couldn\'t find order ${orderNumber}.`
          ));
        }
        const doc = snapshot.docs[0];
        const data = doc.data() || {};
        return res.json(speak.buildGoogleAssistantResponse(
          `Order ${orderNumber} for ${data.customerName || 'unknown customer'} is ${data.status || 'Pending'}.`
        ));
      }

      default:
        return res.json(speak.buildGoogleAssistantResponse(
          'I\'m not sure how to help with that yet. Try asking to add inventory, check stock, create an order, or check order status.'
        ));
    }
  } catch (err) {
    console.error('Google Actions webhook error:', err);
    return res.status(500).json(speak.buildGoogleAssistantError('Something went wrong handling your request'));
  }
});

// --- Helpers ---
function normalizeIncoming(body) {
  // Support Dialogflow v2 and a simple custom schema
  if (body && body.queryResult) {
    const q = body.queryResult;
    return {
      intent: q.intent?.displayName || 'Unknown',
      params: q.parameters || {},
      text: q.queryText || ''
    };
  }
  return {
    intent: body.intent || 'Unknown',
    params: body.params || body.parameters || {},
    text: body.text || body.query || ''
  };
}

function parseAddInventory(params, text) {
  let name = (params.name || params.product || '').toString().trim();
  let quantity = toInt(params.quantity);
  let sku = (params.sku || '').toString().trim();
  let price = params.price != null ? Number(params.price) : undefined;
  if (!quantity) {
    const m = String(text).match(/\b(add|stock|plus)\s+(\d{1,6})\b/i);
    if (m) quantity = parseInt(m[2], 10);
  }
  if (!name) {
    const n = String(text).replace(/hey google|add|to inventory|stock|\d+/gi, '').trim();
    if (n) name = n;
  }
  if (!sku) {
    const s = String(text).match(/sku[-\s:]?([\w-]+)/i);
    if (s) sku = s[1].toUpperCase();
  }
  return { name, quantity, sku, price };
}

function parseCheckStock(params, text) {
  let sku = (params.sku || '').toString().trim();
  let name = (params.name || params.product || '').toString().trim();
  if (!sku) {
    const s = String(text).match(/sku[-\s:]?([\w-]+)/i);
    if (s) sku = s[1].toUpperCase();
  }
  return { sku, name };
}

function parseCreateOrder(params, text) {
  let customerName = (params.customerName || params.customer || '').toString().trim();
  let product = (params.product || params.item || '').toString().trim();
  let quantity = toInt(params.quantity) || 1;
  let price = params.price != null ? Number(params.price) : undefined;
  if (!customerName) {
    const m = String(text).match(/for\s+([a-zA-Z ]{2,60})/i);
    if (m) customerName = m[1].trim();
  }
  return { customerName, product, quantity, price };
}

function parseCheckOrder(params, text) {
  let orderNumber = (params.orderNumber || '').toString().trim();
  if (!orderNumber) {
    const m = String(text).match(/order\s+([\w-]+)/i);
    if (m) orderNumber = m[1].toUpperCase();
  }
  return { orderNumber };
}

function toInt(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? undefined : n;
}

function generateSku(name) {
  return (String(name).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'SKU') + '-' + Math.floor(Math.random()*1000);
}

async function findInventoryRecord({ sku, name }) {
  // Prefer SKU exact match
  if (sku) {
    const snap = await collections.inventory().where('sku', '==', sku).limit(1).get();
    if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }
  if (name) {
    // naive name search by prefix; requires a composite index for production
    const prefix = name.toLowerCase();
    const snap = await collections.inventory().limit(20).get();
    let match = null;
    snap.forEach(d => {
      const data = d.data() || {};
      if (!match && data.name && String(data.name).toLowerCase().includes(prefix)) {
        match = { id: d.id, ...data };
      }
    });
    return match;
  }
  return null;
}

module.exports = router;

