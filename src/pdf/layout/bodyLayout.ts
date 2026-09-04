import type { Schema, TemplatePage } from "../../types";
import { classifyZone } from "../../page/zones";
import type { BodyItem, FlowBounds } from "./layoutTypes";

export function boundsOf(item: BodyItem): FlowBounds {
  return item.kind === "row" ? { y: item.y, height: item.height } : { y: item.schema.y, height: item.schema.height };
}

// Agrupa os schemas do corpo em BodyItem, na ordem em que aparecem na
// página (por Y) — tabela/seção viram um item cada; qualquer outro campo
// (texto/imagem/gráfico/indicador) que compartilhe o MESMO y autorado com
// o item anterior entra na mesma "row" em vez de virar um item à parte
// (ver comentário do BodyItem em layoutTypes.ts pro motivo).
export function buildBodyItems(bodySchemas: Schema[]): BodyItem[] {
  const bodyItems: BodyItem[] = [];
  for (const s of bodySchemas.slice().sort((a, b) => a.y - b.y)) {
    if (s.type === "table") {
      bodyItems.push({ kind: "table", schema: s });
      continue;
    }
    if (s.type === "section") {
      bodyItems.push({ kind: "section", schema: s });
      continue;
    }
    const last = bodyItems[bodyItems.length - 1];
    if (last && last.kind === "row" && last.y === s.y) {
      last.schemas.push(s);
      last.height = Math.max(last.height, s.height);
      continue;
    }
    bodyItems.push({ kind: "row", schemas: [s], y: s.y, height: s.height });
  }
  return bodyItems;
}

// Espaço (mm) entre o final de um bloco (tabela ou seção) e o início do
// próximo — respeita o que foi desenhado no editor (a diferença entre
// onde o próximo foi posicionado e onde o anterior "deveria" terminar,
// segundo a altura autorada), nunca um valor fixo. Negativo (blocos
// sobrepostos no editor) vira 0 — não faz sentido empurrar pra cima.
export function gapAfter(prev: FlowBounds, next: FlowBounds): number {
  return Math.max(next.y - (prev.y + prev.height), 0);
}

// Deriva, de UMA página (TemplatePage), tudo que a paginação/desenho
// precisam — mesma conta de sempre, só que parametrizada por pageDef em vez
// do Template inteiro (permite rodar uma vez por página quando há mais de
// uma).
export function deriveBodyLayout(pageDef: TemplatePage) {
  const headerHeight = pageDef.headerHeight ?? 0;
  const footerHeight = pageDef.footerHeight ?? 0;
  const bodyBottomMm = pageDef.page.height - footerHeight;
  const bands = {
    headerHeight,
    footerHeight,
    marginLeft: pageDef.marginLeft ?? 0,
    marginRight: pageDef.marginRight ?? 0,
  };
  // Campo com sectionId nunca desenha por conta própria — só através da
  // repetição da seção dona dele (ver render/renderSection.ts).
  const ownedBySection = (s: Schema) => Boolean(s.sectionId);
  const repeatingSchemas = pageDef.schemas.filter((s) => !ownedBySection(s) && classifyZone(s, pageDef.page, bands) !== "body");
  const bodySchemas = pageDef.schemas.filter((s) => !ownedBySection(s) && classifyZone(s, pageDef.page, bands) === "body");
  const bodyItems = buildBodyItems(bodySchemas);
  return { headerHeight, bodyBottomMm, repeatingSchemas, bodyItems };
}
