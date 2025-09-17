// Local Home Node.js server for Google Home Mini integration
const express = require('express');
const bodyParser = require('body-parser');
const { App } = require('actions-on-google').smarthome;
const { discoverDevices } = require('./discovery');

const app = express();
app.use(bodyParser.json());

const localHomeApp = new App();

// Local Home intent handlers (already implemented in index.js)
localHomeApp.onIdentify(async (request) => {
  const devices = await discoverDevices();
  const device = devices.find(d => d.id === 'WORKSHOP speaker');
  if (device) {
    return {
      intent: 'action.devices.IDENTIFY',
      payload: {
        device: {
          id: device.id,
          verificationId: device.id
        }
      }
    };
  } else {
    return {
      intent: 'action.devices.IDENTIFY',
      payload: { device: {} }
    };
  }
});

localHomeApp.onExecute(async (request) => {
  return {
    intent: 'action.devices.EXECUTE',
    payload: {
      commands: [{
        ids: ['WORKSHOP speaker'],
        status: 'SUCCESS',
        states: { on: true, online: true }
      }]
    }
  };
});

localHomeApp.onQuery(async (request) => {
  return {
    intent: 'action.devices.QUERY',
    payload: {
      devices: {
        'WORKSHOP speaker': { on: true, online: true }
      }
    }
  };
});

// Expose webhook endpoint for Google Local Home SDK
app.post('/voice/google-actions/webhook', localHomeApp.handler('request', 'response'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Local Home Node.js app listening on port ${PORT}`);
});
