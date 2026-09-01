import type { Template, Binding } from "json-pdf-designer";
import { migrateTemplate } from "json-pdf-designer";

// Exporta template + vínculos como um JSON pra baixar — "projeto" no
// sentido de "dá pra recarregar depois" (ver parseProjectFile).
export function downloadProjectFile(template: Template, bindings: Binding[]) {
  const payload = { template, bindings };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "projeto-relatorio.json";
  a.click();
  URL.revokeObjectURL(url);
}

// Lê e valida um arquivo de projeto exportado por downloadProjectFile —
// mesma validação de forma do loadAutosave (ver hooks/useAutosave.ts):
// sem isso, um JSON editado à mão (ou de uma versão antiga incompatível)
// passava direto pro estado tipado e quebrava o Designer mais na frente,
// sem erro claro na hora do import.
export function parseProjectFile(file: File): Promise<{ template: Template; bindings: Binding[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result as string);
        if (!payload?.template || typeof payload.template !== "object" || !Array.isArray(payload.template.schemas)) {
          reject(new Error('Arquivo de projeto inválido: falta "template" com "schemas".'));
          return;
        }
        if (payload.bindings !== undefined && !Array.isArray(payload.bindings)) {
          reject(new Error('Arquivo de projeto inválido: "bindings" precisa ser uma lista.'));
          return;
        }
        // Template vindo de FORA (arquivo salvo por outra versão do app)
        // passa pela migração antes de virar estado — é o ponto em que um
        // formato antigo é normalizado. generatePdf também migra por dentro,
        // mas aqui garante que o EDITOR já trabalhe no formato corrente.
        resolve({ template: migrateTemplate(payload.template), bindings: payload.bindings ?? [] });
      } catch {
        reject(new Error("Arquivo de projeto inválido: JSON malformado."));
      }
    };
    reader.onerror = () => reject(new Error("Não deu pra ler o arquivo — tente de novo."));
    reader.readAsText(file);
  });
}
