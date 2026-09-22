// It generates and downloads, with no preview at all — and, above all,
// WITHOUT pdfjs-dist installed (see this folder's README.md). It imports only
// from the main entry "json-pdf-designer"; nothing from
// "json-pdf-designer/preview".
//
// The features are the same as examples/report-builder — data sources, a field
// explorer, ready-made examples, undo/redo, autosave, a project file, multiple
// pages, a problems panel, a translated generation error, a language picker —
// MINUS the PDF preview, which is forbidden here by design. What changes is
// the shell: plain CSS with `--app-*` variables in both themes, and the editor
// assembled by the `<Designer>` preset.
//
// The language picker swaps TWO layers with the same value: the editor
// (through the `<Designer>`'s `locale` prop) and this app's shell (through
// src/i18n.ts's `t(locale)`). No second state and no second picker.
import { useEffect, useRef, useState } from "react";
import type { Binding, Locale, Template, TemplatePage } from "json-pdf-designer";
import { CURRENT_TEMPLATE_VERSION, DEFAULT_MAX_PAGES, downloadPdf, generatePdf, withInlineCode } from "json-pdf-designer";
import DataSourcePanel, { type JsonSource } from "./components/DataSourcePanel";
import DesignerPanel from "./components/DesignerPanel";
import FieldTree from "./components/FieldTree";
import GenerationErrorBanner from "./components/GenerationErrorBanner";
import PageTabs from "./components/PageTabs";
import ProblemsPanel from "./components/ProblemsPanel";
import { loadAutosave, useAutosave } from "./hooks/useAutosave";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { describeGenerationError } from "./lib/generationError";
import { loadDefaultFont } from "./lib/font";
import { extractFields, type FieldNode } from "./lib/jsonExplorer";
import { blankPage, ensurePages } from "./lib/pages";
import { downloadProjectFile, parseProjectFile } from "./lib/projectFile";
import { mergeSources, type SourceErrorCode } from "./lib/sources";
import { templateProblems } from "./lib/templateProblems";
import { uid } from "./lib/uid";
import { initialBindings, initialSample, initialTemplate } from "./data/initialTemplate";
import { EXAMPLES } from "./data/templates";
// The SHELL's dictionary — the same `locale` from state feeds it and the
// `<Designer>`. See the long comment in src/i18n.ts.
import { t } from "./i18n";

// The theme is ONE attribute on the `<html>`, and it drives the editor AND
// this shell: the package's `theme.css` redefines the `--jpd-*` under
// `[data-jpd-theme="dark"]`, and index.css's `--app-*` variables follow the
// same key.
//
// `.dark` works too, as a 2.x alias. We use the attribute because it is the
// documented hook.
//
// Deliberately no media query: the package does not turn light-only because
// the OS is dark, nor dark because the OS is. Whoever wants to follow the OS
// reads `matchMedia("(prefers-color-scheme: dark)")` and writes the attribute
// — what this example does is precisely to keep the decision explicit.
type Tema = "light" | "dark";
const TEMA_KEY = "no-preview:tema";

// The UI's initial language (editor + shell). A module constant because the
// `useState` initializer for `fields` already needs it — it runs BEFORE the
// line that declares the `locale` state, and reading the variable in there
// would give a ReferenceError.
const LOCALE_INICIAL: Locale = "pt-BR";

function temaInicial(): Tema {
  try {
    const salvo = localStorage.getItem(TEMA_KEY);
    if (salvo === "light" || salvo === "dark") return salvo;
  } catch {
    // modo privado / storage bloqueado — segue no default
  }
  // THIS example's default is dark: it is the only thing in the repo that
  // exercises the editor's dark mode, so it starts in that mode.
  return "dark";
}

export default function App() {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    document.documentElement.setAttribute("data-jpd-theme", tema);
    try {
      localStorage.setItem(TEMA_KEY, tema);
    } catch {
      // idem
    }
  }, [tema]);

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
  const [errorsById, setErrorsById] = useState<Record<string, SourceErrorCode>>({});
  // The RAW error, not the already-formed message. `describeGenerationError`
  // runs at render time (below), so switching the language with the banner open
  // retranslates the banner on the spot — holding the finished text would
  // freeze it in the language the failure happened in.
  const [genErrorRaw, setGenErrorRaw] = useState<{ err: unknown } | null>(null);
  const [generating, setGenerating] = useState(false);
  // The name of the last downloaded file — the only "receipt" this example
  // can give, since there is no preview to visually confirm what came out.
  const [lastDownload, setLastDownload] = useState<string | null>(null);
  // The UI's language: it feeds the `<Designer locale>` (the editor's
  // buttons/tabs/warnings) AND the shell's `t(locale)`. One picker, two
  // dictionaries — and it does not affect the generated PDF, which is a
  // document, not an interface.
  const [locale, setLocale] = useState<Locale>(LOCALE_INICIAL);
  const s = t(locale);

  // The generation failure already TRANSLATED (see lib/generationError.ts) —
  // not the error's raw message. The package exports the errors as classes
  // precisely for this; the `locale` chooses the actionable text's language.
  const genError = genErrorRaw ? describeGenerationError(genErrorRaw.err, locale) : null;

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
    setGenErrorRaw(null);
    setLastDownload(null);
    setGenerating(true);
    try {
      const { data, errorsById: nextErrors } = mergeSources(sources);
      setErrorsById(nextErrors);
      const fontBytes = await loadDefaultFont();
      // The example's point: generatePdf returns the bytes and downloadPdf
      // hands over the file. No intermediate step renders the PDF on screen,
      // so nothing here needs pdf.js. Whoever wants to check the margins
      // before downloading uses the <PdfPreviewModal> from
      // "json-pdf-designer/preview" (and then does install pdfjs-dist).
      //
      // An explicit `maxPages`, at the package's default: it makes clear that
      // a ceiling exists and that going past it gives a PageLimitError instead
      // of a truncated PDF.
      const bytes = await generatePdf(template, data, bindings, { fontBytes, maxPages: DEFAULT_MAX_PAGES });
      const name = "relatorio.pdf";
      downloadPdf(bytes, name);
      setLastDownload(`${name} — ${(bytes.byteLength / 1024).toFixed(1)} KB`);
    } catch (err) {
      // Sem `err.message` cru: describeGenerationError decide por `instanceof`
      // na classe exportada e devolve título + o que fazer + de quem é a culpa.
      setGenErrorRaw({ err });
    } finally {
      setGenerating(false);
    }
  }

  function handleImportProject(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // `locale` também aqui: as mensagens de arquivo de projeto inválido são
    // NOSSAS (ver lib/projectFile.ts), não do pacote.
    parseProjectFile(file)
      .then(({ template, bindings }) => {
        setTemplate(ensurePages(template));
        setBindings(bindings);
        setActivePageIndex(0);
        setGenErrorRaw(null);
      })
      // parseProjectFile já chama migrateTemplate; um formato mais novo que
      // este build entende chega aqui como erro, e vira a mesma mensagem
      // acionável de qualquer outra falha.
      .catch((err: unknown) => setGenErrorRaw({ err }));
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
    setGenErrorRaw(null);
    setLastDownload(null);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__brand">
          <h1>
            {s.header.title}
            {/* Versão do FORMATO do template (não do pacote) — o que um projeto
                salvo carrega, e o que o migrateTemplate normaliza ao carregar.
                Os dois números entram pela FUNÇÃO do dicionário: em inglês o
                sufixo muda de lado ("até N páginas" / "up to N pages"), e
                concatenar no JSX congelaria a ordem do português. */}
            <span className="app-header__badge" title={s.header.formatBadgeTitle}>
              {s.header.formatBadge(CURRENT_TEMPLATE_VERSION, DEFAULT_MAX_PAGES)}
            </span>
          </h1>
          {/* `withInlineCode` é export público do pacote: troca cada trecho em
              `backtick` do dicionário por um <code> de verdade. Reusado em vez
              de picar a frase em pedaços de JSX — assim a tradução inteira
              cabe numa entrada só e pode reordenar as palavras. */}
          <p>{withInlineCode(s.header.subtitle)}</p>
        </div>

        <div className="app-header__actions">
          <select
            className="app-header__control"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            title={s.header.localeTitle}
          >
            {/* Nome de idioma NÃO se traduz: cada um fica no próprio idioma,
                como é convenção. */}
            <option value="en">English</option>
            <option value="pt-BR">Português</option>
          </select>
          <select
            className="app-header__control"
            value=""
            onChange={(e) => {
              if (e.target.value) handleLoadExample(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">{s.header.loadExample}</option>
            {/* `ex.label` NÃO passa pelo dicionário: é o nome do template de
                exemplo, ou seja, DADO — "Recibo", "Kandir", "Turma" seguem
                iguais com a UI em inglês, como o conteúdo deles. */}
            {Object.entries(EXAMPLES).map(([key, ex]) => (
              <option key={key} value={key}>
                {ex.label}
              </option>
            ))}
          </select>
          <button type="button" className="app-header__control" onClick={() => downloadProjectFile(template, bindings)}>
            {s.header.saveProject}
          </button>
          <label className="app-header__control app-header__control--file">
            ⭱ {s.header.loadProject}
            <input type="file" accept="application/json" onChange={handleImportProject} hidden />
          </label>
          {/* O toggle de tema é casca NOSSA — o glifo ☀/☾ é universal, o texto
              e o `aria-label` ao lado dele entram na tradução. */}
          <button
            type="button"
            className="app-header__control"
            onClick={() => setTema((atual) => (atual === "dark" ? "light" : "dark"))}
            aria-label={tema === "dark" ? s.header.toLight : s.header.toDark}
          >
            {tema === "dark" ? `☀ ${s.header.light}` : `☾ ${s.header.dark}`}
          </button>
        </div>
      </header>

      {genError && <GenerationErrorBanner problem={genError} onDismiss={() => setGenErrorRaw(null)} locale={locale} />}

      <div className="app-body">
        <aside className="app-sidebar">
          {/* Gerar vem PRIMEIRO na coluna, não por hierarquia visual: a
              barra rola (`overflow-y: auto`) e este é o único botão sem o
              qual o example não prova nada. Enterrado embaixo do
              explorador de campos, ele saía da área visível numa tela
              baixa. */}
          <div className="app-generate">
            <button type="button" className="app-btn app-btn--primary" onClick={handleGenerate} disabled={generating}>
              {generating ? s.generate.running : `⭳ ${s.generate.idle}`}
            </button>
            {/* O nome do arquivo ("relatorio.pdf") e o tamanho entram na
                mensagem como estão — nome de arquivo é dado, não interface. */}
            {lastDownload && <p className="app-status is-ok">{s.generate.downloaded(lastDownload)}</p>}
            <p className="app-hint">{withInlineCode(s.generate.hint)}</p>
          </div>

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
            // O <Designer> é dono da seleção (não há prop pra dirigi-la de
            // fora), então o clique navega até a PÁGINA do campo — é o mais
            // longe que dá pra levar hoje.
            onGoTo={(pageIndex) => setActivePageIndex(pageIndex)}
            locale={locale}
          />
          <FieldTree fields={fields} onOpenPicker={() => fieldPickerTriggerRef.current?.()} locale={locale} />
        </aside>

        <main className="app-main">
          <PageTabs
            pages={pages}
            activeIndex={safeActivePageIndex}
            onSelect={setActivePageIndex}
            onAdd={handleAddPage}
            onRemove={handleRemovePage}
            locale={locale}
          />
          <div className="app-canvas-scroll">
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
    </div>
  );
}
