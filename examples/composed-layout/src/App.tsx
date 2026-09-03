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
// Preview (pdf.js) mora no entry "/preview" — peer OPCIONAL pdfjs-dist,
// instalado por este example justamente porque ele usa o preview. (O
// examples/no-preview é o oposto: proíbe o pacote e tem um check no build.)
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

// Editor montado PEÇA POR PEÇA, sem o componente <Designer>.
//
// O layout aqui é impossível com o preset: toolbar full-width em cima,
// coluna de dados à esquerda, canvas no meio (com as abas de página em
// cima dele), e uma coluna à direita com SEIS painéis empilhados — que
// dentro do <Designer> seriam cinco abas diferentes (Dados, Estilo,
// Filtro, Vínculo, Página, Inspetor), com "Dados" e "Estilo" sendo DUAS
// instâncias da mesma peça.
//
// É por isso que o gate de aba é opt-in: NENHUMA peça aqui recebe
// `whenTab`, então todas renderizam ao mesmo tempo. Se `whenTab` fosse o
// default, esta coluna da direita mostraria um painel e apagaria os
// outros cinco. E não há `<DesignerSidebar>` nem `<DesignerTabBar>` em
// lugar nenhum — as únicas abas na tela são as de PÁGINA, que são estado
// deste app, não do editor.
//
// `expandOnSelect={false}` porque não existe sidebar pra reabrir — o
// provider não deve tentar.
export default function App() {
  // Autosave lido UMA vez, no primeiro render (`useState(fn)` como
  // inicializador preguiçoso) — não a cada render.
  const [autosaved] = useState(loadAutosave);
  const [template, setTemplate] = useState<Template>(() => ensurePages(autosaved?.template ?? initialTemplate));
  const [bindings, setBindings] = useState<Binding[]>(() => autosaved?.bindings ?? initialBindings);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [sources, setSources] = useState<JsonSource[]>(
    // "principal" NÃO sai do dicionário: nome de fonte de dados é DADO — vai
    // pro autosave e pro projeto salvo, e mudar de identidade porque alguém
    // trocou o idioma da UI seria errado.
    () => autosaved?.sources ?? [{ id: uid(), name: "principal", raw: JSON.stringify(initialSample, null, 2) }]
  );
  const [fields, setFields] = useState<FieldNode[]>(() => {
    if (autosaved?.sources) return extractFields(mergeSources(autosaved.sources).data);
    return extractFields(initialSample);
  });
  const [errorsById, setErrorsById] = useState<Record<string, SourceErrorCode>>({});
  // O erro CRU, não a frase pronta: `describeGenerationError` roda no render
  // (logo abaixo), então trocar de idioma com o banner aberto retraduz o
  // banner em vez de deixar a mensagem antiga na tela. Caixa (`{ err }`) em
  // vez do valor solto porque `null` é um erro possível.
  const [genErrorBox, setGenErrorBox] = useState<{ err: unknown } | null>(null);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [generating, setGenerating] = useState(false);
  // UM estado de idioma, DUAS camadas de texto: a casca deste app (via
  // `t(locale)`, ver src/i18n.ts) e a UI do editor. No <Designer> a segunda
  // seria a prop `locale`; montando na mão, ela vem do <I18nProvider> por
  // fora do <DesignerProvider> — é responsabilidade de quem monta. Nenhuma
  // das duas afeta o PDF gerado.
  const [locale, setLocale] = useState<Locale>("pt-BR");

  const ui = t(locale);
  // O dicionário do PACOTE como VALOR (`useT()` só funciona dentro do
  // provider, e este componente está por fora dele). Os rótulos dos cartões
  // da direita saem daqui porque o CONCEITO é do pacote: são as abas do
  // <Designer> ("Dados", "Estilo", "Filtro", "Página", "Inspetor") e o
  // título do editor de vínculo. Duplicar a tradução criaria dois textos pra
  // dessincronizar; só o qualificador ("do campo", "de linhas") é nosso.
  const pacote = dictFor(locale);

  // Recalcula a cada render: é varredura de string sobre o template em
  // memória, barata o suficiente pra não valer memo — e assim o painel reage
  // na hora em que alguém digita uma expressão torta.
  const problems = templateProblems(template, bindings, locale);
  const genError: GenerationProblem | null = genErrorBox ? describeGenerationError(genErrorBox.err, locale) : null;

  useUndoRedo(template, bindings, setTemplate, setBindings);
  useAutosave(template, bindings, sources);

  // `template.pages` sempre existe e não é vazio (garantido por ensurePages
  // em todo lugar que troca `template` inteiro) — clampa o índice pra nunca
  // apontar fora do array (ex: depois de remover a última aba selecionada, ou
  // carregar um projeto/exemplo com menos páginas).
  const pages = template.pages!;
  const safeActivePageIndex = Math.min(activePageIndex, pages.length - 1);
  const activePage = pages[safeActivePageIndex];

  // Repassa pro <DesignerProvider> só a página ATIVA — as peças não sabem
  // que existem outras páginas, só editam a que receberam. Grava de volta em
  // template.pages[safeActivePageIndex], preservando o resto do Template
  // intacto (inclusive as outras páginas).
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

  // Só recalcula a lista de campos quando alguém clicar em "Resync campos" —
  // assim dá pra colar um JSON grande sem a árvore piscar a cada tecla.
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
      // `maxPages` explícito, no default do pacote: deixa claro que existe um
      // teto e que estourá-lo dá PageLimitError em vez de um PDF truncado.
      const bytes = await generatePdf(template, data, bindings, { fontBytes, maxPages: DEFAULT_MAX_PAGES });
      setPreviewBytes(bytes);
    } catch (err) {
      // A geração LANÇA em alguns casos (glifo fora da fonte, teto de páginas,
      // tamanho de página inválido). Sem este catch a promise rejeita sem
      // tratamento e o botão fica preso em "Gerando…".
      //
      // Sem `err.message` cru: describeGenerationError delega a
      // `describePdfError` do pacote, que devolve `code`/`blame` estruturados
      // + título e ação já localizados. Ver "Modos de falha" na doc. Ele é
      // chamado no RENDER, não
      // aqui, pra que a frase acompanhe o seletor de idioma — o estado
      // guarda só o erro.
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
      // parseProjectFile já chama migrateTemplate; um formato mais novo que
      // este build entende chega aqui como erro, e vira a mesma mensagem
      // acionável de qualquer outra falha.
      .catch((err: unknown) => setGenErrorBox({ err }));
  }

  // Exemplos prontos — cada um troca template/binding E a fonte de dados pro
  // JSON de exemplo dele, já sincronizando a árvore de campos sem precisar
  // clicar em "Resync".
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
      {/* O header fica FORA do provider: nada nele lê o estado do editor, e
          assim a troca de página (que remonta o provider, ver `key` abaixo)
          não mexe nos controles daqui. */}
      <header className="app-top">
        <h1>
          {/* O nome do example não se traduz — é o nome da pasta. */}
          composed-layout
          <small>{ui.subtitulo}</small>
          <span className="app-version" title={ui.formatoTitle}>
            {ui.formato(CURRENT_TEMPLATE_VERSION, DEFAULT_MAX_PAGES)}
          </span>
        </h1>

        <div className="app-top__actions">
          {/* Undo/redo é o hook useUndoRedo: atalho global de teclado, sem
              botão. Fica escrito aqui porque atalho invisível é atalho que
              ninguém usa. */}
          <span className="app-chip" title={ui.undoRedoTitle}>
            {/* Atalho de teclado: notação, não texto — igual nos dois idiomas. */}
            ⌃Z / ⌃Y
          </span>
          {/* Autosave é o hook useAutosave: localStorage, debounce de 500ms. */}
          <span className="app-chip" title={ui.autosaveTitle}>
            {ui.autosaveChip}
          </span>

          {/* O ÚNICO seletor de idioma: o mesmo `locale` alimenta `t(locale)`
              (a casca) e o <I18nProvider> (a UI do editor). Os nomes dos
              idiomas ficam cada um no PRÓPRIO idioma, como é convenção — não
              se traduzem. */}
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
            {/* `ex.label` NÃO é traduzido: é o nome do template de exemplo
                (data/templates/), ou seja conteúdo — "Recibo de pagamento"
                continua em português com a UI em inglês, do mesmo jeito que o
                PDF que ele gera. */}
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

      {/* Fica FORA do <I18nProvider> — é um dos dois motivos pelos quais a
          casca recebe `locale` por prop em vez de chamar `useLocale()`. */}
      {genError && <GenerationErrorBanner problem={genError} onDismiss={() => setGenErrorBox(null)} locale={locale} />}

      {/* O <I18nProvider> fica explícito porque a prop `locale` era do
          preset; montando na mão, o idioma é responsabilidade de quem monta.
          Ele vai POR FORA do DesignerProvider — as peças leem o dicionário
          por `useT()`.
          É o MESMO `locale` do estado que a casca usa: um seletor, dois
          dicionários (o nosso e o do pacote), zero sincronização manual. */}
      <I18nProvider locale={locale}>
        <DesignerProvider
          // Trocar de página é trocar de documento: sem o `key`, a seleção
          // interna do editor continuaria apontando pra um schema que não
          // existe mais na página nova.
          key={activePage.id}
          template={activePage}
          onChangeTemplate={setActivePageTemplate}
          bindings={bindings}
          onChangeBindings={setBindings}
          onCanvasDrop={handleFieldDrop}
          // Dropdown "Data Source" do editor de vínculo, montado a partir do
          // que o explorador achou no JSON carregado.
          dataSources={dataSourcesFromFields(fields)}
          expandOnSelect={false}
        >
          {/* A toolbar ocupa a largura toda, o que o preset nunca faz (lá ela
              vive no pé da sidebar). `hint={false}` porque a frase "selecione
              um campo na lista" não tem referente aqui — a lista está na
              outra coluna. */}
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
                {/* Peça do pacote — lista os schemas JÁ colocados (o
                    FieldTree acima lista os caminhos do JSON, que é outra
                    coisa). `heading={false}`: o título já está acima, em CSS
                    próprio. `parts.scroll` sobrescreve a altura máxima da
                    lista — dentro do <Designer> ela é curta porque divide a
                    sidebar com a toolbar; aqui a coluna é só dela. */}
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
              {/* A BARRA DE ZOOM DESTE APP, fora do canvas — o caso que a
                  3.1.0 destravou. `hideZoombar` esconde a do pacote, que é
                  `position: sticky` dentro do canvas e por isso não tinha
                  como sair de lá por CSS. Ver components/ZoomBar.tsx. */}
              <ZoomBar locale={locale} />
              {/* O canvas é dono da geometria da folha; ESTA caixa é o
                  viewport que rola, e ela é nossa. */}
              <DesignerCanvas className="app-canvas" hideZoombar />
            </div>

            <aside className="app-right">
              {/* As duas metades do painel de propriedades, EMPILHADAS — é o
                  que a prop `section` existe pra permitir. Dentro do
                  <Designer> são as abas "Dados" e "Estilo". */}
              {/* Os SETE rótulos desta coluna: o substantivo vem do
                  dicionário do PACOTE (`pacote.*`) porque é o nome que o
                  <Designer> dá à mesma peça; o qualificador vem do nosso. */}
              <section className="app-card">
                <h2 className="app-h2">{ui.doCampo(pacote.tabBar.data)}</h2>
                <DesignerPropertyPanel section="dados" />
              </section>

              <section className="app-card">
                <h2 className="app-h2">{ui.doCampo(pacote.tabBar.style)}</h2>
                {/* `header={false}` pra não repetir o nome do campo, que já
                    aparece no cartão de cima. */}
                <DesignerPropertyPanel section="estilo" header={false} />
              </section>

              <section className="app-card">
                {/* Este vem INTEIRO do pacote: é o título que a própria peça
                    usa quando `heading` está ligado. */}
                <h2 className="app-h2">{pacote.bindingEditor.title}</h2>
                {/* Esta peça NÃO existe dentro do <Designer> como bloco
                    próprio: lá o editor de vínculo aparece aninhado no painel
                    de cada tipo de campo. É uma das duas que o
                    examples/headless-designer dizia ter tido de abrir mão. */}
                <DesignerBindingEditor />
              </section>

              <section className="app-card">
                <h2 className="app-h2">{ui.deLinhas(pacote.tabBar.filter)}</h2>
                {/* A outra das duas. Dentro do <Designer> é a aba "Filtro",
                    que só existe enquanto um campo com vínculo de array está
                    selecionado. */}
                <DesignerFilterPanel />
              </section>

              <section className="app-card">
                {/* Sem qualificador nenhum: é a aba "Página"/"Page" do
                    <Designer>, palavra por palavra. */}
                <h2 className="app-h2">{pacote.tabBar.page}</h2>
                <DesignerPageSettings />
              </section>

              <section className="app-card">
                <h2 className="app-h2">{pacote.tabBar.inspector}</h2>
                <DesignerInspector />
              </section>

              {/* Fecha a pilha: é o único cartão que fala do template
                  INTEIRO (todas as páginas), enquanto os seis de cima falam
                  do campo selecionado ou da página atual. */}
              <ProblemsPanel
                problems={problems}
                // As peças são donas da seleção (não há prop pra dirigi-la de
                // fora), então o clique navega até a PÁGINA do campo — é o
                // mais longe que dá pra levar hoje.
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
