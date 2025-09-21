

import * as React from "react";
import { createRoot } from "react-dom/client";
import EaslyAIEventFeed from "./EaslyAIEventFeed";
import EaslyOfflineAI from "./EaslyOfflineAI";
import { firestore } from "./firebase";
import ProductDescriptionGenerator from "./ProductDescriptionGenerator";

// TODO: Replace with actual user authentication logic
const userUid = "demo-user"; // Replace with the real authenticated user's UID

const container = document.getElementById("app") || document.body;
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <div style={{ width: "100%", maxWidth: 1200, margin: "0 auto", padding: 0 }}>
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
    </div>
  </React.StrictMode>
);
