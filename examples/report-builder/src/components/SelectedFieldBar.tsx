import {
  useDesignerActions,
  useDesignerBulkEdit,
  useDesignerSelectedSchema,
  useDesignerSelection,
  useLocale,
  useT,
} from "json-pdf-designer";
import { t } from "../i18n";

// The selected field's context bar, drawn by THE APP'S SHELL (not by the
// editor) and with this project's own Tailwind.
//
// Before 3.0.0 this was IMPOSSIBLE: the `<Designer>` owned the selection and
// there was no way to read it from outside — the comment in App.tsx said
// exactly that ("the <Designer> owns the selection, there is no prop to drive
// it from outside"). Now the state lives in the `<DesignerProvider>`, so any
// part of the app inside it can read it through a hook.
//
// It is the shortest possible demonstration of the public hooks, and the only
// thing migrating this example to the parts actually BOUGHT — the two-column
// layout is still identical to the preset's.
export default function SelectedFieldBar() {
  // This bar receives no prop at all, and the language does not need to
  // become one either: it lives INSIDE the `<I18nProvider>` the DesignerPanel
  // assembles, so `useLocale()` returns exactly the same `locale` as the App's
  // state. One source, two layers — `useT()` for what is the package's, `t()`
  const locale = useLocale();
  const tx = t(locale);
  const tPkg = useT();
  const { selected } = useDesignerSelectedSchema();
  const { selectedIds } = useDesignerSelection();
  const { bulkEditActive } = useDesignerBulkEdit();
  // `useDesignerActions()` never changes identity — it is the context that
  // was designed to be stable, so a memoized part can consume a mutator
  // without re-rendering when the template changes.
  const { removeSchema, bringToFront, sendToBack } = useDesignerActions();

  if (!selected) {
    return (
      <div className="flex h-8 flex-shrink-0 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-400">
        {tx.selectedNone}
      </div>
    );
  }

  return (
    <div className="flex h-8 flex-shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs">
      {/* The field's NAME: the user's data, it comes out as it is (hence
          the mono font). The field's TYPE: the PACKAGE's concept, and the
          package already translates it — `useT().fieldTypeLabels` instead of a
          copy of ours to fall out of sync. Before this it came out raw
          ("text"/"table"), in English even with the UI in Portuguese. */}
      <span className="font-mono font-medium text-slate-700">{selected.name}</span>
      <span className="text-slate-400">{tPkg.fieldTypeLabels[selected.type]}</span>
      <span className="text-slate-300">·</span>
      <span className="text-slate-500">
        {Math.round(selected.x)},{Math.round(selected.y)} mm · {Math.round(selected.width)}×{Math.round(selected.height)} mm
      </span>
      {selectedIds.length > 1 && (
        <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">
          {bulkEditActive ? tx.selectedBulkEditing(selectedIds.length) : tx.selectedCount(selectedIds.length)}
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => bringToFront(selected.id)}
          className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          {tx.selectedBringToFront}
        </button>
        <button
          type="button"
          onClick={() => sendToBack(selected.id)}
          className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          {tx.selectedSendToBack}
        </button>
        <button
          type="button"
          onClick={() => removeSchema(selected.id)}
          className="rounded px-1.5 py-0.5 text-red-600 hover:bg-red-50"
        >
          {tx.selectedRemove}
        </button>
      </div>
    </div>
  );
}
