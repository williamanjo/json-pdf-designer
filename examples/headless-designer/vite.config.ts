import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Sem plugin de Tailwind aqui de propósito — este example prova que dá pra
// montar um editor PRÓPRIO (sem o componente <Designer>) só com as peças de
// baixo nível do pacote (generatePdf/tipos de "json-pdf-designer/server" +
// <PdfPreview> de "json-pdf-designer"). O CSS do <PdfPreview> (classes
// Tailwind já compiladas) vem pronto via "json-pdf-designer/style.css",
// importado em main.tsx — a casca deste App.tsx é CSS puro.
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
