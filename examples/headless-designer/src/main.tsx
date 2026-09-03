import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// SÓ O RESET, sem o tema — e este é o único example que faz isso.
//
// `json-pdf-designer/reset.css` é o subconjunto SEM APARÊNCIA do
// `theme.css`: ele devolve o que o Preflight do Tailwind dava de graça até a
// 2.x (`box-sizing`, `margin: 0` em heading/parágrafo/lista, `font: inherit`
// em controle, `svg { display: block }`, `code` monoespaçado) e mais nada.
// Zero cor, zero espaçamento, zero borda.
//
// Serve porque este app não renderiza o `<Designer>`: ele monta o editor
// próprio e do pacote usa só o `<PdfPreview>`, cuja superfície são QUATRO
// nomes (`.jpd-error`, `.jpd-error--md`, `.jpd-preview__count` e o token
// `--jpd-shadow-page-preview`). Escrever a aparência desses quatro à mão são
// as ~5 regras no fim do index.css — barato. Para o editor INTEIRO o custo
// seria outro: ver `examples/custom-ui`, que paga ~190 classes.
//
// Quem quer a aparência pronta importa `json-pdf-designer/theme.css`, que já
// inclui este reset por dentro — uma linha, e nada a escrever.
import "json-pdf-designer/reset.css";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
