import type { Binding, Template } from "json-pdf-designer";
import { migrateTemplate } from "json-pdf-designer";

// It exports the template + bindings as a JSON to download — a "project" in
// the sense of "it can be loaded back later" (see parseProjectFile).
export function downloadProjectFile(template: Template, bindings: Binding[]) {
  const payload = { template, bindings };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // The file name is NOT translated: it is data the person will keep on disk
  // and load back later, not interface text.
  a.download = "projeto-composed-layout.json";
  a.click();
  URL.revokeObjectURL(url);
}

// The four ways a project file can be refused. It is a CODE and not a
// phrase, for the same reason as `SourceErrorCode` in lib/sources.ts: the
// message is built by `describeGenerationError` at render time, so the banner
// retranslates when the language picker changes. A phrase frozen in the
// `throw` would stay forever in the language of when the file was opened.
export type ProjectFileProblem = "semTemplate" | "bindingsNaoLista" | "jsonMalformado" | "naoLeu";

// A class of its own instead of an `Error` with a message: it is the same
// decision the package makes when exporting `PageLimitError`/
// `UnsupportedGlyphError`, and it lets `lib/generationError.ts` recognize the
// failure by `instanceof` instead of matching text.
export class ProjectFileError extends Error {
  // The field is declared by hand, and not as a parameter property
  // (`constructor(readonly problem: ...)`): this example's tsconfig turns on
  // `erasableSyntaxOnly`, which forbids TS syntax that emits code.
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
