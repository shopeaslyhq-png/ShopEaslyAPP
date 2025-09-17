// Quick script to print packing materials low/out-of-stock alerts
const { generatePackingLowStockAlerts } = require('../utils/inventoryService');

(async () => {
  try {
    const alerts = await generatePackingLowStockAlerts({ defaultThreshold: 5 });
    console.log(JSON.stringify(alerts, null, 2));
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
