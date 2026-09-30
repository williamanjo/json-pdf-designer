import { describePdfError, dictFor } from "json-pdf-designer";
import type { Locale, PdfErrorBlame, PdfProblem } from "json-pdf-designer";
import { t, type ShellDict } from "../i18n";
import { ProjectFileError, type ProjectFileProblem } from "./projectFile";

// Translating a failure into something that says what to DO — and the
// division of labor between the package and this app.
//
// THE PACKAGE classifies and localizes what is ITS OWN.
// `describePdfError(err, dict)` returns `{ code, blame, title, action?,
// field?, detail }` already in the language asked for, or `null` when the
// error is not its own. `code` is a string literal (18 codes + "expression"),
// `blame` is "data" | "template" | "config" | "package" — and it is `blame`
// that decides the banner's tone, in the same way it would decide between
// 413/400 and 500 in a backend.
//
// THIS APP only does three things on top of that:
//   1. it handles the errors that are ITS OWN (ProjectFileError — the package
//      does not know the `{ template, bindings }` format exists);
//   2. it replaces the ACTION of one code where it knows more than the package
//      (the one for `expression` points at this shell's panel, which the
//      package does not know about);
//   3. it fills in the action when the package has none (the `blame:
//      "package"` codes do not have one — the action is to report it, and the
//      repo's link is a choice of whoever builds the app).
//
// WHAT LEFT HERE, and why that was a bug: until this round the classification
// was an `instanceof` on three classes PLUS six regexes matching the error's
// phrase in Portuguese (`/tamanho inválido/`, `/Paginação travada/`...). The
// package started throwing `message` in English, with a class and a structured
// `code` — so none of those regexes matched any more, and EVERY classified
// failure fell into the "unexpected error" branch, silently. Matching message
// text was always fragile; `code` is the contract that replaces it.
//
// The function is called in the RENDER (App.tsx), not in the `catch`.

export type GenerationProblem = {
  // A short title — what happened.
  title: string;
  // What the person does now. Optional because there may be no useful
  // action: in the package's two bug codes the "action" is to report it, and
  // the title already says so.
  action?: string;
  // Whose fault it is: it changes the UI's tone and, on a server, the HTTP
  // status. It is THE PACKAGE's `blame`, not a derivation of ours — this field
  // used to be a union in Portuguese ("dado" | "template" | ...) that we
  // assigned by hand in each branch, which is a second source of truth.
  blame: PdfErrorBlame;
  // The template field involved, when the error knows which one.
  field?: string;
  // The original message, for whoever wants the raw detail. NOT translated:
  // it is a developer diagnostic (English, by library convention) and it is
  // what gets pasted into a bug report.
  detail: string;
};

// The four project file refusals (lib/projectFile.ts). The `switch` on the
// code — and not on the phrase — is what guarantees a new refusal shows up
// here: with no `case`, TypeScript refuses the return.
function projectFileTitle(d: ShellDict, problem: ProjectFileProblem): string {
  switch (problem) {
    case "missingTemplate":
      return d.projectMissingTemplate;
    case "badBindings":
      return d.projectBadBindings;
    case "malformed":
      return d.projectMalformed;
    case "unreadable":
      return d.projectUnreadable;
  }
}

// The ACTION — the only place where this example still writes text for a
// package error, and only in two cases, both for a missing API and not out of
// taste.
//
// The `default` is deliberate: a new code in the package comes in with ITS
// title AND ITS action, already localized, without passing through here.
// Replacing it with an exhaustive `switch` would force this file to have a
// phrase of its own per code — exactly the duplication the previous round
function actionFor(problem: PdfProblem, d: ShellDict): string | undefined {
  switch (problem.code) {
    // The package says "fix the expression in the template — <syntax
    // error>". That is right, but it does not know this shell has a panel that
    // already lists every broken expression and which page it is on; sending
    // the person there is more useful than sending them looking. The panel's
    // name comes from the SAME dictionary that draws its header, so it never
    // points at a panel under another name.
    case "expression":
      return d.expressionAction(d.problemsTitle);
    default:
      // An absent `action` = a package bug (paginationStalled,
      // templateMigrationMissing): there is nothing for the person to fix, and
      // the package deliberately does not guess a repository link. Whoever
      // builds the app knows where to report, so the phrase is ours.
      return problem.action ?? (problem.blame === "package" ? d.reportBugAction : undefined);
  }
}

export function describeGenerationError(err: unknown, locale: Locale): GenerationProblem {
  const d = t(locale);

  // OUR error first: `describePdfError` would return `null` for it and a
  // refused project file would become "unexpected error" — which is wrong
  // twice, because it is neither unexpected nor the package's.
  if (err instanceof ProjectFileError) {
    return {
      title: projectFileTitle(d, err.problem),
      action: d.projectAction,
      // The person handed over a file that will not do: what has to change for
      // this to work is the file, not the template open in the editor.
      blame: "data",
      detail: err.message,
    };
  }

  // Everything that belongs to the package: one call, with the title and
  // action already in the shell's language. `dictFor` is the `useT()` that
  // works as a VALUE — this runs outside the React tree (and is also called
  // from the render, with no provider around).
  const problem = describePdfError(err, dictFor(locale));

  if (problem) {
    return {
      title: problem.title,
      action: actionFor(problem, d),
      blame: problem.blame,
      field: problem.field,
      detail: problem.detail,
    };
  }

  // `null` = it is neither the package's error nor ours. A `fetch` that
  // failed while getting the font (lib/font.ts), a storage quota, a TypeError
  // from inside a dependency. An HONEST generic: we do not invent a title for
  // a failure we do not know, and the raw detail is one click away.
  return {
    title: d.genericTitle,
    action: d.genericAction,
    blame: "package",
    detail: err instanceof Error ? err.message : String(err),
  };
}
