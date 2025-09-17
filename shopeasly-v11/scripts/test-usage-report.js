// Quick test for getInventoryUsageReport
const { getInventoryUsageReport } = require('../utils/usageReport');

(async () => {
  try {
    // Default to past 7 days ending today
    const today = new Date();
    const end = today.toISOString().slice(0,10);
    const startDate = new Date(today.getTime() - 6*24*60*60*1000);
    const start = startDate.toISOString().slice(0,10);

    const report = await getInventoryUsageReport({ start, end });
    console.log(JSON.stringify(report, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
