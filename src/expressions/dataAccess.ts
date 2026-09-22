import type { ChartFilterOp } from "../types";

// Data access and value comparison — the pieces that BOTH the expression
// engine AND the bindings (chart/table/KPI filters) use.
//
// It lives here, and not in bindings.ts, only because of an import cycle:
// bindings.ts started importing the expression engine, so the engine cannot
// import bindings.ts back. The implementations are the same as before, moved
// with no behavior change.

// Looks `path` ("a.b.c") up in `obj` ignoring case on each piece — legacy
// system JSON usually arrives with keys in a different case from the one the
// template wrote.
// It walks ALREADY SPLIT segments. It exists separately because a segment may
// contain a dot (`{["a.b"]}`), and splitting the string in here would undo
// exactly the distinction the brackets made.
export function getCaseInsensitiveSegments(obj: unknown, segments: string[]): unknown {
  if (segments.length === 0) return obj;
  let cur = obj;
  for (const part of segments) {
    if (cur === null || cur === undefined || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    const rec = cur as Record<string, unknown>;
    const lo = part.toLowerCase();
    const key = Object.keys(rec).find((k) => k.toLowerCase() === lo);
    if (key === undefined) return undefined;
    cur = rec[key];
  }
  return cur;
}

// The STRING form, kept because ~6 callers outside the expression engine
// (KPI, chart, filters) store the path as dotted text. Here the dot separates,
// which is the long-standing contract for those fields.
export function getCaseInsensitive(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return getCaseInsensitiveSegments(obj, path.split("."));
}

// "missing field/value" -> "" — a rule repeated everywhere a raw JSON value
// is serialized into an output string (the path does not match, or it matches
// null/undefined).
export function stringifyOrEmpty(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}

// Normalizes an array item into a Record before indexing it by key — an item
// may not be an object (a loose string, a number, null) in a "dirty" array;
// in that case it is treated as having no keys, instead of blowing up.
export function asRecord(item: unknown): Record<string, unknown> {
  return item && typeof item === "object" ? (item as Record<string, unknown>) : {};
}

// "rows.total_amount" -> the "rows" array + the "total_amount" column (always
// the last piece after the dot). Used both to extract numbers
// (numbersFromArrayPath) and to merely count items (COUNT).
export function splitArrayPath(rawPath: string): { arrayPath: string; column: string } {
  const lastDot = rawPath.lastIndexOf(".");
  return {
    arrayPath: lastDot === -1 ? rawPath : rawPath.slice(0, lastDot),
    column: lastDot === -1 ? "" : rawPath.slice(lastDot + 1),
  };
}

// "rows.total_amount" -> the numbers of the "total_amount" column of the
// "rows" array. A non-numeric item is discarded (it does not become 0), so
// one dirty row does not drag the average down.
export function numbersFromArrayPath(data: unknown, rawPath: string): number[] {
  const { arrayPath, column } = splitArrayPath(rawPath);
  const arr = getCaseInsensitive(data, arrayPath);
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => Number(column ? asRecord(item)[column] : item)).filter((n) => !Number.isNaN(n));
}

// Compares the raw value (`raw`) against `value` (always a string) according
// to `op`. Number(...) on both sides when possible (comparing as numbers —
// "10" > "9" numerically, not lexicographically); it falls back to
// case-insensitive text when either side is not a number, and always for
// "contains". gt/gte/lt/lte require both sides to be numeric — they do not
// match otherwise (it never filters everything out by mistake, it simply
// does not match).
//
// Used by the chart/table/KPI filters and by the {IF(...)} comparison.
export function compareValues(raw: unknown, op: ChartFilterOp, value: string): boolean {
  if (op === "contains") return String(raw ?? "").toLowerCase().includes(value.toLowerCase());
  const numRaw = Number(raw);
  const numValue = Number(value);
  const bothNumeric =
    raw !== "" && raw !== null && raw !== undefined && value.trim() !== "" && !Number.isNaN(numRaw) && !Number.isNaN(numValue);
  if (op === "eq" || op === "neq") {
    const equal = bothNumeric ? numRaw === numValue : String(raw ?? "").toLowerCase() === value.toLowerCase();
    return op === "eq" ? equal : !equal;
  }
  if (!bothNumeric) return false;
  if (op === "gt") return numRaw > numValue;
  if (op === "gte") return numRaw >= numValue;
  if (op === "lt") return numRaw < numValue;
  return numRaw <= numValue; // "lte"
}
