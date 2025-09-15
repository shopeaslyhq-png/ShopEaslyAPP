const express = require('express');
const router = express.Router();
const voiceHandler = require('../easly/voiceHandler');

// Voice command routes
// Redirect UI route to the unified AI Assistant page
router.get('/', (req, res) => {
    res.redirect(301, '/easly');
});

router.post('/process', (req, res) => {
    // Process voice commands
    const { command } = req.body;
    if (!command) {
        return res.status(400).json({ error: 'No voice command provided' });
    }

    // For now, echo back the command
    res.json({
        message: 'Voice command received',
        command: command,
        status: 'processed'
    });
});

module.exports = router;
