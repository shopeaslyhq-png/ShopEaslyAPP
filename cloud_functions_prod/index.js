// Easly AI Cloud Functions: Intent Router & Handlers
// Production-ready, no Dialogflow, no external NLU
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

// --- Security Middleware ---
function requireAuth(context, requireAdmin = false) {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  if (requireAdmin && !context.auth.token.admin) throw new functions.https.HttpsError('permission-denied', 'Admin privileges required.');
}

// --- Intent Router ---
exports.easlyAI = functions.https.onCall(async (data, context) => {
  requireAuth(context, true); // All writes require admin
  const { intent, params = {} } = data || {};
  switch (intent) {
    case 'create_product':
      return await create_product(params, context);
    case 'add_material':
      return await add_material(params, context);
    case 'shop_status':
      return await shop_status(params, context);
    case 'brainstorm_product_ideas':
      return await brainstorm_product_ideas(params, context);
    default:
      throw new functions.https.HttpsError('invalid-argument', 'Unknown intent.');
  }
});

// --- Handlers ---
async function create_product(params, context) {
  const { productName, materials } = params;
  if (!productName || !Array.isArray(materials) || materials.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing productName or materials.');
  }
  let estimatedCost = 0;
  const matRefs = [];
  for (const m of materials) {
    if (!m.materialId || typeof m.qty !== 'number' || m.qty <= 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid material entry.');
    }
    const matDoc = await db.collection('materials').doc(m.materialId).get();
    if (!matDoc.exists) throw new functions.https.HttpsError('not-found', `Material ${m.materialId} not found.`);
    const mat = matDoc.data();
    if (typeof mat.unitCost !== 'number' || mat.unitCost <= 0) throw new functions.https.HttpsError('invalid-argument', 'Material unitCost invalid.');
    estimatedCost += mat.unitCost * m.qty;
    matRefs.push({ materialId: m.materialId, qty: m.qty });
  }
  const prodRef = db.collection('products').doc();
  await prodRef.set({ name: productName, materials: matRefs, estimatedCost, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  functions.logger.info('Product created', { productName, estimatedCost });
  return { speech: `Product created: ${productName}.`, event: 'PRODUCT_CREATED', payload: { id: prodRef.id, estimatedCost } };
}

async function add_material(params, context) {
  const { name, unitCost, qty } = params;
  if (!name || typeof unitCost !== 'number' || unitCost <= 0 || typeof qty !== 'number' || qty < 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid material params.');
  }
  const matRef = db.collection('materials').doc();
  await matRef.set({ name, unitCost, qty, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  functions.logger.info('Material added', { name, unitCost, qty });
  return { speech: `Material added: ${name}.`, event: 'MATERIAL_ADDED', payload: { id: matRef.id, name, unitCost, qty } };
}

async function shop_status(params, context) {
  // Aggregate inventory value, product count, low stock
  const matsSnap = await db.collection('materials').get();
  const prodsSnap = await db.collection('products').get();
  let totalValue = 0, lowStock = [];
  matsSnap.forEach(doc => {
    const m = doc.data();
    if (typeof m.unitCost === 'number' && typeof m.qty === 'number') {
      totalValue += m.unitCost * m.qty;
      if (m.qty < 5) lowStock.push({ id: doc.id, name: m.name, qty: m.qty });
    }
  });
  const productCount = prodsSnap.size;
  functions.logger.info('Shop status', { totalValue, productCount, lowStock });
  return {
    speech: `Shop status ready.`,
    event: 'SHOP_STATUS',
    payload: { totalValue, productCount, lowStock }
  };
}

async function brainstorm_product_ideas(params, context) {
  const theme = params.theme || '';
  // Static ideas for now
  const ideas = [
    { name: 'Custom Eco Tote Bag', suggestedMaterials: ['Organic Cotton', 'Eco Ink'] },
    { name: 'Personalized Mug', suggestedMaterials: ['Ceramic', 'Sublimation Ink'] },
    { name: 'Motivational T-Shirt', suggestedMaterials: ['Cotton', 'DTF Film'] },
    { name: 'Sticker Pack', suggestedMaterials: ['Vinyl', 'Adhesive'] },
    { name: 'Desk Art Print', suggestedMaterials: ['Matte Paper', 'Ink'] }
  ];
  functions.logger.info('Product ideas', { theme, ideas });
  return {
    speech: `Here are some product ideas.`,
    event: 'PRODUCT_IDEAS',
    ideas: ideas.slice(0, 3 + Math.floor(Math.random() * 3))
  };
}
