// ShopEasly OAuth 2.0 Authorization Server for Google Home Account Linking
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// In-memory stores (replace with DB in production)
const codes = new Map();
const tokens = new Map();

const CLIENT_ID = process.env.OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;
const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI;
const ALLOWED_SCOPES = process.env.OAUTH_SCOPES.split(/\s+/);
const BASE_URL = process.env.BASE_URL;

function isAuthenticated(req) {
  // Replace with real authentication logic
  return req.session && req.session.user;
}

// Mock login for demo (replace with real auth)
app.get('/login', (req, res) => {
  res.render('login', { brand: 'ShopEasly' });
});
app.post('/login', (req, res) => {
  // Accept any username for demo
  req.session.user = { id: uuidv4(), name: req.body.username || 'User' };
  res.redirect(req.session.returnTo || '/');
});

// OAuth 2.0 /authorize endpoint
app.get('/authorize', (req, res) => {
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
    return res.redirect('/login');
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

app.post('/authorize', (req, res) => {
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
  // Issue code
  const code = uuidv4();
  codes.set(code, {
    client_id,
    user_id: req.session.user.id,
    scope,
    expires: Date.now() + 600000 // 10 min
  });
  const url = `${redirect_uri}?code=${code}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
  res.redirect(url);
});

// OAuth 2.0 /token endpoint
app.post('/token', (req, res) => {
  const { grant_type, code, redirect_uri, client_id, client_secret } = req.body;
  if (client_id !== CLIENT_ID || client_secret !== CLIENT_SECRET || redirect_uri !== REDIRECT_URI) {
    return res.status(400).json({ error: 'invalid_client' });
  }
  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }
  const codeData = codes.get(code);
  if (!codeData || codeData.expires < Date.now()) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  codes.delete(code);
  // Issue token
  const access_token = uuidv4();
  const refresh_token = uuidv4();
  tokens.set(access_token, {
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
  console.log('OAuth 2.0 server running at https://localhost:3000');
});
