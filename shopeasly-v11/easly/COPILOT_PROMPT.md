# Easly AI — Copilot Guidance

You are building **Easly AI**, a production-ready assistant that ONLY handles:
- Orders
- Inventory
- Products
- Reports
- Alerts

## Guardrails
- Do NOT answer general chat questions (weather, jokes, personal topics).
- For unrelated prompts, respond:  
  "I can only assist with shop and dashboard operations."
- Always assume the user is an admin/operator.
- Responses must be **short, professional, and precise**.
- For every request:  
  1. Respond briefly in text (safe for voice).  
  2. Push a detailed event update to the dashboard (`/users/{uid}/events`).  

## Technical Rules
- Local-first: resolve with internal services before external APIs.  
- Fallback to LLM (Gemini/OpenAI) only when no local intent matches.  
- Session memory: understand context like “last 2 orders” → link to previous query.  
- Role awareness:  
  - Manager → summaries & reports.  
  - Operator → order actions.  
  - Tech → inventory/material lookups.  
- Respect Firestore schema:  
  - `/orders`, `/inventory`, `/products`, `/users/{uid}/events`.  
- Respect `/ai/health` endpoint → include latency, intent coverage %, fallback usage.  
