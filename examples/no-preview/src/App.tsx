// Gera e baixa, sem preview nenhum — e, principalmente, SEM pdfjs-dist
// instalado (ver README.md desta pasta). Importa só do entry principal
// "json-pdf-designer"; nada de "json-pdf-designer/preview".
import { useState } from "react";
import { Designer, generatePdf, downloadPdf, type Binding, type Template } from "json-pdf-designer";

// Template mínimo: um título com {token} e uma tabela vinculada a `vendas`.
// Suficiente pra provar que a geração completa (texto + tabela + paginação)
// funciona sem pdf.js — o report-builder cobre o caminho cheio de recursos.
const INITIAL_TEMPLATE: Template = {
  version: 1,
  page: { width: 210, height: 297 },
  schemas: [
    {
      id: "titulo",
      name: "titulo",
      type: "text",
      x: 15,
      y: 15,
      width: 180,
      height: 12,
      content: "Vendas — {mes}",
      fontSize: 18,
      fontColor: "#0f172a",
      alignment: "left",
    },
    {
      id: "tabela",
      name: "tabela",
      type: "table",
      x: 15,
      y: 35,
      width: 180,
      height: 60,
      head: ["Região", "Total"],
      content: [["—", "—"]],
    },
  ],
};

// A tabela puxa de `vendas` no JSON abaixo; o título usa {mes}, resolvido
// direto contra o documento (texto sem vínculo cai no template livre).
const INITIAL_BINDINGS: Binding[] = [
  { schemaName: "tabela", type: "array", path: "vendas", columns: ["regiao", "total"] },
];

const INITIAL_DATA = JSON.stringify(
  {
    mes: "Agosto/2026",
    vendas: [
      { regiao: "Sudeste", total: 128400 },
      { regiao: "Sul", total: 74200 },
      { regiao: "Nordeste", total: 61900 },
      { regiao: "Centro-Oeste", total: 33500 },
      { regiao: "Norte", total: 21800 },
    ],
  },
  null,
  2
);

export default function App() {
  const [template, setTemplate] = useState<Template>(INITIAL_TEMPLATE);
  const [bindings, setBindings] = useState<Binding[]>(INITIAL_BINDINGS);
  const [raw, setRaw] = useState(INITIAL_DATA);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      // O ponto do example: generatePdf devolve os bytes e downloadPdf
      // entrega o arquivo. Nenhum passo intermediário renderiza o PDF na
      // tela, então nada aqui precisa do pdf.js. Quem quiser conferir
      // margens antes de baixar usa o <PdfPreviewModal> de
      // "json-pdf-designer/preview" (e aí sim instala o pdfjs-dist).
      const bytes = await generatePdf(template, JSON.parse(raw), bindings);
      downloadPdf(bytes, "relatorio.pdf");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>no-preview-example — gera o PDF sem pdf.js instalado</h1>
        <p>
          Só o entry <code>json-pdf-designer</code> (nada de <code>/preview</code>), e{" "}
          <code>pdfjs-dist</code> ausente do <code>package.json</code>. Clicar em gerar baixa o arquivo
          direto, sem tela de preview.
        </p>
      </header>

      <div className="app-body">
        <aside className="app-sidebar">
          <div className="panel">
            <span className="panel-title">Dados (JSON)</span>
            <textarea
              className="data-textarea"
              rows={16}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              spellCheck={false}
            />
          </div>
          <button type="button" className="generate-btn" onClick={handleGenerate} disabled={generating}>
            {generating ? "Gerando…" : "Gerar e baixar PDF"}
          </button>
          {error && <p className="error-text">{error}</p>}
          <p className="hint">
            Nenhum recurso fica de fora por não instalar o <code>pdfjs-dist</code>: ele só habilita
            ver o PDF na tela antes de baixar, via <code>json-pdf-designer/preview</code>.
          </p>
        </aside>

        <main className="app-main">
          <Designer
            template={template}
            onChangeTemplate={setTemplate}
            bindings={bindings}
            onChangeBindings={setBindings}
            locale="pt-BR"
          />
        </main>
      </div>
    </div>
  );
}
