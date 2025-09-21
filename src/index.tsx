
import React from "react";
import { createRoot } from "react-dom/client";
import EaslyOfflineAI from "./EaslyOfflineAI";
import EaslyAIEventFeed from "./EaslyAIEventFeed";

// TODO: Replace with actual Firebase import and user context
const mockFirestore = null; // Replace with firebase.firestore() instance
const mockUid = "demo-user"; // Replace with actual user UID

const container = document.getElementById("app") || document.body;
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, padding: 32 }}>
      <EaslyOfflineAI />
      <div style={{ width: "100%", maxWidth: 900 }}>
        <h2 style={{ textAlign: "center", marginBottom: 16 }}>Easly AI Event Feed (Demo)</h2>
        <EaslyAIEventFeed uid={mockUid} firestore={mockFirestore} />
      </div>
    </div>
  </React.StrictMode>
);
