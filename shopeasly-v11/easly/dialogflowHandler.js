// Dialogflow integration for Google Home control
const dialogflow = require('@google-cloud/dialogflow');
const path = require('path');

// TODO: Replace with your actual service account key file path
const keyFilename = path.join(__dirname, '../config/dialogflow-key.json');
const sessionClient = new dialogflow.SessionsClient({ keyFilename });

/**
 * Handles a text query from Google Home via Dialogflow and returns the intent result.
 * @param {string} textQuery - The user's spoken command.
 * @param {string} sessionId - A unique session ID (can be user/device ID).
 * @returns {Promise<object>} Dialogflow intent result and fulfillment text.
 */
async function handleDialogflowQuery(textQuery, sessionId) {
  // TODO: Replace with your actual project ID
  const projectId = '<your-project-id>';
  const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);
  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: textQuery,
        languageCode: 'en-US',
      },
    },
  };
  const [response] = await sessionClient.detectIntent(request);
  const result = response.queryResult;
  return {
    queryText: result.queryText,
    fulfillmentText: result.fulfillmentText,
    intent: result.intent ? result.intent.displayName : null,
    parameters: result.parameters,
    allResponse: result
  };
}

module.exports = handleDialogflowQuery;
