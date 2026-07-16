const ERR_KEY = "scanforge_errors";
const MAX_LOGS = 50;

function pushLog(entry: Record<string, unknown>) {
  try {
    const raw = localStorage.getItem(ERR_KEY);
    const logs: Record<string, unknown>[] = raw ? JSON.parse(raw) : [];
    logs.push({ t: Date.now(), ...entry });
    localStorage.setItem(ERR_KEY, JSON.stringify(logs.slice(-MAX_LOGS)));
  } catch {
    /* localStorage full or unavailable */
  }
}

pushLog({ event: "app_start" });

window.onerror = (msg, source, line, col, err) => {
  console.error("[ScanForge ERROR]", msg, source, line, col, err?.stack);
  pushLog({ event: "onerror", msg: String(msg), source, line, col, stack: err?.stack });
};
window.onunhandledrejection = (evt) => {
  console.error("[ScanForge UNHANDLED]", evt.reason?.stack || evt.reason);
  pushLog({ event: "unhandledrejection", reason: String(evt.reason), stack: evt.reason?.stack });
};

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

try {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  queueMicrotask(() => pushLog({ event: "render_ok" }));
} catch (e) {
  console.error("[ScanForge RENDER FAIL]", e);
  pushLog({ event: "render_fail", msg: String(e), stack: (e as Error)?.stack });
}
