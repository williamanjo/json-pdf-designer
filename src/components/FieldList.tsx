import { useEffect, useRef } from "react";
import type { Binding, Schema } from "../types";
import { fieldWarning } from "../fieldWarnings";
import { useT } from "../i18n";
import { Button } from "./ui";
import { IconAlertTriangle, IconBringToFront, IconLock, IconLockOpen, IconSendToBack, IconTrash } from "./ui/icons";

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
};

// Lista de todo campo já colocado na página — clique seleciona (abre o
// Field Edit logo abaixo); cadeado trava/destrava mover/redimensionar no
// canvas (continua editável pelo painel); lixeira remove direto, sem
// precisar selecionar primeiro.
export function FieldList({ schemas, selectedIds, onSelect, onRemove, onToggleLock, onBringToFront, onSendToBack, bindings }: Props) {
  const t = useT();
  const typeLabel: Record<Schema["type"], string> = {
    text: t.fieldTypeLabels.text,
    table: t.fieldTypeLabels.table,
    image: t.fieldTypeLabels.image,
    section: t.fieldTypeLabels.section,
    chart: t.fieldTypeLabels.chart,
    kpi: t.fieldTypeLabels.kpi,
  };
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
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

  if (schemas.length === 0) {
    return <p className="text-xs text-slate-400 dark:text-gray-400">{t.fieldList.empty}</p>;
  }

  return (
    <ul className="flex flex-col gap-1">
      {schemas.map((schema) => {
        const warning = fieldWarning(schema, bindings?.find((b) => b.schemaName === schema.name), t);
        return (
        <li
          key={schema.id}
          ref={(el) => {
            if (el) itemRefs.current.set(schema.id, el);
            else itemRefs.current.delete(schema.id);
          }}
          onClick={(e) => onSelect(schema.id, e.ctrlKey || e.metaKey)}
          className={`flex cursor-pointer items-center gap-1 rounded-lg border px-1.5 py-1 transition-colors ${
            selectedIds.includes(schema.id)
              ? "border-sky-500 bg-sky-50 dark:border-blue-400 dark:bg-blue-400/10"
              : "border-slate-200 hover:bg-slate-50 dark:border-gray-700 dark:hover:bg-gray-700"
          }`}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-left text-xs">
            {warning && (
              <IconAlertTriangle className="flex-shrink-0 text-amber-500 dark:text-amber-400" />
            )}
            <span className="min-w-0 truncate" title={warning ?? undefined}>
              <span className="font-medium text-slate-700 dark:text-gray-200">{schema.name}</span>
              <span className="ml-1.5 text-slate-400 dark:text-gray-400">{typeLabel[schema.type]}</span>
            </span>
          </span>
          {selectedIds.includes(schema.id) && onSendToBack && (
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onSendToBack(schema.id); }} aria-label={t.fieldList.sendToBackAria(schema.name)} title={t.fieldList.sendToBackTitle}>
              <IconSendToBack />
            </Button>
          )}
          {selectedIds.includes(schema.id) && onBringToFront && (
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
        </li>
        );
      })}
    </ul>
  );
}
