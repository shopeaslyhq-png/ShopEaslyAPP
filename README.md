<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# ShopEasly POD - Print-on-Demand Management App

ShopEasly POD is a Print-on-Demand operations and order management dashboard with AI assistant integrations.

## 🚀 Production Deployment (Render)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

This project includes a `render.yaml` for a one-click Render deployment. The service runs `node shopeasly-v11/server.js` and mounts a persistent disk at `/opt/render/project/data` bound to `DATA_DIR`.

After deploy, your public domain will look like: `https://YOUR-SERVICE.onrender.com`.

Paste these into the Google Smart Home console (replace domain):
- Authorization URL: `https://YOUR-SERVICE.onrender.com/oauth/authorize`
- Token URL: `https://YOUR-SERVICE.onrender.com/oauth/token`
- Cloud fulfillment URL: `https://YOUR-SERVICE.onrender.com/voice/google-actions/webhook`

Set these environment variables in Render:
- `OAUTH_CLIENT_ID` — your real client id
- `OAUTH_CLIENT_SECRET` — your real client secret
- `DATA_DIR` — `/opt/render/project/data` (for JSON persistence)

## 🧪 Local Development

Prerequisites: Node.js 18+

1) Install dependencies:
```
npm install
```
2) Start server (defaults to port 3001):
```
npm run dev
```
3) Optional HTTPS exposure for testing Google integration:
```
ngrok http 3001
```
Then use `https://<NGROK>.ngrok-free.app` for the console URLs during dev.

## 🏠 Local Fulfillment

- Upload `shopeasly-v11/local-fulfillment/shopeasly-local-fulfillment.chrome.js` as your "JavaScript for Chrome" in the Actions Console.
- It targets your LAN endpoint: `http://<YOUR-LAN-IP>:3001/voice/google-actions/webhook` (update in file if your IP changes).

## 🔐 OAuth Endpoints

The app exposes OAuth routes for Account Linking:
- `GET /oauth/authorize`
- `POST /oauth/token`

These use `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET`. Replace demo values with your real credentials.

## 🧰 Health Check

`GET /health` returns `{ ok: true }` with some app stats.

## 📦 Data Persistence

By default, data is stored in JSON under `shopeasly-v11/data`. In production, set `DATA_DIR` to a persistent path (e.g., Render Disk) or migrate to a DB.

## 📄 License

See `LICENSE`.
