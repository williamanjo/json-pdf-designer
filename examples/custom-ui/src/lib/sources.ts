import type { JsonSource } from "../components/DataSourcePanel";

// Why a CODE and not a phrase: a source's error is held in state
// (App.tsx::errorsById) until the next resync/generate. If we held the already
// translated phrase, switching the language would leave the old message on
// screen, in Portuguese, under an interface in English. Holding the code, what
// translates is the render (DataSourcePanel) and the switch is instant.
export type SourceErrorCode = "invalidJson" | "notAnObject";

// It merges N JSON sources into a single object, at the top level — on a
// repeated key, the source further down the list wins. An error in one source
// (invalid JSON, or not an object) does not stop the others from entering the
// merge; it is simply left out and shown marked.
export function mergeSources(sources: JsonSource[]): {
  data: Record<string, unknown>;
  errorsById: Record<string, SourceErrorCode>;
} {
  const data: Record<string, unknown> = {};
  const errorsById: Record<string, SourceErrorCode> = {};
  for (const source of sources) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source.raw);
    } catch {
      errorsById[source.id] = "invalidJson";
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errorsById[source.id] = "notAnObject";
      continue;
    }
    Object.assign(data, parsed);
  }
  return { data, errorsById };
}
