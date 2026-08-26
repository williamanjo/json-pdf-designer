# Escopo da v1

Decisões tomadas antes de começar a implementação (ver conversa original
no app `report-builder` — esse pacote nasce de lá).

## Tipos de campo (v1)

- **text** — texto livre, com placeholder de vínculo (`{path}` ou
  `{FUNÇÃO(...)}`) igual já existe hoje no `report-builder`.
- **table** — array de linhas × colunas. Suporta os 3 modos já validados
  no app antigo: array (1 linha por item do JSON), chave/valor (linhas
  soltas escolhidas manualmente) e coluna calculada (fórmula avaliada por
  linha).
- **image** — imagem posicionável (base64/data URI), sem vínculo
  dinâmico na v1 (conteúdo fixo definido no editor).

Fora da v1 (ver [ROADMAP.md](ROADMAP.md)): date, select, checkbox,
qrcode/barcode, signature, svg, multi-página.

## Canvas: drag/resize/select

**Decisão: `react-rnd`.**

Motivo: arrastar + redimensionar + manter proporção/limites é a parte mais
fácil de errar fazendo na mão (matemática de mouse/touch, edge cases de
resize por qualquer canto). `react-rnd` é pacote pequeno, maduro, só faz
isso — não empacota UI extra (sem Ant Design, sem propPanel). Continua
100% nosso porque a gente escreve o que renderiza DENTRO de cada `<Rnd>`.

Alternativa descartada: implementar do zero com pointer events. Mais
controle, mas mais código pra manter, e não muda o resultado final (ainda
ia ser "um retângulo que arrasta e redimensiona").

## Geração do PDF: `pdf-lib`

**Decisão: `pdf-lib` como motor de geração de PDF.**

Motivo: biblioteca JS pura (roda 100% no navegador, sem dependência de
servidor), MIT, ativamente mantida, API de baixo nível (`drawText`,
`drawRectangle`, `drawImage`) que dá controle total sobre onde cada coisa
vai parar no PDF. A gente escreve a lógica de desenhar tabela (iterar
linhas/colunas, desenhar texto + bordas) — não é mágica, mas também não é
muito código dado que já temos os dados prontos (`buildInputs` já produz
string/2D-array por campo).

Ponto de atenção: fonte padrão do pdf-lib (Helvetica, WinAnsiEncoding)
cobre a maioria dos acentos do português (á é ç ã õ etc). Se aparecer
caractere errado, o próximo passo é embutir uma fonte TTF própria via
`fontkit` (ver ROADMAP).

## O que já existe e só precisa ser portado (sem redesenhar)

Estas partes do `report-builder` **não dependem de nenhuma lib de
schema/plugin de terceiros** — são lógica pura ou componentes React só
nossos. Portar quase sem mudança:

- `lib/bindings.ts` — `resolveToken`, `renderTemplate`, `buildInputs`,
  `describeBinding`/`describeBindingShort`, `CUSTOM_FIELD_FUNCTIONS`,
  `TableColumn` (coluna calculada). Só troca o import de tipo
  `Template`/`Plugins` do motor antigo pelo nosso próprio em `types.ts`,
  e a função `generatePdf` no final troca o gerador antigo por
  `generate.ts` (pdf-lib).
- `lib/jsonExplorer.ts` — varre o JSON de exemplo, monta lista de campos
  arrastáveis. Zero dependência de lib de terceiros.
- `components/FieldExplorer.tsx` — painel arrastável + seletor de coluna +
  botão "+". Zero dependência de lib de terceiros.
- `components/ManualBindingPanel.tsx` — editor de vínculo (template livre,
  funções, coluna calculada, popup). Só troca o import de tipo
  `Schema`/`Template`.

O que **desaparece** ao trocar de motor (não existe mais, porque só
existia pra contornar limitação do motor antigo):
- `lib/plugins.ts` inteiro (bridge `registerOpenBindingModal`,
  `registerBindingsLookup`, wrapper `withBindingButton` no propPanel).
- Injeção de DOM via `MutationObserver` no `DesignerPanel`.
- `options.sidebarOpen` e qualquer lógica em volta do "Field List" nativo.

Isso simplifica bastante o `DesignerPanel` — o botão de vínculo manual
vira só mais um botão React normal dentro do nosso próprio componente de
campo selecionado, sem ponte nenhuma.
