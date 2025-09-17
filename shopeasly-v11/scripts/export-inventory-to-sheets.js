// scripts/export-inventory-to-sheets.js
// CLI: Export current inventory to a Google Sheet; optionally read back
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getAllDocuments } = require('../config/firebase');
const { upsertInventoryToSheet, readSheetAsObjects } = require('../utils/googleSheets');

async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '1skHrBZhoj-9GjTzxbWx4SMG3MmIq5DaVTbyrdB1JsGA';
  const sheetTitle = process.env.GOOGLE_SHEETS_SHEET_TITLE || 'Inventory';
  const mode = process.argv[2] || 'export'; // export | read

  if (!spreadsheetId) {
    console.error('Missing GOOGLE_SHEETS_SPREADSHEET_ID');
    process.exit(1);
  }

  if (mode === 'export') {
    const inventory = await getAllDocuments('inventory', 5000);
    const res = await upsertInventoryToSheet({ spreadsheetId, sheetTitle, inventory });
    console.log(`✅ Exported ${res.updatedRows} rows to ${sheetTitle}`);
  } else if (mode === 'read') {
    const rows = await readSheetAsObjects({ spreadsheetId, sheetTitle });
    console.log(`📖 Read ${rows.length} rows from ${sheetTitle}`);
    console.log(JSON.stringify(rows.slice(0, 5), null, 2));
  } else {
    console.error('Unknown mode. Use: export | read');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Error:', err && err.message || err);
  process.exit(1);
});
