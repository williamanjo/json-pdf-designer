import { describePdfError, dictFor } from "json-pdf-designer";
import type { Locale, PdfErrorBlame, PdfProblemCode } from "json-pdf-designer";
import type { Ui } from "../i18n";
import { t } from "../i18n";
import { ProjectFileError, type ProjectFileProblem } from "./projectFile";

// Translating a `generatePdf` error into a message that says what to DO.
//
// THE PACKAGE IS WHAT CLASSIFIES. `describePdfError(err, dictFor(locale))`
// takes the raw error and returns `{ code, blame, title, action?, field?,
// detail }` already LOCALIZED — or `null` when the error is not its own. This
// file does not look at `err.message`: not by `instanceof` class by class
// (which gave one `if` per error, and silence when the package gained a new
// one), and much less by a regex on the phrase. The thrown message is
// DEVELOPER English (log, stack, Sentry), and matching text in it is exactly
// the bug this file had: the regexes were in Portuguese, the package started
// throwing in English, and EVERY classified failure fell into the generic
// branch with nothing to warn.
//
// What is left here, then, is only what the package CANNOT know:
//
//   1. `ProjectFileError` — this example's project file (lib/projectFile.ts).
//      The package has no concept of a "project file"; `describePdfError`
//      returns `null` for it. It is OUR error, with our text.
//   2. One branch for TONE/STRUCTURE: see `invalidPageSize` below.
//   3. The honest generic for what belongs to nobody (a failed `fetch` of the
//      font, a TypeError from inside pdf-lib).
//
// And it is still called in the App's RENDER, not in the `catch`: the state
// holds the RAW error and the phrase is built on every render — switching
// language with the banner open retranslates the banner.

export type GenerationProblem = {
  // The discriminant. `PdfProblemCode` is the package's 18 codes +
  // "expression"; the two outside are ours. It serves for a branch of its own
  // in the UI, telemetry or an HTTP status in a backend — without matching text.
  code: PdfProblemCode | "projectFile" | "desconhecido";
  // Whose fault it is: it changes the UI's tone and, on a server, the HTTP
  // status. It used to come from an enum of OURS in Portuguese; now it is the
  // package's `blame` ("data" | "template" | "config" | "package"), because
  // deriving that by hand was one more copy to fall out of sync.
  blame: PdfErrorBlame;
  // A short title — what happened, in the language asked for.
  title: string;
  // What the person does now. OPTIONAL because the package omits it when
  // there is no useful action (its own bug: the "action" is to report it, and
  // the title already says so).
  action?: string;
  // The template field involved, when the error knows which one.
  field?: string;
  // The original message, for whoever wants the raw detail. From the package
  // it comes in ENGLISH on purpose (it is a developer diagnostic, not UI) and
  // showing it translated would be lying about what is in the log. When the
  // failure is OURS (ProjectFileError), the detail comes from the dictionary.
  detail: string;
};

function projectFileDetail(ui: Ui, problem: ProjectFileProblem): string {
  switch (problem) {
    case "semTemplate":
      return ui.projetoSemTemplate;
    case "bindingsNaoLista":
      return ui.projetoBindingsNaoLista;
    case "jsonMalformado":
      return ui.projetoJsonMalformado;
    case "naoLeu":
      return ui.projetoNaoLeu;
  }
}

export function describeGenerationError(err: unknown, locale: Locale): GenerationProblem {
  const ui = t(locale);

  // A refused project file (lib/projectFile.ts). It comes first because it is
  // OUR error, with a code of its own — and it is the only case in which even
  // the `detail` comes from the dictionary, since the phrase is ours and not
  // the package's.
  if (err instanceof ProjectFileError) {
    return {
      code: "projectFile",
      blame: "data",
      title: ui.projetoTitulo,
      action: ui.projetoAcao,
      detail: projectFileDetail(ui, err.problem),
    };
  }

  // A package error: it classifies AND localizes. Zero `instanceof` per
  // class, zero regex. `dictFor(locale)` is the SAME dictionary the
  // `<I18nProvider>` hands the editor (App.tsx passes the same `locale`), so
  // the banner never speaks one language and the editor another.
  const problem = describePdfError(err, dictFor(locale));
  if (problem) {
    // The ONLY branch of our own, and it is not a matter of taste: the
    // `action` the package gives for `invalidPageSize` says to "set the width
    // and height on the 'Page' TAB" — and this example's whole subject is
    // assembling the editor WITHOUT a tab bar. Here the
    // `<DesignerPageSettings>` part is a card in the right-hand column, so the
    // package's phrase would send someone looking for something that is not on
    // screen. The title, `code`, `blame` and `field` still come from it.
    if (problem.code === "invalidPageSize") {
      return { ...problem, action: ui.erroTamanhoAcao };
    }
    return problem;
  }

  // Neither ours nor the package's: a failed `fetch` of the font, a
  // TypeError from inside pdf-lib, a network error. An honest generic —
  // inventing a title for a failure we do not know is worse than admitting we
  // do not know.
  return {
    code: "desconhecido",
    blame: "package",
    title: ui.erroGenericoTitulo,
    action: ui.erroGenericoAcao,
    detail: err instanceof Error ? err.message : String(err),
  };
}
