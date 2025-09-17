/* global smarthome, fetch */
// ShopEasly Local Fulfillment App (Chrome target)
// Upload this file as your "JavaScript for Chrome" in the Actions Console.

// IMPORTANT: This file avoids modern syntax (optional chaining, etc.) for wider device compatibility.

// Config - your ShopEasly local endpoint
var LOCAL_DEVICE_IP = '192.168.4.24';
var LOCAL_DEVICE_PORT = 3001;
var COMMAND_ENDPOINT = '/voice/google-actions/webhook';

function fullUrl(path) {
  return 'http://' + LOCAL_DEVICE_IP + ':' + LOCAL_DEVICE_PORT + path;
}

// IDENTIFY handler
function identifyHandler(request) {
  try {
    var inputs = request && request.inputs && request.inputs[0];
    var payload = inputs && inputs.payload;
    var device = payload && payload.device;

    if (device && device.customData && (device.customData.localControl === true || device.customData.shopeasly === true)) {
      return {
        intent: 'action.devices.IDENTIFY',
        requestId: request.requestId,
        payload: {
          device: {
            id: device.id,
            verificationId: LOCAL_DEVICE_IP + ':' + LOCAL_DEVICE_PORT
          }
        }
      };
    }

    return {
      intent: 'action.devices.IDENTIFY',
      requestId: request.requestId,
      payload: {
        errorCode: 'DEVICE_NOT_FOUND',
        debugString: 'Device does not support ShopEasly local control'
      }
    };
  } catch (e) {
    return {
      intent: 'action.devices.IDENTIFY',
      requestId: request.requestId,
      payload: {
        errorCode: 'PROTOCOL_ERROR',
        debugString: 'Identification failed: ' + (e && e.message ? e.message : e)
      }
    };
  }
}

// EXECUTE handler
function executeHandler(request) {
  try {
    var inputs = request && request.inputs && request.inputs[0];
    var payload = inputs && inputs.payload;
    var command = payload && payload.commands && payload.commands[0];
    var execution = command && command.execution && command.execution[0];
    var deviceId = (command && command.devices && command.devices[0] && command.devices[0].id) || 'unknown';

    var body = {
      queryResult: {
        intent: { displayName: (execution && execution.command) || 'unknown' },
        parameters: (execution && execution.params) || {},
        queryText: 'Execute ' + ((execution && execution.command) || 'unknown') + ' on device ' + deviceId
      },
      session: 'local-home-' + deviceId,
      originalDetectIntentRequest: {
        source: 'google-home-local',
        payload: { device: { id: deviceId } }
      }
    };

    return fetch(fullUrl(COMMAND_ENDPOINT), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json().catch(function () { return {}; });
      })
      .then(function (data) {
        var states = {};
        var text = (data && data.fulfillmentText) || '';
        if (/(^|\b)(on|turned on)(\b|$)/i.test(text)) states.on = true;
        if (/(^|\b)(off|turned off)(\b|$)/i.test(text)) states.on = false;

        return {
          intent: 'action.devices.EXECUTE',
          requestId: request.requestId,
          payload: {
            commands: [
              {
                ids: [deviceId],
                status: 'SUCCESS',
                states: states
              }
            ]
          }
        };
      })
      .catch(function (err) {
        return {
          intent: 'action.devices.EXECUTE',
          requestId: request.requestId,
          payload: {
            commands: [
              {
                ids: [deviceId],
                status: 'ERROR',
                errorCode: 'DEVICE_OFFLINE',
                debugString: 'ShopEasly command failed: ' + (err && err.message ? err.message : err)
              }
            ]
          }
        };
      });
  } catch (e) {
    return Promise.resolve({
      intent: 'action.devices.EXECUTE',
      requestId: request.requestId,
      payload: {
        commands: [
          {
            ids: ['unknown'],
            status: 'ERROR',
            errorCode: 'PROTOCOL_ERROR',
            debugString: 'Execution failed: ' + (e && e.message ? e.message : e)
          }
        ]
      }
    });
  }
}

// REACHABLE_DEVICES handler
function reachableDevicesHandler(request) {
  try {
    return fetch(fullUrl('/health'), { method: 'GET' })
      .then(function (response) {
        var devices = (request && request.inputs && request.inputs[0] && request.inputs[0].payload && request.inputs[0].payload.devices) || [];
        var ok = response && (response.ok || response.status === 200);
        var reachable = ok ? devices : [];

        return {
          intent: 'action.devices.REACHABLE_DEVICES',
          requestId: request.requestId,
          payload: {
            devices: reachable.map(function () {
              return { verificationId: LOCAL_DEVICE_IP + ':' + LOCAL_DEVICE_PORT };
            })
          }
        };
      })
      .catch(function () {
        return {
          intent: 'action.devices.REACHABLE_DEVICES',
          requestId: request.requestId,
          payload: { devices: [] }
        };
      });
  } catch (e) {
    return Promise.resolve({
      intent: 'action.devices.REACHABLE_DEVICES',
      requestId: request.requestId,
      payload: { devices: [] }
    });
  }
}

// Initialize the Local Home SDK app if available (Chrome runtime)
try {
  if (typeof smarthome !== 'undefined' && smarthome && typeof smarthome.App === 'function') {
    var app = new smarthome.App('1.0.0');
    app.onIdentify(identifyHandler);
    app.onExecute(executeHandler);
    app.onReachableDevices(reachableDevicesHandler);

    if (typeof app.onError === 'function') {
      app.onError(function (err) {
        try { console.error('ShopEasly Local Home SDK error:', err); } catch (_) {}
      });
    }

    if (typeof app.listen === 'function') {
      app.listen()
        .then(function () {
          try { console.log('ShopEasly Local Home SDK (Chrome) started'); } catch (_) {}
        })
        .catch(function (err) {
          try { console.error('Failed to start Local Home SDK (Chrome):', err); } catch (_) {}
        });
    }
  } else {
    try { console.log('Local Home SDK runtime not detected (Chrome). Upload this file in the Actions Console.'); } catch (_) {}
  }
} catch (_) {
  // swallow errors in non-SDK environments
}
