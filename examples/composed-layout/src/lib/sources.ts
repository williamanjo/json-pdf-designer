import type { JsonSource } from "../components/DataSourcePanel";

// It merges N JSON sources into a single object, at the top level — on a
// repeated key, the source further down the list wins. An error in one source
// (invalid JSON, or not an object) does not stop the others from entering the
// merge; it is simply left out and shown marked.

// A failure CODE, not a finished phrase: `mergeSources`'s result goes into
// the App's STATE (`errorsById`) and is only recomputed on "Resync"/"Generate
// PDF". If it held the translated message, switching language would leave the
// old warning on screen until the next scan. The phrase comes from the
// dictionary at render time (DataSourcePanel), so it switches along with the picker.
export type SourceErrorCode = "jsonInvalido" | "naoObjeto";

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
      errorsById[source.id] = "jsonInvalido";
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errorsById[source.id] = "naoObjeto";
      continue;
    }
    Object.assign(data, parsed);
  }
  return { data, errorsById };
}
