// easly/voiceHandler.js
// Handles Google Home voice command processing
const handleAICoPilot = require('./aiHandlerEnhanced');

module.exports = async function handleVoiceCommand(req, res) {
    const commandText = req.body.commandText || '';
    // Use a mock Express req/res for AI handler
    const aiReq = {
        body: {
            textPart: commandText,
            clientId: req.body.clientId || 'google-voice',
            isVoice: true
        },
        ip: req.ip
    };
    const aiRes = {
        json: response => {
            // Clean up response for better voice output
            const voiceText = response.text
                .replace(/\*\*/g, '')
                .replace(/📦|📋|✅|❌|🔄|🖼️|🗑️|➕|💡|📊|📈|🎨|🔗|📄|⚠️/g, '')
                .replace(/\n\s*•/g, '. ')
                .replace(/\n+/g, ' ')
                .trim();
            res.json({
                result: voiceText,
                originalText: response.text,
                data: response.data,
                action: response.action,
                executed: response.executed,
                source: response.source || 'google-voice'
            });
        },
        status: code => ({
            json: obj => res.status(code).json({
                result: obj.error || 'Voice command failed',
                error: obj,
                source: 'google-voice-error'
            })
        })
    };
    try {
        await handleAICoPilot(aiReq, aiRes);
    } catch (error) {
        console.error('Google voice command error:', error);
        res.status(500).json({
            result: 'Sorry, I had trouble processing that voice command.',
            error: error.message,
            source: 'google-voice-error'
        });
    }
};
