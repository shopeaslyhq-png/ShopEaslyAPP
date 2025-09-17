// easly/aiHandlerEnhanced.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getAllDocuments, createDocument, updateDocument, deleteDocument } = require('../config/firebase');
const { initiateProductCreation, addPackingMaterial, addMaterial } = require('../utils/inventoryService');

// Rate limiting
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

// Lightweight session store for conversational context (per clientId)
const SESSIONS_FILE = path.join(__dirname, '..', 'data', 'sessions.json');
function loadSessions() {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return {};
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8') || '{}');
  } catch (_) { return {}; }
}
function saveSessions(all) {
  try {
    const dir = path.dirname(SESSIONS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(all, null, 2));
  } catch (_) {}
}
function getSession(clientId) {
  if (!clientId) return null;
  const all = loadSessions();
  const s = all[clientId];
  if (!s) return null;
  if (s.expiresAt && Date.now() > s.expiresAt) {
    delete all[clientId];
    saveSessions(all);
    return null;
  }
  return s;
}
function setSession(clientId, patch) {
  if (!clientId) return;
  const all = loadSessions();
  const prev = all[clientId] || {};
  all[clientId] = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  saveSessions(all);
}
function clearSession(clientId, keys) {
  if (!clientId) return;
  const all = loadSessions();
  if (!all[clientId]) return;
  if (!keys) { delete all[clientId]; }
  else {
    for (const k of ([]).concat(keys)) delete all[clientId][k];
  }
  saveSessions(all);
}

// Heuristics for defaults
function slugifyName(name) {
  return String(name||'').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
function guessCategory(name) {
  const n = (name||'').toLowerCase();
  // Packing materials first (boxes, tape, mailers, bubble wrap, labels)
  if (/(pack(ing)?\s*materials?|packaging|shipping\s*suppl(y|ies)|box(es)?|mailer(s)?|bubble\s*wrap|tape|label(s)?)/.test(n)) return 'Packing Materials';
  // General materials and production inputs
  if (/raw\s*material|materials?|blank|suppl(y|ies)|ink|paper|vinyl|dtf|film|sheet(s)?/.test(n)) return 'Materials';
  if (/shirt|t-?shirt|tee/.test(n)) return 'Apparel';
  if (/hoodie|sweatshirt/.test(n)) return 'Apparel';
  if (/mug|cup|tumbler/.test(n)) return 'Drinkware';
  if (/sticker|decal/.test(n)) return 'Stickers';
  if (/hat|cap|beanie/.test(n)) return 'Headwear';
  if (/poster|print/.test(n)) return 'Prints';
  return 'General';
}
function categoryCode(cat) {
  const c = (cat||'').toLowerCase();
  if (c.startsWith('pack')) return 'PKG';
  if (c.startsWith('mater')) return 'MAT';
  if (c.startsWith('raw')) return 'RM';
  if (c.startsWith('apparel')) return 'APP';
  if (c.startsWith('drink')) return 'DRK';
  if (c.startsWith('sticker')) return 'STK';
  if (c.startsWith('head')) return 'HDW';
  if (c.startsWith('print')) return 'PRT';
  return 'GEN';
}
function guessSku(name) {
  const cat = guessCategory(name);
  const slug = slugifyName(name).split('-').slice(0,3).join('-');
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(2,6);
  return `${categoryCode(cat)}-${slug}-${rand}`;
}
function guessPrice(name) {
  const n = (name||'').toLowerCase();
  if (/raw\s*material|blank/.test(n)) return 5.0;
  if (/shirt|t-?shirt|tee/.test(n)) return 15.0;
  if (/hoodie|sweatshirt/.test(n)) return 35.0;
  if (/mug|cup|tumbler/.test(n)) return 12.0;
  if (/sticker|decal/.test(n)) return 1.5;
  if (/hat|cap|beanie/.test(n)) return 18.0;
  if (/poster|print/.test(n)) return 10.0;
  return 9.99;
}
function guessThreshold(stock) {
  const s = Number(stock||0);
  if (!s) return 5;
  return Math.min(25, Math.max(3, Math.floor(s * 0.1)));
}

function extractJsonCandidate(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) {}
  const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (m) {
    try { return JSON.parse(m[1]); } catch (_) {}
  }
  return null;
}

function normalizeStr(s) { return String(s || '').trim(); }

// Helper to normalize category
function catKey(cat) { return String(cat || '').toLowerCase(); }
function isMaterials(cat) { return catKey(cat).startsWith('mater'); }
function isPacking(cat) { return catKey(cat).startsWith('pack'); }
function findMatches(all, term, predicate) {
  const t = String(term || '').toLowerCase();
  const out = all.filter(i => predicate(i) && String(i.name || '').toLowerCase().includes(t));
  return out.slice(0, 7);
}

// Decide when to use external AI (brainstorming, design, and general conversation)
function shouldUseLLM(s) {
  const q = String(s||'').toLowerCase();
  
  // Always use external AI for brainstorming/design/creative tasks
  if (/(brainstorm|idea|ideation|campaign|copywriting|marketing|slogans?|product\s+description|design|image|art|mockup|logo|render|illustration)/.test(q)) {
    return true;
  }
  
  // Use external AI for general questions that don't match specific local intents
  const hasLocalIntent = (
    /(inventory\s+summary|order\s+status|how\s+many|add\s+\d+|set\s+stock|delete|remove|create\s+order|mark\s+order|generate\s+design)/.test(q) ||
    /^\s*(add|create|put)\s+/.test(q) ||
    /(?:set|update)\s+stock/.test(q)
  );
  
  // If no clear local intent, use external AI for conversation
  return !hasLocalIntent;
}

// Generate a design image using OpenAI Images API and save locally
async function generateDesignImage(prompt) {
  const openaiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY || process.env.GEAPI_KEY;
  if (!openaiKey) throw new Error('OPENAI_API_KEY missing for image generation');
  const body = {
    model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    prompt: prompt,
    size: '1024x1024',
    response_format: 'b64_json'
  };
  const resp = await axios.post('https://api.openai.com/v1/images/generations', body, {
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
    timeout: 60000
  });
  const b64 = resp.data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image returned');
  const buffer = Buffer.from(b64, 'base64');
  const dir = path.join(__dirname, '..', 'public', 'images', 'designs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `design-${Date.now()}.png`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  const publicUrl = `/images/designs/${filename}`;
  return { url: publicUrl, file: filename };
}

// Direct action execution functions
async function executeInventoryAction(action) {
  const { type, payload } = action;
  
  try {
    switch (type) {
      case 'increment_inventory_stock': {
        // Increment stock by delta for a given inventory document id
        const items = await getAllDocuments('inventory', 1000);
        const cur = items.find(i => i.id === payload.id);
        if (!cur) throw new Error('inventory item not found');
        const next = Number(cur.stock || 0) + Number(payload.delta || 0);
        await updateDocument('inventory', payload.id, { stock: next });
        return { success: true, message: `✅ Added +${payload.delta} to ${cur.sku || cur.name}. New stock: ${next}` };
      }
      case 'update_inventory_stock':
        await updateDocument('inventory', payload.id, { stock: payload.stock });
        return { success: true, message: `✅ Updated ${payload.sku} stock to ${payload.stock}` };
      
      case 'create_inventory':
        const newItem = {
          name: payload.name,
          sku: payload.sku,
          stock: payload.stock,
          price: payload.price || 0,
          status: payload.status || 'active',
          threshold: payload.threshold || 5,
          category: payload.category || 'General',
          description: payload.description || '',
          dateAdded: new Date().toISOString().split('T')[0]
        };
        const docRef = await createDocument('inventory', newItem);
        return { success: true, message: `✅ Created inventory item: ${payload.name} (${payload.sku}) with ${payload.stock} units`, id: docRef.id };
      
      case 'delete_inventory':
        await deleteDocument('inventory', payload.id);
        return { success: true, message: `✅ Deleted inventory item: ${payload.sku}` };
      
      default:
        return { success: false, message: `❌ Unknown inventory action: ${type}` };
    }
  } catch (error) {
    return { success: false, message: `❌ Error executing inventory action: ${error.message}` };
  }
}

async function executeOrderAction(action) {
  const { type, payload } = action;
  
  try {
    switch (type) {
      case 'update_order_status':
        await updateDocument('orders', payload.id, { status: payload.status });
        return { success: true, message: `✅ Updated order status to ${payload.status}` };
      
      case 'create_order':
        const newOrder = {
          customerName: payload.customerName,
          product: payload.product,
          quantity: payload.quantity || 1,
          price: payload.price || 0,
          status: payload.status || 'Pending',
          notes: payload.notes || '',
          date: new Date().toISOString().split('T')[0],
          orderNumber: `ORD-${Date.now()}`
        };
        const docRef = await createDocument('orders', newOrder);
        return { success: true, message: `✅ Created order ${newOrder.orderNumber} for ${payload.customerName}`, id: docRef.id, orderNumber: newOrder.orderNumber };
      
      case 'delete_order':
        await deleteDocument('orders', payload.id);
        return { success: true, message: `✅ Deleted order: ${payload.orderNumber || payload.id}` };
      
      default:
        return { success: false, message: `❌ Unknown order action: ${type}` };
    }
  } catch (error) {
    return { success: false, message: `❌ Error executing order action: ${error.message}` };
  }
}

// Save base64 image (raw or data URL) to public/images/uploads and return public URL
async function saveImagePartToUploads(imagePart) {
  try {
    if (!imagePart) return null;
    const dir = path.join(__dirname, '..', 'public', 'images', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const b64 = String(imagePart).startsWith('data:') ? String(imagePart).split(',')[1] : String(imagePart);
    const buf = Buffer.from(b64, 'base64');
    const filename = `upload-${Date.now()}.png`;
    fs.writeFileSync(path.join(dir, filename), buf);
    return `/images/uploads/${filename}`;
  } catch (_) {
    return null;
  }
}

async function handleLocalIntents(prompt, autoExecute = false, clientId = undefined, ctx = {}) {
  const q = prompt.toLowerCase();
  const { imagePart } = ctx || {};
  const isExplicitAddMaterial = /\badd\s+(?:a\s+)?(?:raw\s+material|material)s?\b/i.test(q);
  const isExplicitAddPacking = /\badd\s+(?:a\s+)?packing\s+material\b/i.test(q);
  const isExplicitCreateProduct = /\bcreate\s+product\b/i.test(q);
  
  // UI: Open Product Wizard on natural language triggers
  const isOpenWizard = /(open|start|launch)\s+(?:the\s+)?(?:product\s+wizard|product\s+flow)\b|^\s*\+?product\s*$/i.test(prompt);
  if (isOpenWizard) {
    return { text: 'Opening Product Wizard…', executed: false, uiCommand: { type: 'openProductWizard' } };
  }
  // Pending disambiguation flow (awaiting user selection)
  if (clientId) {
    const sess = getSession(clientId);
    if (sess && sess.pendingChoice) {
      const pending = sess.pendingChoice; // { type, term, candidates: [{id,name,sku,stock}], action }
      const candidates = Array.isArray(pending.candidates) ? pending.candidates : [];
      const cancel = /(cancel|never mind|nevermind|stop|abort)/i.test(q);
      if (cancel) {
        clearSession(clientId, ['pendingChoice', 'pendingCreateProduct']);
        return { text: 'Cancelled. Nothing changed.', executed: false };
      }
      // Selection by number (1-based)
      let selIdx = null;
      const num = q.match(/^\s*(?:option\s*)?(\d+)\b/);
      if (num) {
        const n = Number(num[1]);
        if (n >= 1 && n <= candidates.length) selIdx = n - 1;
      }
      // Or by SKU mention
      if (selIdx === null) {
        const skuM = q.match(/\b(sku[-\s]*[a-z0-9\-]+)\b/i);
        if (skuM) {
          const sku = skuM[1].replace(/\s+/g, '').toUpperCase();
          const k = candidates.findIndex(c => String(c.sku || '').toUpperCase() === sku);
          if (k >= 0) selIdx = k;
        }
      }
      // Or by name contains
      if (selIdx === null) {
        const byName = candidates.findIndex(c => String(c.name || '').toLowerCase().includes(q.trim()));
        if (byName >= 0) selIdx = byName;
      }
      if (selIdx === null) {
  // Re-prompt with options
  const lines = candidates.map((c, i) => `${i + 1}. ${c.name} (${c.sku || 'N/A'}) — stock ${Number(c.stock || 0)}`).join('\n');
  const options = candidates.map((c, i) => ({ label: `${c.name} (${c.sku || 'N/A'}) — ${Number(c.stock||0)}`, send: String(i + 1) }));
  return { text: `Please choose an option by number or SKU:\n${lines}`, executed: false, awaiting: 'choice', options };
      }
      const chosen = candidates[selIdx];

      // Handle by type
      if (pending.type === 'restock_by_name') {
        const delta = Number(pending.delta || 0);
        const action = { type: 'increment_inventory_stock', payload: { id: chosen.id, delta, sku: chosen.sku }, endpoint: `/inventory/api/${chosen.id}`, method: 'PUT' };
        const result = await executeInventoryAction(action);
        clearSession(clientId, 'pendingChoice');
        if (result && result.success) setSession(clientId, { lastInventory: { id: chosen.id, name: chosen.name, sku: chosen.sku }, expiresAt: Date.now() + 10 * 60 * 1000 });
        return { text: result.message, executed: true, action };
      }

      if (pending.type === 'material_for_product' || pending.type === 'packaging_for_product') {
        // Continue product creation with selected item
        const pc = getSession(clientId)?.pendingCreateProduct || {};
        const { name, price, quantity, materialsTerms = [], packagingTerm = '', imageUrl } = pc;
        const all = await getAllDocuments('inventory', 2000);

        // Resolve materials
        const resolvedMats = [];
        for (const term of materialsTerms) {
          if (pending.type === 'material_for_product' && term === pending.term) {
            resolvedMats.push(chosen.id);
            continue;
          }
          const matches = findMatches(all, term, i => isMaterials(i.category));
          if (matches.length === 0) continue;
          if (matches.length === 1) { resolvedMats.push(matches[0].id); }
          else {
            // Ask next disambiguation for this term
            setSession(clientId, { pendingChoice: { type: 'material_for_product', term, candidates: matches.map(m => ({ id: m.id, name: m.name, sku: m.sku, stock: m.stock })) } });
      const options = matches.map((m, i) => ({ label: `${m.name} (${m.sku || 'N/A'}) — ${Number(m.stock||0)}`, send: String(i + 1) }));
      return { text: `Multiple materials match "${term}". Please choose:\n` + matches.map((m, i) => `${i + 1}. ${m.name} (${m.sku || 'N/A'}) — stock ${Number(m.stock || 0)}`).join('\n'), executed: false, awaiting: 'choice', options };
          }
        }

        // Resolve packaging
        let packagingId = '';
        if (packagingTerm) {
          if (pending.type === 'packaging_for_product') {
            packagingId = chosen.id;
          } else {
            const pMatches = findMatches(all, packagingTerm, i => isPacking(i.category));
            if (pMatches.length > 1) {
              setSession(clientId, { pendingChoice: { type: 'packaging_for_product', term: packagingTerm, candidates: pMatches.map(m => ({ id: m.id, name: m.name, sku: m.sku, stock: m.stock })) } });
              return { text: `Multiple packaging items match "${packagingTerm}". Please choose:\n` + pMatches.map((m, i) => `${i + 1}. ${m.name} (${m.sku || 'N/A'}) — stock ${Number(m.stock || 0)}`).join('\n'), executed: false, awaiting: 'choice' };
            } else if (pMatches.length === 1) {
              packagingId = pMatches[0].id;
            }
          }
        }

        // All set: create product
        if (!price || !Number.isFinite(Number(price))) {
          clearSession(clientId, ['pendingChoice']);
          return { text: '❌ Price is missing for product creation. Please specify like "price 25".', executed: false };
        }

        const created = await initiateProductCreation({ name, price: Number(price), quantity: Number(quantity || 0), materialsIds: resolvedMats, packagingId, category: 'Products', imageUrl });
        clearSession(clientId, ['pendingChoice', 'pendingCreateProduct']);
        if (clientId) setSession(clientId, { lastInventory: { id: created.id, name: created.name, sku: created.sku }, expiresAt: Date.now() + 10 * 60 * 1000 });
        const partsMsg = [];
        if (resolvedMats.length) partsMsg.push(`${resolvedMats.length} material(s)`);
        if (packagingId) partsMsg.push('packaging attached');
        if (imageUrl) partsMsg.push('image linked');
        const extras = partsMsg.length ? ` (${partsMsg.join(', ')})` : '';
        return { text: `✅ Created product "${created.name}" (SKU ${created.sku}) qty ${created.stock} at $${created.price.toFixed(2)}${extras}.`, executed: true, data: { id: created.id, sku: created.sku } };
      }

      // Unknown pending type; clear
      clearSession(clientId, 'pendingChoice');
    }
  }

  // Conversational follow-ups for the last created inventory item
  const session = clientId ? getSession(clientId) : null;
  if (!isExplicitAddMaterial && !isExplicitAddPacking && !isExplicitCreateProduct && session && session.lastInventory && session.lastInventory.id) {
    const inv = session.lastInventory; // {id, name, sku}
    // price update
    let mUp = q.match(/(?:set|change|update)?\s*price\s*(?:to|=)?\s*(\d+(?:\.\d+)?)/i);
    if (mUp) {
      const price = Number(mUp[1]);
      await updateDocument('inventory', inv.id, { price });
      setSession(clientId, { lastInventory: { ...inv, price }, expiresAt: Date.now() + 10*60*1000 });
      return { text: `✅ Updated price for ${inv.sku||inv.name} to $${price.toFixed(2)}.`, executed: true };
    }
    // sku update
    mUp = q.match(/(?:set|change|update)?\s*sku\s*(?:to|=)?\s*([a-z0-9\-]+)/i);
    if (mUp) {
      const sku = mUp[1].toUpperCase();
      await updateDocument('inventory', inv.id, { sku });
      setSession(clientId, { lastInventory: { ...inv, sku }, expiresAt: Date.now() + 10*60*1000 });
      return { text: `✅ Updated SKU to ${sku}.`, executed: true };
    }
    // name update
    mUp = q.match(/(?:set|change|rename)\s*(?:name\s*)?(?:to|as)?\s*(.+)$/i);
    if (mUp && !/price|sku|stock|quantity|category|color/.test(q)) {
      const name = mUp[1].trim();
      await updateDocument('inventory', inv.id, { name });
      setSession(clientId, { lastInventory: { ...inv, name }, expiresAt: Date.now() + 10*60*1000 });
      return { text: `✅ Renamed item to "${name}".`, executed: true };
    }
    // color or category hints
    mUp = q.match(/(?:make|set)\s+(?:it|them)?\s*([a-z]+)\s*(?:color)?/i);
    if (mUp && !/price|sku|stock|quantity|category/.test(q)) {
      const color = mUp[1].toLowerCase();
      await updateDocument('inventory', inv.id, { color });
      setSession(clientId, { lastInventory: { ...inv, color }, expiresAt: Date.now() + 10*60*1000 });
      return { text: `✅ Set color to ${color}.`, executed: true };
    }
    mUp = q.match(/(?:set|change)\s*category\s*(?:to|=)?\s*(.+)$/i);
    if (mUp) {
      const category = mUp[1].trim();
      await updateDocument('inventory', inv.id, { category });
      setSession(clientId, { lastInventory: { ...inv, category }, expiresAt: Date.now() + 10*60*1000 });
      return { text: `✅ Category set to ${category}.`, executed: true };
    }
  }
  
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
    const text = `📦 **Inventory Summary:**\n- **Total SKUs:** ${totalSkus}\n- **Units in stock:** ${totalUnits}\n- **Low stock items:** ${lowStock}\n- **Out of stock:** ${outOfStock}\n- **Total inventory value:** $${inventoryValue.toFixed(2)}\n` + (topLow.length ? `\n⚠️ **Items at or below threshold:**\n` + topLow.map(i=>`• ${i.name} (${i.sku}) — ${i.stock} ≤ ${i.threshold}`).join('\n') : '');
    return { text, data: { totalSkus, totalUnits, lowStock, outOfStock, inventoryValue, topLow } };
  }

  // Pending orders snapshot
  if ((q.includes('orders') && (q.includes('pending') || q.includes('processing'))) || q.includes('order status')) {
    const orders = await getAllDocuments('orders', 1000);
    const pending = orders.filter(o => /pending/i.test(o.status || ''));
    const processing = orders.filter(o => /processing/i.test(o.status || ''));
    const delivered = orders.filter(o => /delivered/i.test(o.status || ''));
    const head = (arr, n=5) => arr.slice(0,n);
    const top = head(pending).map(o => ({ orderNumber: o.orderNumber || o.id, id: o.id, customer: o.customerName || o.customer || 'N/A', total: o.total || o.price || 0 }));
    const text = `📋 **Orders Overview:**\n- **Pending:** ${pending.length}\n- **Processing:** ${processing.length}\n- **Delivered:** ${delivered.length}\n` + (top.length ? `\n📄 **Top pending orders:**\n` + top.map(o=>`• ${o.orderNumber} — ${o.customer} — $${Number(o.total||0).toFixed(2)}`).join('\n') : '');
    return { text, data: { counts: { pending: pending.length, processing: processing.length, delivered: delivered.length }, topPending: top } };
  }

  // Item stock queries: "how many X do we have" / "do we have any X"
  let m2 = q.match(/(?:how\s+many|do\s+we\s+have\s+any|what\s+is\s+stock\s+of)\s+(.+?)(?:\?|$)/i);
  if (m2) {
    const term = m2[1].trim();
    const items = await getAllDocuments('inventory', 1000);
    const matches = items.filter(i =>
      (i.name && i.name.toLowerCase().includes(term)) ||
      (i.sku && i.sku.toLowerCase().includes(term)) ||
      (i.category && i.category.toLowerCase().includes(term))
    );
    if (!matches.length) {
      return { text: `📦 I couldn't find any items matching "${term}".` };
    }
    const total = matches.reduce((s, it) => s + Number(it.stock||0), 0);
    const top = matches.slice(0,5).map(it => `${it.name||'Unknown'} (${it.sku||'N/A'}) — ${Number(it.stock||0)}`);
    const text = `📦 We have ${total} units matching "${term}".` + (top.length ? `\n• ` + top.join('\n• ') : '');
    return { text, data: { total, matches: matches.map(x => ({ id: x.id, sku: x.sku, stock: x.stock })) } };
  }

  // DIRECT INVENTORY ACTIONS
  // Specialized create flows must come BEFORE the generic add/create handlers

  // A) Add PACKING MATERIAL with dimensions
  // Example: "add packing material 6x9 Poly Mailer dimensions 6x9 in stock 250 price 0.12"
  let pm = q.match(/add\s+(?:a\s+)?packing\s+material\s+(.+?)\s+dimensions\s+([^,]+?)(?:\s+(?:stock|qty|quantity)\s+(\d+))?(?:\s+price\s+\$?(\d+(?:\.\d+)?))?/i);
  if (pm) {
    try {
      const name = pm[1].trim();
      const dimensions = pm[2].trim();
      const stock = pm[3] ? Number(pm[3]) : 0;
      const price = pm[4] ? Number(pm[4]) : undefined;
      const created = await addPackingMaterial({ name, dimensions, stock, price });
      if (clientId) setSession(clientId, { lastInventory: { id: created.id, name: created.name, sku: created.sku }, expiresAt: Date.now() + 10*60*1000 });
      return { text: `📦 Added packing material "${created.name}" (${created.sku}) — ${created.dimensions}, stock ${created.stock}.`, executed: true, data: { id: created.id, sku: created.sku } };
    } catch (e) {
      return { text: `❌ Failed to add packing material: ${e.message}` };
    }
  }

  // B) Add RAW MATERIAL to inventory
  // Examples: "add material DTF film stock 200 price 0.45", "add 100 vinyl sheets as materials price 1.25"
  let mm = q.match(/add\s+(?:a\s+)?(?:raw\s+material|material)s?\s+(.+?)(?:\s+(?:stock|qty|quantity)\s+(\d+))?(?:\s+price\s+\$?(\d+(?:\.\d+)?))?$/i);
  if (mm) {
    try {
      const name = mm[1].trim();
      const stock = mm[2] ? Number(mm[2]) : 0;
      const price = mm[3] ? Number(mm[3]) : undefined;
      const created = await addMaterial({ name, stock, price });
      if (clientId) setSession(clientId, { lastInventory: { id: created.id, name: created.name, sku: created.sku }, expiresAt: Date.now() + 10*60*1000 });
      return { text: `🧩 Added material "${created.name}" (${created.sku}) with stock ${created.stock}.`, executed: true, data: { id: created.id, sku: created.sku } };
    } catch (e) {
      return { text: `❌ Failed to add material: ${e.message}` };
    }
  }

  // C) Create PRODUCT (optionally from last design) and add finished product to inventory
  // Patterns:
  // - create product from last design price $25 qty 10
  // - create product Space T-Shirt price 25 qty 10 using materials dtf film, black shirt packaging 6x9 poly mailer
  let cp = q.match(/create\s+product(?:\s+from\s+last\s+design)?(?:\s+(.+?))?(?:\s+price\s*\$?(\d+(?:\.\d+)?))?(?:\s+qty\s+(\d+))?(?:\s+using\s+materials\s+(.+?))?(?:\s+packaging\s+(.+))?$/i);
  if (cp) {
    try {
      const useLastDesign = /create\s+product\s+from\s+last\s+design/i.test(prompt);
      const nameRaw = (cp[1] || '').trim();
      const price = cp[2] ? Number(cp[2]) : undefined;
      const quantity = cp[3] ? Number(cp[3]) : 0;
      const materialsStr = (cp[4] || '').trim();
      const packagingStr = (cp[5] || '').trim();

      // Resolve image from last design if requested; otherwise use attached imagePart if provided
      let imageUrl = undefined;
      if (useLastDesign && clientId) {
        const s = getSession(clientId);
        if (s && s.lastDesign && s.lastDesign.url) imageUrl = s.lastDesign.url;
      }
      if (!imageUrl && imagePart) {
        const saved = await saveImagePartToUploads(imagePart);
        if (saved) imageUrl = saved;
      }

      // Determine name
      let finalName = nameRaw || (useLastDesign ? (getSession(clientId)?.lastDesign?.subject ? `${getSession(clientId).lastDesign.subject}` : 'New Product') : 'New Product');

      // Map material and packaging names to IDs with disambiguation
      const all = await getAllDocuments('inventory', 2000);
      const mats = [];
      const materialTerms = [];
      if (materialsStr) {
        const parts = materialsStr.split(/,|\band\b/).map(s => s.trim()).filter(Boolean);
        for (const term of parts) {
          materialTerms.push(term);
          const matches = findMatches(all, term, i => isMaterials(i.category));
          if (matches.length === 1) mats.push(matches[0].id);
          else if (matches.length > 1) {
            if (clientId) {
              setSession(clientId, {
                pendingCreateProduct: { name: finalName, price, quantity, materialsTerms: parts, packagingTerm: packagingStr, imageUrl },
                pendingChoice: { type: 'material_for_product', term, candidates: matches.map(m => ({ id: m.id, name: m.name, sku: m.sku, stock: m.stock })) }
              });
            }
            return { text: `Multiple materials match "${term}". Please choose:\n` + matches.map((m, i) => `${i + 1}. ${m.name} (${m.sku || 'N/A'}) — stock ${Number(m.stock || 0)}`).join('\n'), executed: false, awaiting: 'choice' };
          }
        }
      }
      let packagingId = '';
      if (packagingStr) {
        const pMatches = findMatches(all, packagingStr, i => isPacking(i.category));
        if (pMatches.length === 1) packagingId = pMatches[0].id;
        else if (pMatches.length > 1) {
          if (clientId) {
            setSession(clientId, {
              pendingCreateProduct: { name: finalName, price, quantity, materialsTerms: materialTerms.length ? materialTerms : (materialsStr ? materialsStr.split(/,|\band\b/).map(s=>s.trim()).filter(Boolean) : []), packagingTerm: packagingStr, imageUrl },
              pendingChoice: { type: 'packaging_for_product', term: packagingStr, candidates: pMatches.map(m => ({ id: m.id, name: m.name, sku: m.sku, stock: m.stock })) }
            });
          }
      const options = pMatches.map((m, i) => ({ label: `${m.name} (${m.sku || 'N/A'}) — ${Number(m.stock||0)}`, send: String(i + 1) }));
      return { text: `Multiple packaging items match "${packagingStr}". Please choose:\n` + pMatches.map((m, i) => `${i + 1}. ${m.name} (${m.sku || 'N/A'}) — stock ${Number(m.stock || 0)}`).join('\n'), executed: false, awaiting: 'choice', options };
        }
      }

      if (!price || !Number.isFinite(price)) throw new Error('price is required for product creation');

  const created = await initiateProductCreation({ name: finalName, price, quantity, materialsIds: mats, packagingId, category: 'Products', imageUrl });
      if (clientId) setSession(clientId, { lastInventory: { id: created.id, name: created.name, sku: created.sku }, expiresAt: Date.now() + 10*60*1000 });
      const partsMsg = [];
      if (mats.length) partsMsg.push(`${mats.length} material(s)`);
      if (packagingId) partsMsg.push('packaging attached');
      if (imageUrl) partsMsg.push('image linked');
      const extras = partsMsg.length ? ` (${partsMsg.join(', ')})` : '';
      return { text: `✅ Created product "${created.name}" (SKU ${created.sku}) qty ${created.stock} at $${created.price.toFixed(2)}${extras}.`, executed: true, data: { id: created.id, sku: created.sku } };
    } catch (e) {
      return { text: `❌ Failed to create product: ${e.message}` };
    }
  }
  
  // Restock existing item by SKU: "add|increase|restock N to/for SKU-XXX"
  let r = q.match(/\b(?:add|increase|restock|put)\s+(\d+)\s+(?:to|for|on)?\s*(sku[-\s]*[a-z0-9\-]+)\b/i);
  if (r) {
    const delta = Number(r[1]);
    const sku = r[2].replace(/\s+/g,'').toUpperCase();
    const items = await getAllDocuments('inventory', 1000);
    const found = items.find(i => String(i.sku||'').toUpperCase() === sku);
    if (!found) return { text: `❌ I couldn't find SKU ${sku} in inventory.` };
    const action = {
      type: 'increment_inventory_stock',
      payload: { id: found.id, delta, sku },
      endpoint: `/inventory/api/${found.id}`,
      method: 'PUT'
    };
    const result = await executeInventoryAction(action);
    return { text: result.message, executed: true, action };
  }
  // Restock by name phrase: "add 10 black t-shirts" when a close match exists (no price/cost phrase)
  r = q.match(/^\s*(?:add|increase|restock|put)\s+(\d+)\s+(.+?)\s*$/i);
  if (r) {
    const delta = Number(r[1]);
    const nameTerm = r[2].trim();
    if (!/(?:price|cost|at)\s*\$?\s*\d/.test(nameTerm)) {
      const items = await getAllDocuments('inventory', 1000);
      const matches = items.filter(i => (i.name||'').toLowerCase().includes(nameTerm.toLowerCase()) || (i.sku||'').toLowerCase().includes(nameTerm.toLowerCase()));
      if (matches.length > 1 && clientId) {
        setSession(clientId, { pendingChoice: { type: 'restock_by_name', delta, candidates: matches.map(m => ({ id: m.id, name: m.name, sku: m.sku, stock: m.stock })) } });
        const options = matches.map((m, i) => ({ label: `${m.name} (${m.sku || 'N/A'}) — ${Number(m.stock||0)}`, send: String(i + 1) }));
        return { text: `I found multiple items matching "${nameTerm}". Please choose:\n` + matches.map((m, i) => `${i + 1}. ${m.name} (${m.sku || 'N/A'}) — stock ${Number(m.stock || 0)}`).join('\n'), executed: false, awaiting: 'choice', options };
      }
      if (matches.length === 1) {
        const match = matches[0];
        const action = { type: 'increment_inventory_stock', payload: { id: match.id, delta, sku: match.sku }, endpoint: `/inventory/api/${match.id}`, method: 'PUT' };
        const result = await executeInventoryAction(action);
        if (clientId && result && result.success) setSession(clientId, { lastInventory: { id: match.id, name: match.name, sku: match.sku }, expiresAt: Date.now() + 10*60*1000 });
        return { text: result.message, executed: true, action };
      }
    }
  }
  
  // Set/Update stock for SKU-XXX to N
  let m = q.match(/(?:set|update)\s+stock\s+(?:for|of)\s+(sku[-\s]*[a-z0-9\-]+)\s*(?:to|=)\s*(\d+)/i);
  if (m) {
    const sku = m[1].replace(/\s+/g,'').toUpperCase();
    const newStock = Number(m[2]);
    const items = await getAllDocuments('inventory', 1000);
    const found = items.find(i => String(i.sku||'').toUpperCase() === sku);
    if (!found) return { text: `❌ I couldn't find SKU ${sku} in inventory.` };
    
    const action = { 
      type: 'update_inventory_stock', 
      payload: { id: found.id, sku, stock: newStock },
      endpoint: `/inventory/api/${found.id}`,
      method: 'PUT'
    };
    
    // Auto-execute if requested with keywords
    if (autoExecute || q.includes('execute') || q.includes('confirm') || q.includes('do it')) {
      const result = await executeInventoryAction(action);
      return { text: result.message, executed: true, action };
    }
    
    return {
      text: `🔄 I can update **${found.name}** (${sku}) stock from ${found.stock} to ${newStock}. Say "execute" or "confirm" to proceed.`,
      action,
      confirmation: true
    };
  }

  // Add inventory item (supports defaults) with flexible phrasing.
  // Examples:
  // - add 50 premium t-shirts price 25 to inventory
  // - add 50 black raw material shirts
  // - add premium t-shirts (as materials)
  // - add 20 vinyl sheets at $1.25
  {
    // Extract quantity (optional)
    const qtyMatch = q.match(/\b(?:add|create|put)\s+(\d+)\b/);
    // Extract name (between "add" and one of delimiters: to inventory | as <cat> | price/cost/at | end)
    const nameMatch = q.match(/add\s+(?:\d+\s+)?(.+?)(?=\s+(?:to\s+inventory|as\s+|price|cost|at\s+\$?|$))/i);
    // Extract price anywhere
    const priceMatch = q.match(/\b(?:price|cost|at)\s*\$?\s*(\d+(?:\.\d+)?)/i);
    // Extract explicit category if present
    const catMatch = q.match(/\bas\s+(raw\s*materials?|materials?|apparel|drinkware|stickers?|headwear|prints?)\b/i);
    // Check this is indeed an add intent
    const isAdd = /^\s*add\b/.test(q);

    if (isAdd && nameMatch) {
      const stock = qtyMatch ? Number(qtyMatch[1]) : 1;
      const name = (nameMatch[1] || '').trim();
      const isExplicitNew = /\bnew\b/.test(q);
      const existingItems = await getAllDocuments('inventory', 1000);
      const existing = existingItems.find(i => (i.name||'').toLowerCase() === name.toLowerCase());
      if (existing && !isExplicitNew && !/sku\s*[-a-z0-9]+/i.test(q)) {
        const action = {
          type: 'increment_inventory_stock',
          payload: { id: existing.id, delta: stock, sku: existing.sku },
          endpoint: `/inventory/api/${existing.id}`,
          method: 'PUT'
        };
        const result = await executeInventoryAction(action);
        if (clientId && result && result.success) {
          setSession(clientId, { lastInventory: { id: existing.id, name: existing.name, sku: existing.sku }, expiresAt: Date.now() + 10*60*1000 });
        }
        return { text: result.message + ` (Merged with existing item ${existing.sku})`, executed: true, action };
      }
      const explicitCategory = catMatch ? catMatch[1].toLowerCase() : '';
      let category = explicitCategory ? (
                          explicitCategory.startsWith('pack') ? 'Packing Materials'
                        : explicitCategory.startsWith('raw') ? 'Materials'
                        : explicitCategory.startsWith('mater') ? 'Materials'
                        : explicitCategory.charAt(0).toUpperCase() + explicitCategory.slice(1)
                        ) : guessCategory(name);
      // If user mentions materials/raw material anywhere, treat as Materials; packing keywords to Packing Materials
      if (/(pack(ing)?\s*materials?|packaging|box|mailer|bubble\s*wrap|tape|label)/.test(q)) category = 'Packing Materials';
      else if (/raw\s*material|\bmaterials\b/.test(q)) category = 'Materials';

      const price = priceMatch ? Number(priceMatch[1]) : guessPrice(name);
      const sku = guessSku(name);
      const threshold = guessThreshold(stock);

      const action = {
        type: 'create_inventory',
        payload: { name, sku, stock, price, status: 'active', threshold, category },
        endpoint: '/inventory/api',
        method: 'POST'
      };

      // Auto-execute adds by default (no confirmation needed)
      if (autoExecute || true) {
        const result = await executeInventoryAction(action);
        if (clientId && result && result.success) {
          setSession(clientId, { lastInventory: { id: result.id, name, sku }, expiresAt: Date.now() + 10*60*1000 });
        }
        return { text: result.message + ` (Defaults applied: SKU ${sku}, $${Number(price).toFixed(2)}, category ${category}, threshold ${threshold})`, executed: true, action };
      }

      // Fallback (should not hit because we auto-execute)
      return {
        text: `➕ I can add **"${name}"** (SKU: ${sku}) with ${stock} units at $${price} each [category: ${category}, threshold: ${threshold}].`,
        action,
        confirmation: false
      };
    }
  }

  // Delete inventory item by SKU
  m = q.match(/(?:delete|remove)\s+(?:inventory\s+)?(?:item\s+)?(sku[-\s]*[a-z0-9\-]+)/i);
  if (m) {
    const sku = m[1].replace(/\s+/g,'').toUpperCase();
    const items = await getAllDocuments('inventory', 1000);
    const found = items.find(i => String(i.sku||'').toUpperCase() === sku);
    if (!found) return { text: `❌ I couldn't find SKU ${sku} in inventory.` };
    
    const action = { 
      type: 'delete_inventory', 
      payload: { id: found.id, sku },
      endpoint: `/inventory/api/${found.id}`,
      method: 'DELETE'
    };
    
    if (autoExecute || q.includes('execute') || q.includes('confirm') || q.includes('do it')) {
      const result = await executeInventoryAction(action);
      return { text: result.message, executed: true, action };
    }
    
    return {
      text: `🗑️ I can delete **${found.name}** (${sku}). This action cannot be undone. Say "execute" or "confirm" to delete.`,
      action,
      confirmation: true
    };
  }

  // DIRECT ORDER ACTIONS
  
  // Mark/Update order status
  m = q.match(/(?:mark|update|set)\s+order\s+([a-z0-9\-]+)\s+(?:as\s+)?(?:status\s+)?(?:to\s+)?(pending|processing|shipped|delivered)/i);
  if (m) {
    const ord = m[1].toUpperCase();
    const newStatus = m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase();
    const orders = await getAllDocuments('orders', 1000);
    const found = orders.find(o => (o.orderNumber||'').toUpperCase() === ord || (o.id||'').toUpperCase() === ord);
    if (!found) return { text: `❌ I couldn't find order ${ord}.` };
    
    const action = { 
      type: 'update_order_status', 
      payload: { id: found.id, status: newStatus },
      endpoint: `/orders/${found.id}`,
      method: 'PATCH'
    };
    
    if (autoExecute || q.includes('execute') || q.includes('confirm') || q.includes('do it')) {
      const result = await executeOrderAction(action);
      return { text: result.message, executed: true, action };
    }
    
    return {
      text: `🔄 I can mark order **${found.orderNumber||found.id}** as **${newStatus}**. Say "execute" or "confirm" to proceed.`,
      action,
      confirmation: true
    };
  }

  // IMAGE TASKS (local orchestration)
  // Generate design image
  let mImg = q.match(/(?:generate|create|design|make)\s+(?:an?\s+)?(?:image|design|art|mockup|logo)(?:\s+for)?\s+(.+?)(?:\.|$)/i);
  if (mImg) {
    try {
      const subject = mImg[1].trim();
      const result = await generateDesignImage(`High-resolution printable design: ${subject}. Vector-like, clean edges, suitable for DTF printing.`);
      if (clientId) setSession(clientId, { lastDesign: { url: result.url, subject }, expiresAt: Date.now() + 10*60*1000 });
      return { text: `🖼️ Generated design for "${subject}": ${result.url}\nThis is saved locally and ready for printing or upload to NinjaTransfer.`, data: { url: result.url } };
    } catch (e) {
      return { text: `❌ Failed to generate image: ${e.message}` };
    }
  }

  // Attach image URL to an inventory item by SKU or last created item
  mImg = q.match(/(?:set|attach|add)\s+(?:image|photo|picture).*?(https?:[^\s]+)?/i);
  if (mImg) {
    const urlMatch = q.match(/https?:[^\s]+/i);
    const skuMatch = q.match(/\b(sku[-\s]*[a-z0-9\-]+)\b/i);
    const url = urlMatch ? urlMatch[0] : null;
    let targetId = null; let targetLabel = '';
    const items = await getAllDocuments('inventory', 1000);
    if (skuMatch) {
      const sku = skuMatch[1].replace(/\s+/g,'').toUpperCase();
      const found = items.find(i => String(i.sku||'').toUpperCase() === sku);
      if (found) { targetId = found.id; targetLabel = `${found.name} (${sku})`; }
    } else if (clientId) {
      const s = getSession(clientId);
      if (s && s.lastInventory && s.lastInventory.id) { targetId = s.lastInventory.id; targetLabel = s.lastInventory.sku || s.lastInventory.name; }
    }
    if (!targetId) return { text: '❌ Please specify which item. Include a SKU like "for SKU-123" or add the item first.' };
    if (!url) return { text: '❌ Please include an image URL to attach.' };
    await updateDocument('inventory', targetId, { imageUrl: url });
    return { text: `✅ Attached image to ${targetLabel}.` };
  }

  // Set NinjaTransfer link for last item or by SKU
  mImg = q.match(/(?:set|add)\s+(?:ninja\s*transfer|ninjatransfer)\s+(?:link|url)\s+(https?:[^\s]+)/i);
  if (mImg) {
    const link = mImg[1];
    const skuMatch = q.match(/\b(sku[-\s]*[a-z0-9\-]+)\b/i);
    let targetId = null; let targetLabel = '';
    const items = await getAllDocuments('inventory', 1000);
    if (skuMatch) {
      const sku = skuMatch[1].replace(/\s+/g,'').toUpperCase();
      const found = items.find(i => String(i.sku||'').toUpperCase() === sku);
      if (found) { targetId = found.id; targetLabel = `${found.name} (${sku})`; }
    } else if (clientId) {
      const s = getSession(clientId);
      if (s && s.lastInventory && s.lastInventory.id) { targetId = s.lastInventory.id; targetLabel = s.lastInventory.sku || s.lastInventory.name; }
    }
    if (!targetId) return { text: '❌ Please specify which item to attach the NinjaTransfer link to (use SKU or add the item first).'};
    await updateDocument('inventory', targetId, { ninjatransferLink: link });
    return { text: `🔗 Added NinjaTransfer link to ${targetLabel}.` };
  }

  // Create order (pattern: create order for John Smith product Wireless Headphones qty 2 price 149.99)
  m = q.match(/create\s+(?:an?\s+)?order\s+for\s+(.+?)(?:\s+product\s+(.+?))?(?:\s+qty\s+(\d+))?(?:\s+price\s+(\d+(?:\.\d+)?))?$/i);
  if (m) {
    const customerName = (m[1]||'').trim();
    const product = (m[2]||'Custom Item').trim();
    const quantity = Number(m[3]||1);
    const price = Number(m[4]||0);
    
    const action = { 
      type: 'create_order', 
      payload: { customerName, product, quantity, price, status: 'Pending' },
      endpoint: '/orders',
      method: 'POST'
    };
    
    if (autoExecute || q.includes('execute') || q.includes('confirm') || q.includes('do it')) {
      const result = await executeOrderAction(action);
      return { text: result.message, executed: true, action };
    }
    
    return {
      text: `📝 I can create an order for **${customerName}**: ${quantity} × ${product} at $${price} each. Say "execute" or "confirm" to create.`,
      action,
      confirmation: true
    };
  }

  // Delete order
  m = q.match(/(?:delete|remove|cancel)\s+order\s+([a-z0-9\-]+)/i);
  if (m) {
    const ord = m[1].toUpperCase();
    const orders = await getAllDocuments('orders', 1000);
    const found = orders.find(o => (o.orderNumber||'').toUpperCase() === ord || (o.id||'').toUpperCase() === ord);
    if (!found) return { text: `❌ I couldn't find order ${ord}.` };
    
    const action = { 
      type: 'delete_order', 
      payload: { id: found.id, orderNumber: found.orderNumber },
      endpoint: `/orders/${found.id}`,
      method: 'DELETE'
    };
    
    if (autoExecute || q.includes('execute') || q.includes('confirm') || q.includes('do it')) {
      const result = await executeOrderAction(action);
      return { text: result.message, executed: true, action };
    }
    
    return {
      text: `🗑️ I can delete order **${found.orderNumber||found.id}** for ${found.customerName}. This action cannot be undone. Say "execute" or "confirm" to delete.`,
      action,
      confirmation: true
    };
  }

  // Execute previous action if user says confirm/execute/do it
  if (q.includes('execute') || q.includes('confirm') || q.includes('do it') || q.includes('yes do it')) {
    return { text: `✅ Ready to execute! Please provide the specific action you'd like me to perform.` };
  }

  return null;
}

// Enhanced AI handler with direct execution capabilities
module.exports = async function handleAICoPilot(req, res) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'local';
  try {
    if (!allowRequest(ip)) return res.status(429).json({ error: 'Too many requests. Please slow down.' });

  const { textPart, imagePart, responseMimeType, clientId } = req.body || {};
    const prompt = normalizeStr(textPart);
    if (!prompt) return res.status(400).json({ error: 'Missing textPart' });

  // Record user message
  appendChatHistory(clientId, [{ role: 'user', text: prompt }]);

  // Provider keys
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY; // Google Gemini
  const openaiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY || process.env.GEAPI_KEY; // OpenAI (includes GEAPI_KEY fallback)
    
    // Check for direct actions first
  const directAction = await handleLocalIntents(prompt, true, clientId, { imagePart }); // Auto-execute enabled
    if (directAction && directAction.executed) {
      appendAILog({ ip, type: 'direct_action', prompt, result: directAction });
      appendChatHistory(clientId, [{ role: 'assistant', text: directAction.text, action: directAction.action }]);
      return res.json({ text: directAction.text, executed: true, action: directAction.action, source: 'direct' });
    }
    if (directAction && !directAction.executed) {
      // Awaiting user choice/confirmation; don't call LLMs
      appendAILog({ ip, type: 'direct_prompt', prompt, result: directAction });
      appendChatHistory(clientId, [{ role: 'assistant', text: directAction.text }]);
      return res.json({ text: directAction.text, executed: false, awaiting: directAction.awaiting || 'input', options: directAction.options, uiCommand: directAction.uiCommand, source: 'direct' });
    }

    // Include brief chat memory to aid conversational flow
    let recentHistory = '';
    try {
      const file = path.join(__dirname, '..', 'data', 'ai_history.json');
      if (clientId && fs.existsSync(file)) {
        const all = JSON.parse(fs.readFileSync(file, 'utf8')||'[]').filter(x => x.clientId === clientId);
        const last6 = all.slice(-6).map(x => `${x.role||'user'}: ${x.text}`).join('\n');
        recentHistory = last6 ? `\nRecent context:\n${last6}\n` : '';
      }
    } catch (_) {}

    // Shared system prompt for LLM providers
    const systemPrompt = `You are Easly AI, an intelligent admin assistant for ShopEasly print-on-demand business. You have full administrative access and can:

🏪 **Business Context:**
- Manage inventory (add, update, delete items and stock levels)
- Process orders (create, update status, cancel orders)
- Provide analytics and business insights
- Handle customer inquiries professionally

🤖 **Your Capabilities:**
- Direct database operations on inventory and orders
- Natural language understanding for business commands
- Proactive recommendations for business optimization
- Professional customer service responses

💬 **Communication Style:**
- Use emojis and markdown for clarity
- Be concise but thorough (max 6 bullet points for lists)
- Confirm actions before executing destructive operations
- Provide helpful suggestions and insights

📊 **Available Commands:**
- "inventory summary" - Show current stock overview
- "order status" - Display pending/processing orders
- "set stock SKU-123 to 50" - Update inventory levels
- "add 100 t-shirts price 15 to inventory" - Create new items
- "mark order ORD-123 as delivered" - Update order status
- "create order for John Smith product X qty 2 price 25" - New orders

${recentHistory}\nUser: ${prompt}`;

  // Use Gemini when available and prompt qualifies (first choice)
  if (apiKey && shouldUseLLM(prompt)) {
      try {
        const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey;
        const userParts = [];
        if (imagePart) userParts.push({ inline_data: { mime_type: 'image/png', data: imagePart } });

        userParts.push({ text: systemPrompt });

        const body = {
          contents: [ { role: 'user', parts: userParts } ],
          generationConfig: { 
            response_mime_type: responseMimeType || 'text/plain',
            temperature: 0.7,
            max_output_tokens: 1000
          }
        };

        const response = await axios.post(geminiUrl, body, { 
          headers: { 'Content-Type': 'application/json' }, 
          timeout: 15000 
        });
        
        let aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        // Prevent fabricated summary/report content from LLM
        const fabricatedReport = /(Inventory Summary|Orders Overview|Total SKUs|Units in stock|Low stock items|Out of stock|Top pending orders|Pending:|Processing:|Delivered:)/i;
        if (fabricatedReport.test(aiText)) {
          aiText = 'I can pull live numbers from your database. Ask for "inventory summary" or "order status", or specify an item name/SKU (e.g., "how many black shirts do we have?").';
        }
        const maybeJson = extractJsonCandidate(aiText);

        appendAILog({ ip, type: 'gemini_enhanced', prompt, usage: { model: 'gemini-1.5-flash' } });

        // Also check for suggested actions
        let localAction = null;
        try {
          const local = await handleLocalIntents(prompt, false, clientId, { imagePart }); // Don't auto-execute
          if (local && local.action) localAction = local.action;
        } catch (_) {}

        if (maybeJson) {
          const out = { text: JSON.stringify(maybeJson, null, 2), data: maybeJson, source: 'gemini_enhanced', action: localAction };
          appendChatHistory(clientId, [{ role: 'assistant', text: out.text, action: localAction || null }]);
          return res.json(out);
        }
        
        appendChatHistory(clientId, [{ role: 'assistant', text: aiText, action: localAction || null }]);
        return res.json({ text: aiText, source: 'gemini_enhanced', action: localAction });
      } catch (err) {
        appendAILog({ ip, type: 'gemini_error', prompt, error: err.message });
      }
    }

  // Use OpenAI when configured and prompt qualifies
  if (openaiKey && shouldUseLLM(prompt)) {
      try {
        const openaiUrl = 'https://api.openai.com/v1/chat/completions';
        const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

        const messages = [
          { role: 'system', content: systemPrompt.replace(/\*\*|\n/g, ' ') },
          { role: 'user', content: prompt }
        ];

        const body = {
          model,
          messages,
          temperature: 0.7,
          max_tokens: 1000
        };

        const response = await axios.post(openaiUrl, body, {
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
          timeout: 15000
        });

        let aiText = response.data?.choices?.[0]?.message?.content || '';
        // Prevent fabricated summary/report content from LLM
        const fabricatedReport = /(Inventory Summary|Orders Overview|Total SKUs|Units in stock|Low stock items|Out of stock|Top pending orders|Pending:|Processing:|Delivered:)/i;
        if (fabricatedReport.test(aiText)) {
          aiText = 'I can pull live numbers from your database. Ask for "inventory summary" or "order status", or specify an item name/SKU (e.g., "how many black shirts do we have?").';
        }
        const maybeJson = extractJsonCandidate(aiText);

        appendAILog({ ip, type: 'openai_enhanced', prompt, usage: { model } });

        // Also check for suggested actions
        let localAction = null;
        try {
          const local = await handleLocalIntents(prompt, false); // Don't auto-execute
          if (local && local.action) localAction = local.action;
        } catch (_) {}

        if (maybeJson) {
          const out = { text: JSON.stringify(maybeJson, null, 2), data: maybeJson, source: 'openai_enhanced', action: localAction };
          appendChatHistory(clientId, [{ role: 'assistant', text: out.text, action: localAction || null }]);
          return res.json(out);
        }

        appendChatHistory(clientId, [{ role: 'assistant', text: aiText, action: localAction || null }]);
        return res.json({ text: aiText, source: 'openai_enhanced', action: localAction });
      } catch (err) {
        appendAILog({ ip, type: 'openai_error', prompt, error: err.message });
      }
    }

    // Fallback to local intents
  const local = await handleLocalIntents(prompt, false, clientId, { imagePart });
    if (local) {
      appendAILog({ ip, type: 'local_enhanced', prompt, result: local.data });
      const payload = { text: local.text, data: local.data, action: local.action, options: local.options, uiCommand: local.uiCommand, source: apiKey ? 'local_fallback' : 'local_enhanced' };
      appendChatHistory(clientId, [{ role: 'assistant', text: local.text, action: local.action || null }]);
      return res.json(payload);
    }

    // If we have provider keys but gating blocked LLM usage and no local intent matched,
    // attempt a final low-temp external call for general assistance.
    if (apiKey || openaiKey) {
      try {
        const useGemini = Boolean(apiKey);
        if (useGemini) {
          const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey;
          const body = { contents: [{ role: 'user', parts: [{ text: `User: ${prompt}` }] }], generationConfig: { response_mime_type: 'text/plain', temperature: 0.2, max_output_tokens: 400 } };
          const response = await axios.post(geminiUrl, body, { headers: { 'Content-Type': 'application/json' }, timeout: 12000 });
          const aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'I can help with that.';
          appendAILog({ ip, type: 'gemini_enhanced_fallback', prompt });
          appendChatHistory(clientId, [{ role: 'assistant', text: aiText }]);
          return res.json({ text: aiText, source: 'gemini_enhanced_fallback' });
        } else {
          const openaiUrl = 'https://api.openai.com/v1/chat/completions';
          const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
          const body = { model, messages: [{ role: 'system', content: 'Be concise and helpful.' }, { role: 'user', content: prompt }], temperature: 0.2, max_tokens: 400 };
          const response = await axios.post(openaiUrl, body, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` }, timeout: 12000 });
          const aiText = response.data?.choices?.[0]?.message?.content || 'I can help with that.';
          appendAILog({ ip, type: 'openai_enhanced_fallback', prompt });
          appendChatHistory(clientId, [{ role: 'assistant', text: aiText }]);
          return res.json({ text: aiText, source: 'openai_enhanced_fallback' });
        }
      } catch (err) {
        appendAILog({ ip, type: 'fallback_llm_error', prompt, error: err.message });
      }
    }

    // Final fallback
  const offline = '🤖 AI is offline. Configure GEMINI_API_KEY or OPENAI_API_KEY in .env (app folder) and restart the server for enhanced capabilities.';
    appendAILog({ ip, type: 'offline', prompt });
    return res.json({ text: offline, source: 'offline' });
  } catch (err) {
    appendAILog({ ip, type: 'error', error: err.message });
    return res.status(500).json({ error: 'AI request failed', details: err.message });
  }
};