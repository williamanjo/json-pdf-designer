import { describePdfError, dictFor } from "json-pdf-designer";
import type { Locale, PdfErrorBlame, PdfProblemCode } from "json-pdf-designer";
import { t } from "../i18n";
import { FontAssetError } from "./font";
import { ProjectFileError } from "./projectFile";

// Translating a failure of `generatePdf` (or of loading a project) into a
// message that says what to DO.
//
// THE PACKAGE IS WHAT CLASSIFIES. `describePdfError(err, dictFor(locale))`
// takes the raw error and returns `{ code, blame, title, action?, field?,
// detail }` already localized — or `null` when the error is not its own. There
// is no `instanceof` per class here, and much less a regex on `err.message`:
// the package's `error.message` is fixed English (a log diagnostic), and
// matching it against a Portuguese phrase is exactly how the previous version
// of this file started throwing EVERY classified failure into the "unexpected
// error" branch, silently.
//
// In a backend it is the same call, and `problem.blame` is what chooses
// between 413, 400 and 500.
//
// The import comes from the main entry (`json-pdf-designer`), not from
// `json-pdf-designer/server`: both export `describePdfError`, but this app
// already imports `generatePdf`/`downloadPdf`/`<Designer>` from the main one,
// and pulling the same localizer through two specifiers would duplicate the
// module in the bundle. Neither entry touches pdf.js — which is what
// `check-no-pdfjs.mjs` verifies after the build.

// The package's `code` (18 codes + "expression") plus OURS, so a consumer can
// handle a case of their own without matching text. The three below are ones
// the package does not know: this example's font, this example's project file,
// and the honest "I do not know what this is".
export type GenerationProblemCode = PdfProblemCode | "fontAsset" | "projectFile" | "unknown";

export type GenerationProblem = {
  code: GenerationProblemCode;
  // Whose fault it is: it changes the UI's tone (see GenerationErrorBanner)
  // and, on a server, the HTTP status. It comes from THE PACKAGE when the
  // error is its own — this file used to derive it by hand, with the
  // Portuguese labels as the key.
  blame: PdfErrorBlame;
  // O que aconteceu, no idioma pedido.
  title: string;
  // What the person does now. Absent when there is no useful action (a
  // package bug: the action is to report it, and the title already says so).
  action?: string;
  // The template field involved, when the error knows which one.
  field?: string;
  // The raw `err.message` — English, on purpose. A technical detail, not the
  // main sentence.
  detail: string;
};

// `locale` chooses the language. Nothing here is held in state: App.tsx holds
// the RAW error and calls this at render time, so switching the language with
// the banner open retranslates the banner on the spot (including the text that
// comes from the package).
export function describeGenerationError(err: unknown, locale: Locale): GenerationProblem {
  const s = t(locale);

  // 1. What belongs to the package, the package classifies AND localizes.
  //    `dictFor(locale)` is its dictionary as a VALUE — the same one the
  //    `<Designer locale>` uses, so the message never sends someone looking
  //    for a tab under another name.
  const doPacote = describePdfError(err, dictFor(locale));
  if (doPacote) return doPacote;

  // 2. From here down it is OURS, and the package returned `null` because it
  //    knows nothing about any of it.

  // The font belongs to this example (src/assets/inter-regular.ttf, see
  // lib/font.ts) — only this app knows where it lives and what to do when it
  // does not load.
  if (err instanceof FontAssetError) {
    return {
      code: "fontAsset",
      blame: "config",
      title: s.genError.fontTitle,
      action: s.genError.fontAction,
      detail: err.message,
    };
  }

  // An invalid project file. The `problem` is the case's KEY (not the
  // phrase), so the message is written here, at render time, and follows the
  // language.
  if (err instanceof ProjectFileError) {
    return {
      code: "projectFile",
      // A project file IS a template + bindings: the blame belongs to the
      // file's content, not to the package. Without this it would fall into the
      // neutral "our bug" tone, which is the opposite of what happened.
      blame: "template",
      title: s.project[err.problem],
      action: s.project.action,
      detail: err.message,
    };
  }

  // 3. An HONEST generic: an error that is neither the package's nor ours (a
  //    TypeError from inside pdf-lib, a network failure, whatever). This is
  //    the only case in which "unexpected error" is true — and it shows the
  //    raw detail, because it is all that is known.
  return {
    code: "unknown",
    blame: "package",
    title: s.genError.genericTitle,
    action: s.genError.genericAction,
    detail: err instanceof Error ? err.message : String(err),
  };
}
