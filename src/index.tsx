import React from "react";
import { createRoot } from "react-dom/client";
import EaslyOfflineAI from "./EaslyOfflineAI";

const container = document.getElementById("app") || document.body;
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <EaslyOfflineAI />
  </React.StrictMode>
);
