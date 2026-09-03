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

  const headBg = schema.headBackgroundColor ?? "#0284c7";
  const headColor = schema.headTextColor ?? "#ffffff";
  const footerBg = schema.footerBackgroundColor ?? "#e5e7eb";
  const footerColor = schema.footerTextColor ?? "#000000";
  const hasFooter = Boolean(schema.footer && schema.footer.length > 0);

  // Alinhamento por bloco (cabeçalho/corpo/rodapé) — ausente = esquerda/
  // meio, igual sempre foi (mesmos defaults de pdf/render/renderTable.ts).
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
  // que pdf/render/renderTable.ts usa em pt) e já convertida pra px pro CSS —
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

  // Aproximação visual de cantos arredondados — o canvas não precisa ser
  // pixel-perfeito (o PDF gerado, via pdf/render/renderTable.ts, é a fonte da
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
    <div className="jpd-table__wrap" style={wrapperRadiusPx}>
      {/* `table-layout: fixed` e o recorte por célula vivem no CSS
          (.jpd-fieldtable / .jpd-table__cell) — ver o comentário lá: sem eles
          uma célula de rodapé com token comprido alarga a coluna e estoura a
          tabela pra fora da grid do campo. */}
      <table className="jpd-fieldtable">
        <thead>
          <tr>
            {schema.head.map((h, i) => {
              const colStyle = schema.columnStyles?.[i];
              return (
                <th
                  key={i}
                  className="jpd-table__cell"
                  data-role="head"
                  style={{
                    width: colWidthsPx[i],
                    backgroundColor: colStyle?.headBackgroundColor ?? headBg,
                    color: colStyle?.headTextColor ?? headColor,
                    fontSize: colStyle?.headFontSize ?? schema.headFontSize,
                    textAlign: headAlign,
                    verticalAlign: vAlignCss(headVAlign),
                    borderColor: schema.borderColor,
                  }}
                >
                  {editing ? (
                    <input
                      value={h}
                      onChange={(e) => updateHead(i, e.target.value)}
                      onKeyDown={onKeyDown}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="jpd-cell-input"
                    />
                  ) : (
                    h
                  )}
                  {i < schema.head.length - 1 && (
                    <div onMouseDown={(e) => startColumnResize(i, e)} className="jpd-table__resizer" />
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
              // TRÊS estados, não dois: linha não zebrada não tem nada; zebrada
              // com cor do schema usa a cor (inline, que vence a @layer);
              // zebrada sem cor cai no zebrado embutido, que agora vem do
              // [data-banded] no CSS. Trocar isto por só `data-banded` mataria
              // o caminho da cor do schema.
              <tr key={ri} className="jpd-table__row" data-banded={banded || undefined} style={bandColor && banded ? { backgroundColor: bandColor } : undefined}>
                {row.map((cell, ci) => {
                  const colStyle = schema.columnStyles?.[ci];
                  return (
                    <td
                      key={ci}
                      className="jpd-table__cell"
                      data-role="body"
                      style={{
                        backgroundColor: colStyle?.cellBackgroundColor ?? schema.bodyBackgroundColor,
                        color: colStyle?.cellTextColor ?? schema.bodyTextColor,
                        fontSize: colStyle?.cellFontSize ?? schema.bodyFontSize,
                        textAlign: bodyAlign,
                        verticalAlign: vAlignCss(bodyVAlign),
                        borderColor: schema.borderColor,
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
                          className="jpd-cell-input"
                        />
                      ) : editing ? (
                        <div
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => setFocusedCell({ row: "body", ri, ci })}
                          className="jpd-cell-text"
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
                  className="jpd-table__cell"
                  data-role="foot"
                  style={{
                    backgroundColor: footerBg,
                    color: footerColor,
                    fontSize: schema.footerFontSize,
                    textAlign: footerAlign,
                    verticalAlign: vAlignCss(footerVAlign),
                    borderColor: schema.borderColor,
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
                      className="jpd-cell-input"
                    />
                  ) : editing ? (
                    <div
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => setFocusedCell({ row: "footer", ri: 0, ci: i })}
                      className="jpd-cell-text"
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
