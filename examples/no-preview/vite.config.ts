import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Este example existe pra provar UMA coisa: o entry principal do pacote
// funciona sem o pdfjs-dist instalado (ver README.md aqui). Por isso o
// package.json não tem pdfjs-dist em NENHUM campo, e nada aqui importa de
// "json-pdf-designer/preview" — se algum import de pdf.js voltar pra entry
// principal, o `npm ci && npm run build` deste app quebra na CI.
//
// Sem plugin de Tailwind: o CSS do <Designer> já vem compilado em
// "json-pdf-designer/style.css" (import em main.tsx).
export default defineConfig({
  // Relativo — funciona em qualquer subpath do GitHub Pages
  // (playground/no-preview/) sem hardcodar o nome do repo. Seguro aqui
  // porque este app não usa client-side router.
  base: "./",
  plugins: [react()],
  server: {
    // 5173/5174/5175 já são dos outros três examples.
    port: 5176,
  },
  // json-pdf-designer é uma dependência "file:" linkada (symlink) pro
  // pacote pai — sem isso o Vite pode resolver "react" a partir do
  // node_modules dele em vez do node_modules deste app, carregando duas
  // cópias de React (erro "Invalid hook call").
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
