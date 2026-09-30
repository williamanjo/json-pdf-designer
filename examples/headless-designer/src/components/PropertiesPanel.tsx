import type { Binding, Dict, Schema, TableColumn } from "json-pdf-designer/server";
import { columnLabel } from "json-pdf-designer/server";
import type { ShellDict } from "../i18n";

type Props = {
  schema: Schema;
  // The field's binding, when there is one — shown read-only (this example
  // has no binding editor: what creates a binding is the field explorer's
  // drop, see App.tsx::dropFieldAt).
  binding: Binding | undefined;
  // The PACKAGE's dictionary (`dictFor(locale)`). Almost everything in this
  // panel is ITS concept — a field type's name, the geometry
  // (X/Y/width/height), `visibleWhen`, and the text/KPI/chart properties.
  // Duplicating those translations here would create two versions of the same
  // phrase to fall out of sync.
  t: Dict;
  // The SHELL's dictionary, only for the three things the package has no
  // equivalent concept for, because they exist only in this example: the
  // "header label + JSON column" list (here the binding side is read-only),
  // the static row editor, and the notice that an image/section is not
  // editable through this panel.
  tt: ShellDict;
  onChange: (patch: Record<string, unknown>) => void;
  onChangeBinding: (next: Binding | undefined) => void;
  onRemove: () => void;
};

// The readable label of a bound column — `columnLabel` belongs to the
// package and resolves both TableColumn formats (a raw key or {label, formula}).
function bindingColumns(binding: Binding | undefined): TableColumn[] {
  return binding && binding.type === "array" ? binding.columns : [];
}

// The selected field's property panel — geometry, conditional visibility and
// whatever makes sense to edit by typing, per type. No `Designer*` part here:
// they are ordinary inputs, styled in this example's index.css.
export default function PropertiesPanel({ schema, binding, t, tt, onChange, onChangeBinding, onRemove }: Props) {
  const columns = bindingColumns(binding);

  function setHeadAt(index: number, label: string) {
    if (schema.type !== "table") return;
    onChange({ head: schema.head.map((h, i) => (i === index ? label : h)) });
  }

  // It removes a column from the HEADER and from the BINDING in the same
  // step. Touching only one of the two throws head[i] out of alignment with
  // binding.columns[i] and the table starts showing another column's data
  // under the wrong label — the classic bug of that pair (and the reason this
  // app's undo stacks template+bindings together, see hooks/useUndoRedo.ts).
  function removeColumn(index: number) {
    if (schema.type !== "table") return;
    onChange({
      head: schema.head.filter((_, i) => i !== index),
      content: schema.content.map((row) => row.filter((_, i) => i !== index)),
    });
    if (binding && binding.type === "array") {
      onChangeBinding({ ...binding, columns: binding.columns.filter((_, i) => i !== index) });
    }
  }

  function addColumn() {
    if (schema.type !== "table") return;
    onChange({
      head: [...schema.head, `col_${schema.head.length + 1}`],
      content: schema.content.map((row) => [...row, ""]),
    });
  }

  return (
    <div className="panel">
      <div className="panel-title">
        {t.fieldTypeLabels[schema.type]}
        <button type="button" className="remove-btn" aria-label={t.fieldList.removeAria(schema.name)} onClick={onRemove}>
          ×
        </button>
      </div>

      <div className="field-card">
        <div className="field-card-header">
          <input className="field-name" value={schema.name} onChange={(e) => onChange({ name: e.target.value })} />
          <label className="lock-toggle" title={schema.locked ? t.fieldList.unlockTitle : t.fieldList.lockTitle}>
            <input type="checkbox" checked={schema.locked ?? false} onChange={(e) => onChange({ locked: e.target.checked })} />
            {schema.locked ? "🔒" : "🔓"}
          </label>
        </div>

        {/* Geometria também EDITÁVEL por número, não só arrastando — arrastar
            trava na grade de 5mm (ver Canvas.tsx), e às vezes se quer 3mm. */}
        <div className="geometry-grid">
          <label>
            {t.position.x}
            <input type="number" value={schema.x} onChange={(e) => onChange({ x: Number(e.target.value) })} />
          </label>
          <label>
            {t.position.y}
            <input type="number" value={schema.y} onChange={(e) => onChange({ y: Number(e.target.value) })} />
          </label>
          <label>
            {t.position.width}
            <input type="number" value={schema.width} onChange={(e) => onChange({ width: Number(e.target.value) })} />
          </label>
          <label>
            {t.position.height}
            <input type="number" value={schema.height} onChange={(e) => onChange({ height: Number(e.target.value) })} />
          </label>
        </div>

        <label className="field-full">
          {t.visibleWhen.label}
          <input
            value={schema.visibleWhen ?? ""}
            placeholder={t.visibleWhen.placeholder}
            onChange={(e) => onChange({ visibleWhen: e.target.value || undefined })}
          />
          <span className="muted-text">{t.visibleWhen.hint}</span>
        </label>

        {schema.type === "text" && (
          <>
            <label className="field-full">
              {t.text.designText} — {"{path}"} / {"{FUNCTION(...)}"}
              <textarea rows={3} value={schema.content} onChange={(e) => onChange({ content: e.target.value })} />
            </label>
            <div className="geometry-grid">
              <label>
                {t.text.fontSize}
                <input type="number" value={schema.fontSize} onChange={(e) => onChange({ fontSize: Number(e.target.value) })} />
              </label>
              <label>
                {t.text.color}
                <input type="color" value={schema.fontColor} onChange={(e) => onChange({ fontColor: e.target.value })} />
              </label>
              <label>
                {t.text.alignment}
                <select value={schema.alignment} onChange={(e) => onChange({ alignment: e.target.value })}>
                  <option value="left">{t.text.alignLeft}</option>
                  <option value="center">{t.text.alignCenter}</option>
                  <option value="right">{t.text.alignRight}</option>
                </select>
              </label>
            </div>
          </>
        )}

        {schema.type === "table" && (
          <>
            <span className="muted-text">{tt.props.columnsHint}</span>
            <ul className="column-list">
              {schema.head.map((label, i) => (
                <li key={i}>
                  {/* O `head` é o rótulo que sai IMPRESSO no PDF — conteúdo do
                      documento, digitado pelo usuário. Nem o valor nem o
                      placeholder trocam de idioma. */}
                  <input value={label} onChange={(e) => setHeadAt(i, e.target.value)} />
                  {/* A coluna do JSON que alimenta esta posição. Só leitura:
                      trocar de coluna é trocar o vínculo, e o vínculo aqui é
                      criado arrastando um campo do explorador. */}
                  <code>{columns[i] !== undefined ? columnLabel(columns[i]) : "—"}</code>
                  {/* "Remover coluna X" é conceito do PACOTE (`t.table`), não
                      nosso — mesma ação, mesmo nome acessível que o editor
                      dele usa. */}
                  <button type="button" className="remove-btn" aria-label={t.table.removeColAria(label)} onClick={() => removeColumn(i)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
            {binding ? (
              <span className="muted-text">
                {/* "Vinculado: X" vem do pacote — o conceito de vínculo é
                    dele. O que é nosso é só o COMO revincular, que neste
                    example é arrastar do explorador de campos. */}
                {t.bindingEditor.boundLabel("path" in binding ? binding.path : "—")} — {tt.props.tableBoundHint}
              </span>
            ) : (
              <>
                <button type="button" onClick={addColumn}>
                  {tt.props.addColumn}
                </button>
                <label className="field-full">
                  {tt.props.rowsLabel}
                  <textarea
                    rows={3}
                    value={schema.content.map((row) => row.join(", ")).join("\n")}
                    onChange={(e) =>
                      onChange({
                        content: e.target.value.split("\n").map((line) => line.split(",").map((cell) => cell.trim())),
                      })
                    }
                  />
                </label>
              </>
            )}
          </>
        )}

        {schema.type === "kpi" && (
          <>
            <label className="field-full">
              {t.kpi.title}
              <input value={schema.title ?? ""} onChange={(e) => onChange({ title: e.target.value })} />
            </label>
            <label className="field-full">
              {t.kpi.valueLabel}
              <input value={schema.value ?? ""} onChange={(e) => onChange({ value: e.target.value })} />
            </label>
            <label className="field-full">
              {t.kpi.subtitle}
              <input value={schema.subtitle ?? ""} onChange={(e) => onChange({ subtitle: e.target.value })} />
            </label>
            <div className="geometry-grid">
              <label>
                {t.kpi.background}
                <input
                  type="color"
                  value={schema.backgroundColor}
                  onChange={(e) => onChange({ backgroundColor: e.target.value })}
                />
              </label>
              <label>
                {t.kpi.textIcon}
                <input type="color" value={schema.textColor} onChange={(e) => onChange({ textColor: e.target.value })} />
              </label>
            </div>
          </>
        )}

        {schema.type === "chart" && (
          <>
            <div className="geometry-grid">
              <label>
                {t.chart.chartType}
                <select value={schema.chartType} onChange={(e) => onChange({ chartType: e.target.value })}>
                  <option value="pie">{t.chart.pie}</option>
                  <option value="bar">{t.chart.bar}</option>
                </select>
              </label>
              <label>
                {t.chart.display}
                <select value={schema.displayMode} onChange={(e) => onChange({ displayMode: e.target.value })}>
                  <option value="number">{t.chart.rawNumber}</option>
                  <option value="percent">{t.chart.percent}</option>
                  <option value="both">{t.chart.valueAndPercent}</option>
                </select>
              </label>
            </div>
            <span className="muted-text">
              {binding && binding.type === "chart" ? (
                <>
                  {/* Caminho e nomes de coluna são DADO (`agentes`,
                      `total`) — ficam como estão; só a moldura traduz. */}
                  {t.bindingEditor.boundLabel(`${binding.path} (${binding.labelColumn} / ${binding.valueColumn})`)} —{" "}
                  {tt.props.chartBoundHint}
                </>
              ) : (
                // "Falta vínculo" é aviso do PACOTE (`t.warnings`), a mesma
                // frase que o painel de problemas mostra pro mesmo campo.
                <>
                  {t.warnings.missingBinding} — {tt.props.chartUnboundHint}
                </>
              )}
            </span>
          </>
        )}

        {(schema.type === "image" || schema.type === "section") && (
          // O NOME do tipo sai do dicionário do pacote (`fieldTypeLabels`), a
          // frase em volta é nossa — o pacote não tem opinião sobre o que um
          // editor decide não editar.
          <span className="muted-text">{tt.props.unsupportedType(t.fieldTypeLabels[schema.type])}</span>
        )}
      </div>
    </div>
  );
}
