import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx, readPart, type PartStyle } from "./cx";

export type CollapsibleSectionProps = Omit<HTMLAttributes<HTMLDetailsElement>, "children" | "title"> & {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  parts?: { summary?: PartStyle; content?: PartStyle };
};

// Shell repetido 3x em PropertyPanelTable.tsx (Cabeçalho/Valor/Totais,
// dentro da aba "estilo") — um <details>/<summary> nativo, sem estado React,
// porque o navegador já cuida do expandir/colapsar sozinho.
//
// O estado aberto/fechado NÃO tem `data-*`: `<details>` já expõe o atributo
// `open` nativo, e o CSS mira nele. Regra da migração: onde existe
// pseudo-classe ou atributo nativo, usa o nativo.
export const CollapsibleSection = forwardRef<HTMLDetailsElement, CollapsibleSectionProps>(function CollapsibleSection(
  { title, defaultOpen, children, className, parts, ...rest },
  ref
) {
  const summary = readPart(parts?.summary);
  const content = readPart(parts?.content);
  return (
    <details ref={ref} open={defaultOpen} {...rest} className={cx("jpd-disclosure", className)}>
      <summary className={cx("jpd-disclosure__summary", summary.className)} style={summary.style}>
        {title}
      </summary>
      <div className={cx("jpd-disclosure__body", content.className)} style={content.style}>
        {children}
      </div>
    </details>
  );
});
