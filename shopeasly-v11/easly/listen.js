// Speech-to-text logic for Easly AI
// Voice command handler that integrates with the AI system

const handleAICoPilot = require('./aiHandlerEnhanced');

module.exports = async function handleVoiceCommand(req, res) {
  const commandText = req.body.commandText || '';
  
  // Use a mock Express req/res for AI handler
  const aiReq = { 
    body: { 
      textPart: commandText, 
      clientId: req.body.clientId || 'voice',
      // Mark as voice for potential different behavior
      isVoice: true 
    }, 
    ip: req.ip 
  };
  
  const aiRes = {
    json: response => {
      // Clean up response for better voice output
      const voiceText = response.text
        .replace(/\*\*/g, '') // Remove markdown bold
        .replace(/📦|📋|✅|❌|🔄|🖼️|🗑️|➕|💡|📊|📈|🎨|🔗|📄|⚠️/g, '') // Remove emojis for cleaner TTS
        .replace(/\n\s*•/g, '. ') // Convert bullet points to sentences
        .replace(/\n+/g, ' ') // Replace newlines with spaces
        .trim();
      
      res.json({ 
        result: voiceText, 
        originalText: response.text, // Keep original for debugging
        data: response.data, 
        action: response.action,
        executed: response.executed,
        source: response.source || 'voice'
      });
    },
    status: code => ({ 
      json: obj => res.status(code).json({
        result: obj.error || 'Voice command failed',
        error: obj,
        source: 'voice-error'
      })
    })
  };

  try {
    await handleAICoPilot(aiReq, aiRes);
  } catch (error) {
    console.error('Voice command error:', error);
    res.status(500).json({
      result: 'Sorry, I had trouble processing that voice command.',
      error: error.message,
      source: 'voice-error'
    });
  }
};
