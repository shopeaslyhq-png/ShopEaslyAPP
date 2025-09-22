# ShopEasly APP — Comprehensive Design Document

Version: 1.0
Date: 2025-09-21
Owner: shopeaslyhq-png

## 1. Purpose and Scope
ShopEasly APP is an operations system for a print and fulfillment workshop. It centralizes orders, inventory (products, raw materials, packing), production flows, and an AI co-pilot to reduce manual effort. This document defines the end-to-end design: context, architecture, modules, data, APIs, UX, non-functionals, and the app’s role across the workshop lifecycle.

Goals:
- Single place to manage orders and inventory with real data (no hallucinations)
- Fast, no-scroll operational dashboards with modal flows
- AI co-pilot for quick lookups, guided actions, and asset generation
- Local-friendly: runs with JSON storage; can grow to cloud backends later

Out of scope:
- Payment capture and shipping label purchasing (can integrate later)
- Detailed user/role auth (future hardening)

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

Key packages and layers:
- Web server: Express
- Views: EJS templates (`views/`)
- Static: CSS, JS, images (`public/`)
- Data access: `config/firebase.js` (local JSON CRUD)
- Business logic: `utils/*` (orders, inventory, dashboard summary, sheets)
- AI: `easly/aiHandlerEnhanced.js`, voice/tone via `utils/ToneManager.js` + `config/voice.json`

Deployment:
- Local: Node process; data persisted under `data/*.json`
- Hosted: Render (see `render.yaml`) or similar; mount persistent disk to `DATA_DIR`

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
- easly/
  - aiHandlerEnhanced.js: routes local inventory/orders intents; LLM fallback w/ guardrails
  - creativeAssistant.js, dialogflowHandler.js, speak.js, listen.js, voiceHandler.js: voice/assistant integrations
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
- POST /ai/co-pilot { message, channel? } → text (uses local intents first; strict real-data guardrails)
- POST /ai/generate-image { prompt } → { url }
- GET /ai/health → { providers, models }
- GET /ai/history?clientId=&limit= → { items }
- DELETE /ai/history?clientId= → { ok }

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
- Local intent routing for inventory/orders queries; otherwise optional LLM
- Strict guardrails: refuses to invent data; concise responses (tone set in `config/voice.json`)
- Image generation via OpenAI (optional, env-key gated)

## 8. UI/UX Principles
- No page-level scroll on main operational views; one scrollable region per page
- Modal-first flows to keep context
- Concise text; no emojis/filler per tone configuration
- Clear error/status toasts; Escape/overlay click closes modals

## 9. Non-Functional Requirements
- Performance: lightweight server-rendered views, minimal client JS
- Reliability: local JSON persistence; easy backup/restore (copy `data/*.json`)
- Observability: AI logs (ndjson), health endpoint, console logs for CRUD
- Security: CSP `upgrade-insecure-requests`; secrets in env; no API keys exposed client-side
- Privacy: no third-party trackers; data stays local unless configured
- Extensibility: replace local JSON with Firestore/Postgres by swapping `config/firebase.js`

## 10. Error Handling & Edge Cases
- Inventory import: skip rows missing `name` or `sku`; basic CSV parsing; SheetJS for XLSX
- Duplicate SKUs: server uppercases SKUs; de-duplication is left to business ops or can be added
- Negative or non-numeric inputs: server coercion and validation with helpful errors
- Orders referencing Materials/Packing: rejected—only finished Products are orderable
- Image uploads: base64 parsing with validation; returns public URLs in `/public/images/...`

## 11. Security & Access
- Single-tenant, local by default
- Environment variables: `OPENAI_API_KEY`, `GOOGLE_API_KEY/GEMINI_API_KEY`, `DATA_DIR`
- OAuth server present for future integrations; not required for local

## 12. Integrations
- Google Assistant / Local Fulfillment: `local-home/`, `shopeasly-v11/local-fulfillment/*` provide hooks
- Google Sheets: export/report via `utils/googleSheets.js`
- AI Providers: OpenAI/Gemini—optional; app works without them

## 13. Operations & Deployment
- Local run: Node.js; persists data to `data/`
- Hosted: Render; mount persistent disk to `DATA_DIR`
- Backups: copy `data/*.json`
- Logs: AI logs stored as ndjson; application logs to stdout

## 14. Roadmap
- Role-based access control and audit logs
- Real-time updates via WebSockets
- Dedicated production tracking (jobs, stations, timestamps)
- Shipping integration (label purchase, tracking)
- Move storage to Postgres/Firestore with migrations

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
