import { readFileSync as fsRead } from "node:fs";

// SOURCE READING FOR THE GUARDS, with normalized line endings.
//
// Practically every guard in this repo scans the SOURCE with a regex, and a
// good share of those regexes match `\n` — a YAML item list, a CSS token
// block, an export shape, a two-line signature. On Windows the working tree
// may be in CRLF (it is `core.autocrlf`'s default), and then `- item\r\n` does
// not match `- item\n`.
//
// The failure mode is the worst possible for a guard: it does not break, it
// passes EMPTY. `[...text.matchAll(re)]` returns zero, the `filter` finds
// nothing, and the `expect(...).toEqual([])` goes green over no evidence at all.
//
// This is not hypothetical. The two workflow coverage cases in docsFreshness
// were born green in a file I had written with LF and fell the instant git
// converted `ci.yml` to CRLF on a commit switch — that is, the same test gave a
// different result depending on whether the file had been through a checkout.
//
// That is why the normalization lives here, and not in each `readFileSync`: a
// new guard importing from this module is born immune, and whoever forgets the
// `.replace()` has no way of silently reintroducing the problem.
//
// The second parameter exists only so the call sites passing `"utf8"` keep
// reading naturally; it is ignored, because the encoding here is always utf8.
export function readFileSync(path: string, _encoding?: unknown): string {
  return fsRead(path, "utf8").replace(/\r\n/g, "\n");
}
