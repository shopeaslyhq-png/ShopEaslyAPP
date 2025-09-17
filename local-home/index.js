// Entry point for Google Local Home SDK app
// https://developers.home.google.com/cloud-to-cloud/integration/local-home-sdk

const App = require('actions-on-google').smarthome.App;
const app = new App();


// Device discovery logic
const { discoverDevices } = require('./discovery');

// Example: Discover devices on startup (for debugging)
discoverDevices().then(devices => {
	console.log('Discovered devices:', devices);
}).catch(console.error);


// Local Home SDK intent handlers
app.onIdentify(async (request) => {
	// Use device discovery to match device
	const devices = await discoverDevices();
	// Example: match by device name or other criteria
	const device = devices.find(d => d.id === request.inputs[0].payload.device.deviceId);
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


app.onExecute(async (request) => {
	// Example: handle EXECUTE intent (turn on/off, set state, etc.)
	// You would send a command to the device over HTTP/TCP/UDP here
	// This is a stub for demonstration
	return {
		intent: 'action.devices.EXECUTE',
		payload: {
			commands: [{
				ids: request.inputs[0].payload.commands[0].devices.map(d => d.id),
				status: 'SUCCESS',
				states: { on: true, online: true }
			}]
		}
	};
});


app.onQuery(async (request) => {
	// Example: handle QUERY intent (get device state)
	// You would query the device over HTTP/TCP/UDP here
	// This is a stub for demonstration
	const deviceId = request.inputs[0].payload.devices[0].id;
	return {
		intent: 'action.devices.QUERY',
		payload: {
			devices: {
				[deviceId]: {
					on: true,
					online: true
				}
			}
		}
	};
});

module.exports = app;