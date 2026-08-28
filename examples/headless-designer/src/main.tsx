import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// CSS pronto do pacote — só usado aqui pelo <PdfPreview> (classes Tailwind
// já compiladas pro texto de erro/contagem de página). Nada mais deste app
// depende dele — a casca inteira (App.tsx) é CSS puro, ver index.css.
import "json-pdf-designer/style.css";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
