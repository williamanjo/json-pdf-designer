import type { Binding, Template, TemplatePage } from "../../types";
import { computeTableSlice, needsNewPageForItem } from "../pagination";
import { resolveTopLevelTableRows } from "../resolvers";
import { resolveSectionItems, sectionInstanceHeight } from "../render/renderSection";
import { boundsOf, gapAfter } from "./bodyLayout";
import type { BodyItem } from "./layoutTypes";

// Normaliza um Template pro array de páginas que generatePdf desenha: se
// `template.pages` existe e não é vazio, é a fonte da verdade (várias
// páginas, cada uma com seu próprio design); senão, os campos flat de
// sempre (page/headerHeight/.../schemas) viram a única página implícita —
// mesmo caminho de código pros dois casos, sem branch "single vs multi".
export function normalizePageDefs(template: Template): TemplatePage[] {
  if (template.pages && template.pages.length > 0) return template.pages;
  return [
    {
      id: "single",
      page: template.page,
      headerHeight: template.headerHeight,
      footerHeight: template.footerHeight,
      marginLeft: template.marginLeft,
      marginRight: template.marginRight,
      backgroundImage: template.backgroundImage,
      schemas: template.schemas,
    },
  ];
}

// Total de páginas que a sequência do corpo (tabela/seção/texto/imagem, em
// ordem de Y) de UMA página vai ocupar — matemática pura (sem pdf-lib),
// calculada antes de desenhar qualquer coisa, pra {pageCount} já sair certo
// desde a primeira página física de todo o documento (soma de todas as
// páginas do template). Simula a mesma conta de fatiamento/encadeamento do
// loop de desenho real (generate.ts), sem criar página nenhuma.
export function countBodyPages(
  pageDef: TemplatePage,
  bodyItems: BodyItem[],
  bodyBottomMm: number,
  headerHeight: number,
  bindings: Binding[],
  data: unknown,
  inputs: Record<string, string>
): number {
  if (bodyItems.length === 0) return 1;
  let pages = 1;
  let cursorTopMm = boundsOf(bodyItems[0]).y;
  let prev: { y: number; height: number } | undefined;

  for (const item of bodyItems) {
    const bounds = boundsOf(item);
    if (prev) cursorTopMm += gapAfter(prev, bounds);
    prev = bounds;
    if (cursorTopMm >= bodyBottomMm) {
      pages++;
      cursorTopMm = headerHeight;
    }

    if (item.kind === "row") {
      const availableMm = bodyBottomMm - cursorTopMm;
      if (needsNewPageForItem(item.height, availableMm, cursorTopMm, headerHeight)) {
        pages++;
        cursorTopMm = headerHeight;
      }
      cursorTopMm += item.height;
      continue;
    }

    if (item.kind === "table") {
      const table = item.schema;
      const repeatHeader = table.repeatHeader !== false;
      const hasFooter = Boolean(table.footer && table.footer.length > 0);
      let remaining = resolveTopLevelTableRows(table, bindings, data, inputs).length;
      let isFirstSlice = true;
      for (let guard = 0; guard < 1000; guard++) {
        const includeHead = isFirstSlice || repeatHeader;
        const availableMm = bodyBottomMm - cursorTopMm;
        const slice = computeTableSlice(remaining, availableMm, includeHead, hasFooter);
        remaining -= slice.rowsToTake;
        cursorTopMm += slice.heightMm;
        isFirstSlice = false;
        if (remaining <= 0 || slice.capacity <= 0) break;
        pages++;
        cursorTopMm = headerHeight;
      }
    } else {
      const section = item.schema;
      const sectionItems = resolveSectionItems(section, bindings, data);
      let index = 0;
      for (let guard = 0; guard < 20000 && index < sectionItems.length; guard++) {
        const instanceHeight = sectionInstanceHeight(pageDef, section, sectionItems[index], bindings);
        const availableMm = bodyBottomMm - cursorTopMm;
        if (needsNewPageForItem(instanceHeight, availableMm, cursorTopMm, headerHeight)) {
          pages++;
          cursorTopMm = headerHeight;
          continue;
        }
        cursorTopMm += instanceHeight;
        index++;
      }
    }
  }
  return pages;
}
