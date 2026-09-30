import { useRef, useState } from "react";
import type { Locale } from "json-pdf-designer";
import { t } from "../i18n";
import type { SourceErrorCode } from "../lib/sources";
import { uid } from "../lib/uid";

export type JsonSource = { id: string; name: string; raw: string };

type Props = {
  sources: JsonSource[];
  onChangeSources: (sources: JsonSource[]) => void;
  onResync: () => void;
  fieldCount: number;
  // A CODE, not a phrase: the translation happens down here, at render time
  // (see lib/sources.ts for why).
  errorsById: Record<string, SourceErrorCode>;
  // The SAME `locale` as the <Designer> (see App.tsx) — here it picks the
  // shell's dictionary.
  locale: Locale;
};

function nameFromFile(file: File): string {
  return file.name.replace(/\.json$/i, "");
}

// One or more JSON sources — each file/pasted block becomes an entry; at
// generation time (App.tsx), all of them are merged (top level, the last one
// wins on a repeated key) into a single object before binding a field. "Resync
// fields" updates the list of available fields based on that merge.
//
// The input/textarea/icons are native HTML + `.app-*` classes from
// src/index.css — no Card/Input/Textarea/icon from the package. Not out of
// purity: it is that the package's primitives are styled by `theme.css`, and
// this example needs the SHELL to prove its dark mode on its own.
export default function DataSourcePanel({ sources, onChangeSources, onResync, fieldCount, errorsById, locale }: Props) {
  const s = t(locale);
  const [isDragOver, setIsDragOver] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  // File NAMES, not the finished phrase.
  //
  // This used to be a `string | null` with the already-translated message:
  // each read that failed became `"Não deu pra ler \"x.json\"."` at the moment
  // of the error, the phrases were joined with a space and the result went
  // into state. A translated phrase in state freezes in the language it was
  // born in — switching the picker left the warning in the old language. And
  // joining N phrases into one paragraph depended on each ending in a period.
  //
  // Holding the names (which are DATA, and are not translated), the phrase is
  // built at render time, one per file.
  const [failedReads, setFailedReads] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsText(file);
    });
  }

  // It reads ALL the files of the batch before calling onChangeSources once
  // — firing one onChangeSources per file inside the forEach made each onload
  // callback capture the SAME `sources` (a stale closure), so dropping 2+ files
  // at once kept only the last one (each overwrote the previous instead of
  // accumulating).
  async function addFilesAsSources(files: FileList) {
    setFailedReads([]);
    // Materialized into a list: the index is what ties each result to its own
    // file, because `Promise.allSettled` preserves the order but the rejection
    // does not carry the entry. That is how the name reaches the warning
    // without anyone having to embed text in the error.
    const picked = Array.from(files);
    const results = await Promise.allSettled(picked.map((file) => readFileAsText(file)));
    const newSources: JsonSource[] = [];
    const failed: string[] = [];
    results.forEach((result, i) => {
      const file = picked[i];
      if (result.status === "fulfilled") {
        newSources.push({ id: uid(), name: nameFromFile(file), raw: result.value });
      } else {
        failed.push(file.name || s.sources.unknownFile);
      }
    });
    if (newSources.length > 0) onChangeSources([...sources, ...newSources]);
    if (failed.length > 0) setFailedReads(failed);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) addFilesAsSources(e.dataTransfer.files);
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) addFilesAsSources(e.target.files);
    e.target.value = "";
  }

  // `fonte_N` does NOT go through the dictionary, and the placeholder below
  // follows: the source's name is DATA (the person edits it, and it goes into
  // the autosave along with the rest of the project), just like the "principal"
  // of the initial source in App.tsx. Translating here would rename the data.
  function addBlankSource() {
    onChangeSources([...sources, { id: uid(), name: `fonte_${sources.length + 1}`, raw: "{}" }]);
  }

  function updateSource(id: string, patch: Partial<JsonSource>) {
    onChangeSources(sources.map((source) => (source.id === id ? { ...source, ...patch } : source)));
  }

  function removeSource(id: string) {
    onChangeSources(sources.filter((source) => source.id !== id));
  }

  function handleResyncClick() {
    onResync();
    setJustSynced(true);
    setTimeout(() => setJustSynced(false), 1500);
  }

  const errorCount = Object.keys(errorsById).length;

  return (
    <section className="app-panel">
      <span className="app-panel__title">{s.sources.title}</span>
      <p className="app-hint">{s.sources.hint}</p>

      <div
        className={isDragOver ? "app-dropzone is-over" : "app-dropzone"}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <span className="app-dropzone__icon">⭱</span>
        {s.sources.dropzone}
        <input ref={fileInputRef} type="file" accept="application/json,.json" multiple hidden onChange={handleFilePick} />
      </div>
      {/* Uma linha por arquivo, montada agora: o nome é dado, a frase é
          interface. */}
      {failedReads.map((name) => (
        <p className="app-error-text" key={name}>
          {s.sources.unreadable(name)}
        </p>
      ))}

      <div className="app-source-list">
        {sources.map((source, i) => (
          <div key={source.id} className="app-source">
            <div className="app-source__head">
              <input
                className="app-input"
                value={source.name}
                onChange={(e) => updateSource(source.id, { name: e.target.value })}
                placeholder={`fonte_${i + 1}`}
              />
              <button
                type="button"
                onClick={() => removeSource(source.id)}
                className="app-icon-btn app-icon-btn--danger"
                aria-label={s.sources.remove(source.name)}
              >
                ×
              </button>
            </div>
            <textarea
              className="app-textarea app-textarea--mono"
              rows={4}
              value={source.raw}
              onChange={(e) => updateSource(source.id, { raw: e.target.value })}
              spellCheck={false}
              // JSON de amostra: é DADO, e dado não troca de idioma com a UI.
              placeholder='{ "rows": [ { "count": "10", "status": "ERRO" } ] }'
            />
            {/* A mensagem já vem traduzida de `mergeSources` (lib/sources.ts,
                que recebe o mesmo `locale`) — aqui só entra o prefixo. */}
            {errorsById[source.id] && <p className="app-error-text">{s.sources.errorPrefix(s.sources[errorsById[source.id]])}</p>}
          </div>
        ))}
      </div>

      <button type="button" onClick={addBlankSource} className="app-btn app-btn--outline">
        {s.sources.addBlank}
      </button>

      <div className="app-resync">
        <button type="button" onClick={handleResyncClick} className="app-btn app-btn--accent">
          ⟳ {s.sources.resync}
        </button>
        <span className={errorCount > 0 ? "app-status is-error" : justSynced ? "app-status is-ok" : "app-status"}>
          {errorCount > 0 ? s.sources.withError(errorCount) : justSynced ? s.sources.found(fieldCount) : s.sources.loaded(fieldCount)}
        </span>
      </div>
    </section>
  );
}
