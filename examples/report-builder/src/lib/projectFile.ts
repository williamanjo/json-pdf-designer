import type { Template, Binding } from "json-pdf-designer";
import { migrateTemplate } from "json-pdf-designer";

// It exports the template + bindings as a JSON to download — a "project" in
// the sense of "it can be loaded back later" (see parseProjectFile).
export function downloadProjectFile(template: Template, bindings: Binding[]) {
  const payload = { template, bindings };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // The downloaded FILE's name: not translated. It is the identifier of the
  // artifact the user will reopen later — switching language must not change
  // what their file is called.
  a.download = "projeto-relatorio.json";
  a.click();
  URL.revokeObjectURL(url);
}

// It reads and validates a project file exported by downloadProjectFile —
// the same shape validation as loadAutosave (see hooks/useAutosave.ts):
// without it, a hand-edited JSON (or one from an old incompatible version)
// went straight into the typed state and broke the Designer further along,
// with no clear error at import time.
// WHY A CLASS WITH A CODE, and not `new Error(t.phrase)`.
//
// This function USED to take the dictionary and reject with the message
// already translated. The argument was that it became the banner's `detail` —
// the technical layer — and a detail frozen in the error's language would be
// acceptable.
//
// The argument did not hold, for a measured reason: with no code, the
// CLASSIFICATION had no signal at all. The four project file failures fell
// into `describeGenerationError`'s final branch and came out as `appUnknown`
// with `blame: "package"` — that is, the banner said "not your fault, report
// it" to someone who had merely chosen a crooked JSON. The only way to tell
// them apart would be matching a regex on the phrase, which changes with the
// language: exactly the anti-pattern this round removed from the rest of this
// file.
//
// Now `reason` is the signal, the title and action come from the dictionary at
// render time, and the message goes back to being diagnostic English — like
// the package's, which is the text that gets pasted into an issue.
//
// The four validations collapse into THREE reasons because the first two are
// the same failure for whoever reads: the file opened, the JSON was valid, and
// the shape inside it is wrong.
//
// A `readonly` field in the body, and not a parameter property: these
// examples' tsconfig turns on `erasableSyntaxOnly`.
export type ProjectFileReason = "shape" | "malformed" | "unreadable";

export class ProjectFileError extends Error {
  readonly reason: ProjectFileReason;

  constructor(reason: ProjectFileReason, detail: string) {
    super(`Invalid project file (${reason}): ${detail}`);
    this.name = "ProjectFileError";
    this.reason = reason;
  }
}

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
        resolve({ template: migrateTemplate(payload.template), bindings: payload.bindings ?? [] });
      } catch {
        reject(new ProjectFileError("malformed", "not valid JSON"));
      }
    };
    reader.onerror = () => reject(new ProjectFileError("unreadable", "FileReader failed"));
    reader.readAsText(file);
  });
}
