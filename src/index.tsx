

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
    <div className="app-container" style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, paddingLeft: 0 }}>
        {/* Easly AI Event Cards at the top, horizontal, no-scroll */}
        <div style={{ width: "100%", overflowX: "auto", whiteSpace: "nowrap", display: "flex", gap: 16, padding: "16px 0 8px 0", alignItems: "flex-start", borderBottom: "1px solid #eee" }}>
          <EaslyAIEventFeed uid={userUid} firestore={firestore} />
        </div>
        {/* Product Description Generator below event cards */}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
          <ProductDescriptionGenerator />
        </div>
        {/* Offline AI below generator */}
        <div style={{ marginTop: 24 }}>
          <EaslyOfflineAI />
        </div>
      </main>
    </div>
  </React.StrictMode>
);
