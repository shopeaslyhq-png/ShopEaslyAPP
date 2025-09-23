

// ShopEasly OAuth 2.0 Authorization Server for Google Home Account Linking (Production, ESM)
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import admin from 'firebase-admin';
import { OAuth2Client } from 'google-auth-library';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const isProd = (process.env.NODE_ENV || 'production') === 'production';
app.use(session({
  secret: process.env.SESSION_SECRET || 'change_me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd, // requires HTTPS on Render
    sameSite: 'lax'
  }
}));

// Firebase Admin SDK initialization (env or file)
let firebaseCred = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // JSON string in env
  firebaseCred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS.startsWith('.')
    ? path.join(__dirname, process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : process.env.GOOGLE_APPLICATION_CREDENTIALS;
  firebaseCred = JSON.parse(fs.readFileSync(p, 'utf8'));
} else {
  console.error('[OAuth] Firebase service account not configured. Set FIREBASE_SERVICE_ACCOUNT (JSON string) or GOOGLE_APPLICATION_CREDENTIALS (path).');
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(firebaseCred),
});
const db = admin.firestore();

// Base URL for this OAuth server (Render assigns HTTPS)
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

// Google login (user authentication) configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_SCOPES = (process.env.GOOGLE_SCOPES || 'profile email').split(/\s+/);
const GOOGLE_REDIRECT_URI = `${BASE_URL.replace(/\/$/, '')}/oauth/callback`;

// OAuth client (used by Google Home to call our /authorize and /token)
const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID;
const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;
const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || `${BASE_URL.replace(/\/$/, '')}/oauth/callback`;
const ALLOWED_SCOPES = (process.env.OAUTH_SCOPES || 'profile email').split(/\s+/);

function isAuthenticated(req) {
  return req.session && req.session.user;
}

// Google login endpoint (redirects to Google)
app.get('/login', (req, res) => {
  const state = req.query.state || '';
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}` +
    `&response_type=code&scope=${encodeURIComponent(GOOGLE_SCOPES.join(' '))}` +
    `&access_type=offline&state=${encodeURIComponent(state)}`;
  res.redirect(url);
});

// Google OAuth2 callback
app.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).send('Missing code');
  try {
    const { tokens } = await (new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI))
      .getToken(code);
    const ticket = await (new OAuth2Client()).verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    req.session.user = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      picture: payload.picture
    };
    res.redirect(state || '/');
  } catch (err) {
    res.status(401).send('Google authentication failed');
  }
});

// OAuth 2.0 /authorize endpoint
app.get('/authorize', async (req, res) => {
  const { client_id, redirect_uri, scope, state, response_type } = req.query;
  if (client_id !== OAUTH_CLIENT_ID || redirect_uri !== OAUTH_REDIRECT_URI) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid client_id or redirect_uri' });
  }
  const requestedScopes = (scope || '').split(/\s+/);
  if (!requestedScopes.every(s => ALLOWED_SCOPES.includes(s))) {
    return res.status(400).json({ error: 'invalid_scope', error_description: 'Invalid or missing scopes' });
  }
  if (response_type !== 'code') {
    return res.status(400).json({ error: 'unsupported_response_type' });
  }
  if (!isAuthenticated(req)) {
    req.session.returnTo = req.originalUrl;
    return res.redirect(`/login?state=${encodeURIComponent(req.originalUrl)}`);
  }
  // Show consent UI
  res.render('consent', {
    brand: 'ShopEasly',
    user: req.session.user,
    client_id,
    redirect_uri,
    scope: requestedScopes,
    state
  });
});

app.post('/authorize', async (req, res) => {
  const { client_id, redirect_uri, scope, state, approve } = req.body;
  if (client_id !== CLIENT_ID || redirect_uri !== REDIRECT_URI) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid client_id or redirect_uri' });
  }
  if (!isAuthenticated(req)) {
    return res.status(403).json({ error: 'access_denied', error_description: 'User not authenticated' });
  }
  if (!approve) {
    return res.redirect(`${redirect_uri}?error=access_denied&state=${encodeURIComponent(state || '')}`);
  }
  // Issue code and store in Firestore
  const code = uuidv4();
  await db.collection('oauth_codes').doc(code).set({
    client_id,
    user_id: req.session.user.id,
    scope,
    expires: Date.now() + 600000 // 10 min
  });
  const url = `${redirect_uri}?code=${code}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
  res.redirect(url);
});

// OAuth 2.0 /token endpoint
app.post('/token', async (req, res) => {
  const { grant_type, code, redirect_uri, client_id, client_secret } = req.body;
  if (client_id !== OAUTH_CLIENT_ID || client_secret !== OAUTH_CLIENT_SECRET || redirect_uri !== OAUTH_REDIRECT_URI) {
    return res.status(400).json({ error: 'invalid_client' });
  }
  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }
  const codeDoc = await db.collection('oauth_codes').doc(code).get();
  const codeData = codeDoc.exists ? codeDoc.data() : null;
  if (!codeData || codeData.expires < Date.now()) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  await db.collection('oauth_codes').doc(code).delete();
  // Issue token and store in Firestore
  const access_token = uuidv4();
  const refresh_token = uuidv4();
  await db.collection('oauth_tokens').doc(access_token).set({
    user_id: codeData.user_id,
    scope: codeData.scope,
    expires: Date.now() + 3600 * 1000 // 1 hour
  });
  res.json({
    token_type: 'Bearer',
    access_token,
    refresh_token,
    expires_in: 3600
  });
});

// Consent and login views
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.json({ ok: true }));

// Admin health: verifies Firestore connectivity
app.get('/health/admin', async (req, res) => {
  const start = Date.now();
  try {
    // Minimal Firestore read to validate credentials
    await db.listCollections();
    const ms = Date.now() - start;
    res.json({ ok: true, firestore: 'ok', latencyMs: ms, projectId: firebaseCred.project_id || null });
  } catch (err) {
    const dev = (process.env.NODE_ENV || 'development') === 'development';
    const payload = { ok: false, firestore: 'unavailable', error: err.message, hint: 'Ensure Firestore API enabled and service account has permissions.' };
    if (dev) {
      return res.json(payload);
    }
    return res.status(500).json(payload);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`OAuth 2.0 server running on ${BASE_URL} (PORT=${PORT})`);
});
