import { useState } from "react";
import type { Schema, TableSchema } from "../../types";
import { resolveColumnWidthsMm } from "../../fields/table/layout";
import { mmToPx, pxToMm } from "../../page/units";
import { displayCell } from "../../fields/table/columnFormula";
import { resizeColumnPair } from "../../fields/table/columnResize";
import { startDragGesture } from "../../canvas/dragGesture";

type Props = {
  schema: TableSchema;
  editing: boolean;
  onUpdate?: (patch: Partial<Schema>) => void;
  onStopEditing?: () => void;
  // Current canvas zoom (PageCanvas.tsx) — used only by the column resize
  // handle (it converts a mouse delta in SCREEN px into real mm, same
  // reason as the `zoom` KpiField.tsx already receives).
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

  // Editing mode (double-click) unlocks the whole table, but showing ALL
  // cells as <input> at once makes each of them display its raw formula
  // too (e.g. "{CURRENCY(tarFatura, "R$", 2)}") — cluttered, and it
  // overflows the grid (see cellClipStyle). Only the focused cell (the one
  // clicked) becomes an input with the raw formula; the others stay as
  // clean text (displayCell), just like outside editing mode.
  const [focusedCell, setFocusedCell] = useState<{ row: "body" | "footer"; ri: number; ci: number } | null>(null);

  const headBg = schema.headBackgroundColor ?? "#0284c7";
  const headColor = schema.headTextColor ?? "#ffffff";
  const footerBg = schema.footerBackgroundColor ?? "#e5e7eb";
  const footerColor = schema.footerTextColor ?? "#000000";
  const hasFooter = Boolean(schema.footer && schema.footer.length > 0);

  // Alignment per block (header/body/footer) — absent means left/middle,
  // as it always was (same defaults as pdf/render/renderTable.ts).
  const headAlign = schema.headAlign ?? "left";
  const headVAlign = schema.headVerticalAlign ?? "middle";
  const bodyAlign = schema.bodyAlign ?? "left";
  const bodyVAlign = schema.bodyVerticalAlign ?? "middle";
  const footerAlign = schema.footerAlign ?? "left";
  const footerVAlign = schema.footerVerticalAlign ?? "middle";
  function vAlignCss(v: "top" | "middle" | "bottom"): React.CSSProperties["verticalAlign"] {
    return v; // values map 1:1 to CSS vertical-align for a table cell
  }

  // Width per column, in mm (single source of truth, the same pure function
  // pdf/render/renderTable.ts uses in pt) and already converted to px for the
  // CSS — absent everywhere means the usual equal split.
  const colWidthsMm = resolveColumnWidthsMm(schema.columnWidths, schema.head.length, schema.width);
  const colWidthsPx = colWidthsMm.map(mmToPx);

  // Drags the divider between column `index` and the next one — it adjusts
  // BOTH (opposite deltas), keeping the table's TOTAL width constant, like
  // a spreadsheet. Drag wiring goes through startDragGesture (same pattern
  // as KpiField.tsx); the clamp/giveback math lives in resizeColumnPair.
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

  // A visual approximation of rounded corners — the canvas does not have
  // to be pixel-perfect (the generated PDF, via pdf/render/renderTable.ts,
  // is the source of truth); an `overflow: hidden` clips all 4 corners of
  // the WHOLE frame at once, since here (unlike in the PDF) there is no way
  // for "only" the header or "only" the footer to have a clipped colored
  // background without clipping the rest too — enough for the same idea.
  const bottomRadii = hasFooter ? schema.footerBorderRadius : schema.bodyBorderRadius;
  const wrapperRadiusPx = {
    borderTopLeftRadius: mmToPx(schema.headBorderRadius?.topLeft ?? 0),
    borderTopRightRadius: mmToPx(schema.headBorderRadius?.topRight ?? 0),
    borderBottomLeftRadius: mmToPx(bottomRadii?.bottomLeft ?? 0),
    borderBottomRightRadius: mmToPx(bottomRadii?.bottomRight ?? 0),
  };

  return (
    <div className="jpd-table__wrap" style={wrapperRadiusPx}>
      {/* `table-layout: fixed` and the per-cell clipping live in the CSS
          (.jpd-fieldtable / .jpd-table__cell) — see the comment there: without
          them a footer cell holding a long token widens the column and pushes
          the table outside the field's grid. */}
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
              // THREE states, not two: a non-banded row gets nothing; a banded row
              // with a schema color uses that color (inline, which beats the
              // @layer); a banded row without a color falls back to the
              // built-in banding, which now comes from [data-banded] in CSS.
              // Using `data-banded` alone would kill the schema-color path.
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
