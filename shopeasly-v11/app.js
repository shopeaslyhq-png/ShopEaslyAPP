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

app.use('/ai', aiRoutes);
app.use('/voice-command', voiceCommandRoutes);

// TODO: Add other routes (dashboard, orders, etc.)

app.listen(3000, () => {
    console.log('App running on port 3000');
});
