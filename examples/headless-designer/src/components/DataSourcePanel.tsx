import { useRef, useState } from "react";
import type { JsonSource, SourceErrorCode } from "../lib/sources";
import { uid } from "../lib/uid";
import type { ShellDict } from "../i18n";

type Props = {
  sources: JsonSource[];
  onChangeSources: (sources: JsonSource[]) => void;
  onResync: () => void;
  fieldCount: number;
  // CÓDIGO, não frase: a tradução acontece aqui embaixo, no render (ver
  // lib/sources.ts pro porquê).
  errorsById: Record<string, SourceErrorCode>;
  // Dicionário da CASCA: "fonte de dados JSON, várias e mescladas" é recurso
  // DESTE app (ver lib/sources.ts) — o pacote recebe um objeto só e não tem
  // conceito de fonte, então não há nada dele pra reusar aqui.
  tt: ShellDict;
};

function nameFromFile(file: File): string {
  return file.name.replace(/\.json$/i, "");
}

// Uma ou mais fontes de JSON — cada arquivo/bloco colado vira uma entrada;
// na hora de gerar (App.tsx), todas são mescladas (nível superior, último
// sobrescreve em caso de chave repetida) num objeto só antes de vincular
// campo. "Resync fields" atualiza a lista de campos disponíveis com base
// nessa mescla.
//
// Zero componente do pacote: `Card`/`Input`/`Textarea`/`Icon*` existem e
// seriam o caminho curto, mas moram no entry com React (`.`) — e este
// example importa do pacote só `/server` e `<PdfPreview>`. Então a caixa, o
// input e os ícones (caracteres, não SVG) são daqui.
export default function DataSourcePanel({ sources, onChangeSources, onResync, fieldCount, errorsById, tt }: Props) {
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
