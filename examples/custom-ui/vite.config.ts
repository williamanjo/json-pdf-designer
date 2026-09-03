import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Sem plugin de Tailwind aqui de propósito — e, diferente dos outros
// examples, sem NENHUM import de CSS do pacote (ver main.tsx). Este é o
// example que prova que a folha `json-pdf-designer/theme.css` é OPT-IN: o
// <Designer> só deixa as classes `.jpd-*` e os atributos `data-*` no DOM, e
// quem pinta tudo é o src/index.css daqui, em CSS puro.
export default defineConfig({
  // Relativo (não "/repo-name/") — funciona em qualquer subpath do GitHub
  // Pages (site é montado em playground/custom-ui/) sem precisar hardcodar
  // o nome do repo aqui. Só é seguro porque este app não usa client-side
  // router (SPA de view única).
  base: './',
  plugins: [react()],
  // Porta fixa — sem isso o Vite cai no default 5173, que colide com o
  // dev server do example "report-builder" se os dois rodarem juntos.
  server: {
    port: 5174,
  },
  // json-pdf-designer é uma dependência "file:" linkada (symlink) pro
  // pacote pai — sem isso o Vite pode resolver "react" a partir do
  // node_modules dele em vez do node_modules deste app, carregando duas
  // cópias de React (erro "Invalid hook call").
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
