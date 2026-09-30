// Extracts a readable message from an `unknown` caught in a catch — `throw`
// does not guarantee a real Error (it can be a string, an object, and so on).
// A single core reused by the library's several catches, which used to
// reimplement the same `err instanceof Error ? err.message : ...` each its own way.
export function toErrorMessage(err: unknown, fallback: string | ((err: unknown) => string)): string {
  if (err instanceof Error) return err.message;
  return typeof fallback === "function" ? fallback(err) : fallback;
}
