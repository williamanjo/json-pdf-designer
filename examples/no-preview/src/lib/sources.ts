import type { JsonSource } from "../components/DataSourcePanel";

// Junta N fontes JSON num objeto só, nível superior — em caso de chave
// repetida, a fonte mais pra baixo na lista vence. Erro de uma fonte
// (JSON inválido, ou não é objeto) não impede as outras de entrar na
// mescla; só fica de fora e aparece marcada.
//
// POR QUE UM CÓDIGO, e não a frase pronta.
//
// Esta função ANTES recebia `locale` e devolvia a mensagem já traduzida. O
// resultado ia pra estado (`errorsById` no App), e frase traduzida guardada em
// estado CONGELA no idioma em que foi criada: trocar o seletor de idioma
// deixava os erros das fontes na língua antiga até a próxima mescla. O init
// preguiçoso do estado piorava, porque ele mesclava com um `LOCALE_INICIAL`
// fixo — a frase nascia num idioma que o usuário podia nem estar usando.
//
// Com o código, o estado guarda O QUE FALHOU e o painel traduz na
// renderização. Bônus: mesclar JSON volta a ser função de dado, sem
// dependência do dicionário.
export type SourceErrorCode = "invalidJson" | "notAnObject";

export function mergeSources(
  sources: JsonSource[]
): { data: Record<string, unknown>; errorsById: Record<string, SourceErrorCode> } {
  const data: Record<string, unknown> = {};
  const errorsById: Record<string, SourceErrorCode> = {};
  for (const source of sources) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source.raw);
    } catch {
      errorsById[source.id] = "invalidJson";
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errorsById[source.id] = "notAnObject";
      continue;
    }
    Object.assign(data, parsed);
  }
  return { data, errorsById };
}
