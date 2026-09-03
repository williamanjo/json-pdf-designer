import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx, readPart, type PartStyle } from "./cx";

export type TabPanelProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  collapsed: boolean;
  children: ReactNode;
  parts?: { content?: PartStyle };
};

// Colapsa o conteúdo da aba ativa encolhendo em vez de só sumir — usado em
// todo lugar que tem abas (sidebar Campos/Página do Designer, e
// Dados/Estilo/Filtro dentro do editor do campo).
//
// O `gridTemplateRows` saiu de `style` inline e virou `data-collapsed`: a
// mecânica (grid `1fr` -> `0fr`) continua a mesma, mas agora o tema controla
// duração/curva, e o `style` do consumidor deixa de brigar com o do
// componente. Ver `.jpd-tabpanel` em theme.css pro porquê do `min-height: 0`.
export const TabPanel = forwardRef<HTMLDivElement, TabPanelProps>(function TabPanel(
  { collapsed, children, className, parts, ...rest },
  ref
) {
  const content = readPart(parts?.content);
  return (
    <div ref={ref} {...rest} data-collapsed={collapsed || undefined} className={cx("jpd-tabpanel", className)}>
      <div className={cx("jpd-tabpanel__body", content.className)} style={content.style}>
        {children}
      </div>
    </div>
  );
});
