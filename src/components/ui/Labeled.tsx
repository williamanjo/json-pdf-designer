import type { ReactNode } from "react";
import { cx, readPart, type PartStyle } from "./cx";

// Wrapper de rótulo compartilhado por Input/ColorInput/Select/Textarea — os
// quatro repetiam o mesmo <label><span>{label}</span>{controle}</label>.
//
// NOME: `jpd-labeled`, e não `jpd-field`. A palavra "field" descreveria as
// duas coisas, mas `jpd-field` é a caixa de campo do CANVAS (o <Rnd> do
// PageCanvas) — colidir os nomes faria o CSS de uma vazar na outra.
//
// `parts` é o que endereça o que não é o elemento que dá nome ao componente:
// `className` vai pro controle, `parts.root` pro <label> e `parts.label` pro
// <span>. Só className/style, sem handler nem ref — quem precisa disso omite
// `label` e compõe o próprio wrapper, que é o caminho que já existia.
export type LabeledParts = { root?: PartStyle; label?: PartStyle };

export function Labeled({ label, parts, children }: { label?: string; parts?: LabeledParts; children: ReactNode }) {
  // Sem rótulo, devolve o controle NU — mesmo comportamento de 2.x, e é a
  // saída de quem quer montar o próprio wrapper.
  if (!label) return <>{children}</>;

  const root = readPart(parts?.root);
  const text = readPart(parts?.label);
  return (
    <label className={cx("jpd-labeled", root.className)} style={root.style}>
      <span className={cx("jpd-labeled__text", text.className)} style={text.style}>
        {label}
      </span>
      {children}
    </label>
  );
}
