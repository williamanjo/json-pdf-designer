import { useState } from "react";
import type { Schema, TableSchema } from "../../types";
import { resolveColumnWidthsMm } from "../../table/layout";
import { mmToPx, pxToMm } from "../../units";
import { displayCell } from "../../table/columnFormula";
import { resizeColumnPair } from "../../table/columnResize";
import { startDragGesture } from "../dragGesture";

type Props = {
  schema: TableSchema;
  editing: boolean;
  onUpdate?: (patch: Partial<Schema>) => void;
  onStopEditing?: () => void;
  // Zoom atual do canvas (PageCanvas.tsx) — só usado pro handle de
  // redimensionar coluna (converte delta de mouse em px de TELA pra mm
  // real, mesmo motivo do `zoom` que KpiField.tsx já recebe).
  zoom?: number;
};

export function TableField({ schema, editing, onUpdate, onStopEditing, zoom = 1 }: Props) {
  function updateHead(index: number, value: string) {
    const head = schema.head.slice();
    head[index] = value;
    onUpdate?.({ head });
  }

  function updateCell(rowIndex: number, colIndex: number, value: string) {
    const content = schema.content.map((row) => row.slice());
    content[rowIndex][colIndex] = value;
    onUpdate?.({ content });
  }

  function updateFooterCell(colIndex: number, value: string) {
    const footer = (schema.footer ?? schema.head.map(() => "")).slice();
    footer[colIndex] = value;
    onUpdate?.({ footer });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onStopEditing?.();
  }

  // Modo de edição (double-click) libera a tabela toda, mas mostrar
  // TODAS as células como <input> de uma vez faz cada uma exibir a
  // fórmula crua junto (ex: "{CURRENCY(tarFatura, "R$", 2)}") — poluído e
  // estoura a grid (ver cellClipStyle). Só a célula com foco (clicada)
  // vira input com a fórmula crua; as outras ficam como texto limpo
  // (displayCell), igual fora do modo de edição.
  const [focusedCell, setFocusedCell] = useState<{ row: "body" | "footer"; ri: number; ci: number } | null>(null);

  const cellInputStyle: React.CSSProperties = {
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    font: "inherit",
    color: "inherit",
    padding: 0,
  };

  const headBg = schema.headBackgroundColor ?? "#0284c7";
  const headColor = schema.headTextColor ?? "#ffffff";
  const footerBg = schema.footerBackgroundColor ?? "#e5e7eb";
  const footerColor = schema.footerTextColor ?? "#000000";
  const hasFooter = Boolean(schema.footer && schema.footer.length > 0);

  // Alinhamento por bloco (cabeçalho/corpo/rodapé) — ausente = esquerda/
  // meio, igual sempre foi (mesmos defaults de pdf/drawTable.ts).
  const headAlign = schema.headAlign ?? "left";
  const headVAlign = schema.headVerticalAlign ?? "middle";
  const bodyAlign = schema.bodyAlign ?? "left";
  const bodyVAlign = schema.bodyVerticalAlign ?? "middle";
  const footerAlign = schema.footerAlign ?? "left";
  const footerVAlign = schema.footerVerticalAlign ?? "middle";
  function vAlignCss(v: "top" | "middle" | "bottom"): React.CSSProperties["verticalAlign"] {
    return v; // valores batem 1:1 com CSS vertical-align pra célula de tabela
  }

  // Largura por coluna, em mm (fonte única da verdade, mesma função pura
  // que pdf/drawTable.ts usa em pt) e já convertida pra px pro CSS —
  // ausente em tudo = divisão igual de sempre.
  const colWidthsMm = resolveColumnWidthsMm(schema.columnWidths, schema.head.length, schema.width);
  const colWidthsPx = colWidthsMm.map(mmToPx);

  // Arrasta o divisor entre a coluna `index` e a seguinte — ajusta as DUAS
  // (delta oposto), mantendo a largura TOTAL da tabela constante, igual
  // uma planilha. Wiring do arrasto via startDragGesture (mesmo padrão de
  // KpiField.tsx); a matemática de clamp/giveback vive em resizeColumnPair.
  function startColumnResize(index: number, e: React.MouseEvent) {
    e.preventDefault();
    if (!onUpdate) return;
    const startLeft = colWidthsMm[index];
    const startRight = colWidthsMm[index + 1];
    const widths = schema.columnWidths ? schema.columnWidths.slice() : schema.head.map(() => undefined);

    startDragGesture(e, (dx) => {
      const dxMm = pxToMm(dx / zoom);
      const minMm = 10;
      const { left, right } = resizeColumnPair(startLeft, startRight, dxMm, minMm);
      const next = widths.slice();
      next[index] = left;
      next[index + 1] = right;
      onUpdate?.({ columnWidths: next });
    });
  }

  // table-layout fixed trava a largura das colunas na divisão calculada
  // (igual ao drawTable.ts na geração real) — sem isso, célula de rodapé
  // com token comprido (ex: "{SUM(faturas.total)}") força a coluna toda
  // mais larga que a tabela, estourando pra direita, fora da grid do campo.
  const cellClipStyle: React.CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

  // Aproximação visual de cantos arredondados — o canvas não precisa ser
  // pixel-perfeito (o PDF gerado, via pdf/drawTable.ts, é a fonte da
  // verdade); um `overflow: hidden` recorta os 4 cantos da MOLDURA
  // inteira de uma vez, já que aqui (ao contrário do PDF) não tem como
  // "só" o cabeçalho ou "só" o rodapé terem fundo colorido recortado sem
  // recortar o resto junto — suficiente pra dar a mesma ideia no editor.
  const bottomRadii = hasFooter ? schema.footerBorderRadius : schema.bodyBorderRadius;
  const wrapperRadiusPx = {
    borderTopLeftRadius: mmToPx(schema.headBorderRadius?.topLeft ?? 0),
    borderTopRightRadius: mmToPx(schema.headBorderRadius?.topRight ?? 0),
    borderBottomLeftRadius: mmToPx(bottomRadii?.bottomLeft ?? 0),
    borderBottomRightRadius: mmToPx(bottomRadii?.bottomRight ?? 0),
  };

  return (
    <div className="h-full w-full overflow-hidden" style={wrapperRadiusPx}>
      <table
        className="border-collapse"
        style={{ width: "100%", height: "100%", fontSize: 10, tableLayout: "fixed" }}
      >
        <thead>
          <tr>
            {schema.head.map((h, i) => {
              const colStyle = schema.columnStyles?.[i];
              return (
                <th
                  key={i}
                  className="relative border border-slate-300 px-1.5 py-1"
                  style={{
                    ...cellClipStyle,
                    width: colWidthsPx[i],
                    backgroundColor: colStyle?.headBackgroundColor ?? headBg,
                    color: colStyle?.headTextColor ?? headColor,
                    fontSize: colStyle?.headFontSize ?? schema.headFontSize,
                    textAlign: headAlign,
                    verticalAlign: vAlignCss(headVAlign),
                  }}
                >
                  {editing ? (
                    <input
                      value={h}
                      onChange={(e) => updateHead(i, e.target.value)}
                      onKeyDown={onKeyDown}
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{ ...cellInputStyle, color: "inherit", textAlign: "inherit" }}
                    />
                  ) : (
                    h
                  )}
                  {i < schema.head.length - 1 && (
                    <div
                      onMouseDown={(e) => startColumnResize(i, e)}
                      className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-sky-400/40"
                      style={{ transform: "translateX(50%)" }}
                    />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {schema.content.map((row, ri) => {
            const banded = ri % 2 === 1;
            const bandColor = schema.bodyBandColor;
            return (
              <tr
                key={ri}
                style={banded && bandColor ? { backgroundColor: bandColor } : undefined}
                className={banded && !bandColor ? "bg-slate-50" : undefined}
              >
                {row.map((cell, ci) => {
                  const colStyle = schema.columnStyles?.[ci];
                  return (
                    <td
                      key={ci}
                      className="border border-slate-300 px-1.5 py-1"
                      style={{
                        ...cellClipStyle,
                        backgroundColor: colStyle?.cellBackgroundColor ?? schema.bodyBackgroundColor,
                        color: colStyle?.cellTextColor ?? schema.bodyTextColor,
                        fontSize: colStyle?.cellFontSize ?? schema.bodyFontSize,
                        textAlign: bodyAlign,
                        verticalAlign: vAlignCss(bodyVAlign),
                      }}
                    >
                      {editing && focusedCell?.row === "body" && focusedCell.ri === ri && focusedCell.ci === ci ? (
                        <input
                          autoFocus
                          value={cell}
                          onChange={(e) => updateCell(ri, ci, e.target.value)}
                          onBlur={() => setFocusedCell(null)}
                          onKeyDown={onKeyDown}
                          onPointerDown={(e) => e.stopPropagation()}
                          style={{ ...cellInputStyle, color: "inherit" }}
                        />
                      ) : editing ? (
                        <div
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => setFocusedCell({ row: "body", ri, ci })}
                          style={{ cursor: "text", minHeight: "1em" }}
                        >
                          {displayCell(cell)}
                        </div>
                      ) : (
                        displayCell(cell)
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        {schema.footer && schema.footer.length > 0 && (
          <tfoot>
            <tr>
              {schema.footer.map((cell, i) => (
                <td
                  key={i}
                  className="border border-slate-300 px-1.5 py-1 font-medium"
                  style={{
                    ...cellClipStyle,
                    backgroundColor: footerBg,
                    color: footerColor,
                    fontSize: schema.footerFontSize,
                    textAlign: footerAlign,
                    verticalAlign: vAlignCss(footerVAlign),
                  }}
                >
                  {editing && focusedCell?.row === "footer" && focusedCell.ci === i ? (
                    <input
                      autoFocus
                      value={cell}
                      onChange={(e) => updateFooterCell(i, e.target.value)}
                      onBlur={() => setFocusedCell(null)}
                      onKeyDown={onKeyDown}
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{ ...cellInputStyle, color: "inherit" }}
                    />
                  ) : editing ? (
                    <div
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setFocusedCell({ row: "footer", ri: 0, ci: i })}
                      style={{ cursor: "text", minHeight: "1em" }}
                    >
                      {cell}
                    </div>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
