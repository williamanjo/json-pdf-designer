import { useRef, useState } from "react";
import type { Template, TemplatePage, Binding, Locale } from "json-pdf-designer";
import { generatePdf, DEFAULT_MAX_PAGES } from "json-pdf-designer";
import FieldTree from "./components/FieldTree";
import DesignerPanel from "./components/DesignerPanel";
import PageTabs from "./components/PageTabs";
import DataSourcePanel, { type JsonSource } from "./components/DataSourcePanel";
import ProblemsPanel from "./components/ProblemsPanel";
import GenerationErrorBanner from "./components/GenerationErrorBanner";
import PdfPreviewModal from "./components/PdfPreviewModal";
import { templateProblems } from "./lib/templateProblems";
import { describeGenerationError } from "./lib/generationError";
import { extractFields, type FieldNode } from "./lib/jsonExplorer";
import { loadDefaultFont } from "./lib/font";
import { uid } from "./lib/uid";
import { mergeSources, type SourceErrorCode } from "./lib/sources";
import { downloadProjectFile, parseProjectFile } from "./lib/projectFile";
import { ensurePages, blankPage } from "./lib/pages";
import { t } from "./i18n";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { loadAutosave, useAutosave } from "./hooks/useAutosave";
import { initialTemplate, initialBindings, initialSample } from "./data/initialTemplate";
import { EXAMPLES } from "./data/templates";

// The same features as the "report-builder" example, except that the whole
// shell (header, sidebar, cards, page tabs, panels, modals, buttons) is HTML +
// CSS written by hand in src/index.css — no Button/Card/Input/Badge/icon/
// PdfPreviewModal from the package. From json-pdf-designer only the pieces
// that are NOT chrome come in: <Designer>, <PdfPreview>, generatePdf,
// downloadPdf, I18nProvider, the error classes, the layout/warning helpers and
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
  // Each source's problem CODE, not the phrase — what translates is the
  // render, so that switching language does not leave the old message on screen.
  const [errorsById, setErrorsById] = useState<Record<string, SourceErrorCode>>({});
  // It holds the RAW ERROR, not the phrase. The translation happens at render
  // time (describeGenerationError, see lib/generationError.ts) — if we held the
  // phrase, an open banner would be frozen in the language of when the failure
  // happened and switching the picker would leave that residue on screen. The
  // wrapping object exists only because `null` is also a valid `unknown`.
  const [genError, setGenError] = useState<{ err: unknown } | null>(null);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [generating, setGenerating] = useState(false);
  // ONE language state for TWO layers: it goes as the `locale` prop to the
  // <Designer> (the editor's buttons/tabs/warnings) and feeds `t(locale)`,
  // this app's shell dictionary (src/i18n.ts). It affects neither the generated
  // PDF nor the sample templates' content — the interface's language is not
  // the document's language.
  const [locale, setLocale] = useState<Locale>("pt-BR");
  const d = t(locale);

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
    <>
      <header className="app-header">
        <h1>{d.appTitle}</h1>
        <div className="header-actions">
          {/* A language's name is NOT translated: each stays in its own
              language, which is the convention — whoever looks for "Português"
              does not look for "Portuguese". */}
          <select
            className="select"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            title={d.localeSelectTitle}
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
            <option value="">{d.loadExample}</option>
            {/* `ex.label` is NOT translated: it is the sample document's name
                ("Lei Kandir", "Boletim de Turma"), content, not a UI label.
                The report stays in Portuguese with the interface in
                English. */}
            {Object.entries(EXAMPLES).map(([key, ex]) => (
              <option key={key} value={key}>
                {ex.label}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-ghost" onClick={() => downloadProjectFile(template, bindings)}>
            {d.saveProject}
          </button>
          <label className="btn btn-ghost btn-file">
            ⭱ {d.loadProject}
            <input type="file" accept="application/json" onChange={handleImportProject} hidden />
          </label>
          <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
            ⭳ {generating ? d.generating : d.generatePdf}
          </button>
        </div>
      </header>

      {genError && (
        <GenerationErrorBanner
          problem={describeGenerationError(genError.err, locale)}
          locale={locale}
          onDismiss={() => setGenError(null)}
        />
      )}

      <div className="app-body">
        <aside className="sidebar">
          <DataSourcePanel
            sources={sources}
            onChangeSources={setSources}
            onResync={handleResync}
            fieldCount={fields.length}
            errorsById={errorsById}
            locale={locale}
          />
          <ProblemsPanel
            problems={problems}
            locale={locale}
            // The <Designer> owns the selection (there is no prop to drive it from
            // outside), so the click navigates to the field's PAGE — which is
            // as far as it can be taken today.
            onGoTo={(pageIndex) => setActivePageIndex(pageIndex)}
          />
          <FieldTree fields={fields} locale={locale} onOpenPicker={() => fieldPickerTriggerRef.current?.()} />
        </aside>

        <main className="designer-area">
          <PageTabs
            pages={pages}
            activeIndex={safeActivePageIndex}
            onSelect={setActivePageIndex}
            onAdd={handleAddPage}
            onRemove={handleRemovePage}
            locale={locale}
          />
          <div className="designer-scroll">
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
          // The 1st page's size, only for the modal's zoom computation — pages of
          // different sizes in the same Template still generate correctly, only
          // the initial "fit" uses the first as its reference.
          page={pages[0].page}
          locale={locale}
          onClose={() => setPreviewBytes(null)}
        />
      )}
    </>
  );
}
