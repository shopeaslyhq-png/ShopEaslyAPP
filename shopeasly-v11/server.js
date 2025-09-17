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
const voiceCommands = require('./routes/voiceCommands');
const ai = require('./routes/ai');
const orders = require('./routes/orders');
const inventory = require('./routes/inventory');

const dialogflowRoute = require('./easly/dialogflowRoute');
const googleActions = require('./routes/googleActionsEnhanced');
const oauthRouter = require('./routes/oauth');

// Route mounting
app.use('/', dashboard);  // Dashboard at root
app.use('/dashboard', dashboard);
app.use('/easly', easly);
app.use('/voice-commands', voiceCommands);
app.use('/ai', ai);
app.use('/orders', orders);
app.use('/inventory', inventory);

// Dialogflow webhook for Google Home integration
app.use('/voice/dialogflow', dialogflowRoute);
app.use('/voice/google-actions', googleActions);
app.use('/oauth', oauthRouter);

// Serve only app-local static files to avoid conflicts with workspace root assets
// This prevents accidental CSS/JS overrides from ../public or ../src
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', async (req, res) => {
    try {
        const [inv, ord] = await Promise.all([
            getAllDocuments('inventory', 5).catch(()=>[]),
            getAllDocuments('orders', 5).catch(()=>[])
        ]);
        res.json({ ok: true, storage: 'local-json', samples: { inventory: inv.length, orders: ord.length } });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`ShopEasly server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to access the application`);
});
