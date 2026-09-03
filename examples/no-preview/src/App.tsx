// Gera e baixa, sem preview nenhum — e, principalmente, SEM pdfjs-dist
// instalado (ver README.md desta pasta). Importa só do entry principal
// "json-pdf-designer"; nada de "json-pdf-designer/preview".
//
// Os recursos são os mesmos do examples/report-builder — fontes de dados,
// explorador de campos, exemplos prontos, undo/redo, autosave, projeto em
// arquivo, múltiplas páginas, painel de problemas, erro de geração
// traduzido, seletor de idioma — MENOS o preview de PDF, que é proibido
// aqui por design. O que muda é a casca: CSS puro com variáveis `--app-*`
// nos dois temas, e o editor montado pelo `<Designer>` preset.
//
// O seletor de idioma troca DUAS camadas com o mesmo valor: o editor (pelo
// prop `locale` do `<Designer>`) e a casca deste app (pelo `t(locale)` de
// src/i18n.ts). Nada de segundo estado nem segundo seletor — ver README.md.
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
// Dicionário da CASCA — o mesmo `locale` do estado alimenta ele e o
// `<Designer>`. Ver o comentário grande de src/i18n.ts.
import { t } from "./i18n";

// O tema é UM atributo no `<html>`, e ele dirige o editor E esta casca:
// o `theme.css` do pacote redefine os `--jpd-*` sob `[data-jpd-theme="dark"]`,
// e as variáveis `--app-*` do index.css seguem a mesma chave.
//
// `.dark` também funciona, como alias do 2.x. Usamos o atributo porque é o
// hook documentado.
//
// Sem media query de propósito: o pacote não vira light-only porque o SO está
// escuro, e nem escuro porque o SO está. Quem quiser seguir o SO lê
// `matchMedia("(prefers-color-scheme: dark)")` e escreve o atributo — o que
// este example faz é justamente deixar a decisão explícita.
type Tema = "light" | "dark";
const TEMA_KEY = "no-preview:tema";

// Idioma inicial da UI (editor + casca). Constante de módulo porque o
// inicializador do `useState` de `fields` já precisa dele — ele roda ANTES da
// linha que declara o estado de `locale`, e ler a variável ali dentro daria
// ReferenceError.
const LOCALE_INICIAL: Locale = "pt-BR";

function temaInicial(): Tema {
  try {
    const salvo = localStorage.getItem(TEMA_KEY);
    if (salvo === "light" || salvo === "dark") return salvo;
  } catch {
    // modo privado / storage bloqueado — segue no default
  }
  // Default DESTE example é escuro: é a única coisa no repo que exercita o
  // dark do editor, então ele começa nesse modo.
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
  // O erro CRU, não a mensagem já formada. `describeGenerationError` roda na
  // renderização (abaixo), então trocar o idioma com o banner aberto
  // retraduz o banner na hora — guardar o texto pronto o congelaria no
  // idioma em que a falha aconteceu.
  const [genErrorRaw, setGenErrorRaw] = useState<{ err: unknown } | null>(null);
  const [generating, setGenerating] = useState(false);
  // Nome do último arquivo baixado — o único "recibo" que este example pode
  // dar, já que não há preview pra confirmar visualmente o que saiu.
  const [lastDownload, setLastDownload] = useState<string | null>(null);
  // Idioma da UI: alimenta o `<Designer locale>` (botões/abas/avisos do
  // editor) E o `t(locale)` da casca. Um seletor, dois dicionários — e não
  // afeta o PDF gerado, que é documento, não interface.
  const [locale, setLocale] = useState<Locale>(LOCALE_INICIAL);
  const s = t(locale);

  // Falha de geração já TRADUZIDA (ver lib/generationError.ts) — não a
  // mensagem crua do erro. O pacote exporta os erros como classes justamente
  // pra isso; o `locale` escolhe o idioma do texto acionável.
  const genError = genErrorRaw ? describeGenerationError(genErrorRaw.err, locale) : null;

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
    setGenErrorRaw(null);
    setLastDownload(null);
    setGenerating(true);
    try {
      const { data, errorsById: nextErrors } = mergeSources(sources);
      setErrorsById(nextErrors);
      const fontBytes = await loadDefaultFont();
      // O ponto do example: generatePdf devolve os bytes e downloadPdf
      // entrega o arquivo. Nenhum passo intermediário renderiza o PDF na
      // tela, então nada aqui precisa do pdf.js. Quem quiser conferir
      // margens antes de baixar usa o <PdfPreviewModal> de
      // "json-pdf-designer/preview" (e aí sim instala o pdfjs-dist).
      //
      // `maxPages` explícito, no default do pacote: deixa claro que existe
      // um teto e que estourá-lo dá PageLimitError em vez de um PDF
      // truncado.
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
