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
  // Código, não frase — a tradução acontece aqui no render (ver lib/sources.ts).
  errorsById: Record<string, SourceErrorCode>;
  locale: Locale;
};

function nameFromFile(file: File): string {
  return file.name.replace(/\.json$/i, "");
}

// Uma ou mais fontes de JSON — cada arquivo/bloco colado vira uma entrada;
// na hora de gerar (App.tsx), todas são mescladas (nível superior, último
// sobrescreve em caso de chave repetida) num objeto só antes de vincular
// campo. "Resync campos" atualiza a lista de campos disponíveis com base
// nessa mescla.
//
// Input/Textarea/ícones são HTML nativo + CSS de src/index.css — nada
// importado do pacote.
export default function DataSourcePanel({ sources, onChangeSources, onResync, fieldCount, errorsById, locale }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  // NOMES dos arquivos que não deram pra ler, não a frase pronta. Guardar
  // frase traduzida em estado congela o idioma no momento do erro: a mensagem
  // ficaria em português na tela depois de trocar o seletor pro inglês, porque
  // `locale` só afeta o que é renderizado DEPOIS da troca. Guardando o dado, a
  // frase é montada a cada render e acompanha o seletor.
  const [failedFileNames, setFailedFileNames] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const d = t(locale);

  // Rejeita com o NOME do arquivo (dado), não com uma frase — quem escreve a
  // frase é o render, ver `failedFileNames`.
  function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error(file.name));
      reader.readAsText(file);
    });
  }

  // Lê TODOS os arquivos do lote antes de chamar onChangeSources uma vez só
  // — disparar um onChangeSources por arquivo dentro do forEach fazia cada
  // callback de onload capturar o MESMO `sources` (stale closure), então
  // soltar 2+ arquivos de uma vez só mantinha o último (cada um sobrescrevia
  // o anterior em vez de acumular).
  async function addFilesAsSources(files: FileList) {
    setFailedFileNames([]);
    const results = await Promise.allSettled(Array.from(files).map((file) => readFileAsText(file).then((raw) => ({ file, raw }))));
    const newSources: JsonSource[] = [];
    const failedNames: string[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        newSources.push({ id: uid(), name: nameFromFile(result.value.file), raw: result.value.raw });
      } else {
        // String vazia = "nem o nome deu pra saber"; o render escolhe a
        // palavra ("arquivo desconhecido" / "unknown file").
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
    // `fonte_N` NÃO é traduzido: é o NOME da fonte, um dado que vai pro
    // projeto salvo e é o que a pessoa vê/edita. Trocar de idioma não pode
    // renomear dado que já existe, e um projeto salvo em pt-BR reaberto em
    // inglês continuaria com `fonte_2` — o resultado seria nome inconsistente
    // dentro do mesmo arquivo.
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
