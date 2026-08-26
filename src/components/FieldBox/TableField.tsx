import { useState } from "react";
import type { Schema, TableSchema } from "../../types";

type Props = {
  schema: TableSchema;
  editing: boolean;
  onUpdate?: (patch: Partial<Schema>) => void;
  onStopEditing?: () => void;
};

export function TableField({ schema, editing, onUpdate, onStopEditing }: Props) {
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

  // table-layout fixed trava a largura das colunas na divisão igual (igual
  // ao drawTable.ts na geração real) — sem isso, célula de rodapé com
  // token comprido (ex: "{SUM(faturas.total)}") força a coluna toda mais
  // larga que a tabela, estourando pra direita, fora da grid do campo.
  const cellClipStyle: React.CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

  // Fora do modo de edição, esconde a função por trás do token (ex:
  // "{CURRENCY(tarKandir, "R$", 2)}" vira só "{tarKandir}") — o tipo de
  // dado (ver PropertyPanel) continua valendo na hora de gerar o PDF, só
  // não polui o preview do canvas com a fórmula inteira. Célula com texto
  // fixo + token misturado (ex: "FAT-{fatura}") não bate no formato função
  // isolada, então fica como está.
  function displayCell(cell: string): string {
    const wrapped = cell.trim().match(/^\{(.*)\}$/s);
    if (!wrapped) return cell;
    const call = wrapped[1].match(/^[A-Za-z]+\((.*)\)$/s);
    if (!call) return cell;
    const path = call[1].split(",")[0]?.trim();
    return path ? `{${path}}` : cell;
  }

  return (
    <table
      className="overflow-hidden rounded-md"
      style={{ width: "100%", height: "100%", borderCollapse: "collapse", fontSize: 10, tableLayout: "fixed" }}
    >
      <thead>
        <tr>
          {schema.head.map((h, i) => {
            const colStyle = schema.columnStyles?.[i];
            return (
              <th
                key={i}
                className="border border-slate-300 px-1.5 py-1"
                style={{
                  ...cellClipStyle,
                  backgroundColor: colStyle?.headBackgroundColor ?? headBg,
                  color: colStyle?.headTextColor ?? headColor,
                  fontSize: colStyle?.headFontSize ?? schema.headFontSize,
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
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {schema.content.map((row, ri) => (
          <tr key={ri} className={ri % 2 === 1 ? "bg-slate-50" : undefined}>
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
        ))}
      </tbody>
      {schema.footer && schema.footer.length > 0 && (
        <tfoot>
          <tr>
            {schema.footer.map((cell, i) => (
              <td
                key={i}
                className="border border-slate-300 px-1.5 py-1 font-medium"
                style={{ ...cellClipStyle, backgroundColor: footerBg, color: footerColor, fontSize: schema.footerFontSize }}
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
  );
}
