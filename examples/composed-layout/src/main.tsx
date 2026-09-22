import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// A single line: `theme.css` already imports `reset.css` internally.
//
// This example has NO Tailwind pipeline (see vite.config.ts) — the shell is
// plain CSS in index.css, and the editor comes styled from the package.
import "json-pdf-designer/theme.css";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
