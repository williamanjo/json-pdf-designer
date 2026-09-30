import { describePdfError, dictFor } from "json-pdf-designer/server";
import type { Locale, PdfErrorBlame, PdfProblem, PdfProblemCode } from "json-pdf-designer/server";
import { FontAssetError } from "./font";
import { ProjectFileError } from "./projectFile";
import { shellDict } from "../i18n";

// The CLASSIFICATION of a generation failure — which error it is, whose
// fault it is, and what text the person reads.
//
// The split is the one the package started offering in 3.0.0:
//
//   - ITS error: `describePdfError(err, dictFor(locale))` returns
//     `{ code, blame, title, action?, field?, detail }` with the title and
//     action ALREADY LOCALIZED. There are 18 codes + `expression`, and the
//     function is exhaustive — there is no more "it falls into the generic
//     branch because I did not recognize it".
//   - OUR error: `describePdfError` returns `null` (an invalid project file,
//     a font asset that did not load). Then, and only then, the text comes
//     from the shell's dictionary (`src/i18n.ts`, `failures.*`).
//
// WHAT WAS WRONG BEFORE: the errors the package threw as a plain `Error` were
// recognized by a REGEX on the Portuguese phrase (`/tamanho inválido/`,
// `/Paginação travada/`). In 3.0.0 `error.message` turned to English, and each
// failure became a class with a `code` — so every one of those regexes stopped
// matching, silently, and ANY failure landed in "unexpected error". Zero
// regexes are left here, and none should come back: matching message text
// couples the UI to a phrase the package may rewrite at any time.
//
// `blame` is no longer derived by hand either. It comes from the package
// (`data` / `template` / `config` / `package`) — the same information a
// backend uses to choose between 413, 400 and 500, and it should not have two

// The codes that are OURS — what the package does not know exists. They sit
// next to its codes in the union below instead of in a separate field: for
// whoever renders, "which failure was it" is a single question.
export type ShellFailureCode = "projectFile" | "fontAsset" | "unknown";

// The same shape as the package's `PdfProblem`, with the `code` widened.
// Reusing its shape (including `blame: PdfErrorBlame`) is what lets the banner
// handle our error and its error through the same render path.
export type GenerationProblem = Omit<PdfProblem, "code"> & {
  code: PdfProblemCode | ShellFailureCode;
};

// Called AT RENDER TIME, never in the `catch`: the state holds the RAW error,
// and the text is resolved here with the `locale` of the moment. That is what
// makes switching the language with the banner open retranslate the banner,
// without regenerating the PDF.
export function describeGenerationError(err: unknown, locale: Locale): GenerationProblem {
  // The title and action already in the language asked for — the package's
  // dictionary is the same `dictFor(locale)` this example already uses for its
  // own labels.
  const tt = shellDict(locale);
  const problem = describePdfError(err, dictFor(locale));

  if (problem) {
    // The ONLY package failure text this example rewrites, and it is not a
    // matter of tone: its action is "fix the expression — <message>", and here
    // there is a panel ("Template problems") that already lists ALL the broken
    // expressions with each one's location. Sending the person there is better
    // than repeating a single message. `code`, `blame` and `title` still come
    // from the package.
    if (problem.code === "expression") {
      return { ...problem, action: tt.failures.expressionAction };
    }
    return problem;
  }

  // From here down: the error is NOT the package's. It returned `null` on
  // purpose instead of inventing a title for a failure it does not know.
  const detail = err instanceof Error ? err.message : String(err);

  // A project file (the JSON this example saves/loads) — this app's concept,
  // the package has never heard of it. The class carries the `reason`
  // precisely so this classification does not have to read the message.
  if (err instanceof ProjectFileError) {
    const copy = tt.failures.projectFile[err.reason];
    return {
      code: "projectFile",
      // A broken shape is a problem with the TEMPLATE that came in the file;
      // reading/parsing is a problem with the file the person chose.
      blame: err.reason === "shape" ? "template" : "data",
      title: copy.title,
      action: copy.action,
      detail,
    };
  }

  // This example's font is an embedded asset (src/assets/inter-regular.ttf).
  // Failing to fetch it is a build/installation problem — nothing to do with
  // THE PACKAGE's font errors, which are all about .woff2 and `fontBytes`.
  if (err instanceof FontAssetError) {
    return {
      code: "fontAsset",
      blame: "config",
      title: tt.failures.fontAsset.title,
      action: tt.failures.fontAsset.action,
      detail,
    };
  }

  // An honest generic: a TypeError from inside pdf-lib, a network failure,
  // whatever. Before this round EVERY classified failure arrived here.
  return {
    code: "unknown",
    blame: "package" satisfies PdfErrorBlame,
    title: tt.failures.unknown.title,
    action: tt.failures.unknown.action,
    detail,
  };
}
