import { useState } from "react";
import { useT } from "../../i18n";
import type { FieldSources } from "../../designer/helpers";
import { FormulaModal, type FormulaTarget } from "./FormulaModal";

type Props = {
  target: FormulaTarget;
  sources: FieldSources | undefined;
  // Só a fórmula de coluna de tabela tem o seletor "Tipo de dado".
  showDataType?: boolean;
  // Destaca o botão quando o campo já tem conteúdo — mesmo sinal visual que
  // o ƒx da lista de colunas já dava.
  active?: boolean;
};

// O botão "ƒx" e o modal que ele abre. Um componente só porque o estado de
// aberto/fechado é do botão, e cada lugar que oferece expressão (coluna,
// célula de rodapé, campo de KPI, conteúdo de texto) só precisa dizer QUAL é
// o alvo — não repetir o `useState`.
export function FormulaButton({ target, sources, showDataType, active }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.formulaModal.openAria(target.label)}
        title={t.formulaModal.openTitle}
        // `jpd-iconbtn--accent` + `data-on` é o MESMO par de estados do ƒx da
        // lista de colunas (PropertyPanelTable) — as duas strings de cor eram
        // byte-idênticas. O que é só deste botão é o glifo em serifada
        // itálica, que mora em `jpd-fx`.
        className="jpd-iconbtn jpd-iconbtn--accent jpd-fx"
        data-on={open || active || undefined}
      >
        ƒx
      </button>
      {open && (
        <FormulaModal
          target={target}
          sources={sources ?? { arrays: [] }}
          showDataType={showDataType}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
