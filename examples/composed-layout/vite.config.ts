import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Este example existe pra provar UMA coisa: o <Designer> não é indivisível.
// Ele monta o <DesignerProvider> na mão e posiciona as peças num layout que
// o preset não sabe fazer — toolbar em cima, lista à esquerda, painel à
// direita, e NENHUMA barra de abas.
//
// A ausência da barra de abas é o teste de verdade: sem ela, as peças que
// dentro do <Designer> viveriam em abas diferentes (lista, as duas metades
// do painel de propriedades, vínculo, filtro, página, inspetor) têm de
// renderizar TODAS ao mesmo tempo — 9 instâncias no DOM de uma vez. Só
// funciona porque o gate por aba é opt-in (`whenTab`) — se ele fosse o
// default, este layout mostraria uma peça e apagaria as outras oito.
//
// As únicas abas na tela são as de PÁGINA (components/PageTabs.tsx), que
// são estado deste app: elas trocam qual página do documento o canvas
// mostra, não qual painel aparece.
//
// Sem plugin de Tailwind: a casca é CSS puro (src/index.css) e o editor vem
// de "json-pdf-designer/theme.css".
export default defineConfig({
  // Relativo — funciona em qualquer subpath do GitHub Pages
  // (playground/composed-layout/) sem hardcodar o nome do repo.
  base: "./",
  plugins: [react()],
  server: {
    // 5173/5174/5175/5176 já são dos outros quatro examples.
    port: 5177,
  },
  // json-pdf-designer é uma dependência "file:" linkada (symlink) pro
  // pacote pai — sem isso o Vite pode resolver "react" a partir do
  // node_modules dele em vez do node_modules deste app, carregando duas
  // cópias de React (erro "Invalid hook call").
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
