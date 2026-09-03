import type { CSSProperties } from "react";
import { cx, readPart, type PartStyle } from "../../components/ui/cx";
import { useUiComponents } from "../../components/ui/useUiComponents";
import { useDesignerUi } from "../context/hooks";
import { DesignerFieldList } from "./DesignerFieldList";
import { DesignerFilterPanel } from "./DesignerFilterPanel";
import { DesignerInspector } from "./DesignerInspector";
import { DesignerPageSettings } from "./DesignerPageSettings";
import { DesignerPropertyPanel } from "./DesignerPropertyPanel";
import { DesignerTabBar } from "./DesignerTabBar";
import { DesignerToolbar } from "./DesignerToolbar";

export type DesignerSidebarProps = {
  className?: string;
  style?: CSSProperties;
  parts?: {
    // A barra de abas.
    tabBar?: PartStyle;
    // A caixa que colapsa (o `<TabPanel>`).
    panel?: PartStyle;
  };
};

// Peça de CONVENIÊNCIA: a sidebar inteira, do jeito que o `<Designer>`
// monta — barra de abas em cima, e o conteúdo da aba ativa embaixo, numa
// caixa que colapsa no duplo clique.
//
// É a ÚNICA peça que importa outras peças (invariante guardado por
// partBoundaries.test.ts). Existe porque reproduzir o gate de aba de sete
// blocos na mão é chato e fácil de errar — mas é só açúcar: quem quer outro
// layout monta as peças direto, com o `whenTab` que quiser (ou sem nenhum).
//
// O COLAPSO mora só aqui, e não em cada peça. O truque do `<TabPanel>` é um
// grid `1fr`→`0fr`, que exige um pai `flex column` com `min-block-size: 0` —
// uma peça avulsa não garante isso, então ela animaria errado em silêncio em
// vez de degradar. A barra de abas ESCREVE o flag (duplo clique) e a sidebar
// LÊ: usar `<DesignerTabBar>` sem sidebar deixa o duplo clique sem efeito
// visível, o que é o comportamento correto pra quem não tem o que colapsar.
export function DesignerSidebar({ className, style, parts }: DesignerSidebarProps) {
  const { Card, TabPanel } = useUiComponents();
  const { sidebarCollapsed } = useDesignerUi();
  const tabBar = readPart(parts?.tabBar);
  const panel = readPart(parts?.panel);

  return (
    <Card className={cx("jpd-sidebar", className)} data-part="sidebar" style={style}>
      <DesignerTabBar className={tabBar.className} style={tabBar.style} />
      <TabPanel collapsed={sidebarCollapsed} className={panel.className} style={panel.style}>
        {/* A aba "Campos" tem DOIS blocos irmãos, e eles são irmãos de
            propósito: o gap de 8px do `.jpd-tabpanel__body` separa a lista
            do rodapé de ações. Embrulhar os dois num nível a mais colapsaria
            esse gap. */}
        <DesignerFieldList whenTab="campos" />
        <DesignerToolbar whenTab="campos" />

        {/* Duas instâncias do MESMO painel, uma por metade. É exatamente o
            que o `section` existe pra permitir — e dentro da sidebar só uma
            aba está ativa, então só uma renderiza. */}
        <DesignerPropertyPanel whenTab="dados" section="dados" />
        <DesignerPropertyPanel whenTab="estilo" section="estilo" />
        <DesignerFilterPanel whenTab="filtro" />

        <DesignerPageSettings whenTab="pagina" />
        <DesignerInspector whenTab="inspetor" />
      </TabPanel>
    </Card>
  );
}
