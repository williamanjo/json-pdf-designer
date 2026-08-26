// Id único pra schema/fonte de dados nova — usa crypto.randomUUID quando
// disponível (todo browser moderno), cai num fallback simples senão
// (ambiente de teste sem crypto, por exemplo).
export function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}
