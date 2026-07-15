window.onerror = (msg, source, line, col, err) => {
  console.error("[ScanForge ERROR]", msg, source, line, col, err?.stack);
};
window.onunhandledrejection = (evt) => {
  console.error("[ScanForge UNHANDLED]", evt.reason?.stack || evt.reason);
};

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
