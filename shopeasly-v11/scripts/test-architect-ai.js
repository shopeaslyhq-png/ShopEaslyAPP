// Simple test harness for /ai/co-pilot-arch
const axios = require('axios');

async function main() {
  const base = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
  const url = `${base.replace(/\/$/, '')}/ai/co-pilot-arch`;
  const message = process.argv.slice(2).join(' ') || 'List low-stock items';
  try {
    const resp = await axios.post(url, { message }, {
      headers: {
        'Content-Type': 'application/json',
        // If HMAC/Auth/Idempotency are enabled, add headers here or disable for local test
      },
      timeout: 15000
    });
    console.log('[Architect AI]', resp.data);
  } catch (err) {
    console.error('Request failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

main();
