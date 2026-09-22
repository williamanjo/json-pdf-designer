import { useState } from "react";
import { useT } from "../../i18n";
import type { FieldSources } from "../../designer/helpers";
import { FormulaModal, type FormulaTarget } from "./FormulaModal";

type Props = {
  target: FormulaTarget;
  sources: FieldSources | undefined;
  // Only a table column formula has the "Data type" picker.
  showDataType?: boolean;
  // Highlights the button when the field already has content — the same
  // visual cue the ƒx in the column list already gave.
  active?: boolean;
};

// The "ƒx" button and the modal it opens. A component of its own because the
// open/closed state belongs to the button, and each place that offers an
// expression (column, footer cell, KPI field, text content) only needs to say
// WHICH the target is — not repeat the `useState`.
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
        // `jpd-iconbtn--accent` + `data-on` is the SAME pair of states as the ƒx
        // in the column list (PropertyPanelTable) — the two color strings were
        // byte-identical. What belongs to this button alone is the italic
        // serif glyph, which lives in `jpd-fx`.
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
