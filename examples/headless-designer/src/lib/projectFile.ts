import type { Template, Binding } from "json-pdf-designer/server";
import { migrateTemplate } from "json-pdf-designer/server";

// WHY A CLASS, and not `new Error("text")`.
//
// A project file is THIS app's concept — the package has never heard of it, so
// `describePdfError` returns `null` for these errors (see
// lib/generationError.ts). What translates is the shell, and to translate it
// has to know WHICH of the four failures it was, without reading the phrase.
//
// `reason` collapses the four into THREE because the first two validations (a
// "template" with no "schemas", a "bindings" that is not a list) are the SAME
// failure for whoever reads: the file opened, the JSON was valid, and the
// shape inside it is wrong. Telling the two apart in the UI does not change
// what the person does.
//
// A `readonly` field declared in the body, and NOT a parameter property
// (`constructor(readonly reason: ...)`): these examples' tsconfig turns on
// `erasableSyntaxOnly`, which forbids the short form — it emits code, rather
// than only erasing a type.
export type ProjectFileReason = "shape" | "malformed" | "unreadable";

export class ProjectFileError extends Error {
  readonly reason: ProjectFileReason;

  constructor(reason: ProjectFileReason, detail: string) {
    // The message is in ENGLISH, like the package's: it goes to the console
    // and to the banner's `problem.detail`, which is diagnostic text for
    // whoever develops. The text the USER reads comes from the dictionary.
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
