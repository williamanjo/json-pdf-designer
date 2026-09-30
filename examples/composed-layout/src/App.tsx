import { useState } from "react";
import {
  CURRENT_TEMPLATE_VERSION,
  DEFAULT_MAX_PAGES,
  DesignerBindingEditor,
  DesignerCanvas,
  DesignerFieldList,
  DesignerFilterPanel,
  DesignerInspector,
  DesignerPageSettings,
  DesignerPropertyPanel,
  DesignerProvider,
  DesignerToolbar,
  I18nProvider,
  IconDownload,
  IconFolderUp,
  dictFor,
  generatePdf,
  type Binding,
  type Locale,
  type Template,
  type TemplatePage,
} from "json-pdf-designer";
// The preview (pdf.js) lives in the "/preview" entry — the OPTIONAL peer
// pdfjs-dist, installed by this example precisely because it uses the preview.
// (examples/no-preview is the opposite: it forbids the package and has a build check.)
import { PdfPreviewModal } from "json-pdf-designer/preview";
import DataSourcePanel, { type JsonSource } from "./components/DataSourcePanel";
import FieldTree from "./components/FieldTree";
import GenerationErrorBanner from "./components/GenerationErrorBanner";
import PageTabs from "./components/PageTabs";
import ZoomBar from "./components/ZoomBar";
import ProblemsPanel from "./components/ProblemsPanel";
import { EXAMPLES } from "./data/templates";
import { t } from "./i18n";
import { loadAutosave, useAutosave } from "./hooks/useAutosave";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { addFieldToCanvas, dataSourcesFromFields } from "./lib/addField";
import { loadDefaultFont } from "./lib/font";
import { describeGenerationError, type GenerationProblem } from "./lib/generationError";
import { extractFields, type FieldNode } from "./lib/jsonExplorer";
import { blankPage, ensurePages } from "./lib/pages";
import { downloadProjectFile, parseProjectFile } from "./lib/projectFile";
import { mergeSources, type SourceErrorCode } from "./lib/sources";
import { templateProblems } from "./lib/templateProblems";
import { uid } from "./lib/uid";
import { bindings as initialBindings, sample as initialSample, template as initialTemplate } from "./data";

// The editor assembled PART BY PART, without the <Designer> component.
//
// The layout here is impossible with the preset: a full-width toolbar on
// top, a data column on the left, the canvas in the middle (with the page
// tabs above it), and a right-hand column with SIX stacked panels — which
// inside the <Designer> would be five different tabs (Data, Style, Filter,
// Binding, Page, Inspector), with "Data" and "Style" being TWO instances of
// the same part.
//
// That is why the tab gate is opt-in: NO part here receives `whenTab`, so
// they all render at the same time. If `whenTab` were the default, this
// right-hand column would show one panel and erase the other five. And there
// is no `<DesignerSidebar>` or `<DesignerTabBar>` anywhere — the only tabs on
// screen are the PAGE ones, which are this app's state, not the editor's.
//
// `expandOnSelect={false}` because there is no sidebar to reopen — the
// provider should not try.
export default function App() {
  // The autosave is read ONCE, on the first render (`useState(fn)` as a lazy
  // initializer) — not on every render.
  const [autosaved] = useState(loadAutosave);
  const [template, setTemplate] = useState<Template>(() => ensurePages(autosaved?.template ?? initialTemplate));
  const [bindings, setBindings] = useState<Binding[]>(() => autosaved?.bindings ?? initialBindings);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [sources, setSources] = useState<JsonSource[]>(
    // "principal" does NOT come from the dictionary: a data source's name is
    // DATA — it goes into the autosave and the saved project, and changing
    // identity because someone switched the UI language would be wrong.
    () => autosaved?.sources ?? [{ id: uid(), name: "principal", raw: JSON.stringify(initialSample, null, 2) }]
  );
  const [fields, setFields] = useState<FieldNode[]>(() => {
    if (autosaved?.sources) return extractFields(mergeSources(autosaved.sources).data);
    return extractFields(initialSample);
  });
  const [errorsById, setErrorsById] = useState<Record<string, SourceErrorCode>>({});
  // The RAW error, not the finished phrase: `describeGenerationError` runs at
  // render time (just below), so switching language with the banner open
  // retranslates the banner instead of leaving the old message on screen. A box
  // (`{ err }`) instead of the loose value because `null` is a possible error.
  const [genErrorBox, setGenErrorBox] = useState<{ err: unknown } | null>(null);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [generating, setGenerating] = useState(false);
  // ONE language state, TWO layers of text: this app's shell (through
  // `t(locale)`, see src/i18n.ts) and the editor's UI. In the <Designer> the
  // second would be the `locale` prop; assembling by hand, it comes from the
  // <I18nProvider> outside the <DesignerProvider> — the responsibility of
  // whoever assembles. Neither of the two affects the generated PDF.
  const [locale, setLocale] = useState<Locale>("pt-BR");

  const ui = t(locale);
  // The PACKAGE's dictionary as a VALUE (`useT()` only works inside the
  // provider, and this component is outside it). The labels of the right-hand
  // cards come from here because the CONCEPT belongs to the package: they are
  // the <Designer>'s tabs ("Data", "Style", "Filter", "Page", "Inspector") and
  // the binding editor's title. Duplicating the translation would create two
  // texts to fall out of sync; only the qualifier ("of the field", "of rows")
  const pacote = dictFor(locale);

  // Recomputed on every render: it is a string scan over the in-memory
  // template, cheap enough not to be worth a memo — and that way the panel
  // reacts the moment someone types a crooked expression.
  const problems = templateProblems(template, bindings, locale);
  const genError: GenerationProblem | null = genErrorBox ? describeGenerationError(genErrorBox.err, locale) : null;

  useUndoRedo(template, bindings, setTemplate, setBindings);
  useAutosave(template, bindings, sources);

  // `template.pages` always exists and is never empty (guaranteed by
  // ensurePages everywhere the whole `template` is swapped) — it clamps the
  // index so it never points outside the array (e.g. after removing the last
  // selected tab, or loading a project/example with fewer pages).
  const pages = template.pages!;
  const safeActivePageIndex = Math.min(activePageIndex, pages.length - 1);
  const activePage = pages[safeActivePageIndex];

  // It forwards only the ACTIVE page to the <DesignerProvider> — the parts do
  // not know other pages exist, they only edit the one they received. It
  // writes back into template.pages[safeActivePageIndex], keeping the rest of
  // the Template intact (including the other pages).
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

  // It only recomputes the field list when someone clicks "Resync fields" —
  // that way a large JSON can be pasted without the tree flickering on every keystroke.
  function handleResync() {
    const { data, errorsById: nextErrors } = mergeSources(sources);
    setFields(extractFields(data));
    setErrorsById(nextErrors);
  }

  function handleFieldDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    addFieldToCanvas(JSON.parse(raw) as FieldNode, {
      template: activePage,
      bindings,
      setTemplate: setActivePageTemplate,
      setBindings,
    });
  }

  async function handleGenerate() {
    setGenErrorBox(null);
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
      // Generation THROWS in some cases (a glyph outside the font, the page
      // ceiling, an invalid page size). Without this catch the promise rejects
      // unhandled and the button stays stuck on "Generating…".
      //
      // No raw `err.message`: describeGenerationError delegates to the
      // package's `describePdfError`, which returns a structured `code`/`blame`
      // plus an already-localized title and action. See "Failure modes" in the
      // docs. It is called at RENDER time, not here, so the phrase follows the
      // language picker — the state holds only the error.
      setGenErrorBox({ err });
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
        setGenErrorBox(null);
      })
      // parseProjectFile already calls migrateTemplate; a format newer than this
      // build understands arrives here as an error, and becomes the same
      // actionable message as any other failure.
      .catch((err: unknown) => setGenErrorBox({ err }));
  }

  // Ready-made examples — each one swaps template/binding AND the data source
  // for its own sample JSON, already syncing the field tree without having to
  // click "Resync".
  function handleLoadExample(key: string) {
    const example = EXAMPLES[key];
    if (!example) return;
    setTemplate(ensurePages(example.template));
    setBindings(example.bindings);
    setActivePageIndex(0);
    setSources([{ id: uid(), name: example.sourceName, raw: JSON.stringify(example.sample, null, 2) }]);
    setFields(extractFields(example.sample));
    setErrorsById({});
    setPreviewBytes(null);
  }

  return (
    <div className="app">
      {/* The header sits OUTSIDE the provider: nothing in it reads the
          editor's state, so switching pages (which remounts the provider, see
          `key` below) does not disturb the controls here. */}
      <header className="app-top">
        <h1>
          {/* The example's name is not translated — it is the folder's name. */}
          composed-layout
          <small>{ui.subtitulo}</small>
          <span className="app-version" title={ui.formatoTitle}>
            {ui.formato(CURRENT_TEMPLATE_VERSION, DEFAULT_MAX_PAGES)}
          </span>
        </h1>

        <div className="app-top__actions">
          {/* Undo/redo is the useUndoRedo hook: a global keyboard shortcut, no
              button. It is written here because an invisible shortcut is a
              shortcut nobody uses. */}
          <span className="app-chip" title={ui.undoRedoTitle}>
            {/* A keyboard shortcut: notation, not text — the same in both languages. */}
            ⌃Z / ⌃Y
          </span>
          {/* Autosave is the useAutosave hook: localStorage, a 500ms debounce. */}
          <span className="app-chip" title={ui.autosaveTitle}>
            {ui.autosaveChip}
          </span>

          {/* The ONLY language picker: the same `locale` feeds `t(locale)`
              (the shell) and the <I18nProvider> (the editor's UI). The
              language names each stay in their OWN language, as is the
              convention — they are not translated. */}
          <select className="app-select" value={locale} onChange={(e) => setLocale(e.target.value as Locale)} title={ui.idiomaTitle}>
            <option value="pt-BR">Português</option>
            <option value="en">English</option>
          </select>

          <select
            className="app-select"
            value=""
            onChange={(e) => {
              if (e.target.value) handleLoadExample(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">{ui.carregarExemplo}</option>
            {/* `ex.label` is NOT translated: it is the sample template's name
                (data/templates/), that is, content — "Recibo de pagamento"
                stays in Portuguese with the UI in English, in the same way as
                the PDF it generates. */}
            {Object.entries(EXAMPLES).map(([key, ex]) => (
              <option key={key} value={key}>
                {ex.label}
              </option>
            ))}
          </select>

          <button type="button" className="app-btn app-btn--dark" onClick={() => downloadProjectFile(template, bindings)}>
            {ui.salvarProjeto}
          </button>
          <label className="app-btn app-btn--dark">
            <IconFolderUp /> {ui.carregarProjeto}
            <input type="file" accept="application/json" onChange={handleImportProject} hidden />
          </label>

          <button type="button" className="app-generate" onClick={handleGenerate} disabled={generating}>
            <IconDownload /> {generating ? ui.gerando : ui.gerarPdf}
          </button>
        </div>
      </header>

      {/* It sits OUTSIDE the <I18nProvider> — one of the two reasons the
          shell receives `locale` as a prop instead of calling `useLocale()`. */}
      {genError && <GenerationErrorBanner problem={genError} onDismiss={() => setGenErrorBox(null)} locale={locale} />}

      {/* The <I18nProvider> is explicit because the `locale` prop belonged
          to the preset; assembling by hand, the language is the
          responsibility of whoever assembles. It goes OUTSIDE the
          DesignerProvider — the parts read the dictionary through `useT()`.
          It is the SAME `locale` from state that the shell uses: one picker,
          two dictionaries (ours and the package's), zero manual syncing. */}
      <I18nProvider locale={locale}>
        <DesignerProvider
          // Switching page is switching document: without the `key`, the
          // editor's internal selection would keep pointing at a schema that
          // no longer exists on the new page.
          key={activePage.id}
          template={activePage}
          onChangeTemplate={setActivePageTemplate}
          bindings={bindings}
          onChangeBindings={setBindings}
          onCanvasDrop={handleFieldDrop}
          // The binding editor's "Data Source" dropdown, built from what the
          // explorer found in the loaded JSON.
          dataSources={dataSourcesFromFields(fields)}
          expandOnSelect={false}
        >
          {/* The toolbar takes the full width, which the preset never does
              (there it lives at the foot of the sidebar). `hint={false}`
              because the sentence "select a field in the list" has no referent
              here — the list is in the other column. */}
          <DesignerToolbar className="app-toolbar" hint={false} />

          <div className="app-body">
            <aside className="app-left">
              <DataSourcePanel
                sources={sources}
                onChangeSources={setSources}
                onResync={handleResync}
                fieldCount={fields.length}
                errorsById={errorsById}
                locale={locale}
              />
              <FieldTree
                fields={fields}
                locale={locale}
                onAdd={(field) =>
                  addFieldToCanvas(field, {
                    template: activePage,
                    bindings,
                    setTemplate: setActivePageTemplate,
                    setBindings,
                  })
                }
              />
              <section className="app-card">
                <h2 className="app-h2">{ui.noCanvas(pacote.fieldsPanel.heading)}</h2>
                {/* A part of the package — it lists the schemas ALREADY placed
                    (the FieldTree above lists the JSON's paths, which is
                    another thing). `heading={false}`: the title is already
                    above, in its own CSS. `parts.scroll` overrides the list's
                    maximum height — inside the <Designer> it is short because
                    it shares the sidebar with the toolbar; here the column is
                    all its own. */}
                <DesignerFieldList heading={false} parts={{ scroll: "app-list-scroll" }} />
              </section>
            </aside>

            <div className="app-center">
              <PageTabs
                pages={pages}
                activeIndex={safeActivePageIndex}
                onSelect={setActivePageIndex}
                onAdd={handleAddPage}
                onRemove={handleRemovePage}
                locale={locale}
              />
              {/* THIS APP'S ZOOM BAR, outside the canvas — the case 3.1.0
                  unlocked. `hideZoombar` hides the package's, which is
                  `position: sticky` inside the canvas and therefore had no way
                  out of it through CSS. See components/ZoomBar.tsx. */}
              <ZoomBar locale={locale} />
              {/* The canvas owns the sheet's geometry; THIS box is the
                  viewport that scrolls, and it is ours. */}
              <DesignerCanvas className="app-canvas" hideZoombar />
            </div>

            <aside className="app-right">
              {/* The two halves of the property panel, STACKED — which is what
                  the `section` prop exists to allow. Inside the <Designer>
                  they are the "Data" and "Style" tabs. */}
              {/* The SEVEN labels of this column: the noun comes from the
                  PACKAGE's dictionary (`pacote.*`) because it is the name the
                  <Designer> gives the same part; the qualifier comes from ours. */}
              <section className="app-card">
                <h2 className="app-h2">{ui.doCampo(pacote.tabBar.data)}</h2>
                <DesignerPropertyPanel section="dados" />
              </section>

              <section className="app-card">
                <h2 className="app-h2">{ui.doCampo(pacote.tabBar.style)}</h2>
                {/* `header={false}` so as not to repeat the field's name, which
                    already appears on the card above. */}
                <DesignerPropertyPanel section="estilo" header={false} />
              </section>

              <section className="app-card">
                {/* This one comes WHOLE from the package: it is the title the
                    part itself uses when `heading` is on. */}
                <h2 className="app-h2">{pacote.bindingEditor.title}</h2>
                {/* This part does NOT exist inside the <Designer> as a block of
                    its own: there the binding editor appears nested in each
                    field type's panel. It is one of the two that
                    examples/headless-designer said it had to give up. */}
                <DesignerBindingEditor />
              </section>

              <section className="app-card">
                <h2 className="app-h2">{ui.deLinhas(pacote.tabBar.filter)}</h2>
                {/* The other of the two. Inside the <Designer> it is the
                    "Filter" tab, which only exists while a field with an array
                    binding is selected. */}
                <DesignerFilterPanel />
              </section>

              <section className="app-card">
                {/* With no qualifier at all: it is the <Designer>'s "Page" tab,
                    word for word. */}
                <h2 className="app-h2">{pacote.tabBar.page}</h2>
                <DesignerPageSettings />
              </section>

              <section className="app-card">
                <h2 className="app-h2">{pacote.tabBar.inspector}</h2>
                <DesignerInspector />
              </section>

              {/* It closes the stack: it is the only card that speaks about the
                  WHOLE template (every page), while the six above speak about
                  the selected field or the current page. */}
              <ProblemsPanel
                problems={problems}
                // The parts own the selection (there is no prop to drive it from
                // outside), so the click navigates to the field's PAGE — which
                // is as far as it can be taken today.
                onGoTo={(pageIndex) => setActivePageIndex(pageIndex)}
                locale={locale}
              />
            </aside>
          </div>
        </DesignerProvider>
      </I18nProvider>

      {previewBytes && (
        <PdfPreviewModal bytes={previewBytes} page={pages[0].page} name="composed-layout" onClose={() => setPreviewBytes(null)} />
      )}
    </div>
  );
}
