// Creative brainstorming and product creation assistant
const { addDesign } = require('../utils/designsService');
const { initiateProductCreation, addMaterial, addPackingMaterial } = require('../utils/inventoryService');

// Simple in-memory session for prompts (can be replaced with persisted sessions)
const sessions = new Map();

function startBrainstormSession(clientId) {
  const s = { step: 'theme', theme: '', productType: '', style: '', inspiration: '' };
  sessions.set(clientId, s);
  return {
    message: 'What theme are we designing for? (e.g., vintage travel, space, minimalist)',
    state: s
  };
}

function chooseProductType(clientId, productType) {
  const s = sessions.get(clientId) || startBrainstormSession(clientId).state;
  s.productType = String(productType || '').trim();
  s.step = 'style';
  return {
    message: 'Got it. What style or key elements should we include? (e.g., retro palette, bold typography, astronaut illustration)',
    state: s
  };
}

function collectDesignInspiration(clientId, theme, style, inspiration) {
  const s = sessions.get(clientId) || startBrainstormSession(clientId).state;
  if (theme) s.theme = String(theme).trim();
  if (style) s.style = String(style).trim();
  if (inspiration) s.inspiration = String(inspiration).trim();
  s.step = 'gen';
  const prompt = `Create a ${s.style || 'clean'} ${s.productType || 'product'} design about "${s.theme}" ${s.inspiration ? 'with ' + s.inspiration : ''}.`;
  return { message: 'Generating a concept image…', prompt, state: s };
}

async function generateVisualMockup(clientId, prompt, imageGenerator) {
  // imageGenerator is a function(prompt) => Promise<{ imageUrl, meta }>
  const res = await imageGenerator(prompt);
  const s = sessions.get(clientId) || {};
  s.imageUrl = res.imageUrl;
  s.imageMeta = res.meta || {};
  s.step = 'review';
  return { message: 'Here is a mockup based on your inputs. Shall we create a product from it?', imageUrl: res.imageUrl, state: s };
}

async function recordDesignAndCreateProduct(clientId, { name, price, quantity, materialsIds = [], packagingId = '' }) {
  const s = sessions.get(clientId) || {};
  const productType = s.productType || 'Product';
  const theme = s.theme || name || 'Untitled';
  // Save design entry
  const design = await addDesign({ theme, productType, style: s.style, prompt: '', imageUrl: s.imageUrl, metadata: s.imageMeta });
  // Create product in inventory, attaching design image if available
  const created = await initiateProductCreation({ name: name || `${theme} ${productType}`.trim(), price, quantity, materialsIds, packagingId, imageUrl: s.imageUrl });
  return { message: 'Product created from design.', design, product: created };
}

module.exports = {
  startBrainstormSession,
  chooseProductType,
  collectDesignInspiration,
  generateVisualMockup,
  recordDesignAndCreateProduct,
};
