import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Sem plugin de Tailwind aqui — e desde a 3.0.0 não há Tailwind nenhum pra
// plugar: o pacote não usa mais. Este example prova que dá pra montar um
// editor PRÓPRIO (sem o componente <Designer> e sem nenhuma peça
// `Designer*`) só com as peças de baixo nível do pacote (generatePdf/tipos
// de "json-pdf-designer/server" + <PdfPreview> de
// "json-pdf-designer/preview"). E ele importa SÓ o "json-pdf-designer/
// reset.css" (main.tsx), não o tema — então até a aparência do
// <PdfPreview> é escrita à mão, no src/index.css.
export default defineConfig({
  // Relativo — funciona em qualquer subpath do GitHub Pages
  // (playground/headless-designer/) sem hardcodar o nome do repo. Seguro
  // aqui porque este app não usa client-side router.
  base: "./",
  plugins: [react()],
  server: {
    port: 5175,
  },
  // json-pdf-designer é uma dependência "file:" linkada (symlink) pro
  // pacote pai — sem isso o Vite pode resolver "react" a partir do
  // node_modules dele em vez do node_modules deste app, carregando duas
  // cópias de React (erro "Invalid hook call").
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
