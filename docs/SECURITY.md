# Security Guide

This repository had a leaked Google Cloud service account key (`oauth-server/serviceAccountKey.json`). Keys in git history are considered compromised. Follow these steps immediately:

## 1) Rotate the service account key
- In Google Cloud Console → IAM & Admin → Service Accounts → `firebase-adminsdk-fbsvc@shopeasly-workshop.iam.gserviceaccount.com`
- Delete the exposed key (ID: 1ab9d5294b05061c16328dbd14f553ac49d4db68)
- Create a NEW key
- Update deployment secrets to use the new key via env (see below)

## 2) Move credentials to environment variables
Use ONE of these:
- FIREBASE_SERVICE_ACCOUNT with the full JSON contents (recommended)
- GOOGLE_APPLICATION_CREDENTIALS pointing to a local file path (keep file out of git)

See `oauth-server/.env.example` for reference.

## 3) Prevent future commits of secrets
- .gitignore includes patterns for service account JSON files
- Enable GitHub push protection and secret scanning on the repository settings

## 4) (Optional) Scrub git history
Even after rotation, consider removing the file from history:
- Use git filter-repo or BFG Repo-Cleaner to purge `oauth-server/serviceAccountKey.json`
- Force-push with care and notify collaborators
- Alternatively, archive the repo and recreate a clean repository if history rewrite is disruptive

## 5) Audit for misuse
- Check GCP Cloud Logging for suspicious activity during the exposure window
- Review Cloud IAM policies and service account permissions (principle of least privilege)
- Rotate any downstream secrets if the service account had access to them

## 6) App code hardening (already applied)
- OAuth server no longer reads `serviceAccountKey.json` by default; it requires env configuration or explicit credentials path
- AI endpoints can be HMAC + Firebase Auth protected (see `shopeasly-v11/routes/ai.js` and `utils/securityMiddleware.js`)

If you need help rotating the key or scrubbing history, open an issue and we’ll walk through it step-by-step.
