const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// In-memory demo store (replace with DB/real users in production)
const codes = new Map(); // code -> { client_id, redirect_uri, scope, user_id }
const tokens = new Map(); // access_token -> { user_id, scope, expires_at, refresh_token }

// Config from env (set in .env/.env.local)
const CLIENT_ID = process.env.OAUTH_CLIENT_ID || 'shopeasly-demo-client';
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET || 'shopeasly-demo-secret';

function randomString(len = 32) {
  return crypto.randomBytes(len).toString('hex');
}

// GET /oauth/authorize
// Simulate a sign-in + consent screen. For demo, auto-approve and redirect back with a code.
router.get('/authorize', (req, res) => {
  const { response_type, client_id, redirect_uri, scope = '', state = '' } = req.query;

  if (response_type !== 'code') {
    return res.status(400).send('unsupported_response_type');
  }
  if (client_id !== CLIENT_ID) {
    return res.status(401).send('unauthorized_client');
  }
  if (!redirect_uri) {
    return res.status(400).send('invalid_request: redirect_uri required');
  }

  // Issue a one-time code
  const code = randomString(16);
  codes.set(code, { client_id, redirect_uri, scope, user_id: 'demo-user' });

  const url = new URL(redirect_uri);
  url.searchParams.set('code', code);
  if (state) url.searchParams.set('state', state);
  return res.redirect(url.toString());
});

// POST /oauth/token
// Exchange code for tokens, or refresh.
router.post('/token', (req, res) => {
  const { grant_type } = req.body;

  // Basic auth or body creds
  let clientId = req.body.client_id;
  let clientSecret = req.body.client_secret;
  const auth = req.headers.authorization;
  if ((!clientId || !clientSecret) && auth && auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice('Basic '.length), 'base64').toString();
    const [id, secret] = decoded.split(':');
    clientId = clientId || id;
    clientSecret = clientSecret || secret;
  }

  if (clientId !== CLIENT_ID || clientSecret !== CLIENT_SECRET) {
    return res.status(401).json({ error: 'invalid_client' });
  }

  if (grant_type === 'authorization_code') {
    const { code, redirect_uri } = req.body;
    const rec = codes.get(code);
    if (!rec || rec.redirect_uri !== redirect_uri) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
    codes.delete(code);

    const access_token = randomString(24);
    const refresh_token = randomString(24);
    const expires_in = 3600; // 1 hour
    tokens.set(access_token, {
      user_id: rec.user_id,
      scope: rec.scope,
      expires_at: Date.now() + expires_in * 1000,
      refresh_token,
    });
    return res.json({ access_token, token_type: 'Bearer', expires_in, refresh_token });
  }

  if (grant_type === 'refresh_token') {
    const { refresh_token } = req.body;
    // For demo, accept any previously issued refresh_token
    const access_token = randomString(24);
    const expires_in = 3600;
    tokens.set(access_token, {
      user_id: 'demo-user',
      scope: '',
      expires_at: Date.now() + expires_in * 1000,
      refresh_token,
    });
    return res.json({ access_token, token_type: 'Bearer', expires_in });
  }

  return res.status(400).json({ error: 'unsupported_grant_type' });
});

module.exports = router;
