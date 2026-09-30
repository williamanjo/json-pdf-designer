// A table column: a raw JSON key, or a calculated column (a fixed label + a
// formula evaluated per row, with a path relative to the array's item).
export type TableColumn = string | { label: string; formula: string };

export type ChartFilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";

// One of the chart's filter conditions — it compares `column` (a key of the
// bound array's item) against `value` using `op`. A numeric comparison when
// both sides can be converted to a number (see bindings.ts), otherwise text
// (case-insensitive) — "contains" is always text.
export type ChartFilterCondition = { column: string; op: ChartFilterOp; value: string };

// A group is a list of conditions combined with AND (all of them must match).
export type ChartFilterGroup = ChartFilterCondition[];

export type KpiAggregation = "sum" | "count" | "avg" | "min" | "max";

export type Binding =
  | { schemaName: string; type: "scalar"; path: string }
  // A TableSchema's binding — path points at the array, columns maps each of
  // the table's columns (a raw key or a {label,formula} calculated per row).
  // `filters` (optional) — the same format as the chart (OR groups of AND
  // conditions) — an item only becomes a row if it matches at least one whole
  // group; with no filter at all, every row comes in (the usual behavior).
  | { schemaName: string; type: "array"; path: string; columns: TableColumn[]; filters?: ChartFilterGroup[] }
  | { schemaName: string; type: "keyvalue"; paths: string[] }
  | { schemaName: string; type: "template"; template: string }
  // A SectionSchema's binding — path points at the array to repeat. The
  // fields INSIDE the section have their own bindings in this same list (by
  // name), resolved against each ITEM of the array, not against the whole
  // document — see generate.ts.
  | { schemaName: string; type: "section"; path: string }
  // A ChartSchema's binding — path points at the array to aggregate;
  // labelColumn is the key of each slice/bar's label, valueColumn the numeric
  // key summed per label (e.g. "amount" or "quantity"). `filters` (optional) —
  // a list of GROUPS combined with OR; inside each group, the conditions
  // combine with AND. An item of the array only enters the aggregation if it
  // matches at least one whole group (or with no filter at all = everyone
  // comes in, the usual behavior).
  | {
      schemaName: string;
      type: "chart";
      path: string;
      labelColumn: string;
      valueColumn: string;
      filters?: ChartFilterGroup[];
    }
  // A KpiSchema's binding — path points at the array to aggregate;
  // valueColumn is the numeric column summed/averaged/etc (ignored when
  // aggregation === "count", which only counts the filtered rows). Without
  // this binding, the KPI resolves `value` as the usual free template (see
  // bindings.ts) — when present, it rules: `value` becomes the computed
  // result, and the field's template is ignored.
  | {
      schemaName: string;
      type: "kpi";
      path: string;
      valueColumn?: string;
      aggregation: KpiAggregation;
      filters?: ChartFilterGroup[];
    };
