import type { JsonSource } from "../components/DataSourcePanel";

// Junta N fontes JSON num objeto só, nível superior — em caso de chave
// repetida, a fonte mais pra baixo na lista vence. Erro de uma fonte
// (JSON inválido, ou não é objeto) não impede as outras de entrar na
// mescla; só fica de fora e aparece marcada.

// CÓDIGO de falha, não frase pronta: o resultado de `mergeSources` vai pro
// ESTADO do App (`errorsById`) e só é recalculado no "Resync"/"Gerar PDF".
// Se guardasse a mensagem traduzida, trocar de idioma deixaria o aviso
// antigo na tela até a próxima varredura. A frase sai do dicionário na hora
// de renderizar (DataSourcePanel), então ela troca junto com o seletor.
export type SourceErrorCode = "jsonInvalido" | "naoObjeto";

export function mergeSources(sources: JsonSource[]): {
  data: Record<string, unknown>;
  errorsById: Record<string, SourceErrorCode>;
} {
  const data: Record<string, unknown> = {};
  const errorsById: Record<string, SourceErrorCode> = {};
  for (const source of sources) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source.raw);
    } catch {
      errorsById[source.id] = "jsonInvalido";
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errorsById[source.id] = "naoObjeto";
      continue;
    }
    Object.assign(data, parsed);
  }
  return { data, errorsById };
}
