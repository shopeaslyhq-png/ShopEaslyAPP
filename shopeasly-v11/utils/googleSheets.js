// utils/googleSheets.js
// Google Sheets integration helpers: authenticate, ensure sheet, upsert inventory rows, read back rows

const { google } = require('googleapis');

// Auth: Prefer Service Account (server-to-server). Supports:
// - GOOGLE_APPLICATION_CREDENTIALS (path to JSON key)
// - GOOGLE_SA_EMAIL + GOOGLE_SA_PRIVATE_KEY (inline env; \n newlines supported)
// Fallback: Application Default Credentials if running in GCP environment
async function getSheetsClient() {
  // Try explicit service account via email/key envs
  const saEmail = process.env.GOOGLE_SA_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  const saKeyRaw = process.env.GOOGLE_SA_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY;
  if (saEmail && saKeyRaw) {
    const saKey = saKeyRaw.replace(/\\n/g, '\n');
    const jwt = new google.auth.JWT({
      email: saEmail,
      key: saKey,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ]
    });
    await jwt.authorize();
    return google.sheets({ version: 'v4', auth: jwt });
  }

  // Else rely on ADC / GOOGLE_APPLICATION_CREDENTIALS
  const auth = new google.auth.GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ]
  });
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

// Ensure a sheet (tab) exists by title; create if missing. Return { sheetId, title }
async function ensureSheetExists(sheets, spreadsheetId, title = 'Inventory') {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets(properties(sheetId,title))' });
  const found = (meta.data.sheets || []).map(s => s.properties).find(p => String(p.title) === String(title));
  if (found) return { sheetId: found.sheetId, title };
  const resp = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] }
  });
  const props = resp.data?.replies?.[0]?.addSheet?.properties;
  return { sheetId: props.sheetId, title: props.title };
}

// Transform inventory docs to rows
function inventoryToRows(inventory) {
  const headers = [
    'ID', 'SKU', 'Name', 'Category', 'Stock', 'Price', 'Threshold', 'Status', 'ImageUrl', 'NinjaTransferLink', 'DateAdded', 'CreatedAt', 'UpdatedAt'
  ];
  const rows = (inventory || []).map(it => ([
    it.id || '',
    it.sku || '',
    it.name || '',
    it.category || '',
    Number(it.stock ?? 0),
    Number(it.price ?? 0),
    Number(it.threshold ?? 0),
    it.status || '',
    it.imageUrl || '',
    it.ninjatransferLink || it.ninjaTransferLink || '',
    it.dateAdded || '',
    it.createdAt || '',
    it.updatedAt || ''
  ]));
  return { headers, rows };
}

// Upsert (overwrite) entire inventory sheet with latest rows
async function upsertInventoryToSheet({ spreadsheetId, sheetTitle = 'Inventory', inventory }) {
  if (!spreadsheetId) throw new Error('spreadsheetId is required');
  const sheets = await getSheetsClient();
  await ensureSheetExists(sheets, spreadsheetId, sheetTitle);
  const { headers, rows } = inventoryToRows(inventory);

  const range = `${sheetTitle}!A1`;
  // Clear existing contents (optional: range A:Z to be safe)
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${sheetTitle}!A:Z` });
  // Write headers + rows
  const values = [headers, ...rows];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values }
  });

  return { ok: true, updatedRows: values.length - 1 };
}

// Read back the sheet into objects (using first row as headers)
async function readSheetAsObjects({ spreadsheetId, sheetTitle = 'Inventory' }) {
  if (!spreadsheetId) throw new Error('spreadsheetId is required');
  const sheets = await getSheetsClient();
  await ensureSheetExists(sheets, spreadsheetId, sheetTitle);
  const range = `${sheetTitle}!A1:Z`;
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const values = resp.data.values || [];
  if (values.length === 0) return [];
  const headers = values[0];
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};
    headers.forEach((h, idx) => { obj[String(h)] = row[idx] ?? ''; });
    out.push(obj);
  }
  return out;
}

module.exports = { getSheetsClient, ensureSheetExists, upsertInventoryToSheet, readSheetAsObjects, inventoryToRows };
