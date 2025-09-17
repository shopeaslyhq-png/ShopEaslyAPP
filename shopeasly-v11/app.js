// Main Express app entry point
const express = require('express');
const path = require('path');
const layouts = require('express-ejs-layouts');
const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// TODO: Add authentication middleware if needed

// Routes
const aiRoutes = require('./routes/ai');
const voiceCommandRoutes = require('./routes/voiceCommands');
const easlyRoutes = require('./routes/easly');
const ordersRoutes = require('./routes/orders');
const ideasRoutes = require('./routes/ideas');
const dashboardRoutes = require('./routes/dashboard');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// EJS layout middleware
app.use(layouts);

// Serve static files from the public folder
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

app.use('/ai', aiRoutes);
// Mount voice routes at plural path to match UI links (/voice-commands)
app.use('/voice-commands', voiceCommandRoutes);
app.use('/easly', easlyRoutes);
app.use('/orders', ordersRoutes);
app.use('/ideas', ideasRoutes);
app.use('/', dashboardRoutes);

// Google Smart Home fulfillment endpoint for Google Home Mini integration
app.post('/smarthome', async (req, res) => {
  const body = req.body;
  const intent = body.inputs && body.inputs[0] && body.inputs[0].intent;
  const requestId = body.requestId || '';

  switch (intent) {
    case 'action.devices.SYNC':
      // SYNC: Report available devices
      res.json({
        requestId,
        payload: {
          agentUserId: 'user-123',
          devices: [
            {
              id: 'WORKSHOP speaker',
              type: 'action.devices.types.SPEAKER',
              traits: ['action.devices.traits.OnOff'],
              name: {
                defaultNames: ['Workshop Speaker'],
                name: 'WORKSHOP speaker',
                nicknames: ['Workshop Speaker']
              },
              willReportState: true,
              otherDeviceIds: [{ deviceId: 'WORKSHOP speaker' }],
              deviceInfo: {
                manufacturer: 'ShopEasly',
                model: 'Mini',
                hwVersion: '1.0',
                swVersion: '1.0'
              }
            }
          ]
        }
      });
      break;
    case 'action.devices.QUERY':
      // QUERY: Report device state
      res.json({
        requestId,
        payload: {
          devices: {
            'WORKSHOP speaker': {
              on: true,
              online: true
            }
          }
        }
      });
      break;
    case 'action.devices.EXECUTE':
      // EXECUTE: Handle commands (e.g., turn on/off)
      // You can add logic here to control your device/webapp
      res.json({
        requestId,
        payload: {
          commands: [
            {
              ids: ['WORKSHOP speaker'],
              status: 'SUCCESS',
              states: {
                on: true,
                online: true
              }
            }
          ]
        }
      });
      break;
    default:
      res.status(400).json({ error: 'Unknown intent' });
      break;
  }
});

// TODO: Add other routes (dashboard, orders, etc.)

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const server = app.listen(PORT, () => {
    console.log(`App running on port ${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Try stopping the process using it or set PORT to a different value.`);
        process.exit(1);
    }
    console.error('Server error:', err);
    process.exit(1);
});
