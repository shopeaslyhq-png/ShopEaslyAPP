# ShopEasly OAuth Server – Secure Setup

This OAuth 2.0 server supports account linking and uses Firebase Admin (Google Cloud) for storage. Do NOT commit credentials to the repository.

## Credentials: Pick ONE secure method

Method A – Environment JSON (recommended for hosted)
- Set FIREBASE_SERVICE_ACCOUNT to the full JSON of your service account.
- Works with `import 'dotenv/config'` (server.js already loads .env).

Method B – Credentials file path (good for local dev)
- Save the JSON to a secure folder OUTSIDE the repo, e.g. `C:\secrets\gcp\serviceAccountKey.json`.
- Set GOOGLE_APPLICATION_CREDENTIALS to that absolute path.

The server will exit if neither is provided.

## Windows (PowerShell) examples

Option A: File path (simpler, no multiline env)

```powershell
# Create a secure folder and copy your JSON there
New-Item -ItemType Directory -Force -Path C:\secrets\gcp | Out-Null
# Place your serviceAccountKey.json in C:\secrets\gcp

# Set env var for this session
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\secrets\gcp\serviceAccountKey.json'
```

Option B: JSON as env var

If you must use FIREBASE_SERVICE_ACCOUNT, use a here-string so newlines are preserved:

```powershell
$env:FIREBASE_SERVICE_ACCOUNT = @'
{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","token_uri":"https://oauth2.googleapis.com/token"}
'@
```

Note: Do NOT commit the JSON or .env with real secrets.

## Other required env

In `.env` or your process env, set:

```ini
PORT=3001
BASE_URL=http://localhost:3001
SESSION_SECRET=change_me

# Google login (user auth)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_SCOPES=profile email

# OAuth client (for the device linking to this server)
OAUTH_CLIENT_ID=
OAUTH_CLIENT_SECRET=
OAUTH_SCOPES=profile email
OAUTH_REDIRECT_URI=http://localhost:3001/oauth/callback
```

See `.env.example` in this folder.

## Run locally

```powershell
# From oauth-server directory
node server.js
```

## Health checks

- Basic: `GET /health` → `{ ok: true }`
- Admin: `GET /health/admin` → verifies Firestore connectivity and returns latency + projectId

```powershell
curl http://localhost:3001/health/admin
```

## Helper: set credentials from PowerShell

Use the script to quickly set either file path or env JSON for this session:

```powershell
# File path mode (recommended for local dev)
./scripts/set-firebase-creds.ps1 -Path "C:\secrets\gcp\serviceAccountKey.json" -Mode File

# Env JSON mode (if you need to avoid file paths)
./scripts/set-firebase-creds.ps1 -Path "C:\secrets\gcp\serviceAccountKey.json" -Mode Env
```

## Security checklist
- Rotate leaked keys immediately in GCP (IAM & Admin → Service Accounts)
- Use env vars or out-of-repo file paths for credentials
- Keep `.gitignore` entries for service account JSON files
- Enable GitHub secret scanning and push protection

For a deeper guide, read `../docs/SECURITY.md`.
