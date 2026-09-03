import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Uma linha só: `theme.css` já importa o `reset.css` por dentro.
//
// Este example NÃO tem pipeline de Tailwind (ver vite.config.ts) — a casca
// é CSS puro em index.css, e o editor vem estilizado do pacote.
import "json-pdf-designer/theme.css";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
