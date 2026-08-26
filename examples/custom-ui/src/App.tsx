import { useState } from "react";
import type { Template, Binding } from "json-pdf-designer";
import { Designer, generatePdf, downloadPdf } from "json-pdf-designer";
import { reciboTemplate, reciboBindings, reciboSampleData } from "./data/reciboTemplate";

export default function App() {
  const [template, setTemplate] = useState<Template>(reciboTemplate);
  const [bindings, setBindings] = useState<Binding[]>(reciboBindings);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(reciboSampleData, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      let data: unknown;
      try {
        data = JSON.parse(jsonText);
      } catch {
        throw new Error("JSON de dados inválido — corrija e tente de novo.");
      }
      const bytes = await generatePdf(template, data, bindings);
      downloadPdf(bytes, "recibo.pdf");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <header className="app-header">
        <h1>custom-ui-example — casca 100% própria, sem UI pronta do pacote</h1>
        <button className="btn btn-ghost" onClick={handleGenerate} disabled={generating}>
          {generating ? "Gerando…" : "Gerar PDF"}
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="app-body">
        <aside className="sidebar">
          <div>
            <h2>Sobre este example</h2>
            <p>
              Header, sidebar, textarea e botão aqui são HTML/CSS escritos à mão — nenhum Button/Card/Input
              importado do pacote. Só o &lt;Designer&gt; abaixo (canvas, painel de propriedades) usa a
              aparência pronta do json-pdf-designer.
            </p>
          </div>
          <div>
            <label className="field-label" htmlFor="json-data">
              Dados (JSON)
            </label>
            <textarea
              id="json-data"
              className="textarea"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              spellCheck={false}
            />
          </div>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? "Gerando…" : "Gerar e baixar PDF"}
          </button>
        </aside>

        <main className="designer-area">
          <Designer template={template} onChangeTemplate={setTemplate} bindings={bindings} onChangeBindings={setBindings} />
        </main>
      </div>
    </>
  );
}
