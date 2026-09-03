import { readFileSync as fsRead } from "node:fs";

// LEITURA DE FONTE PROS GUARDS, com fim de linha normalizado.
//
// Praticamente todo guard deste repo varre a FONTE com regex, e boa parte
// desses regexes casa `\n` — lista de item YAML, bloco de token CSS, forma de
// export, assinatura em duas linhas. No Windows a árvore de trabalho pode
// estar em CRLF (é o default do `core.autocrlf`), e aí `- item\r\n` não casa
// `- item\n`.
//
// O modo de falha é o pior possível pra um guard: ele não quebra, ele passa
// VAZIO. `[...texto.matchAll(re)]` devolve zero, o `filter` não acha nada, e
// o `expect(...).toEqual([])` fica verde sobre nenhuma evidência.
//
// Não é hipotético. Os dois casos de cobertura de workflow do
// docsFreshness nasceram verdes num arquivo que eu tinha escrito com LF e
// caíram no instante em que o git converteu o `ci.yml` pra CRLF ao trocar de
// commit — ou seja, o mesmo teste dava resultado diferente dependendo de o
// arquivo ter passado pelo checkout ou não.
//
// Por isso a normalização mora aqui, e não em cada `readFileSync`: guard novo
// que importe deste módulo já nasce imune, e quem esquecer o `.replace()` não
// tem como introduzir o problema de volta em silêncio.
//
// O segundo parâmetro existe só pra os call sites que passam `"utf8"`
// continuarem lendo naturalmente; ele é ignorado, porque a codificação aqui é
// sempre utf8.
export function readFileSync(path: string, _encoding?: unknown): string {
  return fsRead(path, "utf8").replace(/\r\n/g, "\n");
}
