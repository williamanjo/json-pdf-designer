// Extrai uma mensagem legível de um `unknown` capturado num catch — `throw`
// não garante um Error de verdade (pode ser string, objeto, etc.). Núcleo
// único reaproveitado pelos vários catch da lib, que antes reimplementavam
// o mesmo `err instanceof Error ? err.message : ...` cada um à sua maneira.
export function toErrorMessage(err: unknown, fallback: string | ((err: unknown) => string)): string {
  if (err instanceof Error) return err.message;
  return typeof fallback === "function" ? fallback(err) : fallback;
}
