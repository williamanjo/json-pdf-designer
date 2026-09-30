import type { JsonSource } from "../components/DataSourcePanel";

// It merges N JSON sources into a single object, at the top level — on a
// repeated key, the source further down the list wins. An error in one source
// (invalid JSON, or not an object) does not stop the others from entering the
// merge; it is simply left out and shown marked.
//
// WHY A CODE, and not the finished phrase.
//
// This function USED to take a `locale` and return the already-translated
// message. The result went into state (`errorsById` in the App), and a
// translated phrase held in state FREEZES in the language it was created in:
// switching the language picker left the sources' errors in the old language
// until the next merge. The state's lazy init made it worse, because it merged
// with a fixed `LOCALE_INICIAL` — the phrase was born in a language the user
// might not even be using.
//
// With the code, the state holds WHAT FAILED and the panel translates at
// render time. A bonus: merging JSON goes back to being a data function, with
// no dependency on the dictionary.
export type SourceErrorCode = "invalidJson" | "notAnObject";

export function mergeSources(
  sources: JsonSource[]
): { data: Record<string, unknown>; errorsById: Record<string, SourceErrorCode> } {
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
