import type { Dispatch, SetStateAction } from "react";
import type {
  Binding,
  DataSourceOption,
  Schema,
  SectionColumnDragPayload,
  SectionSchema,
  TableColumnStyle,
  TableSchema,
  Template,
} from "../types";
import { makeSectionColumnPair, makeSectionSchema, nextFreeY } from "../schemaFactory";
import { columnLabel } from "../bindings/bindings";
import { tokenFor } from "../fields/table/columnFormula";
import { fileToBackgroundImage } from "../pdf/backgroundImage";
import { toErrorMessage } from "../errorUtils";
import {
  addColumnToArrayBinding,
  addColumnToTable,
  applyColumnCellToTable,
  buildColumnCell,
  computeColumnFormulaCell,
  mirrorCellsToArrayBinding,
  reindexArrayBindingForNewHead,
  reindexTableForNewHead,
  removeColumnFromArrayBinding,
  removeColumnFromTable,
  renameColumnInArrayBinding,
  renameColumnInTable,
  reorderArrayBindingColumns,
  reorderTableColumn as reorderTableColumnPure,
  setColumnFormulaOnArrayBinding,
  setColumnStyle as setColumnStylePure,
  setColumnWidth as setColumnWidthPure,
} from "../fields/table/columns";
import { computeSpawnPosition, findTableDataSource } from "./helpers";
import { applyOrientation, orientationOf, PAGE_SIZE_PRESETS } from "../page/sizes";
import type { Dict } from "../i18n";

// Every template/binding mutation of the editor, outside the component.
//
// WHY THIS EXISTS — two reasons, and the second is the one that rules:
//
// 1. Testability. While these functions lived inside Designer.tsx, the most
//    delicate logic in the package (mirroring a table cell into the binding,
//    remapping bindings.schemaName on a rename, reindexing a column by NAME,
//    clearing an orphan sectionId) did not have a single test — it would
//    have required mounting the whole component. As a factory, the
//    dispatched updaters can be captured and applied to a fake template. See
//    test/designer/actions.test.ts.
//
// 2. Stable identity. The editor's parts (DesignerCanvas,
//    DesignerPropertyPanel, ...) receive these functions through context. If
//    the actions object were rebuilt on every render, the context value
//    would change on every keystroke and `React.memo` on any part would be
//    useless FOREVER — the consumer would have no way to opt out. That is
//    why NOTHING reactive comes in as a parameter: everything that changes
//    over time (template, bindings, selection, isolated mode, dictionary) is
//    read from `latest.current`, a ref assigned during render. With that,
//    the factory is called once, with an empty dependency list.
//
// WHAT DID NOT CHANGE: the authority on a WRITE is the `prev` inside the
// functional callback — that is what stops two clicks in quick succession
// from overwriting each other's whole array (that is how an "orgao" ended up
// at the index of "tarKandir", see the long comment further down).
// `latest.current` informs a secondary write DECISION (e.g. "the cell
// changed, does the binding have to follow?") and guard reads (e.g. "does
// this name already exist?"). Reading from the ref is equivalent to the old
// closure — React recreates the handler on every render, so the handler that
// was clicked already belonged to the newest render — that is: no
// regression, and no promise of having fixed the two-click race on a PAIRED
// write (template + bindings), which is unchanged.
//
// THREE KNOWN EXCEPTIONS, where written content still derives from a snapshot.
// They are listed here because the rule above, without them, would be a lie:
//
// 1. `setTableHead` — `oldHead` comes from the snapshot and serves as a
//    name→index map to reindex `binding.columns`. Two quick head edits write
//    the wrong column value under a label: it is the original class of the
//    bug, still alive. Fixing it requires matching by
//    `columnLabel(binding.columns[i])` instead of by `oldHead`, which changes
//    the semantics when head and columns are out of sync (which the
//    table/columns tests pin) — a behavior change, not a refactor commit.
// 2. `setColumnFormula` — only the BINDING side (`rawPath`/`headFallback`);
//    the cell, which is what decides the PDF, already comes from `prev`.
// 3. `addSchema` — `computeSpawnPosition` needs the template to find a free
//    position, and the function returns the positioned schema
//    SYNCHRONOUSLY because `createSection` needs its name to create the
//    binding in the same action. Two very quick "+ text" are born at the
//    same coordinate. A design trade-off, not an oversight.
// EVERYTHING that changes over time lives here — including the setters
// themselves. The `onChange*` come from the consumer (`report-builder` builds
// its own on top of undo/redo + autosave), so there is no guarantee they are
// stable across renders; passing them as parameters would rebuild the factory
// along with them. With them in the ref, the useMemo dependency list is
// genuinely EMPTY.
export type DesignerLatest = {
  template: Template;
  bindings: Binding[];
  selectedId: string | null;
  isolateBands: boolean;
  t: Dict;
  dataSources: DataSourceOption[] | undefined;
  // Grid step (the <Designer> config). It comes in HERE and not as a
  // parameter for the same reason as the rest: the factory runs once, with an
  // empty dependency list, and every value that changes between renders has
  // to be read at the moment of the event.
  gridSizeMm: number | undefined;
  onChangeTemplate: Dispatch<SetStateAction<Template>>;
  onChangeBindings: Dispatch<SetStateAction<Binding[]>>;
  setSelectedIds: (ids: string[]) => void;
  // State that does not belong to the template but whose WRITE is a mutator:
  // the isolated mode (the toggle clears the selection too) and the
  // background upload error. They are `useState` setters, already stable by
  // React's contract — they are in the ref for uniformity, not by necessity.
  setIsolateBands: Dispatch<SetStateAction<boolean>>;
  setBackgroundUploadError: (message: string | null) => void;
};

export type DesignerActions = ReturnType<typeof makeDesignerActions>;

export function makeDesignerActions(latest: { current: DesignerLatest }) {
  // Thin passthroughs, so the bodies below stay readable (and identical to
  // the ones that lived in the component).
  const onChangeTemplate: Dispatch<SetStateAction<Template>> = (u) => latest.current.onChangeTemplate(u);
  const onChangeBindings: Dispatch<SetStateAction<Binding[]>> = (u) => latest.current.onChangeBindings(u);
  const setSelectedIds = (ids: string[]) => latest.current.setSelectedIds(ids);

  // Read shortcuts. Always called at event time, never stored.
  const schemas = () => latest.current.template.schemas;
  const selectedSchema = () => schemas().find((s) => s.id === latest.current.selectedId) ?? null;
  const selectedTable = () => {
    const s = selectedSchema();
    return s && s.type === "table" ? s : null;
  };

  function mirrorTableCellsToBinding(table: TableSchema, nextContent: string[][]) {
    onChangeBindings((prev) => {
      const binding = prev.find((b) => b.schemaName === table.name);
      if (binding?.type !== "array") return prev;
      const columns = mirrorCellsToArrayBinding(binding, table.head, table.content[0], nextContent[0]);
      if (!columns) return prev;
      return prev.map((b) => (b === binding ? { ...b, columns } : b));
    });
  }

  function updateSchema(id: string, patch: Partial<Schema>) {
    const before = schemas().find((s) => s.id === id);
    onChangeTemplate((prev) => ({
      ...prev,
      schemas: prev.schemas.map((s) => (s.id === id ? ({ ...s, ...patch } as Schema) : s)),
    }));
    // A table cell edited right on the canvas: the cell IS the column's
    // formula (generate.ts resolves the row from `content`), so the binding
    // has to follow. Without this the "ƒx" panel kept showing the old
    // formula — two values for the same thing, and what appeared in the
    // panel was not what would come out in the PDF. The opposite path
    // (editing through the ƒx) already mirrored, in setColumnFormula.
    // `patch` is Partial<Schema> (a union), and `content` does not exist on
    // SectionSchema — the access needs the explicit narrowing.
    const nextContent = (patch as Partial<TableSchema>).content;
    if (before?.type === "table" && Array.isArray(nextContent)) {
      mirrorTableCellsToBinding(before, nextContent);
    }
  }

  // Renaming from the Fields tab (FieldList.tsx) — an empty name, or one
  // already used by another field, is ignored (the same uniqueness rule as
  // "paste", see freshName/usedNames in useClipboardAndDelete.ts). It has to
  // remap `bindings` as well — without that, an existing binding
  // ("Binding.schemaName") pointing at the old name stops matching the
  // renamed schema (generate.ts resolves a binding by name) and silently
  // disappears from the generated PDF.
  function renameSchema(id: string, rawName: string) {
    const newName = rawName.trim();
    if (!newName) return;
    const all = schemas();
    const current = all.find((s) => s.id === id);
    if (!current || current.name === newName) return;
    if (all.some((s) => s.id !== id && s.name === newName)) return;
    const oldName = current.name;
    onChangeTemplate((prev) => ({
      ...prev,
      schemas: prev.schemas.map((s) => (s.id === id ? { ...s, name: newName } : s)),
    }));
    onChangeBindings((prev) => prev.map((b) => (b.schemaName === oldName ? { ...b, schemaName: newName } : b)));
  }

  // The same patch on ALL ids at once — used only in bulk editing (see
  // BULK_EDIT_TYPES in the Designer): changing the style with several fields
  // of the SAME type selected applies to all of them, not just the last one.
  function updateSchemas(ids: string[], patch: Partial<Schema>) {
    const idSet = new Set(ids);
    onChangeTemplate((prev) => ({
      ...prev,
      schemas: prev.schemas.map((s) => (idSet.has(s.id) ? ({ ...s, ...patch } as Schema) : s)),
    }));
  }

  // Dragging a field that is part of a multiple selection moves the other
  // selected ones live — an ABSOLUTE position (original + delta since the
  // start of the drag, computed in PageCanvas from a snapshot), not an
  // incremental one, otherwise each onDrag frame would diverge from the last.
  function moveGroup(updates: Array<{ id: string; x: number; y: number }>) {
    if (updates.length === 0) return;
    const byId = new Map(updates.map((u) => [u.id, u]));
    onChangeTemplate((prev) => ({
      ...prev,
      schemas: prev.schemas.map((s) => {
        const u = byId.get(s.id);
        return u ? { ...s, x: u.x, y: u.y } : s;
      }),
    }));
  }

  // Reorders the drawing stack (z-order) — whatever comes later in the array
  // appears on top, on the canvas AND in the generated PDF.
  function bringToFront(id: string) {
    onChangeTemplate((prev) => {
      const idx = prev.schemas.findIndex((s) => s.id === id);
      if (idx === -1 || idx === prev.schemas.length - 1) return prev;
      const next = prev.schemas.slice();
      const [item] = next.splice(idx, 1);
      next.push(item);
      return { ...prev, schemas: next };
    });
  }

  function sendToBack(id: string) {
    onChangeTemplate((prev) => {
      const idx = prev.schemas.findIndex((s) => s.id === id);
      if (idx <= 0) return prev;
      const next = prev.schemas.slice();
      const [item] = next.splice(idx, 1);
      next.unshift(item);
      return { ...prev, schemas: next };
    });
  }

  // Birth position (the center of the body, or inside the red band when
  // isolated) — see computeSpawnPosition in helpers.ts. It returns the
  // schema ALREADY positioned because createSection needs its name to create
  // the binding in the same action.
  function addSchema(schema: Schema): Schema {
    const { template, isolateBands, gridSizeMm } = latest.current;
    const placed = computeSpawnPosition(template, schema, isolateBands, gridSizeMm);
    onChangeTemplate((prev) => ({ ...prev, schemas: [...prev.schemas, placed] }));
    setSelectedIds([placed.id]);
    return placed;
  }

  // "Empty" (sourcePath undefined) or already bound to a known data source
  // (dataSources) — in that case the "section" binding is born ready, with
  // no need to type the path in the BindingEditor afterwards.
  //
  // Closing the section picker is the CALLER's decision (its state is local
  // to the toolbar, not to the editor).
  function createSection(sourcePath?: string) {
    const { t, gridSizeMm } = latest.current;
    const section = addSchema(makeSectionSchema(nextFreeY(schemas(), gridSizeMm), t)) as SectionSchema;
    if (sourcePath) {
      onChangeBindings((prev) => [...prev, { schemaName: section.name, type: "section", path: sourcePath }]);
    }
    return section;
  }

  // Dropping a column "chip" (dragged from the PropertyPanel of a bound
  // section) on the canvas — it creates the header+value pair, already members.
  function dropSectionColumn(payload: SectionColumnDragPayload, xMm: number, yMm: number) {
    const { t } = latest.current;
    const { header, value, valueBinding } = makeSectionColumnPair(payload.sectionId, payload.column, xMm, yMm, t);
    onChangeTemplate((prev) => ({ ...prev, schemas: [...prev.schemas, header, value] }));
    onChangeBindings((prev) => [...prev, valueBinding]);
  }

  function removeSchema(id: string) {
    const schema = schemas().find((s) => s.id === id);
    onChangeTemplate((prev) => ({
      ...prev,
      // A child of a deleted section becomes a loose field again (it clears
      // sectionId) — without this it kept an orphan id pointing at a
      // section that no longer exists and disappeared from the generated
      // PDF (silently, with no error) while still visible on the canvas.
      schemas: prev.schemas
        .filter((s) => s.id !== id)
        .map((s) => (s.sectionId === id ? { ...s, sectionId: undefined } : s)),
    }));
    if (schema) {
      const removedName = schema.name;
      onChangeBindings((prev) => prev.filter((b) => b.schemaName !== removedName));
    }
    setSelectedIds([]);
  }

  function setBinding(schemaName: string, binding: Binding | null) {
    onChangeBindings((prev) => {
      const rest = prev.filter((b) => b.schemaName !== schemaName);
      return binding ? [...rest, binding] : rest;
    });
  }

  // A new "array" binding (the 1st time, with no binding yet) on a table —
  // it syncs head/content with the binding's columns before saving. Without
  // it, a freshly created table (placeholder head "Column 1"/"Column 2")
  // that picks a Data Source in the BindingEditor got a full
  // binding.columns (every column of the source) while head still had only
  // 2 — out of alignment from the click on "Bind", before any "+"/remove
  // happened (every subsequent "+" only made it worse, finding the column
  // "already present" in the inflated binding and never really adding it).
  // An ALREADY EXISTING binding merely being edited (path swapped and so
  // on) does not touch head — only creation from scratch does.
  function handleChangeBinding(schemaName: string, binding: Binding | null) {
    if (binding?.type === "array") {
      const schema = schemas().find((s) => s.name === schemaName);
      const hadBindingBefore = latest.current.bindings.some((b) => b.schemaName === schemaName);
      if (schema && schema.type === "table" && !hadBindingBefore) {
        const newHead = binding.columns.map((c) => columnLabel(c));
        // `tokenFor` and not `` `{${c}}` ``: the key may contain a dot, a
        // space, a parenthesis or a quote, and the bare form would give a wrong
        // path or a syntax error. Same rule as the new table and normalization.
        const newContent = [binding.columns.map((c) => (typeof c === "string" ? tokenFor(c) : c.formula))];
        updateSchema(schema.id, { head: newHead, content: newContent, footer: undefined, columnStyles: undefined });
        // And a raw-key column becomes `{label, formula}` in the binding itself,
        // so no raw column is born through this path either.
        binding = {
          ...binding,
          columns: binding.columns.map((c, i) =>
            typeof c === "string" ? { label: newHead[i] ?? c, formula: tokenFor(c) } : c
          ),
        };
      }
    }
    setBinding(schemaName, binding);
  }

  // ALL the column functions below (setTableHead/addTableColumn/
  // removeTableColumn/reorderTableColumn/setColumnStyle/setColumnFormula)
  // recompute the TABLE from inside the functional callback itself (never
  // from a schema closed over at render time) — 2 clicks in quick succession
  // (before the 1st re-render happened) read the SAME stale schema, and the
  // 2nd click overwrote the whole array on top of the 1st (it did not merely
  // fail to see the other's change — it ERASED it). That is exactly how an
  // "orgao" ended up at the index of "tarKandir": a "+" click used a copy of
  // head/columns from BEFORE the previous click applied, rewrote the whole
  // array from it, and knocked out the other addition.
  //
  // updateSelectedTable centralizes the repeated find/guard/map (it finds the
  // selected table inside the functional `prev`, checks that it really is
  // type "table", applies the `mutator` it received and puts it back in the
  // array) — each function only passes the column logic that differs,
  // delegated to the pure functions in src/fields/table/columns.ts.
  // `mutator` may return undefined for "no change" (e.g. a duplicate column
  // in addColumnToTable).
  function updateSelectedTable(mutator: (table: TableSchema) => TableSchema | null | undefined) {
    const { selectedId } = latest.current;
    if (!selectedId) return;
    onChangeTemplate((prev) => {
      const table = prev.schemas.find((s) => s.id === selectedId);
      if (!table || table.type !== "table") return prev;
      const newTable = mutator(table);
      if (!newTable) return prev;
      return { ...prev, schemas: prev.schemas.map((s) => (s.id === selectedId ? newTable : s)) };
    });
  }

  // Editing "Columns (header, comma)" by hand — it rewrites the whole `head`
  // at once (this is not an add/remove of 1 index, it is the entire list
  // replaced). For each name in the NEW head, it finds that SAME name in the
  // OLD head and carries over what was at that index (content/footer/
  // columnStyles/binding.columns) — by NAME, not by position. By position
  // alone (e.g. truncating/padding at the index) it already caused a real
  // bug: reducing from 9 columns to 1 ("fatura") simply took index 0 of
  // everything, which was "orgao" (the 1st column of the original binding) —
  // the right value for "fatura" (index 2) was never found, and the PDF came
  // out with the agency under the invoice label, silently. A new name with
  // no old match becomes a raw column (the usual "+" pattern).
  function setTableHead(newHead: string[]) {
    const table = selectedTable();
    if (!table) return;
    const schemaName = table.name;
    const oldHead = table.head;
    updateSelectedTable((t) => reindexTableForNewHead(t, newHead));
    onChangeBindings((prev) => {
      const existingBinding = prev.find((b) => b.schemaName === schemaName);
      if (existingBinding?.type !== "array") return prev;
      const columns = reindexArrayBindingForNewHead(existingBinding, oldHead, newHead);
      return prev.map((b) => (b === existingBinding ? { ...b, columns } : b));
    });
  }

  // If this field's sample value in the JSON is numeric (typeof number,
  // seen in findTableDataSource -> dataSources[].columnTypes), the column is
  // born formatted as currency (2 decimals, R$) instead of a raw token — no
  // need to open the "ƒx" afterwards just to mark "this one is money".
  // Text/any other type stays exactly as it always was (a raw token).
  // Rename ONE column — only the label, the reference stays.
  //
  // It is the operation the model did not have, and the cause of the reported
  // bug: without it the only way to change a title was `setTableHead` below,
  // which rewrites the whole list and re-derives each slot by matching the new
  // name against the old head. A renamed name is not in the old head, so the
  // column lost its `content` token (which is what the PDF uses), its style
  // and its width, and gained the new title as a JSON key.
  //
  // The two halves in two dispatches, like every other column function — and
  // the binding half only does something when the column is calculated
  // (`{label, formula}`), because a raw-key column has no label of its own.
  function renameTableColumn(index: number, label: string) {
    const table = selectedTable();
    if (!table) return;
    const schemaName = table.name;
    updateSelectedTable((t) => renameColumnInTable(t, index, label));
    onChangeBindings((prev) => {
      const existingBinding = prev.find((b) => b.schemaName === schemaName);
      if (existingBinding?.type !== "array") return prev;
      const columns = renameColumnInArrayBinding(existingBinding, index, label);
      if (!columns) return prev;
      return prev.map((b) => (b === existingBinding ? { ...b, columns } : b));
    });
  }

  function addTableColumn(column: string) {
    const table = selectedTable();
    if (!table) return;
    const schemaName = table.name;
    const columnType = findTableDataSource(table, schemas(), latest.current.bindings, latest.current.dataSources)?.columnTypes?.[column];
    const cell = buildColumnCell(column, columnType);
    updateSelectedTable((t) => addColumnToTable(t, column, cell));
    onChangeBindings((prev) => {
      const existingBinding = prev.find((b) => b.schemaName === schemaName);
      if (existingBinding?.type !== "array") return prev;
      const newColumn = columnType === "number" ? { label: column, formula: cell } : column;
      const columns = addColumnToArrayBinding(existingBinding, column, newColumn);
      if (!columns) return prev;
      return prev.map((b) => (b === existingBinding ? { ...b, columns } : b));
    });
  }

  // Removes the column from the header/preview rows by index — this includes
  // the placeholder "Column 1"/"Column 2" (a freshly created table, before
  // binding to anything) and the ones that came from the data source's "+".
  //
  // Removal from `head`/`content` is by index (the direct source of truth),
  // but from binding.columns it is by NAME — head and columns can fall out
  // of sync (e.g. the user edited the free "Columns, comma" text without
  // touching the binding), and removing by index there risked taking the
  // WRONG column out of the binding. By name, at worst it finds nothing.
  function removeTableColumn(index: number) {
    const table = selectedTable();
    if (!table) return;
    const schemaName = table.name;
    let removedName: string | undefined;
    updateSelectedTable((t) => {
      const result = removeColumnFromTable(t, index);
      removedName = result.removedName;
      return result.table;
    });
    onChangeBindings((prev) => {
      const existingBinding = prev.find((b) => b.schemaName === schemaName);
      if (existingBinding?.type !== "array") return prev;
      const columns = removeColumnFromArrayBinding(existingBinding, removedName);
      if (!columns) return prev;
      return prev.map((b) => (b === existingBinding ? { ...b, columns } : b));
    });
  }

  // Dragging to reorder (the "Current table columns" list in the panel) —
  // it shifts head/content/footer together (the index is the source of truth
  // for all three). binding.columns is only reordered with them if its length
  // matches head — otherwise it is left alone, so as not to risk shuffling
  // the wrong value under the wrong label (same caution as removal by name).
  function reorderTableColumn(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    const table = selectedTable();
    if (!table) return;
    const schemaName = table.name;
    const headLength = table.head.length;
    updateSelectedTable((t) => reorderTableColumnPure(t, fromIndex, toIndex));
    onChangeBindings((prev) => {
      const existingBinding = prev.find((b) => b.schemaName === schemaName);
      if (existingBinding?.type !== "array") return prev;
      const columns = reorderArrayBindingColumns(existingBinding, headLength, fromIndex, toIndex);
      if (!columns) return prev;
      return prev.map((b) => (b === existingBinding ? { ...b, columns } : b));
    });
  }

  // Style (color/background/size) per column, header and value — the brush
  // button in the panel's column list. It merges at the index, without
  // touching the rest (undefined on a patch field clears only that field).
  function setColumnStyle(index: number, patch: Partial<TableColumnStyle>) {
    updateSelectedTable((t) => setColumnStylePure(t, index, patch));
  }

  // Width of ONE column — the panel's numeric input (dragging the divider on
  // the canvas already writes `columnWidths` directly through the generic
  // onUpdateSchema, see TableField.tsx). Same pattern as setColumnStyle above.
  function setColumnWidth(index: number, widthMm: number | undefined) {
    updateSelectedTable((t) => setColumnWidthPure(t, index, widthMm));
  }

  // Formula for ONE column of the "array" binding — the "ƒx" button in the
  // panel's column list (it only appears for a genuinely bound table; with
  // no binding, the template is already editable in the table cell itself).
  // Empty reverts to a raw column (name only); with text, {label, formula}.
  function setColumnFormula(index: number, formula: string) {
    const table = selectedTable();
    if (!table) return;
    const schemaName = table.name;
    // content[i] is what rules when resolving the cell (see generate.ts) —
    // without mirroring here, the raw token already in content (e.g.
    // "{tarKandir}") keeps beating any new formula saved only in the binding,
    // and editing through the ƒx has no effect at all on the PDF.
    //
    // The CELL is recomputed from inside the updater, out of `prev` — it is
    // what decides what comes out in the PDF, so it cannot come from a snapshot.
    updateSelectedTable((t) => {
      const { cell } = computeColumnFormulaCell(formula, t.content[0]?.[index], t.head[index]);
      return applyColumnCellToTable(t, index, cell);
    });
    // The binding side's `rawPath`/`headFallback` still come from the snapshot:
    // they are two separate dispatches (template and bindings) and one
    // updater cannot read the other's `prev`. Same paired-write limitation
    // described in the opening comment — the side that decides the PDF is above.
    const { rawPath } = computeColumnFormulaCell(formula, table.content[0]?.[index], table.head[index]);
    const headFallback = table.head[index];
    onChangeBindings((prev) => {
      const existingBinding = prev.find((b) => b.schemaName === schemaName);
      if (existingBinding?.type !== "array") return prev;
      const columns = setColumnFormulaOnArrayBinding(existingBinding, index, formula, rawPath, headFallback);
      return prev.map((b) => (b === existingBinding ? { ...b, columns } : b));
    });
  }

  function updatePageBand(patch: Partial<Pick<Template, "headerHeight" | "footerHeight" | "marginLeft" | "marginRight">>) {
    onChangeTemplate((prev) => ({ ...prev, ...patch }));
  }

  // Swaps the page's size/orientation — it preserves the current orientation
  // when switching preset, and preserves the preset (width/height) on a rotate.
  function setPagePreset(presetName: string) {
    const preset = PAGE_SIZE_PRESETS.find((p) => p.name === presetName);
    if (!preset) return;
    // The orientation comes out of `prev`, not out of a snapshot: rotating the
    // page and switching the preset in quick succession read the SAME stale
    // orientation and the second action undid the first.
    onChangeTemplate((prev) => ({ ...prev, page: applyOrientation(preset.size, orientationOf(prev.page)) }));
  }

  function setPageOrientation(orientation: "portrait" | "landscape") {
    onChangeTemplate((prev) => ({ ...prev, page: applyOrientation(prev.page, orientation) }));
  }

  // Background PNG data URI (letterhead). A raw write into the template —
  // the "the user picked a file" path is `handleBackgroundUpload` below,
  // which reads/converts and reports an error.
  function setBackgroundImage(backgroundImage: string | undefined) {
    onChangeTemplate((prev) => ({ ...prev, backgroundImage }));
  }

  // Isolated mode (only header/footer/margin visible). It clears the
  // selection BEFORE flipping the switch: the two sets of fields are
  // disjoint (see the fieldListSchemas filter), so keeping the selection
  // would leave the property panel editing a field the canvas no longer shows.
  function toggleIsolateBands() {
    latest.current.setSelectedIds([]);
    latest.current.setIsolateBands((v) => !v);
  }

  // Background image upload. A mutator, and not a component helper, because
  // its only success path is `setBackgroundImage` — and its failure path
  // needs the dictionary, which already lives in the ref.
  //
  // `e.target.value = ""` before any await: without it, picking the SAME
  // file again (after an error, or after removing the background) does not
  // fire `change`, and the upload "does not respond".
  async function handleBackgroundUpload(e: { target: HTMLInputElement }) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const { t, setBackgroundUploadError } = latest.current;
    setBackgroundUploadError(null);
    try {
      setBackgroundImage(await fileToBackgroundImage(file));
    } catch (err) {
      // A corrupt PDF or an unavailable 2D canvas make fileToBackgroundImage
      // reject — without this the promise broke silently (console only) and
      // the upload "vanished" without the user understanding why.
      setBackgroundUploadError(toErrorMessage(err, t.pageSettings.backgroundUploadError));
    }
  }

  return {
    updateSchema,
    updateSchemas,
    renameSchema,
    moveGroup,
    bringToFront,
    sendToBack,
    addSchema,
    createSection,
    dropSectionColumn,
    removeSchema,
    setBinding,
    handleChangeBinding,
    renameTableColumn,
    setTableHead,
    addTableColumn,
    removeTableColumn,
    reorderTableColumn,
    setColumnStyle,
    setColumnWidth,
    setColumnFormula,
    updatePageBand,
    setPagePreset,
    setPageOrientation,
    setBackgroundImage,
    toggleIsolateBands,
    handleBackgroundUpload,
  };
}
