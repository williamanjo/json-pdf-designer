import type { Binding, ChartFilterCondition, ChartFilterGroup, ChartFilterOp } from "../types";
import { useT, type Dict } from "../i18n";
import { useUiComponents } from "./ui/useUiComponents";
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
  const { Button, Input, Select } = useUiComponents();
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
    <div className="jpd-stack jpd-stack--snug">
      {filters.length === 0 && <p className="jpd-hint">{t.filter.noFilter}</p>}
      {filters.map((group, gi) => (
        <div key={gi} className="jpd-filter-group">
          {gi > 0 && (
            <span className="jpd-filter-group__joiner" data-joiner="or">
              {t.filter.or}
            </span>
          )}
          {group.map((cond, ci) => (
            <div key={ci} className="jpd-row jpd-row--tight">
              {ci > 0 && (
                <span className="jpd-filter-group__joiner" data-joiner="and">
                  {t.filter.and}
                </span>
              )}
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
          <div className="jpd-row jpd-row--between">
            <button type="button" className="jpd-addlink" onClick={() => addCondition(gi)}>
              <IconPlus className="jpd-icon" /> {t.filter.addCondition}
            </button>
            <Button variant="ghost" size="icon" onClick={() => removeGroup(gi)}>
              <IconX />
            </Button>
          </div>
        </div>
      ))}
      <button type="button" className="jpd-addlink jpd-addlink--start" onClick={addGroup}>
        <IconPlus className="jpd-icon" /> {t.filter.addGroup}
      </button>
    </div>
  );
}
