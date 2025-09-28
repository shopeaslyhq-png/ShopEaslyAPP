# ShopEasly APP — Comprehensive Design Document

Version: 2.0.2
Date: 2025-09-28
Owner: shopeaslyhq-png

## 1. Purpose and Scope
ShopEasly APP v2.0 is an enhanced operations system for a print and fulfillment workshop. It centralizes orders, inventory (products, raw materials, packing), production flows, and introduces a proactive AI co-pilot with session memory, forecasting hooks, and real-time updates. Earlier multi-role UI distinctions were simplified to a single admin persona in this iteration to streamline maintenance. Future reinstatement of granular roles remains a roadmap option. This document defines the end-to-end design: context, architecture, modules, data, APIs, UX, non-functionals, and the app’s role across the workshop lifecycle.

Goals:
- Single place to manage orders and inventory with real data (no hallucinations)
- Fast, no-scroll operational dashboards with modal flows
- AI co-pilot for quick lookups, guided actions, asset generation, and bulk product creation/import
- Proactive intelligence: daily digests & forecasting hooks (expanding)
- Real-time operations: updates via Server-Sent Events (SSE) + centralized event bus
- Local-friendly: runs with JSON storage; can grow to cloud backends later

Out of scope:
- Payment capture and shipping label purchasing (can integrate later)
- Detailed user/role auth (future hardening)

### 1.1 Legacy Reference
The original purely client-side SPA (no backend, all in-memory) is archived in `docs/SHOP-EASLY-DESIGN-LEGACY-1.0.md` (Version 1.0.0). Key differences now:
- Server-backed JSON persistence and SSE vs. ephemeral in-memory state
- Modularized AI assistant scripts (CSP-ready) vs. monolithic inline block
- Single-role simplification vs. multi-role UI scaffolding
- Event bus + audit/log groundwork vs. ad-hoc client logging
- Guardrailed AI tool loop vs. direct unmediated Gemini calls

## 2. Key Enhancements in v2.0
- AI Co-Pilot: session memory, proactive daily digests (planned rollout), forecasting hooks, image/design generation, bulk product ideas + import flows.
- Dashboard UX: AI overlay card, drill-down analytics. (Granular role-based view variants deferred; single admin persona active.)
- System: real-time updates via SSE + centralized event bus, dual storage strategy (JSON now; Firestore/Postgres ready), richer observability metrics.
- Security & Reliability: simplified single-role model, AI audit trails foundation (history + ndjson logs), shared validation layer, HMAC + optional Firebase Auth (opt-in), CSP hardening path.
- Workflow Extensions: production tracking (planned), shipping integrations (planned), designer ideation pipeline (foundational image + creative assistant flows in place).

## 2. System Context
Actors (current simplified deployment):
- Admin (single persona): full operational + creative capabilities (encompasses former operator/tech/packer/manager/designer roles)
- AI Co-Pilot: assists with data lookups, bulk ideation, creative generation, and guided flows

Historical / potential future distinct actors (deferred): Operator, Production Tech, Packer/Shipper, Manager, Designer.

External systems (optional/extendable):
- OpenAI / Gemini APIs (image/text)—optional
- Google Assistant Local Fulfillment (local-home integration)
- OAuth server (for integrations requiring consent)

## 3. Architecture Overview
Runtime topology:
- Node.js/Express server: `shopeasly-v11/` with routes, views (EJS), static assets under `public/`
- Client-side enhancements for modals, tabs, upload, and AI overlay
- Storage: local JSON files in `shopeasly-v11/data/*.json` via a Firestore-like shim
- Optional: Vite/React source `src/` for future UI; currently EJS pages are primary
- Real-time: SSE channel for live updates (`/events` or consolidated AI events stream) gated by `USE_EVENTS`; centralized event bus emits domain events consumed by dashboards and AI assistant.
- Data backends: dual storage strategy (local JSON now; Firestore/Postgres target with migration path)

Key packages and layers:
- Web server: Express
- Views: EJS templates (`views/`)
- Static: CSS, JS, images (`public/`)
- Data access: `config/firebase.js` (local JSON CRUD)
- Business logic: `utils/*` (orders, inventory, dashboard summary, sheets)
- AI: `easly/aiHandlerEnhanced.js` (local intents + LLM fallback), voice/tone via `utils/ToneManager.js` + `config/voice.json`
  - Front-end assistant modular scripts: `public/js/assistant-core.js`, `public/js/assistant-bulk.js` (extracted from prior large inline script in `views/easly.ejs` for maintainability & CSP)
- AI (architect blueprint): Gemini function-calling loop with tools; system instructions at `config/system-instructions.js`; local tools at `utils/localDataService.js`
- Real-time: Server-Sent Events stream `/events` (enabled when `USE_EVENTS` is set) backed by a lightweight EventEmitter bus in `utils/eventBus.js`; `utils/securityMiddleware.emitEvent` writes to file and emits to the bus

Deployment:
- Local: Node process; data persisted under `data/*.json`
- Hosted: Render (see `render.yaml`) or similar; mount persistent disk to `DATA_DIR`
 - Secrets: `.env` or `.env.local` (not committed) — see Section 11

## 4. Module Map
- routes/
  - dashboard.js: aggregates dashboard stats; renders `views/dashboard.ejs`
  - orders.js: CRUD routes, status updates, bulk ops; renders `views/orders.ejs`
  - inventory.js: inventory CRUD; materials, packing; usage reports; image attach
  - ai.js: AI co-pilot endpoint, image generation, product suggestions, health
  - fulfillment.js, voiceCommands.js, googleActionsEnhanced.js: integration stubs
  - oauth.js: OAuth helper endpoints (used by `oauth-server/`)
- utils/
  - dashboardSummary.js: computes counts and alert lists for dashboard
  - inventoryService.js: product creation validation, packing alerts
  - ordersService.js: edit/update helpers; bulk actions
  - orderNumber.js: per-day order numbering
  - googleSheets.js: export/report integration
  - ToneManager.js: centralized persona/voice
  - usageReport.js: inventory usage reporting
  - reportsService.js: summaries (daily sales, low stock, pending orders)
  - localDataService.js: read-only filters for inventory/orders used by AI tools
  - securityMiddleware.js: optional HMAC, Firebase Auth stub, idempotency, event emission
- easly/
  - aiHandlerEnhanced.js: routes local inventory/orders intents; LLM fallback w/ guardrails; exposes optional `handleCoPilotMessage` (Gemini tool loop)
  - creativeAssistant.js, dialogflowHandler.js, speak.js, listen.js, voiceHandler.js: voice/assistant integrations
 - training/
  - ConversationTrainer.js: learns patterns from `data/ai_history.json`
  - ProductKnowledgeBase.js: builds/queryable product/category/business insights
 - oauth-server/ (separate service)
  - server.js: production OAuth server with Firestore admin health endpoint
- views/
  - layout.ejs: shell with sticky header, sidebar, CSP, and global UI helpers
  - dashboard.ejs: no-scroll landing with big tiles, stats, alerts, analytics
  - inventory.ejs: single-view with tabs; modals for products/materials/packing; spreadsheet import
  - easly.ejs, orders.ejs and others for respective pages
- public/
  - css/style.css: design system styles; no-scroll layout rules
  - js/*.js: small client helpers (modals, tests, drag-drop)
  - images/: logos, uploads, designs, inventory images
- data/
  - inventory.json, orders.json, ai_history.json, ai_logs.ndjson, ideas.json, sessions.json

## 4.1 AI Architecture: Modes (Standard + Architect)
Modes:
- Architect Mode (optional toggle): Gemini multi-step tool loop for blueprint reasoning / more complex sequences.
- Standard Mode: faster local intent resolution + selective LLM usage.

Core components:
-- `config/system-instructions.js`: system prompt and guardrails for Gemini (trimmed: removed multi-role permission language; single-admin context assumed).
- `utils/localDataService.js`: data tools available to the model via function-calling.
- `easly/aiHandlerEnhanced.js`:
  - Default behavior: local intent handling; strict real-data guardrails; optional LLM fallback (Gemini/OpenAI).
  - Named export `handleCoPilotMessage(message)`: implements Gemini chat + tool loop:
    1) send user message
    2) if model emits functionCalls, execute matching tools (e.g., `findInventoryItems`, `findOrders`)
    3) send functionResponse back to model
    4) repeat until no functionCalls
    5) return final concise text
  - Tools return JSON; loop supports multiple parallel calls via Promise.all.
 - Session memory: short-term context captured in `data/sessions.json` (used for follow-up references e.g. “last design”).
 - Proactive digests: scheduled summaries (planned) will surface daily sales, low stock, pending orders.
 - Front-end refactor: monolithic inline assistant script removed; modular scripts handle SSE lifecycle w/ exponential backoff, UI state, bulk CSV/XLSX import, message sanitation (DOMPurify), accessibility improvements, and toast system.

## 5. Data Model
All collections are arrays of objects in JSON files; each document includes `id`, `createdAt`, `updatedAt`.

Inventory Item
- id: string
- name: string
- sku: string (uppercase key for lookups)
- stock: number (>= 0)
- price: number (unit price or material cost)
- status: 'active' | 'inactive'
- threshold: number (low-stock threshold)
- category: string ("Products", "Materials", "Packing Materials", etc.)
- description: string
- materials: string[] (IDs of material items; only for Products)
- packagingId: string (ID of packing material; optional until fulfillment)
- imageUrl: string (optional)
- ninjatransferLink: string (optional)
- dateAdded: YYYY-MM-DD

Order
- id: string
- orderNumber: string (daily sequence)
- customerName: string
- productId: string
- productName: string
- productSku: string | null
- product: string (back-compat; mirrors productName)
- quantity: number (>= 1)
- price: number | null (unit)
- total: number | null (= price * quantity)
- status: 'Pending' | 'Processing' | 'Shipped' | 'Delivered'
- notes: string
- date: YYYY-MM-DD
- createdAt: ISO

AI History / Logs
- ai_history.json: conversational items with timestamps and clientId
- ai_logs.ndjson: line-delimited logs for observability

## 6. APIs (selected)
Inventory
- GET /inventory/api → [InventoryItem]
- POST /inventory/api { name, sku, stock, price, status, threshold, category, description, materials[], packagingId }
- PUT /inventory/api/:id { ...partial }
- DELETE /inventory/api/:id
- POST /inventory/api/initiate-product { name, price, quantity, materialsIds[], materialsUsage, packagingId, category, sku }
- POST /inventory/api/packing { name, dimensions, stock, sku, price, threshold, status, description }
- POST /inventory/api/:id/image { imageBase64 | imageUrl }
- POST /inventory/api/images/upload { imageBase64 } → { imageUrl }
- POST /inventory/api/:id/ninjatransfer { link }
- GET /inventory/api/packing/alerts?threshold=number
- GET /inventory/api/usage?start=YYYY-MM-DD&end=YYYY-MM-DD

Orders
- GET /orders → server-rendered page
- POST /orders { customerName, product | productId | productSku, quantity, price?, status?, notes? }
- PUT /orders/:id { ...partial }
- PATCH /orders/:id/status { status }
- DELETE /orders/:id
- POST /orders/bulk { action, ids[] } action∈{mark-processing,mark-shipped,mark-delivered,delete}

AI
- POST /ai/co-pilot { message, channel? } → text (uses local intents first; strict real-data guardrails; optionally secured by HMAC/Auth)
- POST /ai/generate-image { prompt } → { url }
- GET /ai/health → { providers, models }
- GET /ai/history?clientId=&limit= → { items }
- DELETE /ai/history?clientId= → { ok }

Optional (architect route):
- POST /ai/co-pilot-arch { message | textPart, role? } → { ok, text, role? }
  - Calls `handleCoPilotMessage` (Gemini tool loop). Safe to run alongside the default /co-pilot.
  - UI toggle “Architect mode” in Easly AI header routes chat to this endpoint and passes optional role via header `x-user-role` or body `role`.

OAuth
- GET /oauth/health → { ok }
- GET /oauth/health/admin → { ok, firestore: 'ok', latencyMs, projectId } (requires valid Firebase Admin credentials and Firestore API)

## 7. Core Workflows
Dashboard (no-scroll)
- Big feature tiles: Orders, Inventory, Easly AI (click-through to pages)
- Stats and alerts summarized from `utils/dashboardSummary.js`
- Analytics panels (order status distribution, top products) with sticky header

Inventory (single view, no-scroll)
- Tabs: Products / Materials / Packing
- Search filter + quick Low/Out filters via metric cards
- Modals for Add/Edit of Product/Material/Packing
- Product creation: optional packaging at creation; materials can be linked. Materials are auto-deducted during production (via services) as per business logic.
- Spreadsheet upload: CSV/XLSX import with auto-mapped headers and preview, then POST rows to `/inventory/api`
- Alerts: low/out-of-stock computed client-side and server-side

Orders
- Create order by choosing product via id/sku/name resolution
- Server calculates total = unit price × quantity; UI shows live totals
- Update status and notes; bulk actions supported
- Order numbering per day via `utils/orderNumber.js`

AI Co-Pilot
- Local intent routing for inventory/orders queries first; optional LLM fallback.
- Architect loop (optional): Gemini function-calling with tools `findInventoryItems`, `findOrders`; JSON tool responses for predictability.
- Strict guardrails: refuses to invent data; concise responses (tone set in `config/voice.json` and `config/system-instructions.js`).
- Image generation via OpenAI (optional, env-key gated)
 - Proactive daily digest on dashboard (sales totals, low stock, pending orders) using reportsService
 - Role-aware responses: tone and actions scoped to Manager/Operator/Tech/Packer personas (planned)

## 8. UI/UX Principles
- No page-level scroll on main operational views; one scrollable region per page
- Modal-first flows to keep context
- Concise text; no emojis/filler per tone configuration
- Clear error/status toasts; Escape/overlay click closes modals

## 9. Non-Functional Requirements
- Performance: lightweight server-rendered views, minimal client JS
- Reliability: local JSON persistence; easy backup/restore (copy `data/*.json`)
- Observability: AI logs (ndjson), health endpoint, console logs for CRUD
- Security: CSP `upgrade-insecure-requests`; secrets in env; no API keys exposed client-side; optional HMAC verification + Firebase Auth on AI webhook; idempotency support
- Privacy: no third-party trackers; data stays local unless configured
- Extensibility: replace local JSON with Firestore/Postgres by swapping `config/firebase.js`
- Real-time: SSE for inventory/orders/assistant events; event bus emits domain events consumed by UI and (future) digest jobs. Client status dot reflects connection state (grey=unknown, green=connected, amber=reconnecting, red=error/disabled). Exponential backoff reconnect implemented in `assistant-core.js`.

## 10. Error Handling & Edge Cases
- Inventory import: skip rows missing `name` or `sku`; basic CSV parsing; SheetJS for XLSX
- Duplicate SKUs: server uppercases SKUs; de-duplication is left to business ops or can be added
- Negative or non-numeric inputs: server coercion and validation with helpful errors
- Orders referencing Materials/Packing: rejected—only finished Products are orderable
- Image uploads: base64 parsing with validation; returns public URLs in `/public/images/...`
 - WebSocket disconnects: clients auto-retry; server drops stale sessions gracefully (planned)

## 11. Security & Access
- Single-tenant, local by default
- Environment variables:
  - Providers: `GEMINI_API_KEY` or `GOOGLE_API_KEY`, `OPENAI_API_KEY` (optional)
  - Storage: `DATA_DIR` (defaults to `shopeasly-v11/data`)
  - Webhook security (opt-in): `USE_HMAC`, `WEBHOOK_SHARED_SECRET`, `USE_FIREBASE_AUTH`, `USE_IDEMPOTENCY`, `USE_EVENTS`
  - OAuth server (separate service): `FIREBASE_SERVICE_ACCOUNT` (JSON string) or `GOOGLE_APPLICATION_CREDENTIALS` (file path)
- AI webhook security:
  - HMAC signature header: `x-webhook-signature` (hex of sha256 over raw body)
  - Firebase Auth (stub in dev): `Authorization: Bearer <token>`
  - Idempotency: `X-Idempotency-Key`
- OAuth server present for future integrations; not required for local
 - AI audit trails: AI logs (ndjson) plus event emission for sensitive actions (planned richer audit)
 - Role-based guardrails: enforce allowed intents per role in AI and UI (planned)

## 12. Integrations
- Google Assistant / Local Fulfillment: `local-home/`, `shopeasly-v11/local-fulfillment/*` provide hooks
- Google Sheets: export/report via `utils/googleSheets.js`
- AI Providers: OpenAI/Gemini—optional; app works without them
 - Shipping/Payments: integration points defined for future adapters (planned)

## 13. Operations & Deployment
- Local run: Node.js; persists data to `data/`
- Hosted: Render; mount persistent disk to `DATA_DIR`
- Backups: copy `data/*.json`
- Logs: AI logs stored as ndjson; application logs to stdout

Environment setup
- Create `.env` or `.env.local` in `shopeasly-v11/`:
  - `GEMINI_API_KEY=...`
  - `OPENAI_API_KEY=...` (optional for images)
  - `DATA_DIR=./data`
  - `USE_EVENTS=1` (to enable SSE and event bus)
  - (optional) `USE_HMAC=1`, `WEBHOOK_SHARED_SECRET=...`

OAuth server
- Start from `oauth-server/` with `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT` set.
- `/health` basic heartbeat; `/health/admin` validates Firestore connectivity (requires API enabled + proper roles).

## 14. Roadmap
Short-term (0–2 weeks)
- Finalize CSP hardening (remove remaining inline handlers; drop `unsafe-inline`).
- AI daily digest alerts surface on dashboard.
- SSE robustness metrics & connection diagnostics UI.
- Optional: reintroduce granular roles if product requirement returns.

Mid-term (2–3 months)
- AI forecasting module for stock and sales trends.
- Advanced dashboard analytics with drill-down charts.
- Google Sheets export auto-sync.
- Audit logs & tamper-evident event chain for AI-triggered actions.

Long-term (6+ months)
- Migration from JSON to Firestore/Postgres with migrations.
- Production line job/station tracking.
- Shipping/payment integrations.
- Extensible plugin system for Easly AI.
- Fine-grained RBAC & audit-grade compliance logging.

## 15. Appendix – Key Files
- `shopeasly-v11/routes/*`: Express endpoints
- `shopeasly-v11/utils/*`: Business logic helpers
- `shopeasly-v11/config/firebase.js`: JSON-backed persistence
- `shopeasly-v11/views/*`: EJS templates (Dashboard, Inventory, Orders, AI)
- `shopeasly-v11/public/css/style.css`: design system
- `shopeasly-v11/easly/aiHandlerEnhanced.js`: AI co-pilot logic
- `shopeasly-v11/utils/eventBus.js`: in-process event emitter powering `/events`

## 16. Changelog

- 2.0.3 (2025-09-28)
  - Archived legacy 1.0 SPA design document (`SHOP-EASLY-DESIGN-LEGACY-1.0.md`) for historical context.
  - Fully removed remaining duplicated inline assistant & bulk creation scripts from `views/easly.ejs`; all logic now in `public/js/assistant-core.js` + `public/js/assistant-bulk.js`.
  - Began inline handler purge (onclick/data-* migration planned) to finalize CSP hardening phase.
  - Clarified legacy vs. current architecture deltas in Section 1.1.

- 2.0.2 (2025-09-28)
  - Simplified to single admin persona; removed role selector UI and role fields in event/log payloads (reduces prompt/token noise and complexity).
  - Modularized AI assistant front-end: extracted massive inline script from `views/easly.ejs` into `public/js/assistant-core.js` and `public/js/assistant-bulk.js` (improves maintainability, enables strict CSP, reduces initial HTML weight).
  - Introduced DOMPurify-based message sanitation layer; prepared for removal of `unsafe-inline` in CSP.
  - Layout upgrades: grid-based assistant layout, sticky compact header behavior, skeleton loading for side panel, jump-to-latest control, improved side panel collapse state persistence.
  - Health endpoint enhancements: unified `GET /health` (JSON) + `HEAD /health` with 5s server-side cache; includes provider/model readiness snapshot.
  - Added graceful shutdown handling and standardized default port to 3001.
  - Dependency cleanup: removed `chromadb` (peer conflicts); consolidated to single root `package.json`.
  - SSE robustness improvements: reconnection backoff & status dot color semantics (grey/green/amber/red) in `assistant-core.js`.
  - Security posture: groundwork for CSP tightening, minimized inline scripts, centralized toast & event handling.
  - Refined system instructions: removed multi-role permission verbiage; single-admin context assumed.
  - Misc: reduced duplicate markup in assistant view (in progress; further pruning tracked), standardized clientId persistence, improved message formatting & accessibility hooks.

- 2.0.1 (2025-09-24)
  - Added in-process event bus (`utils/eventBus.js`) and SSE endpoint `/events` with CSP allowances.
  - Wired client-side SSE in `views/easly.ejs` with a status indicator dot and toast notifications for key events.
  - Added “Architect mode” toggle and optional Role selector in Easly AI header; client routes to `/ai/co-pilot-arch` when enabled and passes role.
  - `/ai/co-pilot-arch` now accepts `{ textPart }` in addition to `{ message|prompt }` for consistency with the main co-pilot payload.
  - `src/EaslyOfflineAI.*`: offline/image training UI (extendable)

---
This document reflects the current codebase (main branch) and implemented behaviors, including no-scroll operational layouts, spreadsheet import with auto-mapping, real-data guardrails for AI, and robust order/inventory flows.
