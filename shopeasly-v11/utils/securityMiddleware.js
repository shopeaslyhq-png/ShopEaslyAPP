// Opt-in security and event middleware for ShopEasly
// Enable via env: USE_HMAC, USE_FIREBASE_AUTH, USE_IDEMPOTENCY, USE_EVENTS
const crypto = require('crypto');

// HMAC verification middleware
function hmacVerify(req, res, next) {
  if (!process.env.USE_HMAC) return next();
  const secret = process.env.WEBHOOK_SHARED_SECRET;
  if (!secret) return res.status(500).json({ error: 'HMAC secret not configured' });
  const sig = req.headers['x-webhook-signature'];
  if (!sig) return res.status(401).json({ error: 'Missing signature' });
  const rawBody = req.rawBody || '';
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (sig !== expected) return res.status(401).json({ error: 'Invalid signature' });
  next();
}

// Firebase Auth verification middleware (stub; real implementation would use firebase-admin)
async function firebaseAuthVerify(req, res, next) {
  if (!process.env.USE_FIREBASE_AUTH) return next();
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing or invalid auth token' });
  // TODO: Verify token with firebase-admin and check admin claim
  // For now, allow all
  next();
}

// Idempotency middleware (simple JSON store for now)
const idempotencyStore = {};
function idempotencyCheck(req, res, next) {
  if (!process.env.USE_IDEMPOTENCY) return next();
  const key = req.headers['x-idempotency-key'];
  if (!key) return res.status(400).json({ error: 'Missing X-Idempotency-Key' });
  if (idempotencyStore[key]) return res.status(409).json({ error: 'Duplicate request', result: idempotencyStore[key] });
  // Save response for later (monkey-patch res.json)
  const origJson = res.json.bind(res);
  res.json = (data) => { idempotencyStore[key] = data; return origJson(data); };
  next();
}

// Event emission (writes to events.json for now)
const fs = require('fs');
const path = require('path');
function emitEvent(type, payload, userId) {
  if (!process.env.USE_EVENTS) return;
  const dir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'events.json');
  const events = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')||'[]') : [];
  events.push({ ts: new Date().toISOString(), type, userId, payload });
  fs.writeFileSync(file, JSON.stringify(events, null, 2));
}

module.exports = {
  hmacVerify,
  firebaseAuthVerify,
  idempotencyCheck,
  emitEvent
};
