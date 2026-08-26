import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// CSS pronto do pacote — Button/Card/Input/etc que o <Designer> usa POR
// DENTRO (PropertyPanel, Toolbar, BindingEditor) continuam vindo daqui.
// "Sem usar as prontas" neste example é sobre a CASCA em volta do
// <Designer> (este App.tsx) — o Designer em si é uma peça única, não dá
// (nem faz sentido) recriar o painel de propriedades na mão.
import "json-pdf-designer/style.css";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
