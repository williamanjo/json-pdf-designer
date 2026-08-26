import { useState } from "react";
import type { KpiSchema } from "../types";
import { MATERIAL_ICON_GRID, MATERIAL_ICON_LABELS, MATERIAL_ICON_NAMES, MATERIAL_ICON_PATHS } from "../materialIcons";
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
// pelo nome técnico OU pelo rótulo em PT-BR (ex: "dinheiro" acha
// attach_money mesmo sem saber o nome em inglês).
function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q
    ? MATERIAL_ICON_NAMES.filter((name) => name.replace(/_/g, " ").includes(q) || MATERIAL_ICON_LABELS[name].toLowerCase().includes(q))
    : MATERIAL_ICON_NAMES;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600">
          {value && value !== "none" ? <IconGlyph name={value} /> : <span className="text-[9px] text-slate-400">—</span>}
        </span>
        <Input
          placeholder="Buscar ícone — ex: dinheiro, alerta, check…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {value && value !== "none" && (
          <button type="button" className="flex-shrink-0 text-[10px] text-slate-400 hover:text-slate-600" onClick={() => onChange("none")}>
            remover
          </button>
        )}
      </div>
      <div className="grid max-h-32 grid-cols-6 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-1.5">
        {matches.length === 0 && <p className="col-span-6 py-2 text-center text-[10px] text-slate-400">Nenhum ícone encontrado.</p>}
        {matches.map((name) => (
          <button
            key={name}
            type="button"
            title={MATERIAL_ICON_LABELS[name]}
            onClick={() => onChange(name)}
            className={`flex items-center justify-center rounded-md border p-1.5 text-slate-600 hover:border-sky-400 hover:bg-sky-50 ${
              value === name ? "border-sky-500 bg-sky-50 text-sky-600" : "border-slate-200"
            }`}
          >
            <IconGlyph name={name} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function PropertyPanelKpi({ schema, onChangeSchema }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <Input label="Título" value={schema.title} onChange={(e) => onChangeSchema({ title: e.target.value })} />
      <Input
        mono
        label='Valor — ex: {caminho} ou {SUM(rows.total)}'
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
      <Input label="Legenda" value={schema.subtitle} onChange={(e) => onChangeSchema({ subtitle: e.target.value })} />
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-slate-600">Ícone (Material Symbols, Google)</span>
        <IconPicker value={schema.icon} onChange={(icon) => onChangeSchema({ icon })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ColorInput label="Fundo" value={schema.backgroundColor} onChange={(e) => onChangeSchema({ backgroundColor: e.target.value })} />
        <ColorInput label="Texto/ícone" value={schema.textColor} onChange={(e) => onChangeSchema({ textColor: e.target.value })} />
      </div>
      <p className="text-[10px] text-slate-400">
        Título/valor/legenda são texto comum — pode usar <code>{"{path}"}</code> ou{" "}
        <code>{"{FUNÇÃO(...)}"}</code> direto, resolvido contra o documento inteiro na hora de gerar.
      </p>
    </div>
  );
}
