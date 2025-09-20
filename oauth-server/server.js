
// ShopEasly OAuth 2.0 Authorization Server for Google Home Account Linking (Production)
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
const { OAuth2Client } = require('google-auth-library');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, sameSite: 'lax' }
}));

// Firebase Admin SDK initialization
admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccountKey.json')),
});
const db = admin.firestore();

// Google OAuth2 client for login
const GOOGLE_CLIENT_ID = '235888572191-cd8r19flvdbn5mb41trikfke7forjpma.apps.googleusercontent.com';
const GOOGLE_REDIRECT_URI = 'https://shopeaslyapp.onrender.com/oauth/callback';
const GOOGLE_SCOPES = ['profile', 'email'];
const CLIENT_ID = GOOGLE_CLIENT_ID;
const CLIENT_SECRET = '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';
const REDIRECT_URI = GOOGLE_REDIRECT_URI;
const ALLOWED_SCOPES = GOOGLE_SCOPES;

function isAuthenticated(req) {
  return req.session && req.session.user;
}

// Google login endpoint (redirects to Google)
app.get('/login', (req, res) => {
  const state = req.query.state || '';
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}` +
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
    const { tokens } = await (new OAuth2Client(GOOGLE_CLIENT_ID, CLIENT_SECRET, GOOGLE_REDIRECT_URI))
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
  if (client_id !== CLIENT_ID || redirect_uri !== REDIRECT_URI) {
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
  if (client_id !== CLIENT_ID || client_secret !== CLIENT_SECRET || redirect_uri !== REDIRECT_URI) {
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

app.listen(3000, () => {
  console.log('OAuth 2.0 server running at https://shopeaslyapp.onrender.com');
});
