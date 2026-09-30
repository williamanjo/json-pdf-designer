import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// The package's ready-made CSS — the whole <Designer> (toolbar, property
// panel, binding editor) depends on it. There is nothing of pdf.js here: the
// theme.css is the SAME file for any entry.
//
// This example is the smoke test of the editor with NO Tailwind pipeline at
// all (neither the app's nor the package's — see vite.config.ts). If the
// theme.css stops loading something Preflight gave for free, it shows up here
// before it shows up in report-builder.
import "json-pdf-designer/theme.css";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
