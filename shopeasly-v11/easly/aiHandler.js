// easly/aiHandler.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getAllDocuments } = require('../config/firebase');
// Tone system
const ToneManager = require('../utils/ToneManager');
const voiceConfig = require('../config/voice.json');
const tone = new ToneManager(voiceConfig);
const applyTone = (s) => { try { return tone.humanize(String(s||'')); } catch(_) { return s; } };

// very simple in-memory rate limit per IP
const RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_MAX = 60; // max requests per window per IP
const ipBuckets = new Map();

function allowRequest(ip) {
  const now = Date.now();
  const b = ipBuckets.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (now > b.resetAt) { b.count = 0; b.resetAt = now + RATE_WINDOW_MS; }
  b.count += 1;
  ipBuckets.set(ip, b);
  return b.count <= RATE_MAX;
}

function appendAILog(entry) {
  try {
    const dir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'ai_logs.ndjson');
    fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
  } catch (_) {}
}

function appendChatHistory(clientId, entries) {
  try {
    if (!clientId) return;
    const dir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'ai_history.json');
    const current = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')||'[]') : [];
    const ts = new Date().toISOString();
    for (const e of entries) current.push({ clientId, ts, ...e });
    fs.writeFileSync(file, JSON.stringify(current, null, 2));
  } catch (_) {}
}

function extractJsonCandidate(text) {
  if (!text) return null;
  // try plain JSON
  try { return JSON.parse(text); } catch (_) {}
  // try markdown fenced code block
  const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (m) {
    try { return JSON.parse(m[1]); } catch (_) {}
  }
  return null;
}

function normalizeStr(s) { return String(s || '').trim(); }

async function handleLocalIntents(prompt) {
  const q = prompt.toLowerCase();
  // Inventory summary
  if (q.includes('inventory') && (q.includes('summary') || q.includes('overview'))) {
    const items = await getAllDocuments('inventory', 1000);
    const totalSkus = items.length;
    const outOfStock = items.filter(i => Number(i.stock || 0) === 0).length;
    const lowStock = items.filter(i => Number(i.stock || 0) > 0 && Number(i.threshold || 0) > 0 && Number(i.stock) <= Number(i.threshold)).length;
    const totalUnits = items.reduce((sum, i) => sum + Number(i.stock || 0), 0);
    const inventoryValue = items.reduce((sum, i) => sum + Number(i.stock || 0) * Number(i.price || 0), 0);
    const topLow = items
      .filter(i => Number(i.stock || 0) <= Number(i.threshold || 0))
      .sort((a,b) => Number(a.stock||0) - Number(b.stock||0))
      .slice(0, 5)
      .map(i => ({ name: i.name, sku: i.sku, stock: Number(i.stock||0), threshold: Number(i.threshold||0) }));
    const text = `Inventory summary:\n- SKUs: ${totalSkus}\n- Units in stock: ${totalUnits}\n- Low stock: ${lowStock}\n- Out of stock: ${outOfStock}\n- Inventory value: $${inventoryValue.toFixed(2)}\n` + (topLow.length ? `\nItems at or below threshold:\n` + topLow.map(i=>`• ${i.name} (${i.sku}) — ${i.stock} ≤ ${i.threshold}`).join('\n') : '');
    return { text, data: { totalSkus, totalUnits, lowStock, outOfStock, inventoryValue, topLow } };
  }
  // Pending orders snapshot
  if ((q.includes('orders') && (q.includes('pending') || q.includes('processing'))) || q.includes('order status')) {
    const orders = await getAllDocuments('orders', 1000);
    const pending = orders.filter(o => /pending/i.test(o.status || ''));
    const processing = orders.filter(o => /processing/i.test(o.status || ''));
    const delivered = orders.filter(o => /delivered/i.test(o.status || ''));
    const head = (arr, n=5) => arr.slice(0,n);
    const top = head(pending).map(o => ({ orderNumber: o.orderNumber || o.id, id: o.id, customer: o.customerName || o.customer || 'N/A', total: o.total || 0 }));
    const text = `Orders snapshot:\n- Pending: ${pending.length}\n- Processing: ${processing.length}\n- Delivered: ${delivered.length}\n` + (top.length ? `\nTop pending:\n` + top.map(o=>`• ${o.orderNumber} — ${o.customer} — $${Number(o.total||0).toFixed(2)}`).join('\n') : '');
    return { text, data: { counts: { pending: pending.length, processing: processing.length, delivered: delivered.length }, topPending: top } };
  }
  // Set stock for SKU-XXX to N
  let m = q.match(/set\s+stock\s+(?:for|of)\s+(sku[-\s]*[a-z0-9\-]+)\s*(?:to|=)\s*(\d+)/i);
  if (m) {
    const sku = m[1].replace(/\s+/g,'').toUpperCase();
    const newStock = Number(m[2]);
    const items = await getAllDocuments('inventory', 1000);
    const found = items.find(i => String(i.sku||'').toUpperCase() === sku);
    if (!found) return { text: `I couldn't find SKU ${sku} in inventory.` };
    return {
      text: `I can update ${found.name} (${sku}) stock to ${newStock}. Confirm to proceed?`,
      action: { type: 'update_inventory_stock', payload: { id: found.id, sku, stock: newStock }, endpoint: `/inventory/api/${found.id}`, method: 'PUT' }
    };
  }
  // Mark order ORD-123 as delivered
  m = q.match(/mark\s+order\s+([a-z0-9\-]+)\s+(?:as\s+)?delivered/i);
  if (m) {
    const ord = m[1].toUpperCase();
    const orders = await getAllDocuments('orders', 1000);
    const found = orders.find(o => (o.orderNumber||'').toUpperCase() === ord || (o.id||'').toUpperCase() === ord);
    if (!found) return { text: `I couldn't find order ${ord}.` };
    return {
      text: `I can mark order ${found.orderNumber||found.id} as Delivered. Confirm to proceed?`,
      action: { type: 'update_order_status', payload: { id: found.id, status: 'Delivered' }, endpoint: `/orders/${found.id}/status`, method: 'PATCH' }
    };
  }
  // Create inventory item (simple pattern: add 50 premium t-shirts to inventory)
  m = q.match(/add\s+(\d+)\s+(.+?)\s+to\s+inventory/i);
  if (m) {
    const stock = Number(m[1]);
    const name = m[2].trim();
    const sku = name.toUpperCase().replace(/[^A-Z0-9]+/g,'-').slice(0,20);
    return {
      text: `I can add a new item “${name}” (SKU: ${sku}) with stock ${stock}. Confirm to create?`,
      action: { type: 'create_inventory', payload: { name, sku, stock, price: 0, status: 'active' }, endpoint: '/inventory/api', method: 'POST' }
    };
  }
  // Create order (simple pattern: create order for John Smith product X qty N)
  m = q.match(/create\s+an?\s+order\s+for\s+(.+?)(?:\s+product\s+(.+?))?(?:\s+qty\s+(\d+))?$/i);
  if (m) {
    const customerName = (m[1]||'').trim();
    const product = (m[2]||'Item').trim();
    const quantity = Number(m[3]||1);
    return {
      text: `I can create an order for ${customerName}: ${quantity} × ${product}. Confirm to proceed?`,
      action: { type: 'create_order', payload: { customerName, product, quantity, status: 'Pending' }, endpoint: '/orders', method: 'POST' }
    };
  }
  return null;
}

// Handles Easly AI prompt using Google Gemini when configured; falls back to local intents
module.exports = async function handleAICoPilot(req, res) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'local';
  try {
    if (!allowRequest(ip)) return res.status(429).json({ error: 'Too many requests. Please slow down.' });

    const { textPart, imagePart, responseMimeType, clientId } = req.body || {};
    const prompt = normalizeStr(textPart);
    if (!prompt) return res.status(400).json({ error: 'Missing textPart' });

    // record user message
    appendChatHistory(clientId, [{ role: 'user', text: prompt }]);

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    // Lightweight out-of-scope detector
    function isOutOfScope(q) {
      const s = q.toLowerCase();
      // Allowed domain keywords
      const domain = /(inventory|stock|sku|order|orders|customer|refund|analytics|report|product|material|packing|design|brainstorm|pricing|price|threshold|reorder|fulfillment|shipment|shipping|ai batch|bulk upload|csv|excel)/;
      if (domain.test(s)) return false;
      // Common out-of-scope categories (general trivia, coding, unrelated advice)
      if (/(movie|weather|capital of|president|translate|recipe|medical|diagnos|politic|election|astrology|horoscope|personal advice|tax|bitcoin|crypto|stock market|celebrity|news)/.test(s)) return true;
      return false; // default not sure => let normal flow decide
    }

    // Polite refusal helper
    function politeRefusal() {
      return applyTone("I’m focused on ShopEasly operations and can’t reliably help with that. Want something about inventory, orders, or products?");
    }

    // Prefer Gemini when API key is present
    if (apiKey) {
      try {
        const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey;
        const userParts = [];
        if (imagePart) userParts.push({ inline_data: { mime_type: 'image/png', data: imagePart } });
  userParts.push({ text: `SYSTEM SCOPE GUARDRAILS:\n- Only answer ShopEasly operational questions (inventory, orders, products, materials, packing materials, analytics, reporting, product design brainstorming).\n- If user asks for anything outside scope: reply with a brief polite refusal: \'I’m focused on ShopEasly operations and can’t reliably help with that. Would you like something inventory, orders, or product related instead?\'\n- If missing details: ask one concise clarification question.\n- Never fabricate unknown data; state what’s unavailable and how to obtain it.\n- Keep refusals < 2 sentences.\n\nYou are Easly AI — a core team member at ShopEasly. Friendly, confident, concise. Use \"we\" for shared shop actions.\n\nUser: ${prompt}` });

        const body = {
          contents: [ { role: 'user', parts: userParts } ],
          generationConfig: { response_mime_type: responseMimeType || 'text/plain' }
        };

        const response = await axios.post(geminiUrl, body, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });
  let aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  aiText = applyTone(aiText);
  // Post-filter: if model ignored scope and gave unrelated trivia, override
  if (isOutOfScope(prompt)) {
    // If AI text appears unrelated (does not mention inventory/order/product) then replace
    if (!/(inventory|order|product|stock|sku|material|report|design)/i.test(aiText)) {
      aiText = politeRefusal();
    }
  }

        const maybeJson = extractJsonCandidate(aiText);
        appendAILog({ ip, type: 'gemini', prompt, usage: { model: 'gemini-1.5-flash' } });

  // Also compute local action suggestions to include alongside Easly AI response
        let localAction = null;
        try {
          const local = await handleLocalIntents(prompt);
          if (local && local.action) localAction = local.action;
        } catch (_) {}

        if (maybeJson) {
          const out = { text: JSON.stringify(maybeJson, null, 2), data: maybeJson, source: 'gemini', action: localAction };
          appendChatHistory(clientId, [{ role: 'assistant', text: out.text, action: localAction || null }]);
          return res.json(out);
        }
  appendChatHistory(clientId, [{ role: 'assistant', text: aiText, action: localAction || null }]);
  return res.json({ text: aiText, source: 'gemini', action: localAction });
      } catch (err) {
        // If Gemini fails, fall through to local intents
        appendAILog({ ip, type: 'gemini_error', prompt, error: err.message });
      }
    }

    // Fallback: local intents (reliable even without API key)
    // Out-of-scope early refusal if clearly unrelated
    if (isOutOfScope(prompt)) {
      const text = politeRefusal();
      appendChatHistory(clientId, [{ role: 'assistant', text }]);
      appendAILog({ ip, type: 'refusal', prompt });
      return res.json({ text, source: 'scope_refusal' });
    }
    const local = await handleLocalIntents(prompt);
    if (local) {
      appendAILog({ ip, type: 'local', prompt, result: local.data });
      const payload = { text: applyTone(local.text), data: local.data, action: local.action, source: apiKey ? 'local_fallback' : 'local' };
      appendChatHistory(clientId, [{ role: 'assistant', text: payload.text, action: local.action || null }]);
      return res.json(payload);
    }

    // Final fallback: offline notice
  const offline = applyTone('AI is offline. Configure GEMINI_API_KEY (or GOOGLE_API_KEY) in .env.local and restart the server.');
    appendAILog({ ip, type: 'offline', prompt });
    return res.json({ text: offline, source: 'offline' });
  } catch (err) {
    appendAILog({ ip, type: 'error', error: err.message });
    return res.status(500).json({ error: 'AI request failed', details: err.message });
  }
};
