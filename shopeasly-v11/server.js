// Main entry point for ShopEasly
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
// Prefer repository root .env.local so it can override defaults
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local'), override: true });
// Then load app-local .env.local if present (won't override root unless set to)
dotenv.config({ path: path.resolve(__dirname, '.env.local') });
// Finally load standard .env in app dir for any remaining values
dotenv.config();

const app = express();
const { getAllDocuments } = require('./config/firebase');
const { hmacVerify, firebaseAuthVerify, idempotencyCheck, emitEvent } = require('./utils/securityMiddleware');
const { subscribe, emit: busEmit } = require('./utils/eventBus');

// View engine and middleware
const ejsMate = require('ejs-mate');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');

app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Production hardening middleware
app.use(compression());

// Configure helmet with custom CSP for Easly AI functionality
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            // Allow inline scripts temporarily for EJS; consider nonces in production
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://cdn.jsdelivr.net",
                "https://unpkg.com"
            ],
            scriptSrcElem: [
                "'self'",
                "'unsafe-inline'",
                "https://cdn.jsdelivr.net",
                "https://unpkg.com"
            ],
            // Allow inline event handlers for now
            scriptSrcAttr: [
                "'self'",
                "'unsafe-inline'"
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://cdn.jsdelivr.net",
                "https://fonts.googleapis.com"
            ],
            fontSrc: [
                "'self'",
                "data:",
                "https://fonts.gstatic.com",
                "https://r2cdn.perplexity.ai"
            ],
            imgSrc: [
                "'self'",
                "data:",
                "blob:",
                "https:"
            ],
            connectSrc: [
                "'self'",
                "https://api.openai.com",
                "wss:",
                "ws:"
            ],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    }
}));

app.use(morgan('combined'));

// Parse request bodies
// Capture raw body for HMAC if needed
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Sanitize occasional encoding artifacts in rendered HTML
app.use((req, res, next) => {
    const originalSend = res.send.bind(res);
    res.send = function (body) {
        try {
            if (typeof body === 'string' && /<(?:!doctype|html|head|body)[\s>]/i.test(body)) {
                const replacements = [
                    ['dY\u000f-', 'AI'],
                    ['dY"S', ''],
                    ['dY"^', ''],
                    ['dY"<', ''],
                    ['dYss', ''],
                    ['dY"?', ''],
                    ['dYZ\u000f', ''],
                    ['dYOT', ''],
                    ['dY?�', ''],
                    ['�z\u0007', ''],
                    ['�sT�,?', ''],
                    ['�o.', ''],
                    ['�?O', ''],
                    ['�s�', ''],
                    ['�', '']
                ];
                for (const [from, to] of replacements) {
                    body = body.split(from).join(to);
                }
                // Also strip any remaining non-printable characters
                body = body.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
            }
        } catch (_) { /* ignore */ }
        return originalSend(body);
    };
    next();
});

// Routes
const dashboard = require('./routes/dashboard');
const easly = require('./routes/easly');
const ai = require('./routes/ai');
const orders = require('./routes/orders');
const inventory = require('./routes/inventory');

// Liveness (HEAD) and readiness (GET) health endpoints (single implementation)
// HEAD is ultra-fast; GET provides lightweight sampled data with caching.
let __healthCache = { ts: 0, payload: null };
app.head('/health', (req, res) => res.status(200).end());

// (Google Home/voice/Dialogflow integrations removed)
const oauthRouter = require('./routes/oauth');
const fulfillmentRouter = require('./routes/fulfillment');

// Route mounting
app.use('/', dashboard);  // Dashboard at root
app.use('/dashboard', dashboard);
// Secure AI, orders, inventory, fulfillment routes if enabled
const secureMiddlewares = [hmacVerify, firebaseAuthVerify, idempotencyCheck];
app.use('/easly', ...secureMiddlewares, easly);
app.use('/ai', ...secureMiddlewares, ai);
app.use('/orders', ...secureMiddlewares, orders);
app.use('/inventory', ...secureMiddlewares, inventory);
app.use('/fulfillment', ...secureMiddlewares, fulfillmentRouter);
app.use('/oauth', oauthRouter); // Mounting the OAuth route
// (Google Home/voice/Dialogflow integrations removed)

// Serve only app-local static files to avoid conflicts with workspace root assets
// This prevents accidental CSS/JS overrides from ../public or ../src
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', async (req, res) => {
    try {
        const now = Date.now();
        // Simple 5s cache to absorb aggressive platform probes
        if (__healthCache.payload && (now - __healthCache.ts) < 5000) {
            return res.json(__healthCache.payload);
        }
        const [inv, ord] = await Promise.all([
            getAllDocuments('inventory', 5).catch(()=>[]),
            getAllDocuments('orders', 5).catch(()=>[])
        ]);
        const payload = {
            ok: true,
            status: 'ready',
            storage: 'local-json',
            samples: { inventory: inv.length, orders: ord.length },
            uptimeSec: Math.round(process.uptime()),
            ts: new Date().toISOString()
        };
        __healthCache = { ts: now, payload };
        res.json(payload);
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message, status: 'degraded' });
    }
});

// Server-Sent Events stream for real-time UI updates (opt-in via USE_EVENTS)
app.get('/events', (req, res) => {
    if (!process.env.USE_EVENTS) return res.status(404).end();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const send = (evt) => {
        res.write(`event: ${evt.type}\n`);
        res.write(`data: ${JSON.stringify(evt)}\n\n`);
    };
    const unsubscribe = subscribe(send);
    req.on('close', () => unsubscribe());
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Server error', message: err.message, stack: err.stack });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', { title: 'Page Not Found' });
});

app.post('/oauth/token', async (req, res) => {
  const { grant_type, code, refresh_token, client_id, client_secret, redirect_uri } = req.body;

  // Validate input
  if (!grant_type || !client_id || !client_secret) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  try {
    if (grant_type === 'authorization_code') {
      // TODO: Implement real validation for the authorization code
      // Example: Verify the code and client_id against your database
      const accessToken = generateAccessToken(); // Implement secure token generation
      const refreshToken = generateRefreshToken(); // Implement secure token generation

      res.json({
        token_type: 'Bearer',
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 3600
      });
    } else if (grant_type === 'refresh_token') {
      // TODO: Implement real validation for the refresh token
      // Example: Verify the refresh_token against your database
      const newAccessToken = generateAccessToken(); // Implement secure token generation

      res.json({
        token_type: 'Bearer',
        access_token: newAccessToken,
        expires_in: 3600
      });
    } else {
      res.status(400).json({ error: 'unsupported_grant_type' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'server_error' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`ShopEasly server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to access the application`);
});
