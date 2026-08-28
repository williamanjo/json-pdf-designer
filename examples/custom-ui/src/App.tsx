import { useRef, useState } from "react";
import type { Template, Binding, Locale } from "json-pdf-designer";
import { generatePdf } from "json-pdf-designer";
import FieldTree from "./components/FieldTree";
import DesignerPanel from "./components/DesignerPanel";
import DataSourcePanel, { type JsonSource } from "./components/DataSourcePanel";
import PdfPreviewModal from "./components/PdfPreviewModal";
import { extractFields, type FieldNode } from "./lib/jsonExplorer";
import { loadDefaultFont } from "./lib/font";
import { uid } from "./lib/uid";
import { mergeSources } from "./lib/sources";
import { downloadProjectFile, parseProjectFile } from "./lib/projectFile";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { loadAutosave, useAutosave } from "./hooks/useAutosave";
import { initialTemplate, initialBindings, initialSample } from "./data/initialTemplate";
import { EXAMPLES } from "./data/templates";

// Mesmas features do example "report-builder", só que a casca inteira
// (header, sidebar, cards, modais, botões) é HTML + CSS escritos à mão em
// src/index.css — nenhum Button/Card/Input/ícone/PdfPreviewModal do
// pacote. Do json-pdf-designer só entram as peças que NÃO são chrome:
// <Designer>, <PdfPreview>, generatePdf, downloadPdf, I18nProvider e os
// helpers de layout/tipos.
export default function App() {
  const fieldPickerTriggerRef = useRef<(() => void) | null>(null);
  const [autosaved] = useState(loadAutosave);
  const [template, setTemplate] = useState<Template>(() => autosaved?.template ?? initialTemplate);
  const [bindings, setBindings] = useState<Binding[]>(() => autosaved?.bindings ?? initialBindings);
  const [sources, setSources] = useState<JsonSource[]>(
    () => autosaved?.sources ?? [{ id: uid(), name: "principal", raw: JSON.stringify(initialSample, null, 2) }]
  );
  const [fields, setFields] = useState<FieldNode[]>(() => {
    if (autosaved?.sources) return extractFields(mergeSources(autosaved.sources).data);
    return extractFields(initialSample);
  });
  const [errorsById, setErrorsById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [generating, setGenerating] = useState(false);
  // Idioma da UI do <Designer> (botões/abas/avisos) — demonstra o prop
  // `locale`, não afeta o PDF gerado.
  const [locale, setLocale] = useState<Locale>("pt-BR");

  useUndoRedo(template, bindings, setTemplate, setBindings);
  useAutosave(template, bindings, sources);

  // Só recalcula a lista de campos quando o usuário clicar em "Resync
  // campos" — assim ele pode colar um JSON grande sem a lista ficar
  // piscando a cada tecla digitada.
  function handleResync() {
    const { data, errorsById: nextErrors } = mergeSources(sources);
    setFields(extractFields(data));
    setErrorsById(nextErrors);
  }

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const { data, errorsById: nextErrors } = mergeSources(sources);
      setErrorsById(nextErrors);
      const fontBytes = await loadDefaultFont();
      const bytes = await generatePdf(template, data, bindings, { fontBytes });
      setPreviewBytes(bytes);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  function handleImportProject(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    parseProjectFile(file)
      .then(({ template, bindings }) => {
        setTemplate(template);
        setBindings(bindings);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }

  // Exemplos prontos — cada um troca template/binding E a fonte de dados
  // pro JSON de exemplo dele, já sincroniza a lista de campos (fields) sem
  // precisar clicar "Resync".
  function handleLoadExample(key: string) {
    const example = EXAMPLES[key];
    if (!example) return;
    setTemplate(example.template);
    setBindings(example.bindings);
    const raw = JSON.stringify(example.sample, null, 2);
    setSources([{ id: uid(), name: example.sourceName, raw }]);
    setFields(extractFields(example.sample));
    setErrorsById({});
    setPreviewBytes(null);
  }

  return (
    <>
      <header className="app-header">
        <h1>custom-ui-example — casca 100% própria, sem UI pronta do pacote</h1>
        <div className="header-actions">
          <select
            className="select"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            title="Idioma da UI do designer (não muda o PDF gerado)"
          >
            <option value="en">English</option>
            <option value="pt-BR">Português</option>
          </select>
          <select
            className="select"
            value=""
            onChange={(e) => {
              if (e.target.value) handleLoadExample(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">Carregar exemplo…</option>
            {Object.entries(EXAMPLES).map(([key, ex]) => (
              <option key={key} value={key}>
                {ex.label}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-ghost" onClick={() => downloadProjectFile(template, bindings)}>
            Salvar projeto
          </button>
          <label className="btn btn-ghost btn-file">
            ⭱ Carregar projeto
            <input type="file" accept="application/json" onChange={handleImportProject} hidden />
          </label>
          <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
            ⭳ {generating ? "Gerando…" : "Gerar PDF"}
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="app-body">
        <aside className="sidebar">
          <DataSourcePanel
            sources={sources}
            onChangeSources={setSources}
            onResync={handleResync}
            fieldCount={fields.length}
            errorsById={errorsById}
          />
          <FieldTree fields={fields} onOpenPicker={() => fieldPickerTriggerRef.current?.()} />
        </aside>

        <main className="designer-area">
          <DesignerPanel
            fields={fields}
            template={template}
            bindings={bindings}
            onChangeTemplate={setTemplate}
            onChangeBindings={setBindings}
            openFieldPickerRef={fieldPickerTriggerRef}
            locale={locale}
          />
        </main>
      </div>

      {previewBytes && (
        <PdfPreviewModal
          bytes={previewBytes}
          page={template.page}
          locale={locale}
          onClose={() => setPreviewBytes(null)}
        />
      )}
    </>
  );
}
