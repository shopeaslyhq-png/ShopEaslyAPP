const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const handleAICoPilot = require('../easly/aiHandlerEnhanced'); // Use enhanced handler
const axios = require('axios');
const { getAllDocuments } = require('../config/firebase');

// AI chat endpoint
router.post('/co-pilot', handleAICoPilot);

// Lightweight health/info endpoint (no secrets)
router.get('/health', (req, res) => {
  try {
    const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY || process.env.GEAPI_KEY);
    const preferred = hasGemini ? 'gemini' : (hasOpenAI ? 'openai' : null);
    res.json({
      ok: true,
      providers: {
        gemini: hasGemini,
        openai: hasOpenAI,
        preferred
      },
      models: {
        openaiChat: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        openaiImage: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

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

// --- Image Generation (DALL·E/OpenAI) ---
router.post('/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });
    const openaiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY || process.env.GEAPI_KEY;
    if (!openaiKey) return res.status(400).json({ error: 'OPENAI_API_KEY not configured' });
    const body = {
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
      prompt,
      size: '1024x1024',
      response_format: 'b64_json'
    };
    const resp = await axios.post('https://api.openai.com/v1/images/generations', body, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
      timeout: 60000
    });
    const b64 = resp.data?.data?.[0]?.b64_json;
    if (!b64) return res.status(500).json({ error: 'no image returned' });
    const dir = path.join(__dirname, '..', 'public', 'images', 'designs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filename = `design-${Date.now()}.png`;
    fs.writeFileSync(path.join(dir, filename), Buffer.from(b64, 'base64'));
    const url = `/images/designs/${filename}`;
    res.json({ ok: true, url, filename });
  } catch (err) {
    console.error('Error generating image:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Product Suggestion (name, price, SKU) ---
router.post('/suggest-product', async (req, res) => {
  try {
    const { imageUrl, materialsIds = [], packagingId = '', productType = '', hints = '' } = req.body || {};
    const items = await getAllDocuments('inventory', 1000);
    const matMap = new Map(items.map(i => [String(i.id), i]));
    const selMats = materialsIds.map(String).map(id => matMap.get(id)).filter(Boolean);
    const packaging = packagingId ? matMap.get(String(packagingId)) : null;

    // Heuristic defaults
    const materialNames = selMats.map(m => m.name);
    const baseNameParts = [productType || 'Product'].concat(materialNames.slice(0,2));
    const heuristicName = baseNameParts.join(' ').replace(/\s+/g,' ').trim();
    const calcCost = selMats.reduce((s, m) => s + (Number(m.price)||0), 0) + (packaging ? (Number(packaging.price)||0) : 0);
    const heuristicPrice = Math.max(9.99, Math.round((calcCost * 3 + 5) * 100)/100); // 3x materials + handling
    const heuristicSku = heuristicName.toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,24) || 'PRODUCT';

    const openaiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY || process.env.GEAPI_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    // Prefer LLM if configured
    if (openaiKey) {
      try {
        const sys = 'You are a product naming assistant for a print-on-demand store. Suggest a catchy name (max 5 words), a fair retail price in USD, and a short SKU based on inputs.';
        const content = `Image: ${imageUrl || '(none)'}\nMaterials: ${materialNames.join(', ') || '(none)'}\nPackaging: ${packaging?packaging.name:'(none)'}\nProduct type: ${productType||'(unknown)'}\nHints: ${hints||'(none)'}\nReturn JSON with keys name, price, sku.`;
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [ { role: 'system', content: sys }, { role: 'user', content } ],
          temperature: 0.6,
          max_tokens: 200
        }, { headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${openaiKey}` }, timeout: 15000 });
        const text = response.data?.choices?.[0]?.message?.content || '';
        let data = null; try { data = JSON.parse(text); } catch {}
        if (data && data.name) return res.json({ ok:true, ...data });
      } catch (e) {
        console.warn('OpenAI suggest fallback:', e.message);
      }
    } else if (geminiKey) {
      try {
        const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + geminiKey;
        const body = { contents: [{ role: 'user', parts: [{ text: `Suggest product name, USD price, and short SKU. Inputs -> Image: ${imageUrl||'(none)'}; Materials: ${materialNames.join(', ')||'(none)'}; Packaging: ${packaging?packaging.name:'(none)'}; Product: ${productType||'(unknown)'}; Hints: ${hints||'(none)'}\nReturn JSON: {"name":"","price":0,"sku":""}` }] }], generationConfig: { temperature: 0.6, max_output_tokens: 200, response_mime_type: 'text/plain' } };
        const resp = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });
        const text = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        let data = null; try { data = JSON.parse(text); } catch {}
        if (data && data.name) return res.json({ ok:true, ...data });
      } catch (e) {
        console.warn('Gemini suggest fallback:', e.message);
      }
    }

    // Heuristic fallback
    return res.json({ ok: true, name: heuristicName, price: heuristicPrice, sku: heuristicSku });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
