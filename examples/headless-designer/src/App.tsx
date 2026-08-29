import { useState } from "react";
import type { Binding, ChartSchema, KpiSchema, Schema, TableColumn, TableSchema, Template, TextSchema } from "json-pdf-designer/server";
import { generatePdf } from "json-pdf-designer/server";
import { PdfPreview } from "json-pdf-designer";

// A4 em mm — mesma unidade do resto do pacote (ver docs/ARCHITECTURE.md).
const PAGE = { width: 210, height: 297 };
// Escala fixa do canvas (px por mm) — só pra desenhar a página em tela num
// tamanho razoável; não tem relação com o PDF gerado (que usa pt de
// verdade via pdf-lib, dentro de generatePdf).
const PX_PER_MM = 3;
const MIN_WIDTH_MM = 15;
const MIN_HEIGHT_MM = 8;
// Grade de 5mm — mesmo passo do <Designer> (arrastar/redimensionar trava
// nela por padrão). Sem isso, campo novo nasce sempre no mesmo x/y e fica
// empilhado exatamente em cima do anterior.
const GRID_MM = 5;
function snap(mm: number): number {
  return Math.round(mm / GRID_MM) * GRID_MM;
}

// `sales` alimenta todo chart adicionado — sem editor de vínculo nesse
// example (ver comentário na CanvasField), então o chart é sempre ligado
// nesse mesmo path/colunas fixos (ver newChartField/handleGenerate abaixo).
const SAMPLE_DATA = JSON.stringify(
  {
    name: "World",
    sales: [
      { region: "North", total: 4200 },
      { region: "South", total: 3100 },
      { region: "East", total: 2600 },
      { region: "West", total: 1800 },
    ],
  },
  null,
  2
);

let nextId = 1;
function uid(): string {
  return `field_${nextId++}`;
}

// `stagger` evita nascer em cima do campo anterior: cada campo novo desloca
// mais um passo de grade (e volta pro início depois de 6, formando uma
// escada em vez de uma fila infinita).
function newTextField(stagger: number): TextSchema {
  const n = nextId;
  const step = (stagger % 6) * GRID_MM;
  return {
    id: uid(),
    name: `text_${n}`,
    type: "text",
    x: 10 + step,
    y: 10 + step,
    width: 100,
    height: 15,
    content: "Hello {name}",
    fontSize: 12,
    fontColor: "#000000",
    alignment: "left",
  };
}

// Toda tabela deste example fica ligada neste path/colunas fixos (ver
// TABLE_BINDING/handleGenerate) — mesma convenção do chart (CHART_BINDING),
// já que só existe um array de exemplo (`sales`) no JSON de amostra. head/
// content abaixo são só o preview de design (mostrado no canvas) — igual
// ao <Designer> de verdade, o PDF gerado usa o vínculo, não esse literal.
const TABLE_BINDING: { path: string; columns: TableColumn[] } = { path: "sales", columns: ["region", "total"] };

function newTableField(stagger: number): TableSchema {
  const n = nextId;
  const step = (stagger % 6) * GRID_MM;
  return {
    id: uid(),
    name: `table_${n}`,
    type: "table",
    x: 10 + step,
    y: 40 + step,
    width: 150,
    height: 30,
    head: ["Region", "Total"],
    content: [["North", "4200"]],
  };
}

// Igual a newTextField/newTableField acima — literal escrito na mão, sem
// nenhuma peça pronta do pacote (nem os factories internos makeKpiSchema/
// makeChartSchema, que o <Designer> usa por dentro). `value` usa {token}
// igual ao campo de texto — sem binding nenhum, generatePdf resolve
// `{name}` direto contra o JSON (KPI sem vínculo cai pro template livre,
// ver generate.ts).
function newKpiField(stagger: number): KpiSchema {
  const n = nextId;
  const step = (stagger % 6) * GRID_MM;
  return {
    id: uid(),
    name: `kpi_${n}`,
    type: "kpi",
    x: 10 + step,
    y: 70 + step,
    width: 55,
    height: 35,
    icon: "bar_chart",
    title: "Name",
    value: "{name}",
    subtitle: "from JSON",
    backgroundColor: "#2563eb",
    textColor: "#ffffff",
  };
}

// Chart PRECISA de um Binding "chart" pra desenhar alguma coisa (sem
// vínculo, generatePdf não desenha nada — diferente de texto/KPI, que
// aceitam {token} direto). Sem editor de vínculo neste example, todo
// chart adicionado fica ligado neste path/colunas fixos — ver SAMPLE_DATA
// (array `sales`) e handleGenerate (monta o Binding correspondente).
const CHART_BINDING = { path: "sales", labelColumn: "region", valueColumn: "total" } as const;

function newChartField(stagger: number): ChartSchema {
  const n = nextId;
  const step = (stagger % 6) * GRID_MM;
  return {
    id: uid(),
    name: `chart_${n}`,
    type: "chart",
    x: 10 + step,
    y: 110 + step,
    width: 100,
    height: 70,
    chartType: "pie",
    displayMode: "percent",
  };
}

function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.slice().buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Arrasta/redimensiona um campo na mão, sem react-rnd nem qualquer peça do
// pacote — só mousedown/mousemove/mouseup do DOM, convertendo delta em px
// pra delta em mm (PX_PER_MM). É exatamente essa lógica (não o componente
// <Designer>) que este example existe pra provar que dá pra escrever do
// zero, por cima só do modelo de dados (Schema/Template) do pacote.
function CanvasField({
  field,
  selected,
  onSelect,
  onMove,
  onResize,
}: {
  field: Schema;
  selected: boolean;
  onSelect: () => void;
  onMove: (xMm: number, yMm: number) => void;
  onResize: (widthMm: number, heightMm: number) => void;
}) {
  function startDrag(e: React.MouseEvent) {
    e.stopPropagation();
    onSelect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = field.x;
    const origY = field.y;
    function onMouseMove(ev: MouseEvent) {
      const dxMm = (ev.clientX - startX) / PX_PER_MM;
      const dyMm = (ev.clientY - startY) / PX_PER_MM;
      onMove(snap(Math.max(0, origX + dxMm)), snap(Math.max(0, origY + dyMm)));
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function startResize(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origW = field.width;
    const origH = field.height;
    function onMouseMove(ev: MouseEvent) {
      const dwMm = (ev.clientX - startX) / PX_PER_MM;
      const dhMm = (ev.clientY - startY) / PX_PER_MM;
      onResize(snap(Math.max(MIN_WIDTH_MM, origW + dwMm)), snap(Math.max(MIN_HEIGHT_MM, origH + dhMm)));
    }
    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  const preview =
    field.type === "text"
      ? field.content
      : field.type === "table"
        ? field.head.join(" | ")
        : field.type === "kpi"
          ? `${field.title}: ${field.value}`
          : field.type === "chart"
            ? `chart (${field.chartType})`
            : "";

  return (
    <div
      className={`canvas-field${selected ? " selected" : ""}`}
      style={{
        left: field.x * PX_PER_MM,
        top: field.y * PX_PER_MM,
        width: field.width * PX_PER_MM,
        height: field.height * PX_PER_MM,
      }}
      onMouseDown={startDrag}
    >
      <span className="canvas-field-label">{field.name}</span>
      <div className="canvas-field-preview">{preview}</div>
      <div className="resize-handle" onMouseDown={startResize} />
    </div>
  );
}

// Painel de conteúdo do campo selecionado — só o que faz sentido editar
// digitando (texto/colunas/linhas); posição e tamanho já vêm do arrasto/
// redimensionamento no canvas.
function SelectedFieldPanel({
  schema,
  onChange,
}: {
  schema: Schema;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="panel">
      <div className="panel-title">Selected field</div>
      <div className="field-card">
        <div className="field-card-header">
          <input className="field-name" value={schema.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        <p className="field-geometry">
          {schema.x.toFixed(0)}, {schema.y.toFixed(0)}mm · {schema.width.toFixed(0)}×{schema.height.toFixed(0)}mm
        </p>
        {schema.type === "text" && (
          <label className="field-full">
            Content — plain text or {"{path}"} / {"{FUNCTION(...)}"}
            <textarea rows={3} value={schema.content} onChange={(e) => onChange({ content: e.target.value })} />
          </label>
        )}
        {schema.type === "table" && (
          <>
            <label className="field-full">
              Header columns (comma-separated)
              <input
                value={schema.head.join(", ")}
                onChange={(e) => onChange({ head: e.target.value.split(",").map((s) => s.trim()) })}
              />
            </label>
            <label className="field-full">
              Rows (one per line, comma-separated cells)
              <textarea
                rows={3}
                value={schema.content.map((row) => row.join(", ")).join("\n")}
                onChange={(e) =>
                  onChange({ content: e.target.value.split("\n").map((line) => line.split(",").map((cell) => cell.trim())) })
                }
              />
            </label>
          </>
        )}
        {schema.type === "kpi" && (
          <>
            <label className="field-full">
              Title
              <input value={schema.title} onChange={(e) => onChange({ title: e.target.value })} />
            </label>
            <label className="field-full">
              Value — plain text or {"{path}"}
              <input value={schema.value} onChange={(e) => onChange({ value: e.target.value })} />
            </label>
            <label className="field-full">
              Subtitle
              <input value={schema.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} />
            </label>
          </>
        )}
        {schema.type === "chart" && (
          <p className="field-geometry">
            Bound to sample data's <code>sales</code> array ({CHART_BINDING.labelColumn}/{CHART_BINDING.valueColumn}) — no binding editor in this example.
          </p>
        )}
      </div>
    </div>
  );
}

// Editor "headless" — SEM o componente <Designer> do pacote. Canvas de
// arrastar/redimensionar montado à mão (ver CanvasField acima), painel de
// conteúdo pro campo selecionado, e geração via generatePdf (de
// "json-pdf-designer/server", sem React nenhum) + <PdfPreview> (de
// "json-pdf-designer") pra mostrar o resultado. Prova que dá pra construir
// um designer 100% próprio em cima só do modelo de dados do pacote.
export default function App() {
  // Um de cada tipo já no canvas ao abrir — cada um mapeado contra o JSON
  // de amostra (texto/KPI via {token}, tabela/chart via Binding), pra dar
  // pra ver o resultado sem precisar montar campo nenhum na mão primeiro.
  const [fields, setFields] = useState<Schema[]>(() => [
    newTextField(0),
    newTableField(1),
    newKpiField(2),
    newChartField(3),
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dataText, setDataText] = useState(SAMPLE_DATA);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"canvas" | "preview">("canvas");

  const selected = fields.find((f) => f.id === selectedId) ?? null;

  function updateField(id: string, patch: Record<string, unknown>) {
    setFields((prev) => prev.map((f) => (f.id === id ? ({ ...f, ...patch } as Schema) : f)));
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }

  function addField(make: (stagger: number) => Schema) {
    const field = make(fields.length);
    setFields((prev) => [...prev, field]);
    setSelectedId(field.id);
  }

  async function handleGenerate() {
    setError(null);
    try {
      const data: unknown = JSON.parse(dataText);
      const template: Template = { page: PAGE, schemas: fields };
      // chart precisa de Binding pra desenhar alguma coisa (ver newChartField);
      // table sem binding também renderiza (usa head/content literal), mas
      // aqui toda tabela é ligada ao mesmo array de amostra (ver
      // TABLE_BINDING) pra provar o vínculo "array" funcionando também.
      const bindings: Binding[] = [
        ...fields
          .filter((f): f is ChartSchema => f.type === "chart")
          .map((f): Binding => ({ schemaName: f.name, type: "chart", ...CHART_BINDING })),
        ...fields
          .filter((f): f is TableSchema => f.type === "table")
          .map((f): Binding => ({ schemaName: f.name, type: "array", ...TABLE_BINDING })),
      ];
      const bytes = await generatePdf(template, data, bindings);
      setPdfBytes(bytes);
      setView("preview");
    } catch (err) {
      setPdfBytes(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>headless-designer example</h1>
        <p>
          No <code>&lt;Designer&gt;</code> here — a hand-built canvas (drag/resize by hand) over{" "}
          <code>json-pdf-designer/server</code> + <code>PdfPreview</code>.
        </p>
      </header>
      <div className="app-body">
        <aside className="app-sidebar">
          <div className="panel">
            <div className="panel-title">Fields</div>
            <div className="field-add-row">
              <button type="button" onClick={() => addField(newTextField)}>
                + Text field
              </button>
              <button type="button" onClick={() => addField(newTableField)}>
                + Table field
              </button>
              <button type="button" onClick={() => addField(newKpiField)}>
                + KPI field
              </button>
              <button type="button" onClick={() => addField(newChartField)}>
                + Chart field
              </button>
            </div>
            <ul className="field-list">
              {fields.map((f) => (
                <li key={f.id} className={f.id === selectedId ? "selected" : ""} onClick={() => setSelectedId(f.id)}>
                  <span className="field-list-name">{f.name}</span>
                  <span className="field-list-type">{f.type}</span>
                  <button
                    type="button"
                    className="remove-btn"
                    aria-label={`Remove ${f.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeField(f.id);
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {selected && <SelectedFieldPanel schema={selected} onChange={(patch) => updateField(selected.id, patch)} />}
          <div className="panel">
            <div className="panel-title">JSON data</div>
            <textarea className="data-textarea" rows={6} value={dataText} onChange={(e) => setDataText(e.target.value)} />
          </div>
          <button type="button" className="generate-btn" onClick={handleGenerate}>
            Generate PDF
          </button>
          {error && <p className="error-text">{error}</p>}
        </aside>
        <main className="app-main">
          <div className="view-tabs">
            <button type="button" className={view === "canvas" ? "active" : ""} onClick={() => setView("canvas")}>
              Canvas
            </button>
            <button
              type="button"
              className={view === "preview" ? "active" : ""}
              disabled={!pdfBytes}
              onClick={() => pdfBytes && setView("preview")}
            >
              Preview
            </button>
          </div>
          {view === "canvas" ? (
            <div className="canvas-scroll">
              <div
                className="canvas-page"
                style={{
                  width: PAGE.width * PX_PER_MM,
                  height: PAGE.height * PX_PER_MM,
                  backgroundSize: `${GRID_MM * PX_PER_MM}px ${GRID_MM * PX_PER_MM}px`,
                }}
                onMouseDown={() => setSelectedId(null)}
              >
                {fields.map((f) => (
                  <CanvasField
                    key={f.id}
                    field={f}
                    selected={f.id === selectedId}
                    onSelect={() => setSelectedId(f.id)}
                    onMove={(x, y) => updateField(f.id, { x, y })}
                    onResize={(width, height) => updateField(f.id, { width, height })}
                  />
                ))}
              </div>
            </div>
          ) : pdfBytes ? (
            <div className="preview-scroll">
              <button type="button" onClick={() => downloadPdf(pdfBytes, "relatorio.pdf")}>
                Download PDF
              </button>
              <PdfPreview bytes={pdfBytes} scale={1.2} />
            </div>
          ) : (
            <p className="empty-hint">Generate a PDF to preview it here.</p>
          )}
        </main>
      </div>
    </div>
  );
}
