# ShopEasly APP — Comprehensive Design Document

Version: 2.0
Date: 2025-09-21
Owner: shopeaslyhq-png

## 1. Purpose and Scope
ShopEasly APP v2.0 is an enhanced operations system for a print and fulfillment workshop. It centralizes orders, inventory (products, raw materials, packing), production flows, and introduces a proactive AI co-pilot with session memory, forecasting, role-awareness, and real-time updates. This document defines the end-to-end design: context, architecture, modules, data, APIs, UX, non-functionals, and the app’s role across the workshop lifecycle.

Goals:
- Single place to manage orders and inventory with real data (no hallucinations)
- Fast, no-scroll operational dashboards with modal flows
- AI co-pilot for quick lookups, guided actions, and asset generation
- Proactive intelligence: daily digests, forecasting, role-aware guidance
- Real-time operations: updates via WebSockets and a centralized event bus
- Local-friendly: runs with JSON storage; can grow to cloud backends later

Out of scope:
- Payment capture and shipping label purchasing (can integrate later)
- Detailed user/role auth (future hardening)

## 2. Key Enhancements in v2.0
- AI Co-Pilot: session memory, proactive daily digests, forecasting hooks, visual output support (charts), creative flows for designers.
- Dashboard UX: AI overlay card, drill-down analytics, role-based views for managers, operators, techs, and packers.
- System: real-time updates via WebSockets, centralized event bus, dual storage (JSON + Firestore/Postgres ready), richer observability metrics.
- Security & Reliability: role-based guardrails, AI audit trails, shared validation layer, HMAC + optional Firebase Auth.
- Workflow Extensions: production tracking (jobs/stations), shipping integrations, designer ideation pipeline.

## 2. System Context
Actors:
- Operator: creates/updates orders, monitors progress
- Production Tech: checks inventory, deducts materials, fulfills
- Packer/Shipper: uses packing list and packing materials
- Manager: reviews dashboard, low-stock alerts, usage
- Designer: generates images/designs and product concepts
- AI Co-Pilot: assists with data lookups and light actions

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
- Real-time: optional WebSockets channel for live updates; centralized event bus emitting domain events for dashboards and AI digests
- Data backends: dual storage strategy (local JSON now; Firestore/Postgres target with migration path)

Key packages and layers:
- Web server: Express
- Views: EJS templates (`views/`)
- Static: CSS, JS, images (`public/`)
- Data access: `config/firebase.js` (local JSON CRUD)
- Business logic: `utils/*` (orders, inventory, dashboard summary, sheets)
- AI: `easly/aiHandlerEnhanced.js` (local intents + LLM fallback), voice/tone via `utils/ToneManager.js` + `config/voice.json`
- AI (architect blueprint): Gemini function-calling loop with tools; system instructions at `config/system-instructions.js`; local tools at `utils/localDataService.js`
 - Real-time: server WebSocket hub (planned), event bus (`utils/securityMiddleware.emitEvent` today; promote to dedicated module)

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

## 4.1 AI Architecture: Architect + Copilot
Roles:
- Architect (blueprints): provides the Gemini multi-step function-calling loop and security patterns.
- Copilot (builder): fleshes out routes and filtering logic from comments and signatures.

Core components:
- `config/system-instructions.js`: system prompt and guardrails for Gemini.
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
 - Session memory: short-term context captured in `data/sessions.json` to power batch actions like “mark the last 2 orders as shipped”.
 - Proactive digests: scheduled summaries (via dashboard/report services) can surface daily sales, low stock, and pending orders.

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
- POST /ai/co-pilot-arch { message } → { response }
  - Calls `handleCoPilotMessage` (Gemini tool loop). Safe to run alongside the default /co-pilot.

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
 - Real-time: WebSockets for inventory/orders updates; event bus emits domain events consumed by UI and AI digest jobs

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
  - (optional) `USE_HMAC=1`, `WEBHOOK_SHARED_SECRET=...`

OAuth server
- Start from `oauth-server/` with `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT` set.
- `/health` basic heartbeat; `/health/admin` validates Firestore connectivity (requires API enabled + proper roles).

## 14. Roadmap
Short-term (0–2 weeks)
- Implement session memory in Easly AI.
- AI daily digest alerts on dashboard.
- Role-aware AI responses with scoped actions.
- Real-time updates via WebSockets.

Mid-term (2–3 months)
- AI forecasting module for stock and sales trends.
- Advanced dashboard analytics with drill-down charts.
- Google Sheets export auto-sync.
- Audit logs for AI-triggered actions.

Long-term (6+ months)
- Migration from JSON to Firestore/Postgres with migrations.
- Production line job/station tracking.
- Shipping/payment integrations.
- Extensible plugin system for Easly AI.

## 15. Appendix – Key Files
- `shopeasly-v11/routes/*`: Express endpoints
- `shopeasly-v11/utils/*`: Business logic helpers
- `shopeasly-v11/config/firebase.js`: JSON-backed persistence
- `shopeasly-v11/views/*`: EJS templates (Dashboard, Inventory, Orders, AI)
- `shopeasly-v11/public/css/style.css`: design system
- `shopeasly-v11/easly/aiHandlerEnhanced.js`: AI co-pilot logic
- `src/EaslyOfflineAI.*`: offline/image training UI (extendable)

---
This document reflects the current codebase (main branch) and implemented behaviors, including no-scroll operational layouts, spreadsheet import with auto-mapping, real-data guardrails for AI, and robust order/inventory flows.
