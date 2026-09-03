import { useRef, useState } from "react";
import type { Template, TemplatePage, Binding, Locale } from "json-pdf-designer";
import { generatePdf, Button, IconDownload, IconFolderUp, CURRENT_TEMPLATE_VERSION, DEFAULT_MAX_PAGES } from "json-pdf-designer";
// Preview (pdf.js) mora no entry "/preview" — peer opcional pdfjs-dist,
// instalado por este example justamente porque ele usa o preview.
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
  // UM estado de idioma pras DUAS camadas: vai pro `<I18nProvider>` do editor
  // (botões/abas/avisos do pacote) E pro dicionário da casca deste app (`tx`).
  // Não afeta o PDF gerado — o idioma do documento é o do dado.
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
  // MOTIVO do erro de cada fonte, não a frase — a frase é escolhida na hora
  // de renderizar (ver lib/sources.ts). Texto traduzido guardado no estado
  // não reage à troca de idioma.
  const [errorsById, setErrorsById] = useState<Record<string, SourceProblem>>({});
  // Guarda o erro CRU, não o `GenerationProblem` já montado, pelo mesmo
  // motivo: o título/ação do banner é escolhido no render, com o `locale`
  // atual, então trocar de idioma retraduz o banner que está na tela.
  const [genError, setGenError] = useState<{ err: unknown } | null>(null);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [generating, setGenerating] = useState(false);

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
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between bg-slate-900 px-5 py-3 text-white shadow-sm">
        <h1 className="flex items-baseline gap-2 text-lg font-semibold">
          {tx.appTitle}
          {/* Versão do FORMATO do template (não do pacote) — o que um projeto
              salvo carrega, e o que o migrateTemplate normaliza ao carregar.
              Os NÚMEROS vêm do pacote; só a moldura da frase é traduzida, e
              numa função só (não concatenada no JSX) porque a ordem muda. */}
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
            {/* Nome de idioma NÃO se traduz: cada um fica no próprio idioma. */}
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
            {/* `ex.label` NÃO é traduzido: é o nome do documento de exemplo
                ("Lei Kandir", "Boletim de Turma") — conteúdo, não interface.
                O relatório continua em português com a UI em inglês. */}
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

      {/* Sem `err.message` cru: describeGenerationError delega pro
          `describePdfError` do pacote, que devolve título + o que fazer + de
          quem é a culpa, classificado por `code` — no idioma de AGORA, não no
          de quando o erro aconteceu. */}
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
            // O <Designer> é dono da seleção (não há prop pra dirigi-la de
            // fora), então o clique navega até a PÁGINA do campo — é o mais
            // longe que dá pra levar hoje.
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
