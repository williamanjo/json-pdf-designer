import type { CSSProperties } from "react";
import { BindingEditor } from "../../components/BindingEditor";
import { cx } from "../../components/ui/cx";
import { useDesignerActions, useDesignerConfig, useDesignerSelectedSchema } from "../context/hooks";
import { useTabGate, type TabGate } from "./useTabGate";

export type DesignerBindingEditorProps = {
  className?: string;
  style?: CSSProperties;
  whenTab?: TabGate;
};

// Peça posicionável: o editor de vínculo (que caminho do JSON alimenta o
// campo selecionado) SOZINHO, fora do painel de propriedades.
//
// Existe porque é exatamente o que o examples/headless-designer disse ter
// tido de abrir mão: dentro do `<Designer>` o `BindingEditor` só aparece
// aninhado em `PropertyPanel*`, por tipo de campo. Quem monta o próprio
// editor quer poder pôr o vínculo numa coluna própria.
//
// Sem campo selecionado renderiza `null` — e não uma dica. O texto de estado
// vazio depende do layout ("clique num campo à esquerda" só faz sentido se
// houver um "à esquerda"), então é do consumidor.
export function DesignerBindingEditor({ whenTab, ...rest }: DesignerBindingEditorProps) {
  if (!useTabGate(whenTab)) return null;
  return <DesignerBindingEditorBody {...rest} />;
}

function DesignerBindingEditorBody({ className, style }: Omit<DesignerBindingEditorProps, "whenTab">) {
  const { dataSources } = useDesignerConfig();
  const { selected, selectedBinding } = useDesignerSelectedSchema();
  const { handleChangeBinding } = useDesignerActions();
  if (!selected) return null;
  return (
    <div className={cx("jpd-part", className)} data-part="binding-editor" style={style}>
      <BindingEditor
        schema={selected}
        binding={selectedBinding}
        onChangeBinding={(b) => handleChangeBinding(selected.name, b)}
        dataSources={dataSources}
      />
    </div>
  );
}
