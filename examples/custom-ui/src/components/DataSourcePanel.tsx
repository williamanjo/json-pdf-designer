import { useRef, useState } from "react";
import type { Locale } from "json-pdf-designer";
import { uid } from "../lib/uid";
import type { SourceErrorCode } from "../lib/sources";
import { t } from "../i18n";

export type JsonSource = { id: string; name: string; raw: string };

type Props = {
  sources: JsonSource[];
  onChangeSources: (sources: JsonSource[]) => void;
  onResync: () => void;
  fieldCount: number;
  // A code, not a phrase — the translation happens here at render time (see lib/sources.ts).
  errorsById: Record<string, SourceErrorCode>;
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
// The Input/Textarea/icons are native HTML + CSS from src/index.css — nothing
// imported from the package.
export default function DataSourcePanel({ sources, onChangeSources, onResync, fieldCount, errorsById, locale }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  // The NAMES of the files that could not be read, not the finished phrase.
  // Holding a translated phrase in state freezes the language at the moment of
  // the error: the message would stay in Portuguese on screen after switching
  // the picker to English, because `locale` only affects what is rendered
  // AFTER the switch. Holding the data, the phrase is built on every render.
  const [failedFileNames, setFailedFileNames] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const d = t(locale);

  // It rejects with the file's NAME (data), not with a phrase — what writes
  // the phrase is the render, see `failedFileNames`.
  function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error(file.name));
      reader.readAsText(file);
    });
  }

  // It reads ALL the files of the batch before calling onChangeSources once
  // — firing one onChangeSources per file inside the forEach made each onload
  // callback capture the SAME `sources` (a stale closure), so dropping 2+ files
  // at once kept only the last one (each overwrote the previous instead of
  // accumulating).
  async function addFilesAsSources(files: FileList) {
    setFailedFileNames([]);
    const results = await Promise.allSettled(Array.from(files).map((file) => readFileAsText(file).then((raw) => ({ file, raw }))));
    const newSources: JsonSource[] = [];
    const failedNames: string[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        newSources.push({ id: uid(), name: nameFromFile(result.value.file), raw: result.value.raw });
      } else {
        // An empty string = "not even the name could be known"; the render picks
        // the word ("arquivo desconhecido" / "unknown file").
        failedNames.push(result.reason instanceof Error ? result.reason.message : "");
      }
    }
    if (newSources.length > 0) onChangeSources([...sources, ...newSources]);
    if (failedNames.length > 0) setFailedFileNames(failedNames);
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

  function addBlankSource() {
    // `fonte_N` is NOT translated: it is the source's NAME, data that goes
    // into the saved project and is what the person sees/edits. Switching
    // language must not rename data that already exists, and a project saved
    // in pt-BR reopened in English would still have `fonte_2` — the result
    // would be an inconsistent name inside the same file.
    onChangeSources([...sources, { id: uid(), name: `fonte_${sources.length + 1}`, raw: "{}" }]);
  }

  function updateSource(id: string, patch: Partial<JsonSource>) {
    onChangeSources(sources.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSource(id: string) {
    onChangeSources(sources.filter((s) => s.id !== id));
  }

  function handleResyncClick() {
    onResync();
    setJustSynced(true);
    setTimeout(() => setJustSynced(false), 1500);
  }

  const errorCount = Object.keys(errorsById).length;

  return (
    <section className="card">
      <h2 className="card-title">{d.sourcesTitle}</h2>
      <p className="hint">{d.sourcesHint}</p>

      <div
        className={isDragOver ? "dropzone is-over" : "dropzone"}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <span className="dropzone-icon">⭱</span>
        {d.dropzone}
        <input ref={fileInputRef} type="file" accept="application/json,.json" multiple hidden onChange={handleFilePick} />
      </div>
      {failedFileNames.length > 0 && (
        <p className="msg-error">{failedFileNames.map((name) => d.cantReadFile(name || d.unknownFile)).join(" ")}</p>
      )}

      <div className="source-list">
        {sources.map((source, i) => (
          <div key={source.id} className="source-item">
            <div className="source-item-head">
              <input
                className="text-input source-name"
                value={source.name}
                onChange={(e) => updateSource(source.id, { name: e.target.value })}
                // Placeholder espelha o nome que `addBlankSource` geraria —
                // dado, não rótulo (ver o comentário lá).
                placeholder={`fonte_${i + 1}`}
              />
              <button
                type="button"
                onClick={() => removeSource(source.id)}
                className="btn-icon btn-icon-danger"
                aria-label={d.removeSourceAria(source.name)}
              >
                ×
              </button>
            </div>
            <textarea
              className="textarea textarea-source"
              rows={4}
              value={source.raw}
              onChange={(e) => updateSource(source.id, { raw: e.target.value })}
              spellCheck={false}
              // JSON de amostra NÃO é traduzido: é dado, e `count`/`status`
              // são nomes de chave que o template vai referenciar.
              placeholder='{ "rows": [ { "count": "10", "status": "ERRO" } ] }'
            />
            {errorsById[source.id] && <p className="msg-error">{d.sourceError(d[errorsById[source.id]])}</p>}
          </div>
        ))}
      </div>

      <button type="button" onClick={addBlankSource} className="btn btn-outline">
        {d.addBlankSource}
      </button>

      <div className="resync-row">
        <button type="button" onClick={handleResyncClick} className="btn btn-accent">
          ⟳ {d.resyncFields}
        </button>
        <span className={errorCount > 0 ? "status is-error" : justSynced ? "status is-ok" : "status"}>
          {errorCount > 0 ? d.sourcesWithError(errorCount) : justSynced ? d.fieldsFound(fieldCount) : d.fieldsLoaded(fieldCount)}
        </span>
      </div>
    </section>
  );
}
