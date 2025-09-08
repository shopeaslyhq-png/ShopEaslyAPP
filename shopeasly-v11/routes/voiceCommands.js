const express = require('express');
const router = express.Router();
const voiceHandler = require('../easly/voiceHandler');

// Voice command routes
router.get('/', (req, res) => {
    res.send('Voice Commands route - Voice processing features');
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
