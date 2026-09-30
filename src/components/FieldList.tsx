import { useCallback, useEffect, useRef, useState } from "react";
import type { Binding, KpiElementKey, Schema } from "../types";
import { fieldWarning } from "../fieldWarnings";
import { kpiElementLocked, kpiElementLockedPatch, kpiElementPresent, kpiElementRestorePatch } from "../fields/kpi/card";
import { useT } from "../i18n";
import { useUiComponents } from "./ui/useUiComponents";
import { IconAlertTriangle, IconBringToFront, IconLock, IconLockOpen, IconPencil, IconPlus, IconSendToBack, IconTrash } from "./ui/icons";

type Props = {
  schemas: Schema[];
  selectedIds: string[];
  onSelect: (id: string, additive?: boolean) => void;
  onRemove: (id: string) => void;
  onToggleLock: (id: string) => void;
  // They only show up on the selected row — next to the padlock/trash, which
  // already act without having to open the field editor.
  onBringToFront?: (id: string) => void;
  onSendToBack?: (id: string) => void;
  // To spot a field with a configuration problem — not bound to the JSON, or
  // bound but incomplete in some way (see fieldWarning below).
  bindings?: Binding[];
  // Rename (the schema name) — any field type, see Designer.tsx
  // `renameSchema` (it remaps bindings.schemaName along with it).
  onRename?: (id: string, newName: string) => void;
  // KPI sub-elements (icon/title/value/subtitle) — they only appear when
  // the KPI is the ONLY selected field (see Designer.tsx).
  selectedKpiElement?: KpiElementKey | null;
  onSelectKpiElement?: (el: KpiElementKey) => void;
  onChangeSchema?: (id: string, patch: Partial<Schema>) => void;
};

const KPI_ELEMENTS: KpiElementKey[] = ["icon", "title", "value", "subtitle"];

// The list of every field already placed on the page — a click selects it
// (opening Field Edit just below); the padlock locks/unlocks move/resize on
// the canvas (it stays editable from the panel); the trash removes it
// directly, without having to select it first; the pencil (or a double click
// on the name) renames it. A KPI selected on its own gains 4 sub-rows
// (icon/title/value/subtitle) — a click focuses one (contextual Style, see
// PropertyPanelKpi.tsx), the padlock unlocks dragging on the canvas (it is
// born locked, see KpiField.tsx), and a button adds/removes the sub-element
// (title/value/subtitle become optional, icon already had "none").
export function FieldList({
  schemas,
  selectedIds,
  onSelect,
  onRemove,
  onToggleLock,
  onBringToFront,
  onSendToBack,
  bindings,
  onRename,
  selectedKpiElement,
  onSelectKpiElement,
  onChangeSchema,
}: Props) {
  const t = useT();
  const { Button } = useUiComponents();
  const typeLabel: Record<Schema["type"], string> = {
    text: t.fieldTypeLabels.text,
    table: t.fieldTypeLabels.table,
    image: t.fieldTypeLabels.image,
    section: t.fieldTypeLabels.section,
    chart: t.fieldTypeLabels.chart,
    kpi: t.fieldTypeLabels.kpi,
  };
  const kpiElementLabel: Record<KpiElementKey, string> = {
    icon: t.kpi.elementIcon,
    title: t.kpi.title,
    value: t.kpi.elementValue,
    subtitle: t.kpi.subtitle,
  };
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  // Same reason (and same `onFocus` gotcha) as the column rename in
  // PropertyPanel/PropertyPanelTable.tsx — see the long comment there.
  const selecionarAoAbrir = useCallback((el: HTMLInputElement | null) => el?.select(), []);
  // The same field can stay "the last selected one" across several renders
  // in a row (e.g. while editing its value, which changes `schemas` on
  // every keystroke) — depending on this ID (a primitive, it only changes
  // when the SELECTION really changes) instead of on the `selectedIds`
  // array (a new reference on every render) avoids scrolling the list back
  // all the time, fighting whoever scrolled by hand to look at something else.
  const lastSelectedId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;
  useEffect(() => {
    if (lastSelectedId) itemRefs.current.get(lastSelectedId)?.scrollIntoView({ block: "nearest" });
  }, [lastSelectedId]);

  function startRename(schema: Schema, e: React.MouseEvent) {
    e.stopPropagation();
    if (!onRename) return;
    setRenamingId(schema.id);
    setDraftName(schema.name);
  }
  function commitRename(id: string) {
    onRename?.(id, draftName);
    setRenamingId(null);
  }

  if (schemas.length === 0) {
    return <p className="jpd-hint jpd-hint--md">{t.fieldList.empty}</p>;
  }

  return (
    <ul className="jpd-list jpd-stack jpd-stack--tight">
      {schemas.map((schema) => {
        const warning = fieldWarning(schema, bindings?.find((b) => b.schemaName === schema.name), t);
        const isSelected = selectedIds.includes(schema.id);
        const showKpiElements = schema.type === "kpi" && isSelected && selectedIds.length === 1;
        return (
        <li key={schema.id}>
        <div
          ref={(el) => {
            if (el) itemRefs.current.set(schema.id, el);
            else itemRefs.current.delete(schema.id);
          }}
          onClick={(e) => onSelect(schema.id, e.ctrlKey || e.metaKey)}
          // The whole row stays clickable — that is a MOUSE convenience, and
          // removing it would shrink the target down to the size of the name.
          // But the row is not the ACCESSIBLE control for selection: that is
          // the <button> holding the name just below, which Tab reaches and a
          // screen reader announces. Hence `role="presentation"` here.
          role="presentation"
          className="jpd-fieldrow"
          data-selected={isSelected || undefined}
        >
          <span className="jpd-fieldrow__main">
            {warning && (
              <IconAlertTriangle className="jpd-icon jpd-warnicon" />
            )}
            <span className="jpd-fieldrow__name" title={warning ?? undefined}>
              {renamingId === schema.id ? (
                <input
                  autoFocus
                  className="jpd-fieldrow__rename"
                  value={draftName}
                  ref={selecionarAoAbrir}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => commitRename(schema.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename(schema.id);
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setRenamingId(null);
                    }
                  }}
                />
              ) : (
                // A <button>, not a <span>: selecting a field used to be a
                // MOUSE-ONLY operation — the row had `onClick` and nothing in
                // the list was focusable beyond the action buttons, so anyone
                // navigating by keyboard could not select a field at all.
                // `stopPropagation` because the row's `onClick` would make
                // the same selection a second time.
                <button
                  type="button"
                  className="jpd-rowname"
                  aria-pressed={isSelected}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(schema.id, e.ctrlKey || e.metaKey);
                  }}
                  onDoubleClick={onRename ? (e) => startRename(schema, e) : undefined}
                >
                  {schema.name}
                </button>
              )}
              <span className="jpd-muted">{typeLabel[schema.type]}</span>
            </span>
          </span>
          {isSelected && onSendToBack && (
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onSendToBack(schema.id); }} aria-label={t.fieldList.sendToBackAria(schema.name)} title={t.fieldList.sendToBackTitle}>
              <IconSendToBack />
            </Button>
          )}
          {isSelected && onBringToFront && (
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onBringToFront(schema.id); }} aria-label={t.fieldList.bringToFrontAria(schema.name)} title={t.fieldList.bringToFrontTitle}>
              <IconBringToFront />
            </Button>
          )}
          {/* A focusable path to rename. The `onDoubleClick` on the name stays,
              but it is a mouse gesture over a `<span>` with no tabIndex —
              without this button, keyboard users cannot rename a field. */}
          {onRename && renamingId !== schema.id && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => startRename(schema, e)}
              aria-label={t.fieldList.renameAria(schema.name)}
              title={t.fieldList.renameTitle}
            >
              <IconPencil />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onToggleLock(schema.id); }}
            aria-label={schema.locked ? t.fieldList.unlockAria(schema.name) : t.fieldList.lockAria(schema.name)}
            title={schema.locked ? t.fieldList.unlockTitle : t.fieldList.lockTitle}
          >
            {schema.locked ? <IconLock /> : <IconLockOpen />}
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onRemove(schema.id); }} aria-label={t.fieldList.removeAria(schema.name)}>
            <IconTrash />
          </Button>
        </div>

        {showKpiElements && schema.type === "kpi" && (
          <ul className="jpd-sublist">
            {KPI_ELEMENTS.map((el) => {
              const present = kpiElementPresent(schema, el);
              const locked = kpiElementLocked(schema, el);
              const focused = selectedKpiElement === el;
              return (
                <li
                  key={el}
                  onClick={(e) => { e.stopPropagation(); onSelectKpiElement?.(el); }}
                  // Same design as the row above: the <li> stays clickable as a mouse
                  // convenience, and the ACCESSIBLE target is the label
                  // button — focusing a KPI sub-element was mouse-only too.
                  role="presentation"
                  className="jpd-fieldrow jpd-fieldrow--sub"
                  data-selected={focused || undefined}
                  data-absent={!present || undefined}
                >
                  <button
                    type="button"
                    className="jpd-rowname jpd-fieldrow__name--sub"
                    aria-pressed={focused}
                    onClick={(e) => { e.stopPropagation(); onSelectKpiElement?.(el); }}
                  >
                    {kpiElementLabel[el]}
                  </button>
                  {present && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); onChangeSchema?.(schema.id, kpiElementLockedPatch(el, !locked)); }}
                      aria-label={locked ? t.fieldList.unlockAria(kpiElementLabel[el]) : t.fieldList.lockAria(kpiElementLabel[el])}
                      title={locked ? t.fieldList.unlockTitle : t.fieldList.lockTitle}
                    >
                      {locked ? <IconLock /> : <IconLockOpen />}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChangeSchema?.(
                        schema.id,
                        present
                          ? el === "icon"
                            ? { icon: "none" }
                            : el === "title"
                              ? { title: undefined }
                              : el === "value"
                                ? { value: undefined }
                                : { subtitle: undefined }
                          : kpiElementRestorePatch(el, t)
                      );
                    }}
                    aria-label={present ? t.kpi.removeElement : t.kpi.addElement}
                    title={present ? t.kpi.removeElement : t.kpi.addElement}
                  >
                    {present ? <IconTrash /> : <IconPlus />}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        </li>
        );
      })}
    </ul>
  );
}
