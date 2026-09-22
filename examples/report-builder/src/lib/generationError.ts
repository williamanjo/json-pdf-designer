import { describePdfError, dictFor } from "json-pdf-designer";
import type { Locale, PdfProblem } from "json-pdf-designer";
import { FontLoadError } from "./font";
import { t, type AppDict } from "../i18n";
import { ProjectFileError, type ProjectFileReason } from "./projectFile";

// Translating a failure of `generatePdf` (or of loading a project) into a
// message that says what to DO.
//
// THE PACKAGE is what classifies: `describePdfError(err, dictFor(locale))`
// takes the raw error and returns `{ code, blame, title, action?, field?,
// detail }` already localized — or `null` if the error is not its own. This
// file used to match a REGEX on the message (`/tamanho inválido/`) to find out
// what had happened; the package's message is fixed English and changed
// wording, the regexes stopped matching, and EVERY failure became "unexpected
// error", silently. That is why `code` exists: a string literal, stable, with
// TypeScript enforcing exhaustiveness. Zero regexes here, on purpose.
//
// `blame` also comes from the package — it is not derived here. It is what
// changes the UI's tone (see components/GenerationErrorBanner.tsx) and, in a
// backend, the HTTP status: `data`/`template` are 4xx, `config` is an
// installation error, `package` is a 500.
//
// What is still OURS: a project file error (lib/projectFile.ts), invalid JSON
// from a data source (lib/sources.ts) and this example's font asset
// (lib/font.ts). The package knows nothing about those, returns `null`, and
// they fall into the branch below with the shell's dictionary (`src/i18n.ts`).
//
// Two layers of language, as before:
//   - `title`/`action` are the copy the person reads and acts on — localized
//     (by THE PACKAGE's dictionary when the error is its own, by the SHELL's
//     when it is ours);
//   - `detail` is the error's RAW message, and it goes through no dictionary —
//     it is the technical layer, and the package always throws it in English.

// Our codes join the same union as the package's: that way whoever renders
// classifies everything by `code`, without having to know where the error came
export type AppProblemCode = "appFontLoad" | "appProjectFile" | "appUnknown";

export type GenerationProblem = Omit<PdfProblem, "code"> & {
  code: PdfProblem["code"] | AppProblemCode;
};

// A table instead of a `switch`: a `Record` over the union forces all three
// reasons to exist, so a new reason in lib/projectFile.ts stops compiling here.
const PROJECT_COPY: Record<ProjectFileReason, { title: (tx: AppDict) => string; action: (tx: AppDict) => string }> = {
  shape: { title: (tx) => tx.projectShapeTitle, action: (tx) => tx.projectShapeAction },
  malformed: { title: (tx) => tx.projectMalformedTitle, action: (tx) => tx.projectMalformedAction },
  unreadable: { title: (tx) => tx.projectUnreadableTitle, action: (tx) => tx.projectUnreadableAction },
};

export function describeGenerationError(err: unknown, locale: Locale): GenerationProblem {
  // `dictFor(locale)` is the SAME dictionary that feeds the editor's
  // `<I18nProvider>` — one `locale` in state, one translation. And since this
  // runs at render time (App.tsx holds the raw error), switching the language
  // with the banner open retranslates what is on screen.
  const problem = describePdfError(err, dictFor(locale));
  if (problem) return withAppCopy(problem, locale);

  const tx = t(locale);
  const detail = err instanceof Error ? err.message : String(err);

  // This example's font asset — ours, so the phrase is ours.
  if (err instanceof FontLoadError) {
    return { code: "appFontLoad", blame: "config", title: tx.genFontTitle, action: tx.genFontAction, detail };
  }

  // A project file — this app's concept, the package does not know it
  // exists. The class carries `reason` precisely so this classification does
  // not have to read the message.
  if (err instanceof ProjectFileError) {
    const copy = PROJECT_COPY[err.reason];
    return {
      code: "appProjectFile",
      // A broken shape is a problem with the TEMPLATE that came in the file;
      // reading or parsing is a problem with the file the person chose. Neither
      // of the two is `package`, which is where all four used to land.
      blame: err.reason === "shape" ? "template" : "data",
      title: copy.title(tx),
      action: copy.action(tx),
      detail,
    };
  }

  // What is left: something from outside the package and outside here (a
  // TypeError from pdf-lib, a network failure). `blame: "package"` keeps the
  // banner in the gray "not your fault, report it" tone — now only for those
  // that deserve that tone.
  return { code: "appUnknown", blame: "package", title: tx.genUnknownTitle, action: tx.genUnknownAction, detail };
}

// Where this example's copy overrides the package's. Only a branch with a
// REASON — duplicating a title/action the package already delivers localized
// is creating two phrases for the same failure, ready to fall out of sync on
function withAppCopy(problem: PdfProblem, locale: Locale): GenerationProblem {
  const tx = t(locale);

  // A `switch` on the `code` (not a regex on the phrase): a literal, and
  // TypeScript warns if a code stops existing.
  switch (problem.code) {
    // The package says "fix the expression in the template" — correct, but it
    // does not know that THIS app has a panel listing each broken expression
    // and where it is. The panel's name comes from the same dictionary the
    // panel uses for its own title, so the message never points at a panel
    // under another name. The `title` still comes from the package.
    case "expression":
      return { ...problem, action: tx.genExpressionAction(tx.problemsTitle) };
    default:
      return problem;
  }
}
