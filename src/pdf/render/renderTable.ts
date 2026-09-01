import type { Color } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";
import type { TableCornerRadii, TableSchema } from "../../types";
import { resolveColumnWidthsMm } from "../../table/layout";
import { mmToPt, ptToMm } from "../../units";
import { colorOrDefault, parseHex } from "../color";
import { roundedRectPath } from "../svgShapes";
import { alignX, alignY, truncateToWidth } from "../textLayout";
import { TABLE_ROW_HEIGHT_MM } from "../tableMetrics";
import { withGlyphContext } from "../textSafety";

const CELL_PADDING_PT = mmToPt(1.5);
const BORDER_COLOR = rgb(0.6, 0.6, 0.6);
const DEFAULT_HEAD_BG = rgb(0.16, 0.5, 0.73);
const DEFAULT_HEAD_COLOR = rgb(1, 1, 1);
const DEFAULT_FOOTER_BG = rgb(0.9, 0.9, 0.92);
const DEFAULT_FOOTER_COLOR = rgb(0, 0, 0);
const BODY_FONT_SIZE = 9;
const HEAD_FONT_SIZE = 9;

// Métricas moram em ../tableMetrics.ts (sem pdf-lib, pro layout poder usar).
// Reexportadas daqui porque há quem já importe por este caminho.
export { TABLE_ROW_HEIGHT_MM, tableRowsPerSlice } from "../tableMetrics";

type HAlign = "left" | "center" | "right";
type VAlign = "top" | "middle" | "bottom";

// "#rrggbb"/"#rgb" -> Color do pdf-lib — undefined (fora do try) cai no
// default de quem chamou, pra templates antigos sem essas cores continuar
// exatamente iguais.
function hexToColor(hex: string | undefined): Color | undefined {
  const c = parseHex(hex);
  return c ? rgb(c.r, c.g, c.b) : undefined;
}

// Resolve as cores/tamanhos/alinhamentos de cabeçalho/corpo/rodapé —
// override do schema (schema.headBackgroundColor etc.) com fallback pro
// default embutido de cada bloco. Extraído de drawTableSlice pra função
// pura (sem depender de nada além do schema), reaproveitável/testável à
// parte.
function resolveTableStyles(schema: TableSchema): {
  headBg: Color;
  headColor: Color;
  headSize: number;
  headAlign: HAlign;
  headVAlign: VAlign;
  bodyBg: Color | undefined;
  bodyBandBg: Color | undefined;
  bodyColor: Color;
  bodySize: number;
  bodyAlign: HAlign;
  bodyVAlign: VAlign;
  footerBg: Color;
  footerColor: Color;
  footerSize: number;
  footerAlign: HAlign;
  footerVAlign: VAlign;
  borderColor: Color;
} {
  return {
    headBg: colorOrDefault(schema.headBackgroundColor, DEFAULT_HEAD_BG),
    headColor: colorOrDefault(schema.headTextColor, DEFAULT_HEAD_COLOR),
    headSize: schema.headFontSize ?? HEAD_FONT_SIZE,
    headAlign: schema.headAlign ?? "left",
    headVAlign: schema.headVerticalAlign ?? "middle",
    bodyBg: hexToColor(schema.bodyBackgroundColor),
    bodyBandBg: hexToColor(schema.bodyBandColor),
    bodyColor: colorOrDefault(schema.bodyTextColor, rgb(0, 0, 0)),
    bodySize: schema.bodyFontSize ?? BODY_FONT_SIZE,
    bodyAlign: schema.bodyAlign ?? "left",
    bodyVAlign: schema.bodyVerticalAlign ?? "middle",
    footerBg: colorOrDefault(schema.footerBackgroundColor, DEFAULT_FOOTER_BG),
    footerColor: colorOrDefault(schema.footerTextColor, DEFAULT_FOOTER_COLOR),
    footerSize: schema.footerFontSize ?? BODY_FONT_SIZE,
    footerAlign: schema.footerAlign ?? "left",
    footerVAlign: schema.footerVerticalAlign ?? "middle",
    borderColor: colorOrDefault(schema.borderColor, BORDER_COLOR),
  };
}

// Trunca o texto da célula, mede a largura resultante e calcula a posição
// final (x, y absolutos) já alinhada dentro da célula — extraído de
// drawRow pra função à parte (usada tanto pro texto de célula quanto,
// futuramente, por qualquer outro bloco de texto alinhado numa caixa).
function cellTextPosition(
  cellX: number,
  cursorY: number,
  colWidth: number,
  rowHeightPt: number,
  align: HAlign,
  vAlign: VAlign,
  text: string,
  font: PDFFont,
  fontSize: number,
  paddingPt: number
): { x: number; y: number; truncated: string } {
  const truncated = truncateToWidth(text, font, fontSize, colWidth - paddingPt * 2);
  const textWidth = font.widthOfTextAtSize(truncated, fontSize);
  const x = cellX + alignX(align, colWidth, textWidth, paddingPt);
  const y = cursorY + alignY(vAlign, rowHeightPt, fontSize, paddingPt);
  return { x, y, truncated };
}

// Desenha (opcionalmente) cabeçalho + um bloco de linhas começando no topo
// (topYPt, sistema pdf-lib com origem embaixo-esquerda) indo pra baixo.
// Usada tanto pra tabela de página única quanto por fatia, quando pagina
// em várias páginas. Retorna o Y (pt) da base da última linha desenhada,
// pra caller saber onde a fatia terminou.
//
// `isLastSlice` (default true — seguro pros call-sites que nunca paginam,
// tabela solta em header/footer/margem) diz se ESTA chamada é a última
// fatia de verdade da tabela inteira — usado só pra decidir onde os
// cantos arredondados de BAIXO (bodyBorderRadius/footerBorderRadius) se
// aplicam: corpo/rodapé só arredondam o fundo na fatia REALMENTE final
// (senão uma tabela de 3 páginas ficaria com "cantos arredondados" no meio
// dela). O cabeçalho arredonda o TOPO toda vez que É desenhado (repetir em
// toda página, se `repeatHeader`, é esperado repetir o arredondamento
// também) — não depende de `isLastSlice`.
export function drawTableSlice(
  page: PDFPage,
  font: PDFFont,
  schema: TableSchema,
  rows: string[][],
  xPt: number,
  topYPt: number,
  widthPt: number,
  includeHead = true,
  // Linha de totais — só desenha se informada (chamador decide QUANDO,
  // ex: só na última fatia de uma tabela que pagina — ver generate.ts).
  footerRow?: string[],
  isLastSlice = true
): number {
  // Envolve a função INTEIRA: os três caminhos de tabela (corpo, faixa
  // repetida, aninhada numa seção) passam por aqui, então um lugar só cobre
  // todos. O provedor de texto é lazy — só roda se já houve erro.
  return withGlyphContext(
    schema.name,
    () => [...schema.head, ...rows.flat(), ...(footerRow ?? [])],
    font,
    schema.bodyFontSize ?? 9,
    () => drawTableSliceInner(page, font, schema, rows, xPt, topYPt, widthPt, includeHead, footerRow, isLastSlice)
  );
}

function drawTableSliceInner(
  page: PDFPage,
  font: PDFFont,
  schema: TableSchema,
  rows: string[][],
  xPt: number,
  topYPt: number,
  widthPt: number,
  includeHead: boolean,
  footerRow: string[] | undefined,
  isLastSlice: boolean
): number {
  const head = schema.head;
  const colCount = head.length || (rows[0]?.length ?? footerRow?.length ?? 1);
  if (colCount === 0) return topYPt;

  const colWidthsPt = resolveColumnWidthsMm(schema.columnWidths, colCount, ptToMm(widthPt)).map(mmToPt);
  const colOffsetsPt: number[] = [];
  {
    let acc = 0;
    for (const w of colWidthsPt) {
      colOffsetsPt.push(acc);
      acc += w;
    }
  }
  const rowHeightPt = mmToPt(TABLE_ROW_HEIGHT_MM);
  let cursorY = topYPt;

  const {
    headBg,
    headColor,
    headSize,
    headAlign,
    headVAlign,
    bodyBg,
    bodyBandBg,
    bodyColor,
    bodySize,
    bodyAlign,
    bodyVAlign,
    footerBg,
    footerColor,
    footerSize,
    footerAlign,
    footerVAlign,
    borderColor,
  } = resolveTableStyles(schema);

  // Tabela TEM rodapé (em alguma fatia, não necessariamente esta) — corpo
  // nunca arredonda o próprio canto de baixo quando isso é verdade (quem
  // fecha o canto de baixo é o rodapé, ver headBorderRadius/
  // bodyBorderRadius/footerBorderRadius em types/schema.ts).
  const tableHasFooter = Boolean(schema.footer && schema.footer.length > 0);

  function radiiOrZero(r: TableCornerRadii | undefined): { tl: number; tr: number; bl: number; br: number } {
    return { tl: mmToPt(r?.topLeft ?? 0), tr: mmToPt(r?.topRight ?? 0), bl: mmToPt(r?.bottomLeft ?? 0), br: mmToPt(r?.bottomRight ?? 0) };
  }

  // Fundo (se houver) + moldura da linha — quando algum canto é
  // arredondado, desenha os DOIS (preenchimento e contorno) num `drawSvgPath`
  // só, senão o contorno reto de cada célula (desenhado à parte, no loop de
  // colunas abaixo) ficaria "espiando" quadrado por baixo do preenchimento
  // arredondado (bug real reportado: cantos pareciam retos mesmo com
  // borderRadius definido). Sem NENHUM canto arredondado, continua um
  // `drawRectangle` reto de sempre (ou nada, se não tiver cor de fundo) —
  // regressão intacta. Retorna se desenhou a moldura arredondada, pro loop
  // de colunas saber se ainda precisa desenhar a borda de fora de cada
  // célula (não precisa — só os divisores internos entre colunas).
  function drawRowFrame(
    y: number,
    width: number,
    fillColor: Color | undefined,
    corners: { tl: number; tr: number; bl: number; br: number } | null
  ): boolean {
    const rounded = Boolean(corners && (corners.tl || corners.tr || corners.bl || corners.br));
    if (rounded) {
      page.drawSvgPath(roundedRectPath(width, rowHeightPt, corners!), {
        x: xPt,
        y: y + rowHeightPt,
        color: fillColor,
        borderColor,
        borderWidth: 0.5,
      });
      return true;
    }
    if (fillColor) {
      page.drawRectangle({ x: xPt, y, width, height: rowHeightPt, color: fillColor });
    }
    return false;
  }

  // Fundo/cor/tamanho: override por coluna (mais específico) > estilo da
  // linha toda (header/valor/rodapé, campos da tabela acima) > default
  // embutido. Rodapé não tem override por coluna, só linha toda.
  function drawRow(
    cells: string[],
    variant: "head" | "body" | "footer",
    allowTopRadius: boolean,
    allowBottomRadius: boolean,
    banded: boolean
  ) {
    cursorY -= rowHeightPt;
    const rowWidthPt = colOffsetsPt[colCount - 1] + colWidthsPt[colCount - 1];
    // Cada bloco só arredonda o(s) canto(s) que fazem sentido pra ELE —
    // cabeçalho é sempre o topo (nunca o próprio fundo, o corpo desenha
    // logo abaixo); rodapé é sempre a base (nunca o próprio topo); corpo
    // só arredonda a base, e só na linha REALMENTE final (allowBottomRadius),
    // nunca o topo (o cabeçalho já cobre isso). Ver comentário de
    // TableCornerRadii em types/schema.ts.
    const corners =
      allowTopRadius || allowBottomRadius
        ? variant === "head"
          ? { ...radiiOrZero(schema.headBorderRadius), bl: 0, br: 0 }
          : variant === "footer"
            ? { ...radiiOrZero(schema.footerBorderRadius), tl: 0, tr: 0 }
            : { ...radiiOrZero(schema.bodyBorderRadius), tl: 0, tr: 0 }
        : null;
    const roundedFrame =
      variant === "footer"
        ? drawRowFrame(cursorY, rowWidthPt, footerBg, corners)
        : variant === "body"
          ? drawRowFrame(cursorY, rowWidthPt, banded && bodyBandBg ? bodyBandBg : bodyBg, corners)
          : drawRowFrame(cursorY, rowWidthPt, headBg, corners);
    const align = variant === "head" ? headAlign : variant === "footer" ? footerAlign : bodyAlign;
    const vAlign = variant === "head" ? headVAlign : variant === "footer" ? footerVAlign : bodyVAlign;
    for (let c = 0; c < colCount; c++) {
      const cellX = xPt + colOffsetsPt[c];
      const colWidth = colWidthsPt[c];
      const colStyle = schema.columnStyles?.[c];
      const fontSize =
        variant === "head" ? colStyle?.headFontSize ?? headSize : variant === "body" ? colStyle?.cellFontSize ?? bodySize : footerSize;
      const textColor =
        variant === "head"
          ? colorOrDefault(colStyle?.headTextColor, headColor)
          : variant === "footer"
            ? footerColor
            : colorOrDefault(colStyle?.cellTextColor, bodyColor);
      // Override por coluna é a única coisa que ainda desenha um retângulo
      // POR CÉLULA — a cor "de linha toda" (default de cabeçalho/corpo) já
      // sai no fundo da própria linha (drawRowBackground acima), pra não
      // desenhar 2x a mesma cor E pra não "re-quadrar" um canto arredondado
      // por cima dele com N retângulos retos, um por coluna.
      const cellBg =
        variant === "head" ? hexToColor(colStyle?.headBackgroundColor) : variant === "body" ? hexToColor(colStyle?.cellBackgroundColor) : undefined;
      if (cellBg) {
        page.drawRectangle({ x: cellX, y: cursorY, width: colWidth, height: rowHeightPt, color: cellBg });
      }
      const text = cells[c] ?? "";
      const { x, y, truncated } = cellTextPosition(cellX, cursorY, colWidth, rowHeightPt, align, vAlign, text, font, fontSize, CELL_PADDING_PT);
      page.drawText(truncated, { x, y, size: fontSize, font, color: textColor });
      // Quando a linha teve o contorno externo já desenhado arredondado
      // (drawRowFrame acima), NÃO redesenha um retângulo reto de 4 lados
      // por cima dele (era exatamente isso que deixava o canto parecendo
      // quadrado mesmo com o preenchimento arredondado) — só o divisor
      // interno entre colunas, reto mesmo (não faz parte do contorno
      // externo). Sem arredondamento nenhum, comportamento idêntico a
      // antes: retângulo reto de sempre, célula por célula.
      if (roundedFrame) {
        if (c < colCount - 1) {
          page.drawLine({
            start: { x: cellX + colWidth, y: cursorY },
            end: { x: cellX + colWidth, y: cursorY + rowHeightPt },
            thickness: 0.5,
            color: borderColor,
          });
        }
      } else {
        page.drawRectangle({
          x: cellX,
          y: cursorY,
          width: colWidth,
          height: rowHeightPt,
          borderColor,
          borderWidth: 0.5,
        });
      }
    }
  }

  if (includeHead) drawRow(head, "head", true, false, false);
  rows.forEach((row, i) => {
    const isFinalBodyRow = isLastSlice && i === rows.length - 1 && !footerRow;
    drawRow(row, "body", false, isFinalBodyRow && !tableHasFooter, i % 2 === 1);
  });
  if (footerRow) drawRow(footerRow, "footer", false, true, false);
  return cursorY;
}
