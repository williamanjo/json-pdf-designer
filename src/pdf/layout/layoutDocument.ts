import type { Binding, Schema, SectionSchema, TableSchema, Template, TemplatePage } from "../../types";
import { computeTableSlice, needsNewPageForItem } from "../pagination";
import { resolveFooterRow, resolveTextValue, resolveTopLevelTableRows } from "../resolvers";
import { boundsOf, deriveBodyLayout, gapAfter } from "./bodyLayout";
import { normalizePageDefs } from "./pageLayout";
import type { BodyItem } from "./layoutTypes";
import { resolveSectionItems, sectionInstanceHeight } from "./sectionLayout";
import { evaluateConditionLenient } from "../../expressions/resolve";
import { PageLimitError, PaginationStalledError } from "../../errors";

// Uma coisa a desenhar, já posicionada numa página física e com o valor
// resolvido. O renderizador consome isto e não toma nenhuma decisão de
// paginação nem resolve nenhum dado.
export type Placement =
  // Campo do corpo (texto/imagem/gráfico/indicador). `yMm` é o Y do CURSOR do
  // fluxo, não o Y autorado — o X de cada um fica onde foi desenhado no
  // editor, que é o que preserva o layout lado a lado de uma "row".
  | { kind: "field"; schema: Schema; yMm: number; value: string | undefined }
  // Uma fatia de tabela: as linhas que caberam nesta página.
  | { kind: "tableSlice"; schema: TableSchema; yMm: number; rows: string[][]; includeHead: boolean; footer?: string[]; isLastSlice: boolean }
  // Uma repetição de seção. Guarda o `item` e o `index` em vez de expandir os
  // membros em Placements: `drawSectionInstance` já sabe deslocar os membros
  // conforme cada tabela membro cresce (mestre-detalhe), e reimplementar isso
  // aqui mudaria comportamento sem necessidade. A DECISÃO de página, que é o
  // que importava unificar, está toda aqui.
  | { kind: "sectionRepeat"; schema: SectionSchema; yMm: number; item: unknown; index: number };

export type LayoutPage = {
  // A qual página-design esta página física pertence (tamanho, fundo, faixas).
  pageDef: TemplatePage;
  // Cabeçalho/rodapé/margem — repetem em toda página física desta página-design.
  // Ficam sem valor resolvido de propósito: {pageNumber}/{pageCount} só existem
  // depois que o layout terminou, então quem resolve é o render (ver
  // drawRepeating em generate.ts), com pages.length já conhecido.
  repeatingSchemas: Schema[];
  placements: Placement[];
};

export type LayoutDocument = { pages: LayoutPage[] };

// Teto de páginas físicas de um documento. Existe pra proteger quem gera:
// um template vindo de fonte não confiável, ou um dado muito maior do que
// alguém esperava, não pode virar um PDF de um milhão de páginas que estoura a
// memória da aba/do worker.
//
// Substituiu dois contadores de ITERAÇÃO (1000 fatias de tabela, 20000
// repetições de seção) que tinham dois problemas:
//
//  1. Truncavam em SILÊNCIO. 60 mil linhas de tabela saíam como 40.998 num PDF
//     que parecia completo; 20 mil repetições de seção saíam como 18.667. Num
//     relatório, omitir linha sem avisar é o pior resultado possível.
//  2. Protegiam de um laço infinito que não pode acontecer: o da tabela sempre
//     quebra em `capacity <= 0`, e o da seção sempre consegue colocar o item na
//     página seguinte (numa página recém-aberta o cursor é o headerHeight, e aí
//     `needsNewPageForItem` é falso). Contar iteração era medir a coisa errada.
//
// O recurso escasso de verdade é página — ela custa memória e tempo, venha de
// tabela, de seção ou de várias páginas-design. Então o teto é em página, e
// estourá-lo é ERRO, não corte.
export const DEFAULT_MAX_PAGES = 5000;

// A classe mora em src/errors.ts (com todas as outras, ver o comentário de lá)
// e é REEXPORTADA daqui: `PageLimitError` já era importada deste módulo por
// código e por teste, e mudar o caminho não traria nada.
export { PageLimitError } from "../../errors";

export type LayoutOptions = {
  // Teto de páginas físicas. Default DEFAULT_MAX_PAGES.
  maxPages?: number;
};

// Nome do que está sendo paginado, pra mensagem de erro. Uma "row" pode ter
// vários campos; o primeiro basta pra localizar.
function nameOf(item: BodyItem): string {
  return item.kind === "row" ? (item.schemas[0]?.name ?? "(linha)") : item.schema.name;
}

// Um laço de paginação que não avança é bug de aritmética, não dado grande.
// Antes isso viraria giro até um contador de iteração estourar e o resultado
// sair truncado em silêncio.
function assertProgress(madeProgress: boolean, field: string): void {
  if (madeProgress) return;
  throw new PaginationStalledError(field);
}

// `schema.visibleWhen` — expressão avaliada contra o dado de verdade; sem a
// prop, sempre visível. Expressão inválida também conta como visível: um erro
// de digitação não pode apagar um campo do relatório em silêncio (o editor
// avisa, ver fieldWarnings.ts).
function isVisible(schema: { visibleWhen?: string }, data: unknown): boolean {
  const condition = schema.visibleWhen?.trim();
  if (!condition) return true;
  return evaluateConditionLenient(condition, data, true);
}

// Onde cada coisa cai, página física por página física, para um Template +
// dado + vínculos — SEM desenhar nada e sem tocar em pdf-lib.
//
// Antes disso a paginação existia em DUAS travessias: o laço de desenho em
// generate.ts decidia e desenhava ao mesmo tempo, e countBodyPages percorria
// tudo de novo só para saber o total (porque {pageCount} precisa do número
// antes da primeira página ser desenhada). As duas compartilhavam só as
// decisões atômicas de pagination.ts; o avanço de cursor, o fatiamento de
// tabela e a repetição de seção estavam escritos duas vezes, e qualquer
// divergência entre as cópias significaria "o dry-run disse 7 páginas, o
// desenho fez 8".
//
// Agora é uma travessia só: a contagem de páginas é `pages.length`, que não
// pode divergir do desenho porque É o desenho.
export function layoutDocument(
  template: Template,
  data: unknown,
  bindings: Binding[],
  inputs: Record<string, string>,
  options: LayoutOptions = {}
): LayoutDocument {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const pages: LayoutPage[] = [];

  for (const pageDef of normalizePageDefs(template)) {
    const { headerHeight, bodyBottomMm, repeatingSchemas, bodyItems } = deriveBodyLayout(pageDef);

    let current: LayoutPage = { pageDef, repeatingSchemas, placements: [] };
    pages.push(current);

    // `field` só serve pra mensagem de erro: diz O QUE estava sendo paginado
    // quando o teto foi atingido, que é a informação de que quem for
    // investigar precisa.
    const newPage = (field: string) => {
      if (pages.length >= maxPages) throw new PageLimitError(maxPages, field);
      current = { pageDef, repeatingSchemas, placements: [] };
      pages.push(current);
    };

    if (bodyItems.length === 0) continue;

    let cursorTopMm = boundsOf(bodyItems[0]).y;
    let prev: { y: number; height: number } | undefined;

    for (const item of bodyItems) {
      // Quais campos deste item de fato vão pro papel. Uma "row" pode ter
      // parte escondida; tabela/seção é tudo ou nada.
      const visibleSchemas = item.kind === "row" ? item.schemas.filter((schema) => isVisible(schema, data)) : [];
      const renders = item.kind === "row" ? visibleSchemas.length > 0 : isVisible(item.schema, data);

      const bounds = boundsOf(item);
      if (prev) cursorTopMm += gapAfter(prev, bounds);
      // `prev` recebe os limites AUTORADOS mesmo quando o item não renderiza:
      // é o que preserva o espaçamento desenhado no editor em volta do que foi
      // escondido. Assim esconder um item recupera a ALTURA dele e nada mais —
      // os gaps dos dois lados continuam valendo, e o que vem depois sobe
      // exatamente a altura escondida. `continue` antes de somar a altura é o
      // que faz isso.
      prev = bounds;
      if (!renders) continue;

      // Nem o começo deste item cabe onde o anterior parou — começa numa
      // página nova.
      if (cursorTopMm >= bodyBottomMm) {
        newPage(nameOf(item));
        cursorTopMm = headerHeight;
      }

      if (item.kind === "row") {
        // Uma linha não pagina sozinha — se nem a própria altura cabe no que
        // resta da página (e não é o topo dela ainda), joga a linha INTEIRA
        // (todo mundo que compartilha essa mesma linha) pra próxima em vez de
        // cortar.
        if (needsNewPageForItem(item.height, bodyBottomMm - cursorTopMm, cursorTopMm, headerHeight)) {
          newPage(nameOf(item));
          cursorTopMm = headerHeight;
        }
        for (const schema of visibleSchemas) {
          const value =
            schema.type === "text"
              ? resolveTextValue(schema.content, bindings.find((b) => b.schemaName === schema.name), data)
              : inputs[schema.name];
          current.placements.push({ kind: "field", schema, yMm: cursorTopMm, value });
        }
        cursorTopMm += item.height;
        continue;
      }

      if (item.kind === "table") {
        const schema = item.schema;
        const repeatHeader = schema.repeatHeader !== false;
        const hasFooter = Boolean(schema.footer && schema.footer.length > 0);
        const footerRow = hasFooter ? resolveFooterRow(schema, data) : undefined;
        let remaining = resolveTopLevelTableRows(schema, bindings, data, inputs);
        let isFirstSlice = true;

        // Sem contador de iteração: o laço termina por construção (ou consome
        // todas as linhas, ou `capacity <= 0` quebra). O teto de página é o que
        // protege o recurso, e `assertProgress` abaixo pega o caso impossível
        // em vez de deixá-lo girar.
        for (;;) {
          const includeHead = isFirstSlice || repeatHeader;
          const decision = computeTableSlice(remaining.length, bodyBottomMm - cursorTopMm, includeHead, hasFooter);
          const rows = remaining.slice(0, decision.rowsToTake);
          current.placements.push({
            kind: "tableSlice",
            schema,
            yMm: cursorTopMm,
            rows,
            includeHead,
            footer: decision.isLastSlice ? footerRow : undefined,
            isLastSlice: decision.isLastSlice,
          });
          remaining = remaining.slice(rows.length);
          isFirstSlice = false;

          // `decision.heightMm` é a altura que o desenho vai ocupar, pelo mesmo
          // cálculo. O código anterior avançava o cursor a partir do Y que
          // drawTableSlice DEVOLVIA — dependência do renderizador que fazia o
          // layout precisar desenhar para saber onde continuar.
          cursorTopMm += decision.heightMm;

          if (remaining.length === 0 || decision.capacity <= 0) break;
          // Nenhuma linha consumida numa fatia com capacidade > 0 seria bug de
          // aritmética de paginação, não dado grande — girar em silêncio
          // esconderia isso.
          assertProgress(rows.length > 0, schema.name);
          newPage(schema.name);
          cursorTopMm = headerHeight;
        }
        continue;
      }

      const schema = item.schema;
      const sectionItems = resolveSectionItems(schema, bindings, data);
      let index = 0;
      // Duas iterações por item, no pior caso: uma que abre página e uma que
      // coloca. Se uma iteração não fizer nem um nem outro, o item não cabe em
      // lugar nenhum — bug, não volume, e `assertProgress` acusa.
      let lastIndex = -1;
      let pagesAtLastIndex = -1;
      for (; index < sectionItems.length; ) {
        assertProgress(index !== lastIndex || pages.length !== pagesAtLastIndex, schema.name);
        lastIndex = index;
        pagesAtLastIndex = pages.length;

        const instanceHeight = sectionInstanceHeight(pageDef, schema, sectionItems[index], bindings);
        if (needsNewPageForItem(instanceHeight, bodyBottomMm - cursorTopMm, cursorTopMm, headerHeight)) {
          newPage(schema.name);
          cursorTopMm = headerHeight;
          continue;
        }
        current.placements.push({ kind: "sectionRepeat", schema, yMm: cursorTopMm, item: sectionItems[index], index });
        cursorTopMm += instanceHeight;
        index++;
      }
    }
  }

  return { pages };
}
