const { createDocument, getAllDocuments } = require('../config/firebase');

// Store generated designs for traceability and reuse
async function addDesign({ theme, productType, style, prompt, imageUrl, metadata }) {
  if (!theme || !productType) throw new Error('theme and productType are required');
  const entry = {
    theme: String(theme).trim(),
    productType: String(productType).trim(),
    style: style ? String(style).trim() : '',
    prompt: prompt ? String(prompt) : '',
    imageUrl: imageUrl ? String(imageUrl) : '',
    metadata: metadata || {},
    createdAt: new Date().toISOString()
  };
  const docRef = await createDocument('designs', entry);
  return { id: docRef.id, ...entry };
}

async function listDesigns(limit = 100) {
  const list = await getAllDocuments('designs', limit);
  return list;
}

module.exports = { addDesign, listDesigns };
