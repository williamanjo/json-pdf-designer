import type { CSSProperties } from "react";
import { TemplateInspector } from "../../components/TemplateInspector";
import { cx } from "../../components/ui/cx";
import { useDesignerData, useDesignerSelection } from "../context/hooks";
import { useTabGate, type TabGate } from "./useTabGate";

export type DesignerInspectorProps = {
  // Vão pro elemento raiz da peça. `className` faz MERGE com a nossa
  // (a sua vem depois); `style` seu ganha do nosso.
  className?: string;
  style?: CSSProperties;
  // Só renderiza nesta(s) aba(s). Omitido = renderiza sempre — ver
  // useTabGate.ts pro porquê do default ser esse.
  whenTab?: TabGate;
};

// Peça posicionável: o inspetor de template (campos por zona, avisos de
// vínculo/expressão).
//
// A peça é um ADAPTADOR, não um substituto: `<TemplateInspector>` continua
// exportado com as props de hoje, e isto aqui é "lê contexto, chama o que já
// existe". Assim o caminho headless por props continua funcionando sem
// provider nenhum, e o diff desta extração lê como MOVE.
//
// Esta é uma das três peças que EMBRULHAM (`.jpd-part`) em vez de reproduzir
// a raiz de dentro: `TemplateInspector` tem DUAS raízes possíveis (a lista, e
// um `<p>` de estado vazio), então não há um elemento estável pra receber o
// `className` do consumidor. As outras peças não embrulham — elas renderizam
// a mesma raiz que o `Designer.tsx` tinha, e o DOM não ganha nível nenhum.
export function DesignerInspector({ whenTab, ...rest }: DesignerInspectorProps) {
  // Gate primeiro, e NENHUM hook depois do return — por isso o corpo mora
  // num componente separado. Ver useTabGate.ts.
  if (!useTabGate(whenTab)) return null;
  return <DesignerInspectorBody {...rest} />;
}

function DesignerInspectorBody({ className, style }: Omit<DesignerInspectorProps, "whenTab">) {
  const { template, bindings } = useDesignerData();
  const { selectedIds, handleSelect } = useDesignerSelection();
  return (
    <div className={cx("jpd-part", className)} data-part="inspector" style={style}>
      <TemplateInspector template={template} bindings={bindings} selectedIds={selectedIds} onSelect={handleSelect} />
    </div>
  );
}
