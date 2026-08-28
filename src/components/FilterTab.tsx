import type { Binding, ChartFilterCondition, ChartFilterGroup, ChartFilterOp } from "../types";
import { useT, type Dict } from "../i18n";
import { Button, Input, Select } from "./ui";
import { IconPlus, IconX } from "./ui/icons";

function filterOps(t: Dict): { value: ChartFilterOp; label: string }[] {
  return [
    { value: "eq", label: t.filter.opEq },
    { value: "neq", label: t.filter.opNeq },
    { value: "gt", label: t.filter.opGt },
    { value: "gte", label: t.filter.opGte },
    { value: "lt", label: t.filter.opLt },
    { value: "lte", label: t.filter.opLte },
    { value: "contains", label: t.filter.opContains },
  ];
}

// Aba "Filtro" — edita `binding.filters` direto (não é rascunho local: o
// vínculo já existe quando essa aba faz sentido de usar). Grupos combinam
// com OU, condições dentro de um grupo combinam com E (ver ChartFilterGroup
// em types/binding.ts, filtro avançado com grupos E/OU combináveis).
// Compartilhado entre chart/table/kpi — Designer.tsx renderiza direto na
// aba "Filtro" (nível superior, mesma fileira de abas de Campos/Dados/
// Estilo/Página) pra qualquer um dos três tipos com vínculo array por
// trás (chart, table -> binding "array", kpi).
export function FilterTab({
  binding,
  onChangeBinding,
  columns,
}: {
  binding: Extract<Binding, { type: "chart" | "array" | "kpi" }>;
  onChangeBinding: (b: Binding | null) => void;
  columns: string[];
}) {
  const t = useT();
  const filters = binding.filters ?? [];

  function applyFilters(next: ChartFilterGroup[]) {
    const clean = next.map((g) => g.filter((c) => c.column)).filter((g) => g.length > 0);
    onChangeBinding({ ...binding, filters: clean.length > 0 ? clean : undefined });
  }
  function addGroup() {
    applyFilters([...filters, [{ column: columns[0] ?? "", op: "eq", value: "" }]]);
  }
  function removeGroup(gi: number) {
    applyFilters(filters.filter((_, i) => i !== gi));
  }
  function addCondition(gi: number) {
    applyFilters(filters.map((g, i) => (i === gi ? [...g, { column: columns[0] ?? "", op: "eq" as ChartFilterOp, value: "" }] : g)));
  }
  function removeCondition(gi: number, ci: number) {
    applyFilters(filters.map((g, i) => (i === gi ? g.filter((_, j) => j !== ci) : g)));
  }
  function updateCondition(gi: number, ci: number, patch: Partial<ChartFilterCondition>) {
    applyFilters(filters.map((g, i) => (i === gi ? g.map((c, j) => (j === ci ? { ...c, ...patch } : c)) : g)));
  }

  return (
    <div className="flex flex-col gap-1.5">
      {filters.length === 0 && (
        <p className="text-[10px] text-slate-400 dark:text-gray-400">{t.filter.noFilter}</p>
      )}
      {filters.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-1 rounded-md border border-slate-200 p-1.5 dark:border-gray-700">
          {gi > 0 && <span className="text-center text-[9px] font-semibold text-slate-400">{t.filter.or}</span>}
          {group.map((cond, ci) => (
            <div key={ci} className="flex items-center gap-1">
              {ci > 0 && <span className="w-4 flex-shrink-0 text-center text-[9px] font-semibold text-slate-400">{t.filter.and}</span>}
              {columns.length > 0 ? (
                <Select value={cond.column} onChange={(e) => updateCondition(gi, ci, { column: e.target.value })}>
                  <option value="">{t.filter.columnPlaceholder}</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              ) : (
                <Input
                  placeholder={t.filter.columnPlaceholder}
                  value={cond.column}
                  onChange={(e) => updateCondition(gi, ci, { column: e.target.value })}
                />
              )}
              <Select value={cond.op} onChange={(e) => updateCondition(gi, ci, { op: e.target.value as ChartFilterOp })}>
                {filterOps(t).map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </Select>
              <Input placeholder={t.filter.valuePlaceholder} value={cond.value} onChange={(e) => updateCondition(gi, ci, { value: e.target.value })} />
              <Button variant="ghost" size="icon" onClick={() => removeCondition(gi, ci)}>
                <IconX />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="flex items-center gap-1 text-[10px] text-sky-600 hover:underline dark:text-blue-400"
              onClick={() => addCondition(gi)}
            >
              <IconPlus /> {t.filter.addCondition}
            </button>
            <Button variant="ghost" size="icon" onClick={() => removeGroup(gi)}>
              <IconX />
            </Button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="flex items-center gap-1 self-start text-[10px] text-sky-600 hover:underline dark:text-blue-400"
        onClick={addGroup}
      >
        <IconPlus /> {t.filter.addGroup}
      </button>
    </div>
  );
}
