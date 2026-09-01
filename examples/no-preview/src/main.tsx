import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// CSS pronto do pacote — o <Designer> inteiro (toolbar, painel de
// propriedades, editor de vínculo) depende dele. Não tem nada de pdf.js
// aqui: o style.css é o MESMO arquivo pra qualquer entry.
import "json-pdf-designer/style.css";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
