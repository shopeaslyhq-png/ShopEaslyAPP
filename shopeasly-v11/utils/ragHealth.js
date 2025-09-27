// Lightweight RAG (Chroma) availability check
// Attempts to load chromadb client and list (or create) the collection
// Caches result for the process lifetime.
let cached = null;

async function checkRagAvailability(opts = {}) {
  if (cached && !opts.force) return cached;
  const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
  let available = false;
  let reason = null;
  let collection = process.env.CHROMA_COLLECTION || 'shopeasly_data';
  try {
    let ChromaClient = null;
    try { ({ ChromaClient } = require('chromadb')); } catch (e) {
      reason = 'chromadb module missing';
      cached = { available, reason, collection, url: CHROMA_URL };
      return cached;
    }
    const client = new ChromaClient({ path: CHROMA_URL });
    await client.getOrCreateCollection({ name: collection });
    available = true;
  } catch (err) {
    reason = err.message || String(err);
  }
  cached = { available, reason, collection, url: process.env.CHROMA_URL || 'http://localhost:8000' };
  return cached;
}

module.exports = { checkRagAvailability };