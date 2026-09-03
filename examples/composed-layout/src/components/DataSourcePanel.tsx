import { useRef, useState } from "react";
import { IconPlus, IconRefresh, IconUpload, IconX } from "json-pdf-designer";
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
  // Código, não frase: a tradução acontece na renderização, aqui embaixo —
  // ver o comentário em lib/sources.ts.
  errorsById: Record<string, SourceErrorCode>;
  locale: Locale;
};

function nameFromFile(file: File): string {
  return file.name.replace(/\.json$/i, "");
}

// Uma ou mais fontes de JSON — cada arquivo/bloco colado vira uma entrada;
// na hora de gerar (App.tsx), todas são mescladas (nível superior, último
// sobrescreve em caso de chave repetida) num objeto só antes de vincular
// campo. "Resync" atualiza a lista de campos disponíveis com base nessa
// mescla.
//
// Casca em CSS puro (`.app-*`, ver index.css) — este example não tem
// pipeline de Tailwind. Os ÍCONES vêm do pacote: são SVG em
// `currentColor`, então herdam a cor do botão que os embrulha.
export default function DataSourcePanel({ sources, onChangeSources, onResync, fieldCount, errorsById, locale }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  // NOMES dos arquivos que falharam, não a frase pronta: o estado guarda dado
  // e a frase sai do dicionário na renderização, então trocar de idioma
  // retraduz o aviso que já está na tela.
  const [failedFiles, setFailedFiles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ui = t(locale);

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
  //
  // O `.then(ok, falha)` de duas pontas (em vez de `Promise.allSettled`)
  // preserva QUAL arquivo falhou — o `reason` de um settled rejeitado não
  // sabe de qual promise veio, e sem o nome não há como montar o aviso na
  // hora de renderizar.
  async function addFilesAsSources(files: FileList) {
    setFailedFiles([]);
    const results = await Promise.all(
      Array.from(files).map((file) =>
        readFileAsText(file).then(
          (raw) => ({ ok: true as const, file, raw }),
          () => ({ ok: false as const, file })
        )
      )
    );
    const newSources: JsonSource[] = [];
    const failedNames: string[] = [];
    for (const result of results) {
      if (result.ok) newSources.push({ id: uid(), name: nameFromFile(result.file), raw: result.raw });
      else failedNames.push(result.file.name);
    }
    if (newSources.length > 0) onChangeSources([...sources, ...newSources]);
    if (failedNames.length > 0) setFailedFiles(failedNames);
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
    <section className="app-card">
      <h2 className="app-h2">{ui.fontesTitulo}</h2>
      <p className="app-note">{ui.fontesNota}</p>

      <div
        className={`app-dropzone${isDragOver ? " is-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <IconUpload />
        <span>{ui.dropzone}</span>
        <input ref={fileInputRef} type="file" accept="application/json,.json" multiple hidden onChange={handleFilePick} />
      </div>
      {failedFiles.length > 0 && <p className="app-alert">{ui.naoLeuArquivos(failedFiles)}</p>}

      <div className="app-source-list">
        {sources.map((source, i) => (
          <div key={source.id} className="app-source">
            <div className="app-source__head">
              <input
                className="app-input"
                value={source.name}
                onChange={(e) => updateSource(source.id, { name: e.target.value })}
                // NÃO traduzido, e de propósito: o placeholder espelha o nome
                // que `addBlankSource` gera (`fonte_2`), e nome de fonte é
                // DADO — fica no autosave e no projeto salvo. Traduzir só o
                // placeholder faria a dica prometer um nome que o botão não
                // cria; traduzir o nome faria a mesma fonte mudar de
                // identidade ao trocar de idioma.
                placeholder={`fonte_${i + 1}`}
              />
              <button
                type="button"
                className="app-icon-btn app-icon-btn--danger"
                onClick={() => removeSource(source.id)}
                aria-label={ui.removerFonte(source.name)}
              >
                <IconX />
              </button>
            </div>
            <textarea
              className="app-textarea"
              rows={4}
              value={source.raw}
              onChange={(e) => updateSource(source.id, { raw: e.target.value })}
              spellCheck={false}
              // Placeholder de JSON: é FORMA DE DADO, não frase — `rows` e
              // `pnr` são nome de campo e continuam iguais nos dois idiomas.
              placeholder='{ "rows": [ { "pnr": "ABC123" } ] }'
            />
            {errorsById[source.id] && (
              <p className="app-alert">
                {ui.erroPrefixo} {errorsById[source.id] === "jsonInvalido" ? ui.fonteJsonInvalido : ui.fonteNaoObjeto}
              </p>
            )}
          </div>
        ))}
      </div>

      <button type="button" className="app-btn app-btn--ghost" onClick={addBlankSource}>
        <IconPlus /> {ui.novaFonte}
      </button>

      <div className="app-row">
        <button type="button" className="app-btn app-btn--accent" onClick={handleResyncClick}>
          <IconRefresh /> {ui.resync}
        </button>
        <span className={`app-note${errorCount > 0 ? " is-error" : justSynced ? " is-ok" : ""}`}>
          {errorCount > 0 ? ui.fontesComErro(errorCount) : justSynced ? ui.camposSincronizados(fieldCount) : ui.camposCarregados(fieldCount)}
        </span>
      </div>
    </section>
  );
}
