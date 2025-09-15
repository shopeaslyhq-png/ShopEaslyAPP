const http = require('http');

function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const { hostname, port, path } = new URL(url);
    const data = Buffer.from(JSON.stringify(body));
    const req = http.request({
      hostname,
      port,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, res => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(buf || '{}');
          resolve({ status: res.statusCode, json });
        } catch (e) {
          resolve({ status: res.statusCode, text: buf });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  try {
    const res = await postJSON('http://localhost:3001/ai/co-pilot', { textPart: 'Show me inventory summary', clientId: 'cli_test' });
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(res.json || res.text, null, 2));
  } catch (e) {
    console.error('Request failed:', e.message);
    process.exit(1);
  }
})();
