import type { Template, TemplateVersion } from "./types";
import {
  TemplateMigrationMissingError,
  TemplateNotAnObjectError,
  TemplateVersionInvalidError,
  TemplateVersionTooNewError,
} from "./errors";

// The document FORMAT version this build understands. It is NOT the package
// version: the package goes from 2.0.0 to 2.1.0 to 3.0.0 without the Template
// format changing. It only goes up when the saved JSON changes shape.
export const CURRENT_TEMPLATE_VERSION = 1 satisfies TemplateVersion;

// A template saved before the `version` field existed — every template created
// up to the package's v2.0.0. No shape change has happened since then, so
// treating it as 1 is exact, not an approximation.
const IMPLICIT_VERSION = 1;

// Each entry takes format N to N+1. One migration per step, applied in a
// chain — never `if (version === 1) ... if (version === 2) ...` scattered
// around the consumers, which is how this becomes unmanageable by the third
// version.
//
// It is deliberately empty today: there is ONE version. The value of having
// it now is that the first format change lands as ONE entry here, without
// touching any caller — the cost of introducing the chain after there are
// already templates in a database is far higher.
//
// An example of what the first one will look like:
//   1: (t) => ({ ...t, schemas: t.schemas.map(renameTypeToKind) }),
const MIGRATIONS: Record<number, (template: Record<string, unknown>) => Record<string, unknown>> = {};

function readVersion(input: Record<string, unknown>): number {
  const raw = input.version;
  if (raw === undefined || raw === null) return IMPLICIT_VERSION;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1) {
    throw new TemplateVersionInvalidError(raw, IMPLICIT_VERSION);
  }
  return raw;
}

// Normalizes a Template coming from outside (a database, a file, an API) into
// the format this build understands, applying the necessary migrations in
// order.
//
// A single point: `generatePdf` calls this before anything else, so every
// template that generates a PDF goes through here. Whoever loads a template to
// edit (not to generate) should call it explicitly — it is a public export.
//
// A version HIGHER than the current one is an error, not a warning: it means
// the file was saved by a newer build of the package and may contain fields
// this build would silently ignore. Failing loudly is better than generating a
// PDF with a piece missing and nobody noticing.
export function migrateTemplate(input: unknown): Template {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TemplateNotAnObjectError(Array.isArray(input) ? "array" : typeof input);
  }

  let current = input as Record<string, unknown>;
  const from = readVersion(current);

  if (from > CURRENT_TEMPLATE_VERSION) {
    throw new TemplateVersionTooNewError(from, CURRENT_TEMPLATE_VERSION);
  }

  for (let v = from; v < CURRENT_TEMPLATE_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) {
      throw new TemplateMigrationMissingError(v, v + 1);
    }
    current = step(current);
  }

  // It stamps the current version even when nothing was migrated: a template
  // that came in with no `version` leaves with `version: 1`, so whoever saves
  // it back writes it explicitly and the next load no longer relies on the
  // default.
  return { ...current, version: CURRENT_TEMPLATE_VERSION } as unknown as Template;
}
