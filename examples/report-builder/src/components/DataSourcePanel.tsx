import { useRef, useState } from "react";
import { Card, CardTitle, Input, Textarea, IconPlus, IconRefresh, IconUpload, IconX } from "json-pdf-designer";
import type { Locale } from "json-pdf-designer";
import { uid } from "../lib/uid";
import type { SourceProblem } from "../lib/sources";
import { t, type AppDict } from "../i18n";

export type JsonSource = { id: string; name: string; raw: string };

type Props = {
  // The same `locale` that goes to the editor's `<I18nProvider>` — the shell
  // and the package read from the same state, with no manual syncing.
  locale: Locale;
  sources: JsonSource[];
  onChangeSources: (sources: JsonSource[]) => void;
  onResync: () => void;
  fieldCount: number;
  // The REASON for each source's error, not the finished phrase — see lib/sources.ts.
  errorsById: Record<string, SourceProblem>;
};

function sourceProblemText(problem: SourceProblem, t: AppDict): string {
  return problem === "invalidJson" ? t.sourceInvalidJson : t.sourceNotObject;
}

function nameFromFile(file: File): string {
  return file.name.replace(/\.json$/i, "");
}

// One or more JSON sources — each file/pasted block becomes an entry; at
// generation time (App.tsx), all of them are merged (top level, the last one
// wins on a repeated key) into a single object before binding a field. "Resync
// fields" updates the list of available fields based on that merge.
export default function DataSourcePanel({ locale, sources, onChangeSources, onResync, fieldCount, errorsById }: Props) {
  const tx = t(locale);
  const [isDragOver, setIsDragOver] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  // The names of the files that could not be read — the phrase is built at
  // render time, in the current language, instead of stored ready in state.
  const [failedFileNames, setFailedFileNames] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
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
    // Each read returns a MARKED result (ok/failed) instead of rejecting with
    // text: that way the failure carries the FILE, and the error phrase is
    // chosen at render time, in the current language.
    const results = await Promise.all(
      Array.from(files).map((file) =>
        readFileAsText(file).then(
          (raw) => ({ ok: true as const, file, raw }),
          () => ({ ok: false as const, file, raw: "" })
        )
      )
    );
    const newSources: JsonSource[] = [];
    const failed: string[] = [];
    for (const result of results) {
      if (result.ok) newSources.push({ id: uid(), name: nameFromFile(result.file), raw: result.raw });
      else failed.push(result.file.name);
    }
    if (newSources.length > 0) onChangeSources([...sources, ...newSources]);
    if (failed.length > 0) setFailedFileNames(failed);
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

  // `fonte_N` is NOT translated (neither here nor in the placeholder below):
  // it is the source's IDENTIFIER, editable by the user and kept in the
  // autosave — the same family as `text_a3f2`, the schema name the app
  // generates. Switching language must not rename what the user already named.
  function addBlankSource() {
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
    <Card className="flex flex-col gap-2 p-3">
      <CardTitle>{tx.sourcesTitle}</CardTitle>
      <p className="text-[11px] text-slate-500">{tx.sourcesHelp}</p>

      <div
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-3 py-3 text-center text-[11px] transition-colors ${
          isDragOver ? "border-sky-500 bg-sky-50 text-sky-700" : "border-slate-300 text-slate-500 hover:border-sky-400"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <IconUpload />
        {tx.sourcesDropzone}
        <input ref={fileInputRef} type="file" accept="application/json,.json" multiple hidden onChange={handleFilePick} />
      </div>
      {failedFileNames.length > 0 && (
        // Nome do arquivo é dado; só a moldura da frase traduz.
        <p className="text-[11px] text-red-600">{failedFileNames.map((name) => tx.sourceReadFailed(name)).join(" ")}</p>
      )}

      <div className="flex flex-col gap-2">
        {sources.map((source, i) => (
          <div key={source.id} className="rounded-lg border border-slate-200 p-2">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Input
                value={source.name}
                onChange={(e) => updateSource(source.id, { name: e.target.value })}
                className="!py-1 text-xs font-medium"
                placeholder={`fonte_${i + 1}`}
              />
              <button
                type="button"
                onClick={() => removeSource(source.id)}
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                aria-label={tx.sourceRemoveAria(source.name)}
              >
                <IconX />
              </button>
            </div>
            <Textarea
              mono
              rows={4}
              value={source.raw}
              onChange={(e) => updateSource(source.id, { raw: e.target.value })}
              spellCheck={false}
              // O placeholder é uma AMOSTRA de JSON — dado, não interface.
              // "rows"/"status"/"ERRO" são chaves e valores de exemplo, e
              // traduzi-los ensinaria a chave errada.
              placeholder='{ "rows": [ { "count": "10", "status": "ERRO" } ] }'
            />
            {errorsById[source.id] && (
              <p className="mt-1 text-[11px] text-red-600">
                {tx.sourceErrorPrefix} {sourceProblemText(errorsById[source.id], tx)}
              </p>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addBlankSource}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
      >
        <IconPlus /> {tx.sourceAddBlank}
      </button>

      <div className="flex items-center gap-2.5">
        <button
          onClick={handleResyncClick}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-sky-700"
        >
          <IconRefresh /> {tx.sourcesResync}
        </button>
        <span className={`text-[11px] ${errorCount > 0 ? "text-red-600" : justSynced ? "font-semibold text-green-700" : "text-slate-500"}`}>
          {errorCount > 0 ? tx.sourcesWithError(errorCount) : justSynced ? tx.fieldsFound(fieldCount) : tx.fieldsLoaded(fieldCount)}
        </span>
      </div>
    </Card>
  );
}
