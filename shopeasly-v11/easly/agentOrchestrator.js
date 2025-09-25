/**
 * easly/agentOrchestrator.js
 *
 * Planner-Executor agentic loop with RAG using LangChain.js, OpenAI LLM, and a local ChromaDB store.
 * - getRelevantContext: queries the Chroma collection for top-k relevant docs
 * - runEaslyAgent: composes plan -> retrieve -> generate using a Runnable chain
 */

// Note: This module uses ESM-like imports available via require() shims where needed.
const { ChromaClient } = require('chromadb');
const OpenAI = require('openai');
const { RunnableSequence, RunnablePassthrough } = require('@langchain/core/runnables');
const { ChatOpenAI } = require('@langchain/openai');
const axios = require('axios');

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
  const client = new ChromaClient({ path: CHROMA_URL });
  const collection = await client.getOrCreateCollection({ name: COLLECTION_NAME });

  // Use OpenAI embeddings for the query
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing for embeddings.');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const embedModel = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
  const embResp = await openai.embeddings.create({ model: embedModel, input: [query] });
  const queryVec = embResp.data[0].embedding;

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
async function runEaslyAgent(prompt) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required (for LLM).');

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
    }
  };

  // Ask the model if a tool is needed before final answer
  const decisionPrompt = (vars) => [
    { role: 'system', content: 'Decide if calling a tool will help. Output strict JSON: {"useTool":boolean, "toolName":"getInventorySummary|createInventoryItem|updateInventoryStock|none", "args":object, "reason":string}. If not needed, set useTool=false and toolName="none".' },
    { role: 'user', content: `QUESTION: ${vars.query}\nCONTEXT:\n${vars.context || '(none)'}` }
  ];

  // 1) Retrieve context
  const planned = await plan({ prompt });
  // 2) Decide on tool
  const decisionResp = await llm.invoke(decisionPrompt(planned));
  const decision = tryExtractJson(String(decisionResp?.content || '')) || { useTool: false, toolName: 'none', args: {} };

  let toolOutcome = null;
  if (decision.useTool && TOOLS[decision.toolName]) {
    try {
      toolOutcome = await TOOLS[decision.toolName](decision.args || {});
    } catch (e) {
      toolOutcome = { error: String(e.message || e) };
    }
  }

  // 3) Final answer with tool result (if any)
  const finalMessages = [
    { role: 'system', content: systemPrompt() },
    { role: 'user', content: `QUESTION: ${planned.query}` },
    { role: 'user', content: `CONTEXT:\n${planned.context || '(none)'}` },
    { role: 'user', content: `TOOL_RESULT:\n${toolOutcome ? JSON.stringify(toolOutcome).slice(0, 4000) : '(none)'}` }
  ];
  const finalResp = await llm.invoke(finalMessages);
  return String(finalResp?.content || '').trim();
}

module.exports = { getRelevantContext, runEaslyAgent };
