const express = require('express');
const router = express.Router();
const voiceHandler = require('../easly/voiceHandler');

// Voice command routes
// Redirect UI route to the unified Easly AI page
router.get('/', (req, res) => {
    res.redirect(301, '/easly');
});

router.post('/process', (req, res) => {
    // Process voice commands
    const { command } = req.body;
    if (!command) {
        return res.status(400).json({ error: 'No voice command provided' });
    }

    // Use the AI voiceHandler to process the command
    voiceHandler(command)
        .then(result => {
            res.json({
                message: 'Easly AI response',
                command: command,
                aiResult: result,
                status: 'processed'
            });
        })
        .catch(error => {
            res.status(500).json({ error: 'AI processing failed', details: error.message || error });
        });
});

module.exports = router;
