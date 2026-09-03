import { useDesignerUi } from "../context/hooks";
import type { TabKey } from "../useTabBar";

// O gate por aba é OPT-IN. É a decisão mais sutil da decomposição, e a que
// decide se as peças são de verdade posicionáveis.
//
// Se `DesignerPropertyPanel` e `DesignerPageSettings` gateassem por
// `sidebarTab` por default, pôr os dois lado a lado num layout próprio
// apagaria um dos dois — porque só uma aba pode estar ativa. Seriam peças
// que PARECEM decompostas mas só funcionam dentro de uma sidebar com abas,
// o que anula a feature inteira.
//
// Então: sem `whenTab`, a peça renderiza sempre. Com `whenTab`, ela só
// aparece na(s) aba(s) listada(s) — e é assim que `DesignerSidebar` e o
// `<Designer>` reproduzem o comportamento de hoje.
export type TabGate = TabKey | readonly TabKey[] | undefined;

// Chame SEMPRE no topo da peça, e faça o `return null` logo depois — nenhum
// outro hook pode vir antes do return, então o corpo de verdade mora num
// componente separado (`*Body`). É por isso que cada arquivo de peça tem
// dois componentes em vez de um.
export function useTabGate(whenTab: TabGate): boolean {
  const { sidebarTab } = useDesignerUi();
  if (whenTab === undefined) return true;
  return typeof whenTab === "string" ? sidebarTab === whenTab : whenTab.includes(sidebarTab);
}
