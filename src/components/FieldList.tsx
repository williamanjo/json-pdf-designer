import { useEffect, useRef, useState } from "react";
import type { Binding, KpiElementKey, Schema } from "../types";
import { fieldWarning } from "../fieldWarnings";
import { kpiElementLocked, kpiElementLockedPatch, kpiElementPresent, kpiElementRestorePatch } from "../fields/kpi/card";
import { useT } from "../i18n";
import { useUiComponents } from "./ui/useUiComponents";
import { IconAlertTriangle, IconBringToFront, IconLock, IconLockOpen, IconPlus, IconSendToBack, IconTrash } from "./ui/icons";

type Props = {
  schemas: Schema[];
  selectedIds: string[];
  onSelect: (id: string, additive?: boolean) => void;
  onRemove: (id: string) => void;
  onToggleLock: (id: string) => void;
  // Só aparecem na linha selecionada — junto do cadeado/lixeira, que já
  // agem sem precisar abrir o editor do campo.
  onBringToFront?: (id: string) => void;
  onSendToBack?: (id: string) => void;
  // Pra detectar campo com problema de configuração — sem vínculo com o
  // JSON, ou vinculado mas com algo incompleto (ver fieldWarning abaixo).
  bindings?: Binding[];
  // Renomear (nome do schema) — qualquer tipo de campo, ver Designer.tsx
  // `renameSchema` (remapeia bindings.schemaName junto).
  onRename?: (id: string, newName: string) => void;
  // Sub-elementos de KPI (ícone/título/valor/legenda) — só aparecem
  // quando o KPI é o ÚNICO campo selecionado (ver Designer.tsx).
  selectedKpiElement?: KpiElementKey | null;
  onSelectKpiElement?: (el: KpiElementKey) => void;
  onChangeSchema?: (id: string, patch: Partial<Schema>) => void;
};

const KPI_ELEMENTS: KpiElementKey[] = ["icon", "title", "value", "subtitle"];

// Lista de todo campo já colocado na página — clique seleciona (abre o
// Field Edit logo abaixo); cadeado trava/destrava mover/redimensionar no
// canvas (continua editável pelo painel); lixeira remove direto, sem
// precisar selecionar primeiro; duplo clique no nome renomeia. Um KPI
// selecionado sozinho ganha 4 sub-linhas (ícone/título/valor/legenda) —
// clique foca (Estilo contextual, ver PropertyPanelKpi.tsx), cadeado
// destrava arrastar no canvas (nasce travado, ver KpiField.tsx), e um
// botão adiciona/remove o sub-elemento (title/value/subtitle viram
// opcionais, icon já tinha "nenhum").
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
  // Mesmo campo pode continuar "o último selecionado" por vários renders
  // seguidos (ex: editando o valor dele, que muda `schemas` a cada tecla)
  // — depender desse ID (primitivo, só muda quando a SELEÇÃO muda de
  // verdade) em vez do array `selectedIds` (referência nova a cada
  // render) evita rolar a lista de volta toda hora, brigando com quem
  // rolou manualmente pra ver outra coisa enquanto edita.
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
                <span
                  className="jpd-rowname"
                  onDoubleClick={onRename ? (e) => startRename(schema, e) : undefined}
                >
                  {schema.name}
                </span>
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
                  className="jpd-fieldrow jpd-fieldrow--sub"
                  data-selected={focused || undefined}
                  data-absent={!present || undefined}
                >
                  <span className="jpd-fieldrow__name jpd-fieldrow__name--sub">{kpiElementLabel[el]}</span>
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
