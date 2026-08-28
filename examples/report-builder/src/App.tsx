import { useRef, useState } from "react";
import type { Template, TemplatePage, Binding, Locale } from "json-pdf-designer";
import { generatePdf, PdfPreviewModal, Button, IconDownload, IconFolderUp } from "json-pdf-designer";
import FieldTree from "./components/FieldTree";
import DesignerPanel from "./components/DesignerPanel";
import PageTabs from "./components/PageTabs";
import DataSourcePanel, { type JsonSource } from "./components/DataSourcePanel";
import { extractFields, type FieldNode } from "./lib/jsonExplorer";
import { loadDefaultFont } from "./lib/font";
import { uid } from "./lib/uid";
import { mergeSources } from "./lib/sources";
import { downloadProjectFile, parseProjectFile } from "./lib/projectFile";
import { ensurePages, blankPage } from "./lib/pages";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { loadAutosave, useAutosave } from "./hooks/useAutosave";
import { initialTemplate, initialBindings, initialSample } from "./data/initialTemplate";
import { EXAMPLES } from "./data/templates";
import "json-pdf-designer/style.css";
import "./App.css";

export default function App() {
  const fieldPickerTriggerRef = useRef<(() => void) | null>(null);
  const [autosaved] = useState(loadAutosave);
  const [template, setTemplate] = useState<Template>(() => ensurePages(autosaved?.template ?? initialTemplate));
  const [bindings, setBindings] = useState<Binding[]>(() => autosaved?.bindings ?? initialBindings);
  const [activePageIndex, setActivePageIndex] = useState(0);
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
  const [locale, setLocale] = useState<Locale>("en");

  useUndoRedo(template, bindings, setTemplate, setBindings);
  useAutosave(template, bindings, sources);

  // `template.pages` sempre existe e não é vazio (garantido por
  // ensurePages em todo lugar que troca `template` inteiro) — clampa o
  // índice pra nunca apontar fora do array (ex: depois de remover a última
  // aba selecionada, ou carregar um projeto/exemplo com menos páginas).
  const pages = template.pages!;
  const safeActivePageIndex = Math.min(activePageIndex, pages.length - 1);
  const activePage = pages[safeActivePageIndex];

  // Repassa pro <Designer> (via DesignerPanel) só a página ATIVA — Designer
  // não sabe que existem outras páginas, só edita a que recebeu. Grava de
  // volta em template.pages[safeActivePageIndex], preservando o resto do
  // Template intacto (inclusive as outras páginas).
  function setActivePageTemplate(update: React.SetStateAction<Template>) {
    setTemplate((prev) => {
      const prevPages = prev.pages!;
      const current = prevPages[safeActivePageIndex];
      const next = (typeof update === "function" ? (update as (p: Template) => Template)(current) : update) as TemplatePage;
      return { ...prev, pages: prevPages.map((p, i) => (i === safeActivePageIndex ? next : p)) };
    });
  }

  function handleAddPage() {
    setTemplate((prev) => ({ ...prev, pages: [...prev.pages!, blankPage()] }));
    setActivePageIndex(pages.length); // nova página vai pro final
  }

  function handleRemovePage(index: number) {
    if (pages.length <= 1) return;
    setTemplate((prev) => ({ ...prev, pages: prev.pages!.filter((_, i) => i !== index) }));
    setActivePageIndex((prevIndex) => Math.max(0, prevIndex >= index ? prevIndex - 1 : prevIndex));
  }

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
        setTemplate(ensurePages(template));
        setBindings(bindings);
        setActivePageIndex(0);
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
    setTemplate(ensurePages(example.template));
    setBindings(example.bindings);
    setActivePageIndex(0);
    const raw = JSON.stringify(example.sample, null, 2);
    setSources([{ id: uid(), name: example.sourceName, raw }]);
    setFields(extractFields(example.sample));
    setErrorsById({});
    setPreviewBytes(null);
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between bg-slate-900 px-5 py-3 text-white shadow-sm">
        <h1 className="text-lg font-semibold">Gerador de Relatórios</h1>
        <div className="flex gap-2">
          <select
            className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-medium text-white"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            title="Idioma da UI do designer (não muda o PDF gerado)"
          >
            <option value="en" className="text-slate-900">English</option>
            <option value="pt-BR" className="text-slate-900">Português</option>
          </select>
          <select
            className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-medium text-white"
            value=""
            onChange={(e) => {
              if (e.target.value) handleLoadExample(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="" className="text-slate-900">
              Carregar exemplo…
            </option>
            {Object.entries(EXAMPLES).map(([key, ex]) => (
              <option key={key} value={key} className="text-slate-900">
                {ex.label}
              </option>
            ))}
          </select>
          <Button variant="dark" onClick={() => downloadProjectFile(template, bindings)}>
            Salvar projeto
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-white/20">
            <IconFolderUp />
            Carregar projeto
            <input type="file" accept="application/json" onChange={handleImportProject} hidden />
          </label>
          <Button onClick={handleGenerate} disabled={generating}>
            <IconDownload /> {generating ? "Gerando..." : "Gerar PDF"}
          </Button>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 px-5 py-2 text-xs text-red-700">{error}</div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[320px] flex-col gap-4 overflow-y-auto border-r border-slate-200 bg-white p-3">
          <DataSourcePanel
            sources={sources}
            onChangeSources={setSources}
            onResync={handleResync}
            fieldCount={fields.length}
            errorsById={errorsById}
          />
          <FieldTree
            fields={fields}
            onOpenPicker={() => fieldPickerTriggerRef.current?.()}
          />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <PageTabs
            pages={pages}
            activeIndex={safeActivePageIndex}
            onSelect={setActivePageIndex}
            onAdd={handleAddPage}
            onRemove={handleRemovePage}
          />
          <div className="min-h-0 flex-1 overflow-auto p-4">
            <DesignerPanel
              key={activePage.id}
              fields={fields}
              template={activePage}
              bindings={bindings}
              onChangeTemplate={setActivePageTemplate}
              onChangeBindings={setBindings}
              openFieldPickerRef={fieldPickerTriggerRef}
              locale={locale}
            />
          </div>
        </main>
      </div>

      {previewBytes && (
        <PdfPreviewModal
          bytes={previewBytes}
          page={pages[0].page}
          onClose={() => setPreviewBytes(null)}
        />
      )}
    </div>
  );
}
