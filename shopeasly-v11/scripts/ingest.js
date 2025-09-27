#!/usr/bin/env node
/**
 * scripts/ingest.js
 *
 * Ingest ShopEasly business data (inventory and orders) into a local ChromaDB collection (shopeasly_data)
 * using OpenAI embeddings. This enables Retrieval-Augmented Generation (RAG) for the agent.
 */

const fs = require('fs');
const path = require('path');
let ChromaClient = null;
try { ({ ChromaClient } = require('chromadb')); } catch (e) {
  console.error('[ingest] chromadb module not found. Install with `npm install chromadb` at repo root.');
  process.exit(1);
}
const OpenAI = require('openai');

const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
const OPENAI_EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
const COLLECTION_NAME = process.env.CHROMA_COLLECTION || 'shopeasly_data';

/**
 * Load a JSON file if present; return [] when missing.
 * @param {string} filePath Absolute path to JSON file.
 * @returns {any[]} Parsed array or []
 */
function loadJsonArray(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw || '[]');
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn(`Warn: could not read ${filePath}: ${e.message}`);
    return [];
  }
}

/**
 * Build natural-language documents for inventory items.
 * @param {any[]} items
 */
function buildInventoryDocs(items) {
  const docs = [];
  for (const it of items) {
    const id = `inv-${it.id || it.sku || it.name || Math.random().toString(36).slice(2)}`;
    const lines = [
      `Inventory Item: ${it.name || 'Unknown'}`,
      it.sku ? `SKU: ${it.sku}` : '',
      it.category ? `Category: ${it.category}` : '',
      `Stock: ${it.stock != null ? it.stock : 'N/A'}`,
      it.price != null ? `Price: $${it.price}` : '',
      it.status ? `Status: ${it.status}` : '',
      it.threshold != null ? `Threshold: ${it.threshold}` : '',
      it.description ? `Description: ${it.description}` : ''
    ].filter(Boolean);
    const text = lines.join(' | ');
    docs.push({ id, text, metadata: { source: 'inventory.json', type: 'inventory', refId: it.id || null, sku: it.sku || null } });
  }
  return docs;
}

/**
 * Build natural-language documents for orders.
 * @param {any[]} orders
 */
function buildOrderDocs(orders) {
  const docs = [];
  for (const o of orders) {
    const id = `ord-${o.id || o.orderNumber || Math.random().toString(36).slice(2)}`;
    const lines = [
      `Order: ${o.orderNumber || o.id || 'Unknown'}`,
      o.customerName ? `Customer: ${o.customerName}` : '',
      o.productName || o.product ? `Product: ${o.productName || o.product}` : '',
      `Quantity: ${o.quantity != null ? o.quantity : 'N/A'}`,
      o.status ? `Status: ${o.status}` : '',
      o.total != null ? `Total: $${o.total}` : '',
      o.date ? `Date: ${o.date}` : ''
    ].filter(Boolean);
    const text = lines.join(' | ');
    docs.push({ id, text, metadata: { source: 'orders.json', type: 'order', refId: o.id || null, orderNumber: o.orderNumber || null } });
  }
  return docs;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required for embeddings. Set it in your environment.');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const client = new ChromaClient({ path: CHROMA_URL });
  const collection = await client.getOrCreateCollection({ name: COLLECTION_NAME });

  const invPath = path.join(__dirname, '..', 'data', 'inventory.json');
  const ordPath = path.join(__dirname, '..', 'data', 'orders.json');
  const inv = loadJsonArray(invPath);
  const ord = loadJsonArray(ordPath);

  const invDocs = buildInventoryDocs(inv);
  const ordDocs = buildOrderDocs(ord);
  const docs = [...invDocs, ...ordDocs];

  if (docs.length === 0) {
    console.log('No documents to ingest. Ensure data/inventory.json and data/orders.json exist.');
    return;
  }

  // Embed in manageable batches to avoid token/size limits
  const BATCH = 100;
  let added = 0;
  for (let i = 0; i < docs.length; i += BATCH) {
    const slice = docs.slice(i, i + BATCH);
    const inputs = slice.map(d => d.text);
    const embResp = await openai.embeddings.create({ model: OPENAI_EMBED_MODEL, input: inputs });
    const vectors = embResp.data.map(e => e.embedding);

    await collection.add({
      ids: slice.map(d => d.id),
      documents: slice.map(d => d.text),
      metadatas: slice.map(d => d.metadata),
      embeddings: vectors
    });
    added += slice.length;
    console.log(`Added ${added}/${docs.length} documents...`);
  }

  console.log(`✅ Ingestion complete. Collection: ${COLLECTION_NAME}. Total documents: ${docs.length}.`);
}

main().catch(err => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
