import { useRef, useState } from "react";
import { uid } from "../lib/uid";

export type JsonSource = { id: string; name: string; raw: string };

type Props = {
  sources: JsonSource[];
  onChangeSources: (sources: JsonSource[]) => void;
  onResync: () => void;
  fieldCount: number;
  errorsById: Record<string, string>;
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
export default function DataSourcePanel({ sources, onChangeSources, onResync, fieldCount, errorsById }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error(`Não deu pra ler "${file.name}".`));
      reader.readAsText(file);
    });
  }

  // Lê TODOS os arquivos do lote antes de chamar onChangeSources uma vez só
  // — disparar um onChangeSources por arquivo dentro do forEach fazia cada
  // callback de onload capturar o MESMO `sources` (stale closure), então
  // soltar 2+ arquivos de uma vez só mantinha o último (cada um sobrescrevia
  // o anterior em vez de acumular).
  async function addFilesAsSources(files: FileList) {
    setReadError(null);
    const results = await Promise.allSettled(Array.from(files).map((file) => readFileAsText(file).then((raw) => ({ file, raw }))));
    const newSources: JsonSource[] = [];
    const failedNames: string[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        newSources.push({ id: uid(), name: nameFromFile(result.value.file), raw: result.value.raw });
      } else {
        failedNames.push(result.reason instanceof Error ? result.reason.message : "arquivo desconhecido");
      }
    }
    if (newSources.length > 0) onChangeSources([...sources, ...newSources]);
    if (failedNames.length > 0) setReadError(failedNames.join(" "));
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
      <h2 className="card-title">Fontes de dados (JSON)</h2>
      <p className="hint">
        Cole ou arraste um ou mais arquivos .json — cada um vira uma fonte. Na hora de gerar, todas são juntadas (nível
        superior; em caso de chave repetida, a última fonte da lista vence) num objeto só antes de vincular campo.
      </p>

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
        Solte um ou mais arquivos .json aqui ou clique para escolher
        <input ref={fileInputRef} type="file" accept="application/json,.json" multiple hidden onChange={handleFilePick} />
      </div>
      {readError && <p className="msg-error">{readError}</p>}

      <div className="source-list">
        {sources.map((source, i) => (
          <div key={source.id} className="source-item">
            <div className="source-item-head">
              <input
                className="text-input source-name"
                value={source.name}
                onChange={(e) => updateSource(source.id, { name: e.target.value })}
                placeholder={`fonte_${i + 1}`}
              />
              <button
                type="button"
                onClick={() => removeSource(source.id)}
                className="btn-icon btn-icon-danger"
                aria-label={`Remover fonte ${source.name}`}
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
              placeholder='{ "rows": [ { "count": "10", "status": "ERRO" } ] }'
            />
            {errorsById[source.id] && <p className="msg-error">Erro: {errorsById[source.id]}</p>}
          </div>
        ))}
      </div>

      <button type="button" onClick={addBlankSource} className="btn btn-outline">
        + nova fonte em branco
      </button>

      <div className="resync-row">
        <button type="button" onClick={handleResyncClick} className="btn btn-accent">
          ⟳ Resync campos
        </button>
        <span className={errorCount > 0 ? "status is-error" : justSynced ? "status is-ok" : "status"}>
          {errorCount > 0
            ? `${errorCount} fonte(s) com erro`
            : justSynced
              ? `✓ ${fieldCount} campo(s) encontrado(s)`
              : `${fieldCount} campo(s) carregado(s)`}
        </span>
      </div>
    </section>
  );
}
