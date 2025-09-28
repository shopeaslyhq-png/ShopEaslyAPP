/**
 * easly/agentOrchestrator.js
 *
 * Planner-Executor agentic loop with RAG using LangChain.js, OpenAI LLM, and a local ChromaDB store.
 * - getRelevantContext: queries the Chroma collection for top-k relevant docs
 * - runEaslyAgent: composes plan -> retrieve -> generate using a Runnable chain
 */

// Note: This module uses ESM-like imports available via require() shims where needed.
let ChromaClient = null;
// Optional ChromaDB: install locally with `npm install chromadb` (not required in production deploy if RAG not needed)
try { ({ ChromaClient } = require('chromadb')); } catch (e) {
  console.warn('[agentOrchestrator] chromadb not installed; RAG context retrieval will return empty context. Install chromadb or set CHROMA_URL.');
}
const OpenAI = require('openai');
const { RunnableSequence, RunnablePassthrough } = require('@langchain/core/runnables');
const { ChatOpenAI } = require('@langchain/openai');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { emitEvent } = require('../utils/securityMiddleware');

const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
const COLLECTION_NAME = process.env.CHROMA_COLLECTION || 'shopeasly_data';

/**
 * Build a compact system prompt to steer the LLM.
 * @returns {string}
 */
function systemPrompt() {
  return [
    'You are Easly AI, an expert assistant for ShopEasly. ',
    'Use the provided CONTEXT faithfully. If the context does not contain the answer, say so and suggest the next best step.',
    'Keep answers concise and helpful. Never invent data beyond the retrieved context and the user prompt.'
  ].join('');
}

/**
 * Extract JSON object from a model response that may contain extra text or fenced code blocks.
 * @param {string} text
 * @returns {any|null}
 */
function tryExtractJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch(_) {}
  const m = String(text).match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (m) {
    try { return JSON.parse(m[1]); } catch(_) {}
  }
  return null;
}

/**
 * Generate a SKU similar to server-side logic (best-effort client mirror)
 * @param {string} name
 * @param {string} category
 */
function generateSkuFrom(name, category) {
  const n = String(name || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toUpperCase();
  const c = String(category || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toUpperCase();
  const base = (c.slice(0,3) + '-' + n.slice(0,8)).replace(/--+/g,'-').replace(/^-+|-+$/g,'');
  const rand = Math.random().toString(36).slice(2,5).toUpperCase();
  return `${base}-${rand}`;
}

/**
 * getRelevantContext
 * Query ChromaDB collection for documents relevant to the user query, return top 5 concatenated.
 * @param {string} query The user query text.
 * @param {object} [opts]
 * @param {number} [opts.k=5] Top K results to include.
 * @returns {Promise<string>} Concatenated context text.
 */
async function getRelevantContext(query, opts = {}) {
  const k = Number.isFinite(opts.k) ? opts.k : 5;
  if (!ChromaClient) return '';
  const client = new ChromaClient({ path: CHROMA_URL });
  const collection = await client.getOrCreateCollection({ name: COLLECTION_NAME });

  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing for embeddings.');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const embedModel = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';

  // Simple on-disk embedding cache for queries
  const cacheFile = path.join(__dirname, '..', 'data', 'embeddings_cache.json');
  let cache = {};
  try { if (fs.existsSync(cacheFile)) cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')||'{}'); } catch(_) {}
  const hash = crypto.createHash('sha1').update(embedModel + '|' + query).digest('hex');
  let queryVec = cache[hash];
  if (!queryVec) {
    const embResp = await openai.embeddings.create({ model: embedModel, input: [query] });
    queryVec = embResp.data[0].embedding;
    cache[hash] = queryVec;
    try { fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2)); } catch(_) {}
  }

  const res = await collection.query({ queryEmbeddings: [queryVec], nResults: k });
  const docs = (res.documents && res.documents[0]) || [];
  const metas = (res.metadatas && res.metadatas[0]) || [];
  // Concatenate with simple dividers
  const pieces = docs.map((d, i) => `Source: ${metas[i]?.source || 'unknown'} | ${d}`);
  return pieces.join('\n---\n');
}

/**
 * runEaslyAgent
 * Execute a planner-executor style chain:
 * 1) Retrieve relevant context via getRelevantContext
 * 2) Call LLM with system prompt + context + user prompt
 * @param {string} prompt User prompt.
 * @returns {Promise<string>} Final LLM response.
 */
async function runEaslyAgent(prompt, options = {}) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required (for LLM).');
  // Single-role deployment (admin implicit) – role metadata removed
  const startedOverall = Date.now();

  // LLM wrapper (OpenAI Chat)
  const llm = new ChatOpenAI({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.2,
    openAIApiKey: process.env.OPENAI_API_KEY
  });

  // Planner step: retrieve context and ask the model if a tool call is useful
  const plan = async (input) => ({
    query: input.prompt,
    context: await getRelevantContext(input.prompt)
  });

  // Prompt template assembly
  const buildChatMessages = (vars) => [
    { role: 'system', content: systemPrompt() },
    { role: 'user', content: `CONTEXT:\n${vars.context || '(none)'}\n\nQUESTION: ${vars.query}` }
  ];

  // Simple tool catalog for the agent
  const TOOLS = {
    async getInventorySummary() {
      const url = process.env.AGENT_API_BASE || 'http://localhost:10000';
      const resp = await axios.get(`${url}/inventory/api`);
      const items = Array.isArray(resp.data) ? resp.data : [];
      return { count: items.length, items };
    },
    async createInventoryItem(args) {
      const url = process.env.AGENT_API_BASE || 'http://localhost:10000';
      const name = String(args?.name || '').trim();
      const price = Number(args?.price || 0);
      const stock = Number(args?.stock || 0);
      const category = String(args?.category || 'Products').trim();
      let sku = String(args?.sku || '').trim().toUpperCase();
      if (!name) throw new Error('name is required');
      if (!sku) sku = generateSkuFrom(name, category);
      const body = { name, sku, price, stock, category };
      const resp = await axios.post(`${url}/inventory/api`, body, { headers: { 'Content-Type': 'application/json' } });
      return resp.data;
    },
    async updateInventoryStock(args) {
      const url = process.env.AGENT_API_BASE || 'http://localhost:10000';
      const id = String(args?.id || '').trim();
      const stock = Number(args?.stock);
      if (!id) throw new Error('id is required');
      if (!Number.isFinite(stock)) throw new Error('stock must be a number');
      const resp = await axios.put(`${url}/inventory/api/${id}`, { stock }, { headers: { 'Content-Type': 'application/json' } });
      return resp.data;
    },
    async listOrders(args) {
      const url = process.env.AGENT_API_BASE || 'http://localhost:10000';
      const limit = Number.isFinite(Number(args?.limit)) ? Number(args.limit) : 200;
      const resp = await axios.get(`${url}/orders/api`, { params: { limit } });
      return Array.isArray(resp.data) ? resp.data : [];
    },
    async updateOrderStatus(args) {
      const url = process.env.AGENT_API_BASE || 'http://localhost:10000';
      const id = String(args?.id || '').trim();
      const status = String(args?.status || '').trim();
      if (!id) throw new Error('id is required');
      if (!status) throw new Error('status is required');
      const resp = await axios.patch(`${url}/orders/${id}/status`, { status }, { headers: { 'Content-Type': 'application/json' } });
      return resp.data;
    },
    async createOrder(args) {
      const url = process.env.AGENT_API_BASE || 'http://localhost:10000';
      const body = {
        customerName: String(args?.customerName || '').trim(),
        product: args?.productId || args?.productSku ? undefined : String(args?.product || '').trim(),
        productId: args?.productId ? String(args.productId).trim() : undefined,
        productSku: args?.productSku ? String(args.productSku).trim() : undefined,
        quantity: Number.parseInt(args?.quantity, 10),
        price: args?.price !== undefined ? Number(args.price) : undefined,
        status: args?.status ? String(args.status) : undefined,
        notes: args?.notes ? String(args.notes) : undefined
      };
      if (!body.customerName) throw new Error('customerName is required');
      if ((body.product == null) && !body.productId && !body.productSku) throw new Error('product or productId or productSku is required');
      if (!Number.isFinite(body.quantity) || body.quantity < 1) throw new Error('quantity must be >= 1');
      const resp = await axios.post(`${url}/orders`, body, { headers: { 'Content-Type': 'application/json' } });
      return resp.data;
    },
    async initiateProductCreation(args) {
      const url = process.env.AGENT_API_BASE || 'http://localhost:10000';
      const body = {
        name: String(args?.name || '').trim(),
        price: Number(args?.price || 0),
        quantity: Number.isFinite(Number(args?.quantity)) ? Number(args.quantity) : 0,
        materialsIds: Array.isArray(args?.materialsIds) ? args.materialsIds.map(String) : [],
        materialsUsage: args?.materialsUsage || {},
        packagingId: args?.packagingId ? String(args.packagingId) : '',
        category: args?.category ? String(args.category) : 'Products',
        sku: args?.sku ? String(args.sku).toUpperCase() : undefined
      };
      if (!body.name) throw new Error('name is required');
      const resp = await axios.post(`${url}/inventory/api/initiate-product`, body, { headers: { 'Content-Type': 'application/json' } });
      return resp.data;
    },
    async getPackingAlerts(args) {
      const url = process.env.AGENT_API_BASE || 'http://localhost:10000';
      const threshold = Number.isFinite(Number(args?.threshold)) ? Number(args.threshold) : undefined;
      const resp = await axios.get(`${url}/inventory/api/packing/alerts`, { params: { threshold } });
      return resp.data;
    },
    async inventoryUsageReport(args) {
      const url = process.env.AGENT_API_BASE || 'http://localhost:10000';
      const start = String(args?.start || '').trim();
      const end = String(args?.end || '').trim();
      if (!start || !end) throw new Error('start and end (YYYY-MM-DD) are required');
      const resp = await axios.get(`${url}/inventory/api/usage`, { params: { start, end } });
      return resp.data;
    },
    async bulkImportInventory(args) {
      const url = process.env.AGENT_API_BASE || 'http://localhost:10000';
      const items = Array.isArray(args?.items) ? args.items : [];
      const defaultCategory = args?.defaultCategory ? String(args.defaultCategory) : undefined;
      if (items.length === 0) throw new Error('items array is required');
      const resp = await axios.post(`${url}/inventory/api/bulk`, { items, defaultCategory }, { headers: { 'Content-Type': 'application/json' } });
      return resp.data;
    },
    async deleteInventoryItem(args) {
      const url = process.env.AGENT_API_BASE || 'http://localhost:10000';
      const id = String(args?.id || '').trim();
      const confirmToken = String(args?.confirmToken || '');
      if (!id) throw new Error('id is required');
      if (confirmToken !== `CONFIRM DELETE ${id}`) {
        return { pendingConfirmation: true, message: `Type: CONFIRM DELETE ${id} to proceed.` };
      }
      const resp = await axios.delete(`${url}/inventory/api/${id}`);
      return { deleted: true, id, resp: resp.data };
    },
    async deleteOrder(args) {
      const url = process.env.AGENT_API_BASE || 'http://localhost:10000';
      const id = String(args?.id || '').trim();
      const confirmToken = String(args?.confirmToken || '');
      if (!id) throw new Error('id is required');
      if (confirmToken !== `CONFIRM DELETE ${id}`) {
        return { pendingConfirmation: true, message: `Type: CONFIRM DELETE ${id} to proceed.` };
      }
      const resp = await axios.delete(`${url}/orders/${id}`);
      return { deleted: true, id, resp: resp.data };
    }
  };

  // Role-based permissions
  // All tools allowed (admin only)
  const allowedTools = Object.keys(TOOLS);

  // Ask the model if a tool is needed before final answer
    const decisionPrompt = (vars) => [
      { role: 'system', content: 'Decide next action. Output strict JSON: {"useTool":boolean,"toolName":"getInventorySummary|createInventoryItem|updateInventoryStock|updateOrderStatus|createOrder|listOrders|initiateProductCreation|getPackingAlerts|inventoryUsageReport|bulkImportInventory|deleteInventoryItem|deleteOrder|none","args":object,"reason":string,"needsAnotherTool":boolean,"finalAnswer":string}.' },
    { role: 'user', content: `QUESTION: ${vars.query}\nCONTEXT:\n${vars.context || '(none)'}${vars.toolResults ? `\nTOOL_RESULTS_SO_FAR:\n${vars.toolResults}`: ''}` }
  ];

  const planned = await plan({ prompt });
  emitEvent('ai.plan', { prompt });
  const toolResults = [];
  let finalAnswer = null;
  const MAX_STEPS = Number(process.env.AGENT_MAX_STEPS || 3);
  for (let step = 0; step < MAX_STEPS; step++) {
    const agg = toolResults.map((r,i)=>`#${i+1} ${r.tool}: ${JSON.stringify(r.outcome).slice(0,600)}`).join('\n');
    const decisionResp = await llm.invoke(decisionPrompt({ ...planned, toolResults: agg }));
    const decision = tryExtractJson(String(decisionResp?.content || '')) || { useTool:false, toolName:'none', args:{}, needsAnotherTool:false };
  emitEvent('ai.tool.decide', { prompt, decision });
    if (!decision.useTool || decision.toolName === 'none') { finalAnswer = decision.finalAnswer || null; break; }
    if (!allowedTools.includes(decision.toolName)) { toolResults.push({ tool: decision.toolName, denied:true, outcome:{ error: 'permission denied' }}); break; }
    let outcome; const t0 = Date.now();
    try { outcome = await TOOLS[decision.toolName](decision.args || {}); } catch(e) { outcome = { error: String(e.message||e) }; }
  emitEvent('ai.tool.execute', { tool: decision.toolName, ms: Date.now()-t0, partial: !!decision.needsAnotherTool });
    toolResults.push({ tool: decision.toolName, outcome });
    if (outcome && outcome.pendingConfirmation) { finalAnswer = outcome.message; break; }
    if (!decision.needsAnotherTool) break;
  }
  if (!finalAnswer) {
    const finalMessages = [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: `QUESTION: ${planned.query}` },
      { role: 'user', content: `CONTEXT:\n${planned.context || '(none)'}` },
      { role: 'user', content: `TOOL_RESULTS:\n${toolResults.map((r,i)=>`#${i+1} ${r.tool}: ${JSON.stringify(r.outcome).slice(0,1000)}`).join('\n') || '(none)'}` }
    ];
    const finalResp = await llm.invoke(finalMessages);
    finalAnswer = String(finalResp?.content || '').trim();
  }
  emitEvent('ai.final', { prompt, steps: toolResults.length });
  try {
    const logDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive:true });
  fs.appendFileSync(path.join(logDir, 'agent_runs.ndjson'), JSON.stringify({ ts:new Date().toISOString(), prompt, steps: toolResults, ms: Date.now()-startedOverall })+'\n');
  } catch(_) {}
  return finalAnswer;
}

module.exports = { getRelevantContext, runEaslyAgent };
