import { useRef, useState } from "react";
import type { Template, TemplatePage, Binding, Locale } from "json-pdf-designer";
import { generatePdf, Button, IconDownload, IconFolderUp, CURRENT_TEMPLATE_VERSION, DEFAULT_MAX_PAGES } from "json-pdf-designer";
// The preview (pdf.js) lives in the "/preview" entry — the optional peer
// pdfjs-dist, installed by this example precisely because it uses the preview.
import { PdfPreviewModal } from "json-pdf-designer/preview";
import FieldTree from "./components/FieldTree";
import DesignerPanel from "./components/DesignerPanel";
import PageTabs from "./components/PageTabs";
import DataSourcePanel, { type JsonSource } from "./components/DataSourcePanel";
import ProblemsPanel from "./components/ProblemsPanel";
import GenerationErrorBanner from "./components/GenerationErrorBanner";
import { templateProblems } from "./lib/templateProblems";
import { describeGenerationError } from "./lib/generationError";
import { extractFields, type FieldNode } from "./lib/jsonExplorer";
import { loadDefaultFont } from "./lib/font";
import { uid } from "./lib/uid";
import { mergeSources, type SourceProblem } from "./lib/sources";
import { downloadProjectFile, parseProjectFile } from "./lib/projectFile";
import { ensurePages, blankPage } from "./lib/pages";
import { t } from "./i18n";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { loadAutosave, useAutosave } from "./hooks/useAutosave";
import { initialTemplate, initialBindings, initialSample } from "./data/initialTemplate";
import { EXAMPLES } from "./data/templates";
import "json-pdf-designer/theme.css";
import "./App.css";

export default function App() {
  const fieldPickerTriggerRef = useRef<(() => void) | null>(null);
  const [autosaved] = useState(loadAutosave);
  // ONE language state for the TWO layers: it goes to the editor's
  // `<I18nProvider>` (the package's buttons/tabs/warnings) AND to this app's
  // shell dictionary (`tx`). It does not affect the generated PDF — the
  // document's language is the data's.
  const [locale, setLocale] = useState<Locale>("en");
  const tx = t(locale);
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
  // The REASON for each source's error, not the phrase — the phrase is
  // chosen at render time (see lib/sources.ts). Translated text held in state
  // does not react to a language switch.
  const [errorsById, setErrorsById] = useState<Record<string, SourceProblem>>({});
  // It holds the RAW error, not the already-assembled `GenerationProblem`,
  // for the same reason: the banner's title/action is chosen at render time,
  // with the current `locale`, so switching language retranslates the banner
  // already on screen.
  const [genError, setGenError] = useState<{ err: unknown } | null>(null);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [generating, setGenerating] = useState(false);

  // Recomputed on every render: it is a string scan over the in-memory
  // template, cheap enough not to be worth a memo — and that way the panel
  // reacts the moment someone types a crooked expression.
  const problems = templateProblems(template, bindings, locale);

  useUndoRedo(template, bindings, setTemplate, setBindings);
  useAutosave(template, bindings, sources);

  // `template.pages` always exists and is never empty (guaranteed by
  // ensurePages everywhere the whole `template` is swapped) — it clamps the
  // index so it never points outside the array (e.g. after removing the last
  // selected tab, or loading a project/example with fewer pages).
  const pages = template.pages!;
  const safeActivePageIndex = Math.min(activePageIndex, pages.length - 1);
  const activePage = pages[safeActivePageIndex];

  // It forwards only the ACTIVE page to the <Designer> (through
  // DesignerPanel) — the Designer does not know other pages exist, it only
  // edits the one it received. It writes back into
  // template.pages[safeActivePageIndex], keeping the rest of the Template intact.
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
    setActivePageIndex(pages.length); // a new page goes to the end
  }

  function handleRemovePage(index: number) {
    if (pages.length <= 1) return;
    setTemplate((prev) => ({ ...prev, pages: prev.pages!.filter((_, i) => i !== index) }));
    setActivePageIndex((prevIndex) => Math.max(0, prevIndex >= index ? prevIndex - 1 : prevIndex));
  }

  // It only recomputes the field list when the user clicks "Resync fields" —
  // that way they can paste a large JSON without the list flickering on every
  // keystroke.
  function handleResync() {
    const { data, errorsById: nextErrors } = mergeSources(sources);
    setFields(extractFields(data));
    setErrorsById(nextErrors);
  }

  async function handleGenerate() {
    setGenError(null);
    setGenerating(true);
    try {
      const { data, errorsById: nextErrors } = mergeSources(sources);
      setErrorsById(nextErrors);
      const fontBytes = await loadDefaultFont();
      // An explicit `maxPages`, at the package's default: it makes clear that a
      // ceiling exists and that going past it gives a PageLimitError instead
      // of a truncated PDF.
      const bytes = await generatePdf(template, data, bindings, { fontBytes, maxPages: DEFAULT_MAX_PAGES });
      setPreviewBytes(bytes);
    } catch (err) {
      setGenError({ err });
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
        setGenError(null);
      })
      // parseProjectFile already calls migrateTemplate; a format newer than this
      // build understands arrives here as an error, and becomes the same
      // actionable message as any other failure.
      .catch((err: unknown) => setGenError({ err }));
  }

  // Ready-made examples — each one swaps template/binding AND the data source
  // for its own sample JSON, already syncing the field list (fields) without
  // having to click "Resync".
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
        <h1 className="flex items-baseline gap-2 text-lg font-semibold">
          {tx.appTitle}
          {/* The template FORMAT's version (not the package's) — what a saved
              project carries, and what migrateTemplate normalizes on load.
              The NUMBERS come from the package; only the sentence's frame is
              translated, and in a single function (not concatenated in the
              JSX) because the order changes. */}
          <span className="text-[10px] font-normal text-white/50" title={tx.formatBadgeTitle}>
            {tx.formatBadge(CURRENT_TEMPLATE_VERSION, DEFAULT_MAX_PAGES)}
          </span>
        </h1>
        <div className="flex gap-2">
          <select
            className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-medium text-white"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            title={tx.localeTitle}
          >
            {/* A language's name is NOT translated: each stays in its own language. */}
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
              {tx.loadExample}
            </option>
            {/* `ex.label` is NOT translated: it is the sample document's name
                ("Lei Kandir", "Boletim de Turma") — content, not interface.
                The report stays in Portuguese with the UI in English. */}
            {Object.entries(EXAMPLES).map(([key, ex]) => (
              <option key={key} value={key} className="text-slate-900">
                {ex.label}
              </option>
            ))}
          </select>
          <Button variant="dark" onClick={() => downloadProjectFile(template, bindings)}>
            {tx.saveProject}
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-white/20">
            <IconFolderUp />
            {tx.loadProject}
            <input type="file" accept="application/json" onChange={handleImportProject} hidden />
          </label>
          <Button onClick={handleGenerate} disabled={generating}>
            <IconDownload /> {generating ? tx.generating : tx.generatePdf}
          </Button>
        </div>
      </header>

      {/* No raw `err.message`: describeGenerationError delegates to the
          package's `describePdfError`, which returns a title + what to do +
          whose fault it is, classified by `code` — in the language of NOW, not
          of when the error happened. */}
      {genError && (
        <GenerationErrorBanner
          locale={locale}
          problem={describeGenerationError(genError.err, locale)}
          onDismiss={() => setGenError(null)}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[320px] flex-col gap-4 overflow-y-auto border-r border-slate-200 bg-white p-3">
          <DataSourcePanel
            locale={locale}
            sources={sources}
            onChangeSources={setSources}
            onResync={handleResync}
            fieldCount={fields.length}
            errorsById={errorsById}
          />
          <ProblemsPanel
            locale={locale}
            problems={problems}
            // The <Designer> owns the selection (there is no prop to drive it from
            // outside), so the click navigates to the field's PAGE — which is
            // as far as it can be taken today.
            onGoTo={(pageIndex) => setActivePageIndex(pageIndex)}
          />
          <FieldTree
            locale={locale}
            fields={fields}
            onOpenPicker={() => fieldPickerTriggerRef.current?.()}
          />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <PageTabs
            locale={locale}
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
