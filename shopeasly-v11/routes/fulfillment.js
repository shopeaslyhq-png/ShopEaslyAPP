const express = require('express');
const router = express.Router();

// Simple fulfillment endpoint that handles a 'dashboard' intent
// Contract:
// - Input: JSON body, either Dialogflow v2 style { queryResult: { intent: { displayName } } }
//          or custom { intent: 'dashboard' }
// - Output: JSON with { fulfillmentText: string }
router.post('/', (req, res) => {
  try {
    const body = req.body || {};
    const dfIntent = body?.queryResult?.intent?.displayName;
    const customIntent = body?.intent;
    const intent = dfIntent || customIntent || '';

    if (intent.toLowerCase() === 'dashboard') {
      return res.json({
        fulfillmentText: 'Dashboard is up. Orders: 0, Inventory items: 0. Say "shop status" for more.'
      });
    }

    return res.json({ fulfillmentText: 'Unhandled intent. Try saying: dashboard.' });
  } catch (err) {
    console.error('Fulfillment error:', err);
    return res.json({ fulfillmentText: 'Sorry, there was an error handling your request.' });
  }
});

module.exports = router;
