import { useState } from "react";
import type {
  Binding,
  ChartSchema,
  KpiSchema,
  Locale,
  Schema,
  TableSchema,
  Template,
  TemplatePage,
  TextSchema,
} from "json-pdf-designer/server";
import {
  CURRENT_TEMPLATE_VERSION,
  DEFAULT_MAX_PAGES,
  dictFor,
  generatePdf,
  tokenFor,
} from "json-pdf-designer/server";
// PdfPreview (canvas do pdf.js) mora no entry "/preview" — peer opcional
// pdfjs-dist, instalado por este example porque ele usa o preview. É o
// ÚNICO componente React que este example pega do pacote.
import { PdfPreview } from "json-pdf-designer/preview";
import Canvas from "./components/Canvas";
import { GRID_MM, snap } from "./lib/geometry";
import DataSourcePanel from "./components/DataSourcePanel";
import FieldTree from "./components/FieldTree";
import GenerationErrorBanner from "./components/GenerationErrorBanner";
import PageTabs from "./components/PageTabs";
import ProblemsPanel from "./components/ProblemsPanel";
import PropertiesPanel from "./components/PropertiesPanel";
import { clearAutosave, loadAutosave, useAutosave } from "./hooks/useAutosave";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { loadDefaultFont } from "./lib/font";
import { describeGenerationError } from "./lib/generationError";
import { extractFields, sanitizeName, type ColumnType, type FieldNode } from "./lib/jsonExplorer";
import { blankPage, ensurePages } from "./lib/pages";
import { downloadProjectFile, parseProjectFile } from "./lib/projectFile";
import { mergeSources, type JsonSource, type SourceErrorCode } from "./lib/sources";
import { templateProblems } from "./lib/templateProblems";
import { uid } from "./lib/uid";
import { shellDict } from "./i18n";
import { initialBindings, initialSample, initialTemplate } from "./data/initialTemplate";
import { EXAMPLES } from "./data/templates";

function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.slice().buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Fábricas de campo — literais escritos na mão, sem nenhuma peça pronta do
// pacote (nem os factories internos makeKpiSchema/makeChartSchema, que o
// <Designer> usa por dentro). É o modelo de dados e nada mais.
//
// `stagger` evita nascer em cima do campo anterior quando o campo vem do
// botão da barra (o drop do explorador usa a posição do mouse, então lá não
// precisa): cada campo novo desloca mais um passo de grade, e volta pro
// início depois de 6 — uma escada em vez de uma fila infinita.
//
// NENHUMA destas fábricas recebe dicionário, e é decisão consciente: o que
// elas escrevem (`"Indicator"`, `"from JSON"`, `"col_1"`, `"Hello
// {company.name}"`) é o CONTEÚDO inicial do campo — o que vai sair impresso
// no PDF. Conteúdo de documento não troca com o idioma da interface (regra
// que o `<Designer locale>` do pacote documenta): quem gerou um relatório em
// português não quer o título do KPI virando inglês porque mudou a UI. O
// pacote traduz os seeds DELE (`t.schemaDefaults`) pro editor dele; aqui as
// fábricas são deste app e o conteúdo é dado, não rótulo.
// ---------------------------------------------------------------------------
function newTextField(name: string, x: number, y: number, content: string): TextSchema {
  return {
    id: uid(),
    name,
    type: "text",
    x,
    y,
    width: 90,
    height: 8,
    content,
    fontSize: 11,
    fontColor: "#0f172a",
    alignment: "left",
  };
}

function newTableField(name: string, x: number, y: number, head: string[]): TableSchema {
  return {
    id: uid(),
    name,
    type: "table",
    x,
    y,
    width: 180,
    height: 30,
    head,
    // `tokenFor` do pacote: `content[0][i]` é a fórmula da coluna, e um
    // placeholder sem chaves não conta como template — a tabela nascia sem
    // token e o editor de fórmula abria vazio.
    content: [head.map((h) => tokenFor(h))],
  };
}

function newKpiField(name: string, x: number, y: number): KpiSchema {
  return {
    id: uid(),
    name,
    type: "kpi",
    x,
    y,
    width: 55,
    height: 35,
    icon: "bar_chart",
    title: "Indicator",
    // Texto puro, sem expressão — um `{}` vazio aqui viraria erro de
    // expressão e o campo nasceria já no painel de problemas.
    value: "0",
    subtitle: "from JSON",
    backgroundColor: "#0284c7",
    textColor: "#ffffff",
  };
}

function newChartField(name: string, x: number, y: number): ChartSchema {
  return {
    id: uid(),
    name,
    type: "chart",
    x,
    y,
    width: 100,
    height: 70,
    chartType: "pie",
    displayMode: "percent",
  };
}

// Nome único no Template INTEIRO (não só na página) — é o que o Binding
// referencia, e o pacote exige unicidade global (ver types/schema.ts).
function freshName(prefix: string): string {
  return `${sanitizeName(prefix)}_${Math.random().toString(36).slice(2, 6)}`;
}

// Campo mais "de cima" que contém o ponto (mm) — o último do array ganha,
// mesma regra de pintura do canvas. Usado pelo drop pra decidir entre
// "criar campo novo" e "revincular o campo em que você soltou".
function fieldAt(schemas: Schema[], x: number, y: number): Schema | undefined {
  return [...schemas].reverse().find((s) => x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height);
}

// Escolhe rótulo/valor pro vínculo de gráfico: valor é a primeira coluna
// numérica; rótulo é a primeira coluna que não seja ela. Sem isso o example
// precisaria de um editor de vínculo — e ele não tem um de propósito.
function chartColumns(columns: string[], types: Record<string, ColumnType> | undefined): { labelColumn: string; valueColumn: string } {
  const valueColumn = columns.find((c) => types?.[c] === "number") ?? columns[columns.length - 1];
  const labelColumn = columns.find((c) => c !== valueColumn) ?? columns[0];
  return { labelColumn, valueColumn };
}

// Editor "headless" — SEM o componente <Designer> e sem nenhuma peça
// `Designer*`. Canvas de arrastar/redimensionar montado à mão
// (components/Canvas.tsx), explorador de campos, painel de propriedades,
// abas de página, painel de problemas, undo/redo e autosave: tudo estado
// deste App. Do pacote entram só `generatePdf`/tipos (de
// "json-pdf-designer/server", build sem React nenhum) e `<PdfPreview>` (de
// "json-pdf-designer/preview", o entry que carrega o pdfjs-dist).
export default function App() {
  const [autosaved] = useState(loadAutosave);
  const [template, setTemplate] = useState<Template>(() => ensurePages(autosaved?.template ?? initialTemplate));
  const [bindings, setBindings] = useState<Binding[]>(() => autosaved?.bindings ?? initialBindings);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sources, setSources] = useState<JsonSource[]>(
    () => autosaved?.sources ?? [{ id: uid(), name: "main", raw: JSON.stringify(initialSample, null, 2) }]
  );
  const [fields, setFields] = useState<FieldNode[]>(() => {
    if (autosaved?.sources) return extractFields(mergeSources(autosaved.sources).data);
    return extractFields(initialSample);
  });
  const [errorsById, setErrorsById] = useState<Record<string, SourceErrorCode>>({});
  // O erro CRU, não o texto dele. Esta é a regra que faz o seletor de idioma
  // funcionar: frase traduzida guardada em estado CONGELA no idioma em que foi
  // criada, e trocar o idioma com o banner aberto deixaria o banner na língua
  // antiga. A tradução acontece na renderização, algumas linhas abaixo.
  //
  // Embrulhado num objeto (`{ err }`) por dois motivos: `null` não distingue
  // "sem erro" de "erro que é null", e `setGenError(err)` com um erro que
  // fosse função seria interpretado pelo React como updater.
  const [genErrorBox, setGenErrorBox] = useState<{ err: unknown } | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [generating, setGenerating] = useState(false);
  const [view, setView] = useState<"canvas" | "preview">("canvas");
  // UM estado de idioma, DUAS camadas de texto. No report-builder isto é a
  // prop `locale` do <Designer>; aqui não existe <Designer> nenhum, então o
  // idioma é aplicado por nós:
  //
  //   `t`  = dicionário do PACOTE (`dictFor(locale)`, do entry /server, sem
  //          React) — todo conceito que é DELE: tipo de campo, geometria,
  //          `visibleWhen`, propriedades de texto/KPI/gráfico, "falta
  //          vínculo", erro de expressão.
  //   `tt` = dicionário da CASCA (`shellDict(locale)`, src/i18n.ts) — o que
  //          só existe neste app: cabeçalho, abas de vista, fontes de dados,
  //          explorador de campos, painel de problemas, banner de erro.
  //
  // Como este example é o único dos cinco sem `<Designer>`, quase tudo na
  // tela é casca — e é por isso que a divisão acima está escrita em cada
  // componente: reusar o rótulo do pacote pra significar OUTRA coisa é pior
  // que traduzir à mão (ver `tt.fields.selectHint`, em src/i18n.ts).
  //
  // `Locale` é o tipo DO PACOTE, não um union nosso: quando o pacote ganhar
  // um idioma, `shellDict` deixa de compilar até a casca ser traduzida junto.
  const [locale, setLocale] = useState<Locale>("en");
  const t = dictFor(locale);
  const tt = shellDict(locale);

  // AQUI a falha vira texto, e não no `catch`. Deriva do `locale` deste render,
  // então trocar o idioma com o banner aberto retraduz o banner — sem gerar o
  // PDF de novo, porque o que está guardado é o erro, não a frase.
  const genError = genErrorBox ? describeGenerationError(genErrorBox.err, locale) : null;

  // Recalcula a cada render: é varredura de string sobre o template em memória,
  // barata o suficiente pra não valer memo — e assim o painel reage na hora em
  // que alguém digita uma expressão torta.
  const problems = templateProblems(template, bindings, locale);

  useUndoRedo(template, bindings, setTemplate, setBindings);
  useAutosave(template, bindings, sources);

  // `template.pages` sempre existe e não é vazio (garantido por ensurePages
  // em todo lugar que troca `template` inteiro) — clampa o índice pra nunca
  // apontar fora do array (ex: depois de remover a última aba selecionada, ou
  // carregar um projeto/exemplo com menos páginas).
  const pages = template.pages!;
  const safeActivePageIndex = Math.min(activePageIndex, pages.length - 1);
  const activePage = pages[safeActivePageIndex];
  const selected = activePage.schemas.find((s) => s.id === selectedId) ?? null;
  const selectedBinding = selected ? bindings.find((b) => b.schemaName === selected.name) : undefined;

  // Grava de volta só na página ATIVA, preservando o resto do Template
  // intacto (inclusive as outras páginas).
  function updateActivePage(update: (page: TemplatePage) => TemplatePage) {
    setTemplate((prev) => ({
      ...prev,
      pages: prev.pages!.map((p, i) => (i === safeActivePageIndex ? update(p) : p)),
    }));
  }

  function updateSchemas(update: (schemas: Schema[]) => Schema[]) {
    updateActivePage((page) => ({ ...page, schemas: update(page.schemas) }));
  }

  function patchField(id: string, patch: Record<string, unknown>) {
    updateSchemas((schemas) => schemas.map((s) => (s.id === id ? ({ ...s, ...patch } as Schema) : s)));
  }

  // Remove o campo E o vínculo dele — vínculo órfão não quebra a geração
  // (ninguém referencia aquele schemaName), mas fica sujando o arquivo de
  // projeto salvo e reaparece se um campo com o mesmo nome nascer depois.
  function removeField(id: string) {
    const victim = activePage.schemas.find((s) => s.id === id);
    updateSchemas((schemas) => schemas.filter((s) => s.id !== id));
    if (victim) setBindings((prev) => prev.filter((b) => b.schemaName !== victim.name));
    setSelectedId((prev) => (prev === id ? null : prev));
  }

  function replaceBinding(schemaName: string, next: Binding | undefined) {
    setBindings((prev) => {
      const without = prev.filter((b) => b.schemaName !== schemaName);
      return next ? [...without, next] : without;
    });
  }

  // Botão da barra: posição em escada, dentro do corpo da página.
  function addField(make: (name: string, x: number, y: number) => Schema, prefix: string) {
    const step = (activePage.schemas.length % 6) * GRID_MM;
    const x = 10 + step;
    const y = Math.max((activePage.headerHeight ?? 0) + 5, 15) + step;
    const field = make(freshName(prefix), snap(x), snap(y));
    updateSchemas((schemas) => [...schemas, field]);
    setSelectedId(field.id);
  }

  // ------------------------------------------------------------------
  // O explorador de campos solta NO NOSSO canvas. Além de criar campo na
  // posição do mouse, o drop olha em QUE campo caiu: soltar um array em cima
  // de um gráfico/tabela revincula aquele campo em vez de criar outro, e
  // soltar uma coluna em cima de uma tabela já vinculada ao mesmo array
  // acrescenta a coluna. É o substituto do editor de vínculo que este
  // example não tem.
  // ------------------------------------------------------------------
  function dropFieldAt(raw: string, x: number, y: number) {
    let node: FieldNode;
    try {
      node = JSON.parse(raw) as FieldNode;
    } catch {
      return;
    }
    const target = fieldAt(activePage.schemas, x, y);

    if (node.kind === "arraySource") {
      const columns = node.columns ?? [];
      // Array de valores simples (sem colunas) — não há tabela nem gráfico
      // pra montar a partir dele.
      if (columns.length === 0) return;

      if (target?.type === "chart") {
        replaceBinding(target.name, { schemaName: target.name, type: "chart", path: node.path, ...chartColumns(columns, node.columnTypes) });
        setSelectedId(target.id);
        return;
      }
      if (target?.type === "table") {
        patchField(target.id, { head: columns, content: [columns.map((c) => tokenFor(c))] });
        replaceBinding(target.name, { schemaName: target.name, type: "array", path: node.path, columns });
        setSelectedId(target.id);
        return;
      }

      const name = freshName(node.path);
      const field = newTableField(name, x, y, columns);
      updateSchemas((schemas) => [...schemas, field]);
      replaceBinding(name, { schemaName: name, type: "array", path: node.path, columns });
      setSelectedId(field.id);
      return;
    }

    if (node.kind === "arrayColumn") {
      // Tabela sob o cursor, ou (se soltou no vazio) a primeira da página já
      // vinculada a esse mesmo array.
      const candidate =
        target?.type === "table"
          ? target
          : activePage.schemas.find(
              (s): s is TableSchema =>
                s.type === "table" && bindings.some((b) => b.schemaName === s.name && b.type === "array" && b.path === node.sourcePath)
            );
      const candidateBinding = candidate ? bindings.find((b) => b.schemaName === candidate.name) : undefined;

      if (candidate && candidateBinding?.type === "array" && candidateBinding.path === node.sourcePath) {
        patchField(candidate.id, {
          head: [...candidate.head, node.column],
          content: candidate.content.map((row) => [...row, node.column.toUpperCase()]),
        });
        replaceBinding(candidate.name, { ...candidateBinding, columns: [...candidateBinding.columns, node.column] });
        setSelectedId(candidate.id);
        return;
      }

      // Sem tabela pra receber: cria uma de uma coluna só, já vinculada ao
      // array-pai. (No report-builder este caso não faz nada, porque lá a
      // coluna avulsa só entra numa SEÇÃO já vinculada — e seção é peça de
      // editor, que aqui não existe.)
      const name = freshName(node.path);
      const field = newTableField(name, x, y, [node.column]);
      updateSchemas((schemas) => [...schemas, field]);
      replaceBinding(name, { schemaName: name, type: "array", path: node.sourcePath, columns: [node.column] });
      setSelectedId(field.id);
      return;
    }

    // scalar | native — campo de texto com o token. `native`
    // ({pageNumber}/{pageCount}) só resolve no cabeçalho/rodapé/margem; o
    // canvas desenha as faixas justamente pra dar pra soltar lá dentro.
    const content = `{${node.path}}`;
    const name = freshName(node.path);
    const field = newTextField(name, x, y, content);
    updateSchemas((schemas) => [...schemas, field]);
    if (node.kind === "scalar") replaceBinding(name, { schemaName: name, type: "template", template: content });
    setSelectedId(field.id);
  }

  function handleAddPage() {
    setTemplate((prev) => ({ ...prev, pages: [...prev.pages!, blankPage()] }));
    setActivePageIndex(pages.length); // nova página vai pro final
    setSelectedId(null);
  }

  function handleRemovePage(index: number) {
    if (pages.length <= 1) return;
    setTemplate((prev) => ({ ...prev, pages: prev.pages!.filter((_, i) => i !== index) }));
    setActivePageIndex((prevIndex) => Math.max(0, prevIndex >= index ? prevIndex - 1 : prevIndex));
    setSelectedId(null);
  }

  // Só recalcula a lista de campos quando o usuário clicar em "Resync
  // fields" — assim ele pode colar um JSON grande sem a lista ficar
  // piscando a cada tecla digitada.
  function handleResync() {
    const { data, errorsById: nextErrors } = mergeSources(sources);
    setFields(extractFields(data));
    setErrorsById(nextErrors);
  }

  async function handleGenerate() {
    setGenErrorBox(null);
    setGenerating(true);
    try {
      const { data, errorsById: nextErrors } = mergeSources(sources);
      setErrorsById(nextErrors);
      const fontBytes = await loadDefaultFont();
      // `maxPages` explícito, no default do pacote: deixa claro que existe um
      // teto e que estourá-lo dá PageLimitError em vez de um PDF truncado.
      const bytes = await generatePdf(template, data, bindings, { fontBytes, maxPages: DEFAULT_MAX_PAGES });
      setPdfBytes(bytes);
      setView("preview");
    } catch (err) {
      // O erro entra em estado como veio. Quem classifica é
      // describeGenerationError, na renderização — por `instanceof` na classe
      // exportada pelo pacote, nunca por `err.message`.
      setPdfBytes(null);
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
      .then(({ template: loaded, bindings: loadedBindings }) => {
        setTemplate(ensurePages(loaded));
        setBindings(loadedBindings);
        setActivePageIndex(0);
        setSelectedId(null);
        setGenErrorBox(null);
      })
      // parseProjectFile já chama migrateTemplate; um formato mais novo que
      // este build entende chega aqui como erro, e vira a mesma mensagem
      // acionável de qualquer outra falha.
      .catch((err: unknown) => setGenErrorBox({ err }));
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
    setSelectedId(null);
    setSources([{ id: uid(), name: example.sourceName, raw: JSON.stringify(example.sample, null, 2) }]);
    setFields(extractFields(example.sample));
    setErrorsById({});
    setPdfBytes(null);
    setView("canvas");
  }

  function handleReset() {
    clearAutosave();
    setTemplate(ensurePages(initialTemplate));
    setBindings(initialBindings);
    setActivePageIndex(0);
    setSelectedId(null);
    setSources([{ id: uid(), name: "main", raw: JSON.stringify(initialSample, null, 2) }]);
    setFields(extractFields(initialSample));
    setErrorsById({});
    setPdfBytes(null);
    setGenErrorBox(null);
    setView("canvas");
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-titles">
          <h1>
            {tt.header.title}
            {/* Versão do FORMATO do template (não do pacote) — o que um projeto
                salvo carrega, e o que o migrateTemplate normaliza ao carregar. */}
            <span className="app-header-meta" title={tt.header.formatVersionTitle}>
              {tt.header.formatMeta(CURRENT_TEMPLATE_VERSION, DEFAULT_MAX_PAGES)}
            </span>
          </h1>
          {/* Os nomes de símbolo entram como argumento e o dicionário decide
              a ORDEM das partes — concatenar a frase aqui a prenderia à
              ordem do inglês. */}
          <p>{tt.header.subtitle((text) => <code key={text}>{text}</code>)}</p>
        </div>
        <div className="app-header-actions">
          {/* O MESMO seletor troca as duas camadas: `dictFor(locale)` (o
              chrome que vem do pacote) e `shellDict(locale)` (a casca deste
              app). Um estado, dois dicionários, zero sincronização manual.
              Nome de idioma não se traduz: cada um fica no próprio. */}
          <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} title={tt.header.localeTitle}>
            <option value="en">English</option>
            <option value="pt-BR">Português</option>
          </select>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) handleLoadExample(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">{tt.header.loadExample}</option>
            {/* `ex.label` NÃO passa pelo dicionário: é o NOME do documento de
                exemplo ("Lei Kandir", "Relatório Financeiro"), igual ao
                conteúdo dele em data/templates/. Um relatório escrito em
                português continua chamado assim quando a UI está em inglês —
                o idioma da interface não é o idioma do documento. */}
            {Object.entries(EXAMPLES).map(([key, ex]) => (
              <option key={key} value={key}>
                {ex.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => downloadProjectFile(template, bindings)}>
            {tt.header.saveProject}
          </button>
          <label className="file-button">
            {tt.header.loadProject}
            <input type="file" accept="application/json" onChange={handleImportProject} hidden />
          </label>
          <button type="button" onClick={handleReset} title={tt.header.resetTitle}>
            {tt.header.reset}
          </button>
          <button type="button" className="generate-btn" onClick={handleGenerate} disabled={generating}>
            {generating ? tt.header.generating : tt.header.generate}
          </button>
        </div>
      </header>

      {genError && <GenerationErrorBanner problem={genError} tt={tt} onDismiss={() => setGenErrorBox(null)} />}

      <div className="app-body">
        <aside className="app-sidebar">
          <DataSourcePanel
            sources={sources}
            onChangeSources={setSources}
            onResync={handleResync}
            fieldCount={fields.length}
            errorsById={errorsById}
            tt={tt}
          />
          <ProblemsPanel
            problems={problems}
            tt={tt}
            onGoTo={(pageIndex, schemaId) => {
              setActivePageIndex(pageIndex);
              setSelectedId(schemaId);
              setView("canvas");
            }}
          />
          <FieldTree
            fields={fields}
            tt={tt}
            // O "+" (sem arrastar) solta no meio da página ativa.
            onAdd={(field) =>
              dropFieldAt(JSON.stringify(field), snap(activePage.page.width / 2 - 45), snap(activePage.page.height / 2))
            }
          />
        </aside>

        <main className="app-main">
          <PageTabs
            pages={pages}
            activeIndex={safeActivePageIndex}
            tt={tt}
            onSelect={(i) => {
              setActivePageIndex(i);
              setSelectedId(null);
            }}
            onAdd={handleAddPage}
            onRemove={handleRemovePage}
          />
          <div className="view-tabs">
            <button type="button" className={view === "canvas" ? "active" : ""} onClick={() => setView("canvas")}>
              {tt.view.canvas}
            </button>
            <button
              type="button"
              className={view === "preview" ? "active" : ""}
              disabled={!pdfBytes}
              onClick={() => pdfBytes && setView("preview")}
            >
              {tt.view.preview}
            </button>
            {view === "canvas" && (
              <div className="add-row">
                {/* Rótulo do BOTÃO vem do pacote (`t.toolbar`) — tipo de
                    campo é conceito dele. O conteúdo que o campo NASCE com
                    ("Hello {company.name}") é o texto do documento, não da
                    UI: fica igual nos dois idiomas, e é o que sai no PDF. */}
                <button type="button" onClick={() => addField((n, x, y) => newTextField(n, x, y, "Hello {company.name}"), "text")}>
                  + {t.toolbar.text}
                </button>
                <button type="button" onClick={() => addField((n, x, y) => newTableField(n, x, y, ["col_1", "col_2"]), "table")}>
                  + {t.toolbar.table}
                </button>
                <button type="button" onClick={() => addField(newKpiField, "kpi")}>
                  + {t.toolbar.kpi}
                </button>
                <button type="button" onClick={() => addField(newChartField, "chart")}>
                  + {t.toolbar.chart}
                </button>
              </div>
            )}
          </div>

          {view === "canvas" ? (
            <div className="canvas-scroll">
              <Canvas
                page={activePage}
                selectedId={selectedId}
                t={t}
                onSelect={setSelectedId}
                onMove={(id, x, y) => patchField(id, { x, y })}
                onResize={(id, width, height) => patchField(id, { width, height })}
                onDropField={dropFieldAt}
              />
            </div>
          ) : pdfBytes ? (
            <div className="preview-scroll">
              {/* "report.pdf" é NOME DE ARQUIVO, não rótulo: um nome que
                  muda de idioma quebraria script e link de quem consome o
                  download. Fica igual nos dois. */}
              <button type="button" onClick={() => downloadPdf(pdfBytes, "report.pdf")}>
                {tt.view.downloadPdf}
              </button>
              {/* O único componente React do pacote nesta tela — e o único
                  resíduo de idioma conhecido do example: ele NÃO está dentro
                  de um <I18nProvider>, então a linha "N page(s)" sai sempre no
                  idioma default do pacote (inglês), mesmo com a casca em
                  português.

                  Isso é ESCOLHA, não impedimento técnico. O `I18nProvider`
                  mora no entry `.` (o com React) e importá-lo daqui compila:
                  o tree-shaking descarta o `<Designer>` e traz só os ~10
                  módulos de `src/i18n/` — o `react-rnd`, que este example nem
                  instala, não é resolvido. O motivo de não fazer é de
                  IDENTIDADE: este é o único dos cinco examples que não toca
                  no entry React, e é assim que a doc do repo o descreve
                  (`docs/USAGE.md` + a tabela "O que vem do pacote" no README).
                  Um provider aqui trocaria a demonstração inteira por uma
                  linha de contagem traduzida. Ver o README. */}
              <PdfPreview bytes={pdfBytes} scale={1.2} />
            </div>
          ) : (
            <p className="empty-hint">{tt.view.emptyHint}</p>
          )}
        </main>

        <aside className="app-props">
          {selected ? (
            <PropertiesPanel
              schema={selected}
              binding={selectedBinding}
              t={t}
              tt={tt}
              onChange={(patch) => patchField(selected.id, patch)}
              onChangeBinding={(next) => replaceBinding(selected.name, next)}
              onRemove={() => removeField(selected.id)}
            />
          ) : (
            <div className="panel">
              {/* "Campos" é conceito do pacote — mesmo painel, mesmo nome. */}
              <div className="panel-title">{t.fieldsPanel.heading}</div>
              {/* A DICA, ao contrário, é nossa: a do pacote termina em "…ou
                  adicione um novo:" porque no <Designer> ela fica logo acima
                  dos botões de adicionar campo. Aqui esses botões estão na
                  barra sobre o canvas, do outro lado da tela — reusar o
                  rótulo do pacote prometeria uma ação que este painel não
                  tem. Ver src/i18n.ts, `fields.selectHint`. */}
              <p className="panel-hint">{tt.fields.selectHint}</p>
              <ul className="field-list">
                {activePage.schemas.map((f) => (
                  <li key={f.id} onClick={() => setSelectedId(f.id)}>
                    {/* Nome do campo (`kandir_tabela`) é dado do template. */}
                    <span className="field-list-name">{f.name}</span>
                    <span className="field-list-type">{t.fieldTypeLabels[f.type]}</span>
                  </li>
                ))}
              </ul>
              {activePage.schemas.length === 0 && <p className="panel-hint">{t.fieldList.empty}</p>}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
