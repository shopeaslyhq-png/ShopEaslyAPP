// Main Express app entry point
const express = require('express');
const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// TODO: Add authentication middleware if needed

// Routes
const aiRoutes = require('./routes/ai');
const voiceCommandRoutes = require('./routes/voiceCommands');
const easlyRoutes = require('./routes/easly');
const ordersRoutes = require('./routes/orders');
const dashboardRoutes = require('./routes/dashboard');

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

app.use('/ai', aiRoutes);
app.use('/voice-command', voiceCommandRoutes);
app.use('/easly', easlyRoutes);
app.use('/orders', ordersRoutes);
app.use('/', dashboardRoutes);

// TODO: Add other routes (dashboard, orders, etc.)

app.listen(3000, () => {
    console.log('App running on port 3000');
});
