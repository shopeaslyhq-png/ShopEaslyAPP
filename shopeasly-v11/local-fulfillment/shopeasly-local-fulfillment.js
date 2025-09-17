/* global smarthome */
// ShopEasly Local Fulfillment App (Google Local Home SDK)
// Upload this file in the Google Actions Console under Local Fulfillment.

// Optional fetch polyfill when executing outside the Local Home SDK runtime
(function ensureFetch() {
  try {
    // If fetch isn't defined (e.g., in Node), use cross-fetch if available
    if (typeof fetch === 'undefined' && typeof require === 'function') {
      const cf = require('cross-fetch');
      if (cf) {
        // In Node, cross-fetch export is the function
        if (typeof cf === 'function') {
          globalThis.fetch = cf;
        } else if (cf.default) {
          globalThis.fetch = cf.default;
        }
      }
    }
  } catch (_) {
    // no-op; in Local Home SDK runtime, fetch is provided
  }
})();

// Access the Local Home SDK App constructor when available
const App = typeof smarthome !== 'undefined' ? smarthome.App : undefined;

// Configuration - Your ShopEasly local endpoint
const LOCAL_DEVICE_IP = '192.168.4.24';
const LOCAL_DEVICE_PORT = 3001;
const COMMAND_ENDPOINT = '/voice/google-actions/webhook';

// Utility to build full URL
const fullUrl = (path) => `http://${LOCAL_DEVICE_IP}:${LOCAL_DEVICE_PORT}${path}`;

// IDENTIFY intent handler
const identifyHandler = (request) => {
  try {
    const device = request?.inputs?.[0]?.payload?.device;

    if (device && device.customData && (device.customData.localControl === true || device.customData.shopeasly === true)) {
      return {
        intent: 'action.devices.IDENTIFY',
        requestId: request.requestId,
        payload: {
          device: {
            id: device.id,
            verificationId: `${LOCAL_DEVICE_IP}:${LOCAL_DEVICE_PORT}`,
          },
        },
      };
    }

    return {
      intent: 'action.devices.IDENTIFY',
      requestId: request.requestId,
      payload: {
        errorCode: 'DEVICE_NOT_FOUND',
        debugString: 'Device does not support ShopEasly local control',
      },
    };
  } catch (error) {
    return {
      intent: 'action.devices.IDENTIFY',
      requestId: request.requestId,
      payload: {
        errorCode: 'PROTOCOL_ERROR',
        debugString: `Identification failed: ${error?.message || error}`,
      },
    };
  }
};

// EXECUTE intent handler
const executeHandler = (request) => {
  try {
    const command = request?.inputs?.[0]?.payload?.commands?.[0];
    const execution = command?.execution?.[0];
    const deviceId = command?.devices?.[0]?.id || 'unknown';

    const body = {
      queryResult: {
        intent: { displayName: execution?.command || 'unknown' },
        parameters: execution?.params || {},
        queryText: `Execute ${execution?.command} on device ${deviceId}`,
      },
      session: `local-home-${deviceId}`,
      originalDetectIntentRequest: {
        source: 'google-home-local',
        payload: { device: { id: deviceId } },
      },
    };

    const fetchPromise = (typeof fetch === 'function')
      ? fetch(fullUrl(COMMAND_ENDPOINT), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      : Promise.reject(new Error('fetch not available'));

    return fetchPromise
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json().catch(() => ({}));
      })
      .then((data) => {
        const states = {};
        const text = data?.fulfillmentText || '';
        if (/\b(on|turned on)\b/i.test(text)) states.on = true;
        if (/\b(off|turned off)\b/i.test(text)) states.on = false;

        return {
          intent: 'action.devices.EXECUTE',
          requestId: request.requestId,
          payload: {
            commands: [
              {
                ids: [deviceId],
                status: 'SUCCESS',
                states,
              },
            ],
          },
        };
      })
      .catch((error) => ({
        intent: 'action.devices.EXECUTE',
        requestId: request.requestId,
        payload: {
          commands: [
            {
              ids: [deviceId],
              status: 'ERROR',
              errorCode: 'DEVICE_OFFLINE',
              debugString: `ShopEasly command failed: ${error?.message || error}`,
            },
          ],
        },
      }));
  } catch (error) {
    return Promise.resolve({
      intent: 'action.devices.EXECUTE',
      requestId: request.requestId,
      payload: {
        commands: [
          {
            ids: ['unknown'],
            status: 'ERROR',
            errorCode: 'PROTOCOL_ERROR',
            debugString: `Execution failed: ${error?.message || error}`,
          },
        ],
      },
    });
  }
};

// REACHABLE_DEVICES intent handler
const reachableDevicesHandler = (request) => {
  try {
    const fetchPromise = (typeof fetch === 'function')
      ? fetch(fullUrl('/health'), { method: 'GET' })
      : Promise.reject(new Error('fetch not available'));

    return fetchPromise
      .then((response) => {
        const devices = request?.inputs?.[0]?.payload?.devices || [];
        const ok = response && (response.ok || response.status === 200);
        const reachable = ok ? devices : [];

        return {
          intent: 'action.devices.REACHABLE_DEVICES',
          requestId: request.requestId,
          payload: {
            devices: reachable.map(() => ({
              verificationId: `${LOCAL_DEVICE_IP}:${LOCAL_DEVICE_PORT}`,
            })),
          },
        };
      })
      .catch(() => ({
        intent: 'action.devices.REACHABLE_DEVICES',
        requestId: request.requestId,
        payload: { devices: [] },
      }));
  } catch (_) {
    return Promise.resolve({
      intent: 'action.devices.REACHABLE_DEVICES',
      requestId: request.requestId,
      payload: { devices: [] },
    });
  }
};

// Initialize and start the app when in the Local Home runtime
try {
  if (App) {
    const app = new App('1.0.0');
    app
      .onIdentify(identifyHandler)
      .onExecute(executeHandler)
      .onReachableDevices(reachableDevicesHandler);

    app.onError((err) => {
      try { console.error('ShopEasly Local Home SDK error:', err); } catch(_) {}
    });

    app
      .listen()
      .then(() => {
        try {
          console.log('ShopEasly Local Home SDK started');
          console.log(`Endpoint: ${fullUrl(COMMAND_ENDPOINT)}`);
        } catch (_) {}
      })
      .catch((err) => {
        try { console.error('Failed to start Local Home SDK:', err); } catch(_) {}
      });
  } else {
    // Not running in the Local Home SDK context; this is expected for local editing.
    try { console.log('Local Home SDK runtime not detected. This file is meant to be uploaded to Google Actions Console.'); } catch(_) {}
  }
} catch (_) {
  // swallow initialization errors in non-SDK environments
}
