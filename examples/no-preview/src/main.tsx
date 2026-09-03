import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// CSS pronto do pacote — o <Designer> inteiro (toolbar, painel de
// propriedades, editor de vínculo) depende dele. Não tem nada de pdf.js
// aqui: o theme.css é o MESMO arquivo pra qualquer entry.
//
// Este exemplo é o smoke test do editor SEM pipeline de Tailwind nenhum
// (nem o do app, nem o do pacote — ver vite.config.ts). Se o theme.css
// deixar de carregar algo que o Preflight dava de graça, aparece aqui
// antes de aparecer no report-builder.
import "json-pdf-designer/theme.css";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
