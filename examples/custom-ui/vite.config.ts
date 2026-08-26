import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Sem plugin de Tailwind aqui de propósito — esse example prova que dá pra
// usar o <Designer> sem NENHUM setup de design system próprio: o CSS dele
// (Button/Card/Input internos do pacote) já vem pronto e compilado em
// "json-pdf-designer/style.css" (import estático, ver main.tsx), não
// depende do consumidor ter Tailwind configurado.
export default defineConfig({
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
