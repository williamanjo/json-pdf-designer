import type { JsonSource } from "../components/DataSourcePanel";

// Junta N fontes JSON num objeto só, nível superior — em caso de chave
// repetida, a fonte mais pra baixo na lista vence. Erro de uma fonte
// (JSON inválido, ou não é objeto) não impede as outras de entrar na
// mescla; só fica de fora e aparece marcada.
export function mergeSources(sources: JsonSource[]): { data: Record<string, unknown>; errorsById: Record<string, string> } {
  const data: Record<string, unknown> = {};
  const errorsById: Record<string, string> = {};
  for (const source of sources) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source.raw);
    } catch {
      errorsById[source.id] = "JSON inválido.";
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errorsById[source.id] = "precisa ser um objeto JSON (não array/valor solto) pra poder juntar com as outras fontes.";
      continue;
    }
    Object.assign(data, parsed);
  }
  return { data, errorsById };
}
