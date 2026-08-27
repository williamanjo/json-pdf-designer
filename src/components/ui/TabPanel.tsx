import type { ReactNode } from "react";

// Colapsa o conteúdo da aba ativa com uma animação de "encolher" em vez
// de só sumir — usado em todo lugar que tem abas (sidebar Campos/Página
// do Designer, e Dados/Estilo/Filtro dentro do editor do campo). Truque
// do CSS Grid (`1fr` -> `0fr` com overflow:hidden) anima a altura mesmo
// sem saber o tamanho do conteúdo de antemão, coisa que `max-height` fixo
// não faz direito. `min-h-0` no próprio wrapper é essencial: quem usa
// esse componente sempre tá dentro de um `flex flex-col` (Card da
// sidebar, painel do campo), e um item de flex tem `min-height: auto`
// por padrão — sem zerar isso aqui, ele nunca encolhe abaixo da altura do
// próprio conteúdo, TRUQUE de grid por dentro ou não.
export function TabPanel({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  return (
    <div
      className="grid min-h-0 transition-[grid-template-rows] duration-200 ease-in-out"
      style={{ gridTemplateRows: collapsed ? "0fr" : "1fr" }}
    >
      <div className="flex min-h-0 flex-col gap-2 overflow-hidden">{children}</div>
    </div>
  );
}
