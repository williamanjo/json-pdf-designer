// One JSON data source. The type lives HERE (and not in the panel that edits
// it) because what depends on it is the merge engine below, the autosave and
// the App itself — the panel is only one of the screens that show it.
export type JsonSource = { id: string; name: string; raw: string };

// It merges N JSON sources into a single object, at the top level — on a
// repeated key, the source further down the list wins. An error in one source
// (invalid JSON, or not an object) does not stop the others from entering the
// merge; it is simply left out and shown marked.
// WHY A CODE, and not the finished phrase.
//
// These two messages used to be an ENGLISH STRING hardcoded here, and they
// went into state (`errorsById` in the App). The panel wrapped them in a
// translated prefix (`tt.sources.parseError`), so the result was half
// translated: "Erro: Invalid JSON." — the label in Portuguese and the reason
// in English, in every pt-BR session. Switching the language changed nothing,
// because the phrase was already in state.
//
// With the code, the state holds WHAT FAILED and the panel resolves the text
// at render time, in the language of that render.
export type SourceErrorCode = "invalidJson" | "notAnObject";

export function mergeSources(sources: JsonSource[]): { data: Record<string, unknown>; errorsById: Record<string, SourceErrorCode> } {
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
