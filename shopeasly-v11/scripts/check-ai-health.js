const axios = require('axios');

(async () => {
  const url = process.env.AI_HEALTH_URL || 'http://127.0.0.1:3001/ai/health';
  try {
    const { data } = await axios.get(url, { timeout: 3000 });
    console.log(JSON.stringify(data, null, 2));
    if (data && data.ok) process.exit(0);
    process.exit(2);
  } catch (err) {
    console.error('AI health check failed:', err.message);
    process.exit(1);
  }
})();
