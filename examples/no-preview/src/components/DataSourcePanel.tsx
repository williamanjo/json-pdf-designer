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
  // CÓDIGO, não frase: a tradução acontece aqui embaixo, no render (ver
  // lib/sources.ts pro porquê).
  errorsById: Record<string, SourceErrorCode>;
  // O MESMO `locale` do <Designer> (ver App.tsx) — aqui ele escolhe o
  // dicionário da casca.
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
// Input/textarea/ícones são HTML nativo + classes `.app-*` de
// src/index.css — nenhum Card/Input/Textarea/ícone do pacote. Não por
// pureza: é que os primitivos do pacote são estilizados pelo `theme.css`,
// e este example precisa que a CASCA prove o dark mode dela por conta.
export default function DataSourcePanel({ sources, onChangeSources, onResync, fieldCount, errorsById, locale }: Props) {
  const s = t(locale);
  const [isDragOver, setIsDragOver] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  // NOMES de arquivo, não a frase pronta.
  //
  // Antes isto era `string | null` com a mensagem já traduzida: cada leitura
  // que falhava virava `"Não deu pra ler \"x.json\"."` na hora do erro, as
  // frases eram juntadas com espaço e o resultado ia pra estado. Frase
  // traduzida em estado congela no idioma em que nasceu — trocar o seletor
  // deixava o aviso na língua antiga. E juntar N frases num parágrafo só
  // dependia de elas terminarem em ponto.
  //
  // Guardando os nomes (que são DADO, e não se traduzem), a frase é montada na
  // renderização, uma por arquivo.
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

  // Lê TODOS os arquivos do lote antes de chamar onChangeSources uma vez só
  // — disparar um onChangeSources por arquivo dentro do forEach fazia cada
  // callback de onload capturar o MESMO `sources` (stale closure), então
  // soltar 2+ arquivos de uma vez só mantinha o último (cada um sobrescrevia
  // o anterior em vez de acumular).
  async function addFilesAsSources(files: FileList) {
    setFailedReads([]);
    // Materializado numa lista: o índice é o que amarra cada resultado ao
    // arquivo dele, porque `Promise.allSettled` preserva a ordem mas a
    // rejeição não carrega a entrada. É assim que o nome chega ao aviso sem
    // ninguém ter que embutir texto no erro.
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

  // `fonte_N` NÃO passa pelo dicionário, e o placeholder abaixo acompanha:
  // o nome da fonte é DADO (a pessoa edita, e ele vai pro autosave junto do
  // resto do projeto), do mesmo jeito que o "principal" da fonte inicial em
  // App.tsx. Traduzir aqui renomearia o dado de quem trocasse de idioma.
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
