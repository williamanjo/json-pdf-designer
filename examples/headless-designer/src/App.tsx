import { useState } from "react";
import type { Schema, TableSchema, Template, TextSchema } from "json-pdf-designer/server";
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

const SAMPLE_DATA = JSON.stringify({ name: "World" }, null, 2);

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
    head: ["Column A", "Column B"],
    content: [["1", "2"]],
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

  const preview = field.type === "text" ? field.content : field.type === "table" ? field.head.join(" | ") : "";

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
  const [fields, setFields] = useState<Schema[]>(() => [newTextField(0)]);
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
      const bytes = await generatePdf(template, data, []);
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
