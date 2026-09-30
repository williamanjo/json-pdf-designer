import type { JsonSource } from "../components/DataSourcePanel";

// It merges N JSON sources into a single object, at the top level — on a
// repeated key, the source further down the list wins. An error in one source
// (invalid JSON, or not an object) does not stop the others from entering the
// merge; it is simply left out and shown marked.
//
// It returns the error's REASON (a code), not the finished phrase: the phrase
// is chosen at render time, in DataSourcePanel. Holding already-translated
// text in state was the bug — switching the language does not recompute the
// state, and the error message stayed frozen in the language it was born in.
export type SourceProblem = "invalidJson" | "notObject";

export function mergeSources(sources: JsonSource[]): { data: Record<string, unknown>; errorsById: Record<string, SourceProblem> } {
  const data: Record<string, unknown> = {};
  const errorsById: Record<string, SourceProblem> = {};
  for (const source of sources) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source.raw);
    } catch {
      errorsById[source.id] = "invalidJson";
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errorsById[source.id] = "notObject";
      continue;
    }
    Object.assign(data, parsed);
  }
  return { data, errorsById };
}
