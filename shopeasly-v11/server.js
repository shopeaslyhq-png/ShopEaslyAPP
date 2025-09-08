// Main entry point for ShopEasly V11
const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
const dashboard = require('./routes/dashboard');
const easly = require('./routes/easly');
const voiceCommands = require('./routes/voiceCommands');
const ai = require('./routes/ai');
const orders = require('./routes/orders');

// Route mounting
app.use('/', dashboard);  // Dashboard at root
app.use('/dashboard', dashboard);
app.use('/easly', easly);
app.use('/voice-commands', voiceCommands);
app.use('/ai', ai);
app.use('/orders', orders);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('layout', {
        body: '<h1>404 - Page Not Found</h1><p>The page you are looking for does not exist.</p>'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`ShopEasly V11 server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to access the application`);
});
