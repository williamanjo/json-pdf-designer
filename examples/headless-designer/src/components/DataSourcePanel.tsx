import { useRef, useState } from "react";
import type { JsonSource, SourceErrorCode } from "../lib/sources";
import { uid } from "../lib/uid";
import type { ShellDict } from "../i18n";

type Props = {
  sources: JsonSource[];
  onChangeSources: (sources: JsonSource[]) => void;
  onResync: () => void;
  fieldCount: number;
  // A CODE, not a phrase: the translation happens down here, at render time
  // (see lib/sources.ts for why).
  errorsById: Record<string, SourceErrorCode>;
  // The SHELL's dictionary: "a JSON data source, several of them and merged"
  // is a feature of THIS app (see lib/sources.ts) — the package receives a
  // single object and has no concept of a source, so there is nothing of its
  // own to reuse here.
  tt: ShellDict;
};

function nameFromFile(file: File): string {
  return file.name.replace(/\.json$/i, "");
}

// One or more JSON sources — each file/pasted block becomes an entry; at
// generation time (App.tsx), all of them are merged (top level, the last one
// wins on a repeated key) into a single object before binding a field. "Resync
// fields" updates the list of available fields based on that merge.
//
// Zero components from the package: `Card`/`Input`/`Textarea`/`Icon*` exist
// and would be the short path, but they live in the React entry (`.`) — and
// this example imports only `/server` and `<PdfPreview>` from the package. So
// the box, the input and the icons (characters, not SVG) belong here.
export default function DataSourcePanel({ sources, onChangeSources, onResync, fieldCount, errorsById, tt }: Props) {
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
        failed.push(file.name || tt.sources.unknownFile);
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

  function addBlankSource() {
    onChangeSources([...sources, { id: uid(), name: `source_${sources.length + 1}`, raw: "{}" }]);
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
    <div className="panel">
      <div className="panel-title">{tt.sources.title}</div>
      <p className="panel-hint">{tt.sources.hint}</p>

      <div
        className={`dropzone${isDragOver ? " over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {tt.sources.dropzone}
        <input ref={fileInputRef} type="file" accept="application/json,.json" multiple hidden onChange={handleFilePick} />
      </div>
      {/* Uma linha por arquivo, montada agora: o nome é dado, a frase é
          interface. */}
      {failedReads.map((name) => (
        <p className="error-text" key={name}>
          {tt.sources.readError(name)}
        </p>
      ))}

      {sources.map((source, i) => (
        <div key={source.id} className="source-card">
          <div className="source-card-header">
            <input
              className="field-name"
              value={source.name}
              onChange={(e) => updateSource(source.id, { name: e.target.value })}
              // `source_N` não se traduz: é o NOME que `addBlankSource` grava
              // de verdade na fonte (dado do projeto salvo), e o placeholder
              // só espelha esse padrão.
              placeholder={`source_${i + 1}`}
            />
            <button
              type="button"
              className="remove-btn"
              onClick={() => removeSource(source.id)}
              aria-label={tt.sources.removeAria(source.name)}
            >
              ×
            </button>
          </div>
          <textarea
            className="data-textarea"
            rows={4}
            value={source.raw}
            spellCheck={false}
            onChange={(e) => updateSource(source.id, { raw: e.target.value })}
            // JSON de exemplo — DADO, não rótulo de UI. As chaves e os
            // valores continuam iguais nos dois idiomas: é a forma do
            // documento do usuário, não texto do app.
            placeholder='{ "rows": [ { "count": "10", "status": "ERROR" } ] }'
          />
          {/* A mensagem do erro é a do `JSON.parse` do navegador, no idioma
              DELE — o app traduz só a palavra que a introduz. */}
          {errorsById[source.id] && <p className="error-text">{tt.sources.parseError(tt.sources[errorsById[source.id]])}</p>}
        </div>
      ))}

      <button type="button" onClick={addBlankSource}>
        {tt.sources.addBlank}
      </button>

      <div className="resync-row">
        <button type="button" className="accent-btn" onClick={handleResyncClick}>
          {tt.sources.resync}
        </button>
        <span className={errorCount > 0 ? "error-text" : justSynced ? "ok-text" : "muted-text"}>
          {errorCount > 0
            ? tt.sources.withErrors(errorCount)
            : justSynced
              ? tt.sources.found(fieldCount)
              : tt.sources.loaded(fieldCount)}
        </span>
      </div>
    </div>
  );
}
