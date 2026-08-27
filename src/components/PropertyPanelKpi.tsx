import { useState } from "react";
import type { KpiSchema } from "../types";
import { MATERIAL_ICON_GRID, MATERIAL_ICON_NAMES, MATERIAL_ICON_PATHS, materialIconLabels } from "../materialIcons";
import { useLocale, useT, withInlineCode, type Locale } from "../i18n";
import { ColorInput, Input } from "./ui";

type DroppedField = { path: string; kind: string };
function readDroppedField(e: React.DragEvent): DroppedField | null {
  const raw = e.dataTransfer.getData("application/json");
  if (!raw) return null;
  try { return JSON.parse(raw) as DroppedField; } catch { return null; }
}
const allowDrop = (e: React.DragEvent) => {
  if (e.dataTransfer.types.includes("application/json")) e.preventDefault();
};

type Props = {
  schema: KpiSchema;
  activeTab: "dados" | "estilo";
  onChangeSchema: (patch: Partial<KpiSchema>) => void;
};

function IconGlyph({ name, size = 18 }: { name: string; size?: number }) {
  const path = MATERIAL_ICON_PATHS[name as keyof typeof MATERIAL_ICON_PATHS];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox={`0 -${MATERIAL_ICON_GRID} ${MATERIAL_ICON_GRID} ${MATERIAL_ICON_GRID}`} fill="currentColor">
      <path d={path} />
    </svg>
  );
}

// Busca+seleção de ícone (Material Symbols, ver materialIcons.ts) — filtra
// pelo nome técnico OU pelo rótulo no idioma ativo (ex: "money" acha
// attach_money mesmo sem saber o nome técnico).
function IconPicker({ value, onChange, locale, removeLabel, searchPlaceholder, noneFoundLabel }: {
  value: string;
  onChange: (icon: string) => void;
  locale: Locale;
  removeLabel: string;
  searchPlaceholder: string;
  noneFoundLabel: string;
}) {
  const [query, setQuery] = useState("");
  const labels = materialIconLabels(locale);
  const q = query.trim().toLowerCase();
  const matches = q
    ? MATERIAL_ICON_NAMES.filter((name) => name.replace(/_/g, " ").includes(q) || labels[name].toLowerCase().includes(q))
    : MATERIAL_ICON_NAMES;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 dark:border-gray-600 dark:text-gray-300">
          {value && value !== "none" ? <IconGlyph name={value} /> : <span className="text-[9px] text-slate-400 dark:text-gray-500">—</span>}
        </span>
        <Input
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {value && value !== "none" && (
          <button type="button" className="flex-shrink-0 text-[10px] text-slate-400 hover:text-slate-600 dark:text-gray-400 dark:hover:text-gray-200" onClick={() => onChange("none")}>
            {removeLabel}
          </button>
        )}
      </div>
      <div className="grid max-h-32 grid-cols-6 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-1.5 dark:border-gray-600">
        {matches.length === 0 && <p className="col-span-6 py-2 text-center text-[10px] text-slate-400 dark:text-gray-400">{noneFoundLabel}</p>}
        {matches.map((name) => (
          <button
            key={name}
            type="button"
            title={labels[name]}
            onClick={() => onChange(name)}
            className={`flex items-center justify-center rounded-md border p-1.5 text-slate-600 hover:border-sky-400 hover:bg-sky-50 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:bg-blue-400/10 ${
              value === name
                ? "border-sky-500 bg-sky-50 text-sky-600 dark:border-blue-400 dark:bg-blue-400/10 dark:text-blue-400"
                : "border-slate-200 dark:border-gray-600"
            }`}
          >
            <IconGlyph name={name} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function PropertyPanelKpi({ schema, onChangeSchema, activeTab }: Props) {
  const t = useT();
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-2">
      {activeTab === "dados" && (
        <>
          <Input label={t.kpi.title} value={schema.title} onChange={(e) => onChangeSchema({ title: e.target.value })} />
          <Input
            mono
            label={t.kpi.valueLabel}
            value={schema.value}
            onChange={(e) => onChangeSchema({ value: e.target.value })}
            onDragOver={allowDrop}
            onDrop={(e) => {
              const f = readDroppedField(e);
              if (!f) return;
              e.preventDefault();
              const token = `{${f.path}}`;
              onChangeSchema({ value: schema.value ? `${schema.value} ${token}` : token });
            }}
          />
          <Input label={t.kpi.subtitle} value={schema.subtitle} onChange={(e) => onChangeSchema({ subtitle: e.target.value })} />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-600 dark:text-gray-400">{t.kpi.iconLabel}</span>
            <IconPicker
              value={schema.icon}
              onChange={(icon) => onChangeSchema({ icon })}
              locale={locale}
              removeLabel={t.kpi.removeIcon}
              searchPlaceholder={t.kpi.iconSearchPlaceholder}
              noneFoundLabel={t.kpi.noIconFound}
            />
          </div>
          <p className="text-[10px] text-slate-400 dark:text-gray-400">{withInlineCode(t.kpi.hint)}</p>
        </>
      )}

      {activeTab === "estilo" && (
        <div className="grid grid-cols-2 gap-2">
          <ColorInput label={t.kpi.background} value={schema.backgroundColor} onChange={(e) => onChangeSchema({ backgroundColor: e.target.value })} />
          <ColorInput label={t.kpi.textIcon} value={schema.textColor} onChange={(e) => onChangeSchema({ textColor: e.target.value })} />
        </div>
      )}
    </div>
  );
}
