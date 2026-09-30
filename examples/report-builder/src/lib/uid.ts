// A unique id for a new schema/data source — it uses crypto.randomUUID when
// available (every modern browser), and falls back to something simple
// otherwise (a test environment with no crypto, for instance).
export function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}
