#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ToneManager = require('../utils/ToneManager');

const configPath = path.join(__dirname, '..', 'config', 'voice.json');
const cfg = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
const tone = new ToneManager(cfg);

const samples = [
  'I will create the order now. Do you want me to proceed? Confirm to execute.',
  'Order ORD-123 has been updated. STATUS: PROCESSING. YOU MUST PRINT THE LABEL.',
  'Inventory Summary: Total SKUs: 12; Units in stock: 324; Low stock items: 2;',
  'Go to the dashboard and click the inventory tab. Then set stock to 50 for SKU-123.',
  'Sorry for the inconvenience. I cannot do that action at this time.'
];

console.log('Tone test — before vs after:\n');
for (const s of samples) {
  const out = tone.humanize(s);
  console.log('--- before ---');
  console.log(s);
  console.log('--- after ----');
  console.log(out);
  console.log();
}
