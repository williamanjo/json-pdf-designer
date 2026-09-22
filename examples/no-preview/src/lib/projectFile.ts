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
  // The DOWNLOADED file's name: it is data leaving the app, not an interface
  // label — it stays the same in both languages, like "relatorio.pdf" (App.tsx).
  a.download = "projeto-relatorio.json";
  a.click();
  URL.revokeObjectURL(url);
}

// It reads and validates a project file exported by downloadProjectFile —
// the same shape validation as loadAutosave (see hooks/useAutosave.ts):
// without it, a hand-edited JSON (or one from an old incompatible version)
// went straight into the typed state and broke the Designer further along,
// with no clear error at import time.
// The four refusals are OURS (the package has no concept of a "project
// file"), and each carries a KEY, never the phrase.
//
// Holding the phrase here was a real bug: it was built at the moment of the
// rejection, stayed frozen in the language of that instant, and switching the
// picker with the banner open retranslated nothing. The key travels; the text
// comes from the dictionary at render time.
export type ProjectFileProblem = "missingTemplate" | "bindingsNotAList" | "malformed" | "unreadable";

export class ProjectFileError extends Error {
  // The field is declared and assigned by hand, and not
  // `constructor(readonly problem)`: these examples' tsconfig turns on
  // `erasableSyntaxOnly`, which forbids a parameter property (it EMITS code,
  // so it is not erasable syntax). The package uses the short form because it
  // does not turn that flag on.
  readonly problem: ProjectFileProblem;

  constructor(problem: ProjectFileProblem) {
    // `message` in English, like every `throw` in the package: it is a log
    // diagnostic, not screen text. What shows it to the user is
    // describeGenerationError, which reads `problem` and takes the translated
    super(`Invalid project file: ${problem}`);
    this.name = "ProjectFileError";
    this.problem = problem;
  }
}

export function parseProjectFile(file: File): Promise<{ template: Template; bindings: Binding[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result as string);
        if (!payload?.template || typeof payload.template !== "object" || !Array.isArray(payload.template.schemas)) {
          reject(new ProjectFileError("missingTemplate"));
          return;
        }
        if (payload.bindings !== undefined && !Array.isArray(payload.bindings)) {
          reject(new ProjectFileError("bindingsNotAList"));
          return;
        }
        // Template vindo de FORA (arquivo salvo por outra versão do app)
        // passa pela migração antes de virar estado — é o ponto em que um
        // formato antigo é normalizado. generatePdf também migra por dentro,
        // mas aqui garante que o EDITOR já trabalhe no formato corrente.
        resolve({ template: migrateTemplate(payload.template), bindings: payload.bindings ?? [] });
      } catch {
        reject(new ProjectFileError("malformed"));
      }
    };
    reader.onerror = () => reject(new ProjectFileError("unreadable"));
    reader.readAsText(file);
  });
}
