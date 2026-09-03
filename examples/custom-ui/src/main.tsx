import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// NENHUM CSS DO PACOTE é importado aqui — nem `json-pdf-designer/style.css`,
// nem `json-pdf-designer/theme.css`. É esse o ponto deste example: a folha do
// pacote é OPT-IN, e não importar ela é modo suportado.
//
// O que sobra no DOM sem ela são as classes `.jpd-*` e os atributos `data-*`
// que cada elemento do <Designer> carrega (`.jpd-btn[data-variant]`,
// `.jpd-field[data-selected]`, `.jpd-tab[data-active]`, ...). Quem estiliza é
// o src/index.css daqui, escrito à mão em CSS puro — canvas, painel de
// propriedades, abas, modais e todos os controles inclusive.
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
