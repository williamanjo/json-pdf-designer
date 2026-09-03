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

// Mesmas features do example "report-builder", só que a casca inteira
// (header, sidebar, cards, abas de página, painéis, modais, botões) é HTML +
// CSS escritos à mão em src/index.css — nenhum Button/Card/Input/Badge/
// ícone/PdfPreviewModal do pacote. Do json-pdf-designer só entram as peças
// que NÃO são chrome: <Designer>, <PdfPreview>, generatePdf, downloadPdf,
// I18nProvider, as classes de erro, os helpers de layout/aviso e os tipos.
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
  // Código do problema de cada fonte, não a frase — quem traduz é o render,
  // pra que trocar de idioma não deixe a mensagem antiga na tela.
  const [errorsById, setErrorsById] = useState<Record<string, SourceErrorCode>>({});
  // Guarda o ERRO CRU, não a frase. A tradução acontece no render
  // (describeGenerationError, ver lib/generationError.ts) — se guardássemos a
  // frase, um banner aberto ficaria congelado no idioma de quando a falha
  // aconteceu e trocar o seletor deixaria esse resíduo na tela. O objeto
  // envolvente existe só porque `null` também é um `unknown` válido.
  const [genError, setGenError] = useState<{ err: unknown } | null>(null);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [generating, setGenerating] = useState(false);
  // UM estado de idioma pra DUAS camadas: vai como prop `locale` pro
  // <Designer> (botões/abas/avisos do editor) e alimenta `t(locale)`, o
  // dicionário da casca deste app (src/i18n.ts). Não afeta o PDF gerado nem o
  // conteúdo dos templates de exemplo — idioma da interface não é idioma do
  // documento.
  const [locale, setLocale] = useState<Locale>("pt-BR");
  const d = t(locale);

  // Recalcula a cada render: é varredura de string sobre o template em memória,
  // barata o suficiente pra não valer memo — e assim o painel reage na hora em
  // que alguém digita uma expressão torta.
  const problems = templateProblems(template, bindings, locale);

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
    setGenError(null);
    setGenerating(true);
    try {
      const { data, errorsById: nextErrors } = mergeSources(sources);
      setErrorsById(nextErrors);
      const fontBytes = await loadDefaultFont();
      // `maxPages` explícito, no default do pacote: deixa claro que existe um
      // teto e que estourá-lo dá PageLimitError em vez de um PDF truncado.
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
      // parseProjectFile já chama migrateTemplate; um formato mais novo que
      // este build entende chega aqui como erro, e vira a mesma mensagem
      // acionável de qualquer outra falha.
      .catch((err: unknown) => setGenError({ err }));
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
    <>
      <header className="app-header">
        <h1>{d.appTitle}</h1>
        <div className="header-actions">
          {/* Nome de idioma NÃO se traduz: cada um fica no próprio idioma, que
              é a convenção — quem procura "Português" não procura por
              "Portuguese". */}
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
            {/* `ex.label` NÃO é traduzido: é o nome do documento de exemplo
                ("Lei Kandir", "Boletim de Turma"), conteúdo, não rótulo de
                UI. O relatório continua em português com a interface em
                inglês. */}
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
            // O <Designer> é dono da seleção (não há prop pra dirigi-la de
            // fora), então o clique navega até a PÁGINA do campo — é o mais
            // longe que dá pra levar hoje.
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
          // Tamanho da 1ª página só pro cálculo de zoom do modal — páginas
          // de tamanhos diferentes no mesmo Template continuam gerando
          // certo, só o "fit" inicial usa a primeira como referência.
          page={pages[0].page}
          locale={locale}
          onClose={() => setPreviewBytes(null)}
        />
      )}
    </>
  );
}
