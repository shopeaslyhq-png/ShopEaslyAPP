// Local Home Node.js server for Google Home Mini integration
const express = require('express');
const bodyParser = require('body-parser');

// Use static discovery (no mdns)
const { discoverDevices } = require('./discovery');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Local Home Node.js app listening on port ${PORT}`);
});
// Local Home webhook endpoint for Google Home Mini integration
app.post('/voice/google-actions/webhook', async (req, res) => {
  const body = req.body;
  const intent = body.inputs && body.inputs[0] && body.inputs[0].intent;
  const requestId = body.requestId || '';

  switch (intent) {
    case 'action.devices.IDENTIFY': {
      // IDENTIFY: Match device for local execution
      const devices = await discoverDevices();
      const device = devices.find(d => d.id === 'WORKSHOP speaker');
      if (device) {
        res.json({
          intent: 'action.devices.IDENTIFY',
          payload: {
            device: {
              id: device.id,
              verificationId: device.id
            }
          }
        });
      } else {
        res.json({
          intent: 'action.devices.IDENTIFY',
          payload: { device: {} }
        });
      }
      break;
    }
    case 'action.devices.EXECUTE': {
      // EXECUTE: Handle local commands
      res.json({
        intent: 'action.devices.EXECUTE',
        payload: {
          commands: [{
            ids: ['WORKSHOP speaker'],
            status: 'SUCCESS',
            states: { on: true, online: true }
          }]
        }
      });
      break;
    }
    case 'action.devices.QUERY': {
      // QUERY: Report local device state
      res.json({
        intent: 'action.devices.QUERY',
        payload: {
          devices: {
            'WORKSHOP speaker': { on: true, online: true }
          }
        }
      });
      break;
    }
    default:
      res.status(400).json({ error: 'Unknown intent' });
      break;
  }
});
