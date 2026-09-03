import type { Binding, Template } from "json-pdf-designer";
import { migrateTemplate } from "json-pdf-designer";

// Exporta template + vínculos como um JSON pra baixar — "projeto" no
// sentido de "dá pra recarregar depois" (ver parseProjectFile).
export function downloadProjectFile(template: Template, bindings: Binding[]) {
  const payload = { template, bindings };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Nome do arquivo NÃO traduzido: é dado que a pessoa vai guardar em disco e
  // recarregar depois, não texto de interface.
  a.download = "projeto-composed-layout.json";
  a.click();
  URL.revokeObjectURL(url);
}

// As quatro maneiras de um arquivo de projeto ser recusado. É CÓDIGO e não
// frase, pelo mesmo motivo do `SourceErrorCode` em lib/sources.ts: a mensagem
// é montada por `describeGenerationError` no render, então o banner retraduz
// quando o seletor de idioma muda. Uma frase congelada no `throw` ficaria pra
// sempre no idioma de quando o arquivo foi aberto.
export type ProjectFileProblem = "semTemplate" | "bindingsNaoLista" | "jsonMalformado" | "naoLeu";

// Classe própria em vez de `Error` com mensagem: é a mesma decisão que o
// pacote toma ao exportar `PageLimitError`/`UnsupportedGlyphError`, e permite
// a `lib/generationError.ts` reconhecer a falha por `instanceof` em vez de
// casar texto.
export class ProjectFileError extends Error {
  // Campo declarado à mão, e não parameter property (`constructor(readonly
  // problem: ...)`): o tsconfig deste example liga `erasableSyntaxOnly`, que
  // proíbe sintaxe de TS que emite código.
  problem: ProjectFileProblem;

  constructor(problem: ProjectFileProblem) {
    super(`projectFile:${problem}`);
    this.name = "ProjectFileError";
    this.problem = problem;
  }
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
          reject(new ProjectFileError("semTemplate"));
          return;
        }
        if (payload.bindings !== undefined && !Array.isArray(payload.bindings)) {
          reject(new ProjectFileError("bindingsNaoLista"));
          return;
        }
        // Template vindo de FORA (arquivo salvo por outra versão do app)
        // passa pela migração antes de virar estado — é o ponto em que um
        // formato antigo é normalizado. generatePdf também migra por dentro,
        // mas aqui garante que o EDITOR já trabalhe no formato corrente.
        resolve({ template: migrateTemplate(payload.template), bindings: payload.bindings ?? [] });
      } catch (err) {
        // `migrateTemplate` também lança daqui de dentro (formato mais novo
        // que este build entende) — esse erro é do PACOTE e segue em frente
        // pra ser classificado por `describeGenerationError`, em vez de virar
        // "JSON malformado".
        reject(err instanceof SyntaxError ? new ProjectFileError("jsonMalformado") : err);
      }
    };
    reader.onerror = () => reject(new ProjectFileError("naoLeu"));
    reader.readAsText(file);
  });
}
