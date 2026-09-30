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
  // The file name does NOT follow the UI's language: it is the name of the
  // DOCUMENT the person will keep on disk and reopen. Switching the picker to
  // English must not make the same project be saved under another name.
  a.download = "projeto-relatorio.json";
  a.click();
  URL.revokeObjectURL(url);
}

// REFUSING A PROJECT FILE IS **OUR** ERROR.
//
// The `{ template, bindings }` format is this example's invention — the
// package does not know it exists, so `describePdfError` returns `null` for
// these failures (on purpose: it does not invent a title for what is not its
// own). That is why they become a CLASS here, with a discriminating `problem`,
// and `lib/generationError.ts` handles them in a branch of its own.
//
// Two decisions deliberately copied from the package, because both are good:
//
//   - the discriminant is a CODE, not the phrase. Before this round the
//     `reject` carried `new Error(d.projetoJsonMalformado)`, that is: an
//     ALREADY translated phrase going into the App's state. An open banner was
//     frozen in the language of when the failure happened, and switching the
//     picker left the residue on screen;
//   - the `message` is ENGLISH, and it is a developer diagnostic — it is what
//     comes out in the banner's `detail` and what gets pasted into a bug
//     report. The end-user text comes from the dictionary, at render time.
export type ProjectFileProblem = "missingTemplate" | "badBindings" | "malformed" | "unreadable";

const PROBLEM_DETAIL: Record<ProjectFileProblem, string> = {
  missingTemplate: 'missing "template" with a "schemas" array',
  badBindings: '"bindings" must be an array',
  malformed: "the file is not valid JSON",
  unreadable: "the browser could not read the file",
};

export class ProjectFileError extends Error {
  // The field is declared and assigned in the body, and not
  // `constructor(readonly ...)`: `erasableSyntaxOnly` (tsconfig.app.json)
  // refuses a parameter property.
  readonly problem: ProjectFileProblem;

  constructor(problem: ProjectFileProblem) {
    super(`Invalid project file: ${PROBLEM_DETAIL[problem]}.`);
    this.name = "ProjectFileError";
    this.problem = problem;
  }
}

// Lê e valida um arquivo de projeto exportado por downloadProjectFile —
// mesma validação de forma do loadAutosave (ver hooks/useAutosave.ts):
// sem isso, um JSON editado à mão (ou de uma versão antiga incompatível)
// passava direto pro estado tipado e quebrava o Designer mais na frente,
// sem erro claro na hora do import.
//
// Sem `locale`: nada aqui produz frase de tela. O que sai é `ProjectFileError`
// (nosso, com código) ou o erro de migração do PACOTE, cru — e quem escolhe a
// frase é o render (App.tsx -> lib/generationError.ts).
export function parseProjectFile(file: File): Promise<{ template: Template; bindings: Binding[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      let payload: unknown;
      try {
        payload = JSON.parse(reader.result as string);
      } catch {
        reject(new ProjectFileError("malformed"));
        return;
      }

      const candidate = payload as { template?: { schemas?: unknown }; bindings?: unknown };
      if (!candidate?.template || typeof candidate.template !== "object" || !Array.isArray(candidate.template.schemas)) {
        reject(new ProjectFileError("missingTemplate"));
        return;
      }
      if (candidate.bindings !== undefined && !Array.isArray(candidate.bindings)) {
        reject(new ProjectFileError("badBindings"));
        return;
      }

      // Template vindo de FORA (arquivo salvo por outra versão do app)
      // passa pela migração antes de virar estado — é o ponto em que um
      // formato antigo é normalizado. generatePdf também migra por dentro,
      // mas aqui garante que o EDITOR já trabalhe no formato corrente.
      //
      // FORA do try do JSON.parse de propósito: `migrateTemplate` lança as
      // classes do PACOTE (TemplateVersionTooNewError, ...), que têm título e
      // ação localizados por `describePdfError`. Engolir isso num
      // `ProjectFileError("malformed")` diria "JSON inválido" pra um arquivo
      // que na verdade só foi salvo por um build mais novo.
      try {
        resolve({ template: migrateTemplate(candidate.template as Template), bindings: (candidate.bindings as Binding[]) ?? [] });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new ProjectFileError("unreadable"));
    reader.readAsText(file);
  });
}
