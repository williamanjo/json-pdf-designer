import type { CSSProperties } from "react";

// Junção de classe e de style, num lugar só. Antes disto o pacote tinha TRÊS
// formas de concatenar classe — `[...].join(" ")` (Button/Select/Textarea),
// template literal (Card) e `[...].filter(Boolean).join(" ")`
// (ClearFieldButton) — e nenhuma delas deduplicava nem tratava o caso de
// "nada sobrou".
export type ClassValue = string | false | null | undefined;

// `cx("jpd-btn", props.className)`.
//
// ORDEM: classe própria primeiro, a do consumidor por último. É só
// legibilidade e estabilidade de diff — a ordem dos tokens DENTRO do atributo
// `class` nunca decidiu cascata, nem com Tailwind. `.jpd-btn` e a classe do
// consumidor têm a mesma especificidade (0-1-0), então quem ganha é a ordem
// na FOLHA DE ESTILO, não aqui. Quem precisa vencer o theme.css carrega o CSS
// dele depois, ou usa `style` (ver mergeStyle abaixo).
//
// DEDUPE: por token exato, primeira ocorrência vence. Não é pra resolver
// conflito de utilitária (esse problema sai junto com o Tailwind) — é porque
// a composição passa o mesmo token duas vezes de verdade: ClearFieldButton
// repassa `className` pro Button, que já pôs a base dele; e um adapter de
// slot que embrulha o nosso próprio componente
// (`(p) => <Button {...p} className={cx("meu", p.className)} />`) passa por
// aqui duas vezes. Deduplicar deixa `cx` idempotente, que é o que permite
// asserção estável de markup nos testes.
//
// RETORNO `undefined` (e não `""`) quando nada sobra: o React OMITE o
// atributo pra `undefined`, então o markup não fica com `class=""` sobrando.
// É o oposto do que o Card fazia (`${...} ${className}` sempre emitia um
// espaço no fim, mesmo sem className).
export function cx(...parts: ClassValue[]): string | undefined {
  const seen = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const token of part.split(/\s+/)) {
      if (token) seen.add(token);
    }
  }
  if (seen.size === 0) return undefined;
  return [...seen].join(" ");
}

// `style={mergeStyle(nossoStyle, props.style)}`.
//
// UMA regra, em todo lugar: o `style` do consumidor ganha. É a saída de
// último recurso — o que sobrou quando classe e token não bastaram —, então
// não pode ser sobrescrita pelo componente.
//
// Duas consequências assumidas de propósito: o `gridTemplateRows` do TabPanel
// É o mecanismo de colapso, e o `backgroundColor` de cada swatch em
// PaletteSwatches É a paleta. Sobrescrever qualquer um dos dois quebra a
// função do componente — e isso é aceitável numa saída de último recurso.
export function mergeStyle(own: CSSProperties | undefined, incoming: CSSProperties | undefined): CSSProperties | undefined {
  if (!own) return incoming;
  if (!incoming) return own;
  return { ...own, ...incoming };
}

// Estilo de UMA parte interna de um componente.
//
// A regra de toda a API de estilo do pacote é:
//
//   `className`/`style`/`...rest` vão pro elemento que dá NOME ao componente.
//   Todo outro elemento que ele renderiza é endereçado por `parts`, por papel.
//
// Então `<Input className>` continua batendo no `<input>` (igual a 2.x, sem
// migração), e o `<label>` que embrulha o controle passa a ser
// `parts={{ root: ... }}`. Em `<Modal>` o nomeado é o PAINEL; o fundo
// escurecido é `parts={{ overlay: ... }}`.
//
// A alternativa "className sempre na raiz" foi recusada: ela realocaria em
// silêncio todo `<Input className="w-24">` existente do controle pro wrapper
// sempre que `label` estivesse presente — quebra sem erro, só UI errada.
//
// Cada componente declara um conjunto FECHADO de 2 a 6 chaves, então o
// consumidor descobre por autocomplete no próprio componente e o TypeScript
// reprova typo. É o que substitui o mapa global de 50-80 chaves que foi
// recusado: mesma cobertura, superfície local.
//
// `parts` aceita só className/style — sem handler, sem ref, de propósito.
// É esse limite que impede o `parts` de crescer de volta pra um mapa global:
// quem precisa de handler/ref no wrapper omite `label` e compõe o próprio,
// o que JÁ funciona hoje (Input/Select/Textarea devolvem o controle nu
// quando não recebem `label`).
export type PartStyle = string | { className?: string; style?: CSSProperties };

export function readPart(part: PartStyle | undefined): { className?: string; style?: CSSProperties } {
  if (!part) return {};
  return typeof part === "string" ? { className: part } : part;
}
