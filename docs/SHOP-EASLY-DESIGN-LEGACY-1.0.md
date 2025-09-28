# ShopEasly Application — Design Document (Legacy)

Version: 1.0.0 (Archived)
Status: Superseded by v2.x architecture
Date (original): Unknown (Imported from user-provided legacy text)

> This document captures the original purely client-side SPA concept for ShopEasly that operated without a backend. It is retained for historical reference and to clarify architectural evolution toward the current Node/Express + modular AI assistant system.

---

## 1. Purpose and Scope
### 1.1. Purpose
ShopEasly is a comprehensive, client-side internal business management application designed for small e-commerce or print-on-demand businesses. It provides a centralized, AI-enhanced interface to manage inventory, track orders, generate creative ideas, and streamline fulfillment operations. The application runs entirely within the browser, leveraging in-memory data and the Google Gemini API to offer a fast, responsive, and intelligent management experience.

### 1.2. Scope
**In Scope:**
- Single-user, single-session data management (no persistence).
- Dashboard for at-a-glance operational overview.
- CRUD (Create, Read, Update, Delete) operations for inventory (Products, Materials, Packaging) and Orders.
- AI-powered features including content generation, image creation, and voice commands.
- Dedicated views for specific operational roles (e.g., Fulfillment Tablet).
- Data import from and export to Excel files.
- Responsive UI for desktop, tablet, and mobile use.

**Out of Scope:**
- Server-side backend and database persistence.
- User authentication and multi-user collaboration.
- Real-time data synchronization.
- Direct integration with e-commerce platforms or payment gateways.

## 2. Architecture Overview
### 2.1. System Architecture
ShopEasly is a client-side Single-Page Application (SPA) built with TypeScript, HTML, and CSS. The architecture is self-contained and operates without a dedicated backend server.

- **Core Logic:** Encapsulated within a `ShopEaslyApp` TypeScript class handling state, DOM updates, and API calls.
- **State Management:** All state stored in-memory global object `appState` (lost on refresh).
- **View Rendering:** Multi-view illusion within a single `index.html` toggling containers.
- **AI Integration:** Direct calls to Google Gemini API from browser.
- **Dependencies:** Loaded at runtime via `<script>` / import maps (e.g., `@google/genai`, `xlsx`, `dompurify`, `marked`).

### 2.2. Key Technologies & Libraries
TypeScript, Vite, @google/genai, xlsx, marked, DOMPurify, SpeechRecognition API, localStorage.

## 3. Core Modules & Features (Legacy)
Summarized: Dashboard, Inventory & Orders tables, Ideas Hub (image + brainstorming), Creator & Fulfillment Tablet, Voice Assistant side panel, Excel import/export.

## 4. Data Model (In-Memory)
Objects: Product, Material, Packaging, Order, Design, AuditLog Entry (all transient).

## 5. UI/UX Principles
Modal-first workflow, responsive layout, toast feedback, loading spinners, accessibility via ARIA.

## 6. Security (Legacy Constraints)
- Relied on DOMPurify for AI Markdown sanitation.
- Exposed Gemini API key client-side (acceptable only for prototype).

---
## 7. Evolution Notes
This legacy design did not provide:
- Persistence beyond a session
- Real-time eventing
- Server-mediated AI guardrails
- Modularized assistant logic / CSP hardening

All of the above are addressed in v2.x (see `SHOP-EASLY-DESIGN.md`).

---
## 8. Deprecation Statement
This document should not be used for implementation planning. It is preserved solely to understand architectural drift and justify backend introduction, SSE, modular security improvements, and single-role consolidation.
