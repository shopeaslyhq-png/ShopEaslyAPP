// Text-to-speech logic and Google Assistant webhook helpers for Easly AI

function buildGoogleAssistantResponse(text, { expectUserResponse = true } = {}) {
  const safe = String(text || '').slice(0, 1000);
  return {
    fulfillmentText: safe,
    payload: {
      google: {
        expectUserResponse,
        richResponse: {
          items: [
            { simpleResponse: { textToSpeech: safe, displayText: safe } }
          ]
        }
      }
    }
  };
}

function buildGoogleAssistantError(text) {
  return buildGoogleAssistantResponse(text || 'Sorry, something went wrong.');
}

module.exports = {
  buildGoogleAssistantResponse,
  buildGoogleAssistantError,
};
