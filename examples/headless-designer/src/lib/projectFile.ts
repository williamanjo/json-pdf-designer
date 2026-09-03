import type { Template, Binding } from "json-pdf-designer/server";
import { migrateTemplate } from "json-pdf-designer/server";

// POR QUE UMA CLASSE, e não `new Error("texto")`.
//
// Arquivo de projeto é conceito DESTE app — o pacote nunca ouviu falar dele,
// então `describePdfError` devolve `null` pra estes erros (ver
// lib/generationError.ts). Quem traduz é a casca, e pra traduzir ela precisa
// saber QUAL das quatro falhas foi, sem ler a frase.
//
// `reason` colapsa as quatro em TRÊS porque as duas primeiras validações
// ("template" sem "schemas", "bindings" que não é lista) são a MESMA falha
// pra quem lê: o arquivo abriu, o JSON era válido, e a forma dentro dele está
// errada. Distinguir as duas na UI não muda o que a pessoa faz.
//
// Campo `readonly` declarado no corpo, e NÃO parameter property
// (`constructor(readonly reason: ...)`): o tsconfig destes examples liga
// `erasableSyntaxOnly`, que proíbe a forma curta — ela emite código, e não
// só apaga tipo.
export type ProjectFileReason = "shape" | "malformed" | "unreadable";

export class ProjectFileError extends Error {
  readonly reason: ProjectFileReason;

  constructor(reason: ProjectFileReason, detail: string) {
    // Mensagem em INGLÊS, igual às do pacote: ela vai pro console e pro
    // `problem.detail` do banner, que é texto de diagnóstico pra quem
    // desenvolve. O texto que o USUÁRIO lê sai do dicionário.
    super(`Invalid project file (${reason}): ${detail}`);
    this.name = "ProjectFileError";
    this.reason = reason;
  }
}

// Exporta template + vínculos como um JSON pra baixar — "projeto" no
// sentido de "dá pra recarregar depois" (ver parseProjectFile).
export function downloadProjectFile(template: Template, bindings: Binding[]) {
  const payload = { template, bindings };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "headless-project.json";
  a.click();
  URL.revokeObjectURL(url);
}

// Lê e valida um arquivo de projeto exportado por downloadProjectFile —
// mesma validação de forma do loadAutosave (ver hooks/useAutosave.ts):
// sem isso, um JSON editado à mão (ou de uma versão antiga incompatível)
// passava direto pro estado tipado e quebrava o editor mais na frente,
// sem erro claro na hora do import.
export function parseProjectFile(file: File): Promise<{ template: Template; bindings: Binding[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result as string);
        if (!payload?.template || typeof payload.template !== "object" || !Array.isArray(payload.template.schemas)) {
          reject(new ProjectFileError("shape", 'missing "template" with "schemas"'));
          return;
        }
        if (payload.bindings !== undefined && !Array.isArray(payload.bindings)) {
          reject(new ProjectFileError("shape", '"bindings" is not a list'));
          return;
        }
        // Template vindo de FORA (arquivo salvo por outra versão do app)
        // passa pela migração antes de virar estado — é o ponto em que um
        // formato antigo é normalizado. generatePdf também migra por dentro,
        // mas aqui garante que o EDITOR já trabalhe no formato corrente.
        // `migrateTemplate` sai do entry SEM React (`/server`), igual todo o
        // resto que este example importa do pacote.
        resolve({ template: migrateTemplate(payload.template), bindings: payload.bindings ?? [] });
      } catch {
        reject(new ProjectFileError("malformed", "not valid JSON"));
      }
    };
    reader.onerror = () => reject(new ProjectFileError("unreadable", "FileReader failed"));
    reader.readAsText(file);
  });
}
