

import * as React from "react";
import { createRoot } from "react-dom/client";
import EaslyAIEventFeed from "./EaslyAIEventFeed";
import EaslyOfflineAI from "./EaslyOfflineAI";
import { firestore } from "./firebase";
import ProductDescriptionGenerator from "./ProductDescriptionGenerator";
import Sidebar from "./components/Sidebar";

// TODO: Replace with actual user authentication logic
const userUid = "demo-user"; // Replace with the real authenticated user's UID

const container = document.getElementById("root") || document.body;
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <div className="app-container" style={{ display: "flex", minHeight: "100vh", background: "var(--background)" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: "2.5rem 2rem", background: "var(--background)", minHeight: "100vh" }}>
        <section style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
          {/* Easly AI Event Cards at the top, horizontal, no-scroll */}
          <div style={{
            width: "100%",
            overflowX: "auto",
            whiteSpace: "nowrap",
            display: "flex",
            gap: 20,
            padding: "20px 0 12px 0",
            alignItems: "flex-start",
            borderBottom: "1px solid var(--divider)",
            borderRadius: "var(--radius-lg)",
            background: "var(--surface)",
            boxShadow: "0 2px 12px var(--shadow-brand)"
          }}>
            <EaslyAIEventFeed uid={userUid} firestore={firestore} />
          </div>
          {/* Product Description Generator below event cards */}
          <div style={{
            marginTop: 0,
            display: "flex",
            justifyContent: "center",
            background: "var(--surface)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "0 4px 24px var(--shadow-brand)",
            padding: 32,
            border: "2px solid var(--border)"
          }}>
            <ProductDescriptionGenerator />
          </div>
          {/* Offline AI below generator */}
          <div style={{
            marginTop: 0,
            background: "var(--surface)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "0 4px 24px var(--shadow-brand)",
            padding: 32,
            border: "2px solid var(--border)"
          }}>
            <EaslyOfflineAI />
          </div>
        </section>
      </main>
    </div>
  </React.StrictMode>
);
