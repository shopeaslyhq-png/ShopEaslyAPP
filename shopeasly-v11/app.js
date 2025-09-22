// Main Express app entry point
const express = require('express');
const path = require('path');
const layouts = require('express-ejs-layouts');
const app = express();

// Middleware
// Capture raw body using body-parser verify to enable HMAC verification without consuming the stream
app.use(express.json({ limit: '10mb', verify: (req, res, buf) => { req.rawBody = buf.toString('utf8'); } }));
app.use(express.urlencoded({ extended: true, verify: (req, res, buf) => { req.rawBody = buf.toString('utf8'); } }));
// TODO: Add authentication middleware if needed

// Routes
const aiRoutes = require('./routes/ai');
const easlyRoutes = require('./routes/easly');
const ordersRoutes = require('./routes/orders');
const ideasRoutes = require('./routes/ideas');
const dashboardRoutes = require('./routes/dashboard');
// (Google Home/voice integrations removed)

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// EJS layout middleware
app.use(layouts);

// Serve static files from the public folder
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

app.use('/ai', aiRoutes);
// Mount voice routes at plural path to match UI links (/voice-commands)
app.use('/easly', easlyRoutes);
app.use('/orders', ordersRoutes);
app.use('/ideas', ideasRoutes);
app.use('/', dashboardRoutes);
// (Google Home/voice integrations removed)

// (Google Home/voice integrations removed)

// TODO: Add other routes (dashboard, orders, etc.)

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const server = app.listen(PORT, () => {
    console.log(`App running on port ${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Try stopping the process using it or set PORT to a different value.`);
        process.exit(1);
    }
    console.error('Server error:', err);
    process.exit(1);
});
