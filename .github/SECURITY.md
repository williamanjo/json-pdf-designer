# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 3.x | Yes |
| < 3.0 | No |

Security fixes land on the latest `3.x` release. Older majors are not
patched — upgrade first, then report.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub's private reporting form:
[Report a vulnerability](https://github.com/williamanjo/json-pdf-designer/security/advisories/new).
It opens a private thread visible only to the maintainers.

What helps, in order of usefulness:

1. The version of `json-pdf-designer` and of Node / React.
2. A minimal template + binding JSON that reproduces it.
3. What an attacker gets out of it.

You can expect a first reply within 7 days and a fix or a decision
within 30 days for anything confirmed. Reporters are credited in the
advisory unless they ask not to be.

## Threat model worth knowing

This package renders **user-supplied JSON** into a PDF through
[pdf-lib](https://github.com/Hopding/pdf-lib) — no DOM, no headless
browser, no shell. Two areas deserve extra scrutiny in a report:

- **The expression engine** (`src/expressions/`) evaluates a small
  formula language. It is a hand-written parser and evaluator with no
  `eval` and no access to the host scope. An escape from that sandbox is
  a vulnerability.
- **Resource exhaustion.** A template can ask for very large images,
  very many pages or a deeply nested section tree. Limits live in
  `src/pdf/generate.ts`; an input that gets past them and pins a worker
  is a valid report.

Rendering a template you did not author is equivalent to rendering
untrusted input. Generate in a worker with a timeout.
