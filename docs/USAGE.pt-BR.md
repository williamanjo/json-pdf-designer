**Português** | [English](USAGE.md)

# Documentação

Guia completo de instalação, uso e API do `json-pdf-designer`. Pra visão
geral do projeto, veja o [README](../README.pt-BR.md); pra decisões de
arquitetura internas, veja [ARCHITECTURE.pt-BR.md](./ARCHITECTURE.pt-BR.md).

## Instalação

```bash
npm install json-pdf-designer
```

Peer deps: `react` e `react-dom` (18 ou 19). Importe o CSS do pacote **uma
vez**, no entrypoint do seu app (ele estiliza o próprio `<Designer>` —
sem isso alguns elementos do editor ficam sem posição/cor certa, porque o
Tailwind do seu app não escaneia o código desta lib):

```ts
import "json-pdf-designer/style.css";
```

### Usando sua própria instalação do Tailwind

`dist/style.css` é uma folha de estilo pré-compilada e independente —
funciona com qualquer versão do Tailwind (ou nenhuma) no seu app, porque
é CSS puro já compilado, não classes de utilitário "cruas".

Se seu app já tem o próprio pipeline do Tailwind (v3 ou v4) e você
prefere que ELE gere as classes do Designer também — pra seguir seu
próprio tema/modo escuro em vez de carregar uma segunda folha de estilo
separada — pule o `import "json-pdf-designer/style.css"` acima e aponte
o scan de conteúdo do seu próprio Tailwind pro build do pacote:

**Tailwind v4** (config em CSS):

```css
@import "tailwindcss";
@source "../node_modules/json-pdf-designer/dist/**/*.{js,cjs}";
```

**Tailwind v3** (`tailwind.config.js`):

```js
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/json-pdf-designer/dist/**/*.{js,cjs}",
  ],
  // ...
};
```

`dist/index.js`/`dist/index.cjs` não são minificados, então os nomes de
classe continuam intactos e o scanner de qualquer uma das duas versões
consegue achar toda classe usada pelos componentes do Designer. Escolha
um caminho ou outro — importar `style.css` **e** escanear o pacote com
seu próprio Tailwind ao mesmo tempo só duplica as mesmas regras.

> **Seu app está no Tailwind v3 e já tem o próprio Preflight (reset de
> CSS)?** O `dist/style.css` já vem com o Preflight do Tailwind **v4**
> embutido — importar os dois juntos aplica um reset de CSS duas vezes,
> o que pode aparecer como pequenas diferenças de espaçamento/borda onde
> os dois discordam. Escanear o pacote com o seu próprio Tailwind v3
> (como acima) evita isso de vez: seu build nunca toca no nosso CSS,
> então só o SEU Preflight roda — nada pra importar, nada pra colidir.

### Uso só no servidor (sem precisar de React)

Só precisa do `generatePdf` num backend/API Node e não quer nem
`react`/`react-dom` no meio? Importe do subpath `/server` em vez da raiz
do pacote — mesma lógica de geração de PDF, só que num build separado,
sem React nenhum:

```ts
import { generatePdf, type Template, type Binding } from "json-pdf-designer/server";

const bytes = await generatePdf(template, data, bindings);
```

Ele exporta tudo que é dado/PDF — tipos, `generatePdf`, os helpers de
vínculo (`renderTemplate`, `buildInputs`, …), paletas de cor de gráfico,
as fábricas de schema, `normalizeFontBytes` — mas não
`Designer`/`PdfPreview`/`PdfPreviewModal`/os componentes de UI prontos
(todos React), nem `downloadPdf` (usa `document`/`Blob` do navegador —
não se aplica num servidor; escreva `bytes` num arquivo ou numa resposta
HTTP em vez disso).

A raiz do pacote (`.`) continua exportando o conjunto completo pra quem
usa o editor e a geração juntos no mesmo código — `react`, `react-dom` e
`react-rnd` continuam listados como peer dependencies lá, mas marcados como
opcionais (`peerDependenciesMeta`), então um `npm install` só de backend
não força a instalação deles de qualquer jeito.

O `react-rnd` (a lib de arrastar/redimensionar do canvas) está nessa lista
por um motivo não óbvio: como `dependency` normal ele era instalado sempre,
e como os peers `react`/`react-dom` *dele* **não** são opcionais, o npm
puxava o stack React inteiro — cerca de 8,7MB — até num projeto que só
importa `/server`. Tornar ele peer opcional é o que de fato entrega o
install de backend sem React; o `optional: true` nos nossos próprios peers
react não bastava sozinho.

## Uso básico

```tsx
import { useState } from "react";
import { Designer, generatePdf, downloadPdf, type Template, type Binding } from "json-pdf-designer";
import "json-pdf-designer/style.css";

const initialTemplate: Template = {
  page: { width: 210, height: 297 }, // A4 em mm
  schemas: [],
};

function Report() {
  const [template, setTemplate] = useState<Template>(initialTemplate);
  const [bindings, setBindings] = useState<Binding[]>([]);

  async function handleGenerate() {
    const data = await fetchMyData(); // o JSON de verdade que popula os campos
    const pdfBytes = await generatePdf(template, data, bindings);
    downloadPdf(pdfBytes, "relatorio.pdf");
  }

  return (
    <>
      <Designer
        template={template}
        onChangeTemplate={setTemplate}
        bindings={bindings}
        onChangeBindings={setBindings}
      />
      <button onClick={handleGenerate}>Gerar PDF</button>
    </>
  );
}
```

`onChangeTemplate`/`onChangeBindings` aceitam a forma funcional do
`setState` do React (`(prev) => next`) — use direto o setter do
`useState`, como no exemplo, pra não perder um campo se dois forem
adicionados em sequência rápida.

## Idioma da UI

O `<Designer>` fala inglês por padrão. Passe `locale="pt-BR"` pra trocar
a própria UI dele (botões, abas, avisos, placeholders) pro português:

```tsx
<Designer locale="pt-BR" template={template} onChangeTemplate={setTemplate} bindings={bindings} onChangeBindings={setBindings} />
```

É só uma configuração de casca de UI — nunca muda como o **PDF gerado**
formata data ou moeda (isso é `{DATE(...)}`/`{CURRENCY(...)}` escrito no
próprio conteúdo do template por quem monta ele, ver "Vínculo de dados"
abaixo) nem o `name` interno que seus templates já usam pra campos
existentes.

Se você usa algum componente do pacote sozinho (`PdfPreview`,
`FieldList` etc) sem embrulhar em `<Designer>`, eles renderizam em
inglês por padrão também — embrulhe em `<I18nProvider locale="pt-BR">`
você mesmo se precisar deles em português:

```tsx
import { I18nProvider } from "json-pdf-designer";
import { PdfPreview } from "json-pdf-designer/preview";

<I18nProvider locale="pt-BR">
  <PdfPreview bytes={pdfBytes} />
</I18nProvider>
```

`useT()`/`useLocale()` (exportados) dão o dicionário/código de idioma
ativo dentro dos seus próprios componentes, o mesmo contexto que o
`<Designer>` usa por dentro.

## O que tem

**Campos**: texto, tabela, imagem, **seção** (data band repetido),
**gráfico** (pizza/barra) e **indicador** (cartão de KPI) — arrasta/
redimensiona livre (react-rnd), com **grade de 5mm** travando
posição/tamanho por padrão — segura **Shift** durante o arrasto/resize
pra soltar da grade e mover livre (sem Shift o campo sempre volta pra
grade, mesmo que tenha nascido torto). Botão "+ texto/tabela/imagem/
seção/gráfico/indicador" sempre cria o campo novo **centrado** na área
do corpo — não depende de onde os outros campos já estão, então nunca
"empilha" pra fora da página. Duplo clique liga edição inline: texto/
tabela viram input/textarea direto em cima do campo (Escape sai, e só a
célula efetivamente clicada mostra a fórmula crua — as outras continuam
com o token limpo); imagem abre o seletor de arquivo pra trocar.
`Delete`/`Backspace` apaga TODOS os campos selecionados; `Ctrl`/`Cmd`+`C`
copia, `Ctrl`/`Cmd`+`V` cola uma cópia deslocada (id/nome novos, já
selecionada) — os três atalhos ficam desativados enquanto o foco tá num
input/textarea, pra não comer a digitação normal.

**Seleção múltipla** — Ctrl/Cmd+clique soma/tira um campo da seleção
(no canvas ou na lista lateral); arrastar no fundo vazio do canvas (ou
dentro do corpo de uma seção, sem tocar na barra de arrastar dela) desenha
uma caixa de seleção que pega todo campo que ela cruzar. Arrastar QUALQUER
campo selecionado move o grupo inteiro junto, ao vivo. Arrastar uma seção
sempre move os campos membros dela também, além do resto da seleção.

**Painel lateral** tem uma única fileira de abas, sem aninhamento —
**Campos** (lista com todo campo já colocado: clique em qualquer parte da
linha seleciona — e rola a lista sozinha até o item, caso esteja fora da
área visível —, botões de enviar-pra-trás/trazer-pra-frente aparecem na
linha selecionada, cadeado trava/destrava mover/redimensionar, lixeira
remove direto, duplo clique no nome renomeia o campo — remapeia junto
qualquer `Binding.schemaName` que apontava pro nome antigo), **Página** (tamanho/orientação, cabeçalho/rodapé/margem,
imagem de fundo, toggle "editar cabeçalho/rodapé/margem") sempre
acessíveis, e **Dados**/**Estilo**/**Filtro** — só aparecem enquanto um
campo está selecionado, e só as que fazem sentido pro tipo dele (Estilo
não existe pra imagem/seção; Filtro só existe pra gráfico). Trocar de
campo mantém a aba atual se ela também existir no novo tipo (editando o
estilo de vários gráficos em sequência, por exemplo, sem ficar voltando
pra "Dados" a cada clique); se não existir, cai pra "Campos".

Cada aba de Dados/Estilo/Filtro/Página pode ser fixada como escondida no
"×" que aparece nela quando ativa — reaparece pelo botão "+" no fim da
barra (que também lista "Restaurar padrão" quando a ordem ou a
visibilidade foi alterada). A ordem das abas é livre — arraste uma em
cima da outra pra reordenar (mostra uma barrinha indicando onde vai
parar). Ordem e abas escondidas persistem entre sessões via
`localStorage` (chaves `json-pdf-designer:tab-order` e
`json-pdf-designer:hidden-tabs`) — preferência de UI do navegador, não
faz parte do `Template`/`Binding[]` salvo.

**Aviso de configuração incompleta** — seção/gráfico sem vínculo com o
JSON, ou gráfico com filtro que tem coluna escolhida e valor em branco
(ver "Filtro do gráfico" abaixo), ganham um ícone de alerta ⚠ amarelo na
lista de Campos (com o motivo no tooltip) e, no caso do gráfico, também
na aba certa da barra superior — "Dados" se falta o vínculo, "Filtro" se
o problema é uma condição incompleta — pra apontar direto onde mexer, sem
precisar abrir cada aba pra descobrir.

**Vínculo de dados** (`Binding`) — cada campo aponta pro JSON real:
- `scalar` — um valor direto (`caminho.no.json`).
- `template` — texto livre com `{token}`, ex:
  `"Cliente: {nome} — Total: {SUM(rows.total)}"`.
- `array` — uma tabela vinda de um array de objetos, coluna por coluna,
  incluindo **coluna calculada** (rótulo fixo + fórmula avaliada por linha,
  pode combinar texto fixo com mais de um token: `"{pnr} - {produto}"`).
- `keyvalue` — tabela "campo / valor" a partir de uma lista de paths
  escolhidos manualmente.
- `section` — o array que uma **seção** (ver abaixo) repete, um item por
  repetição.

Dentro de `{...}` (texto, coluna calculada, célula de rodapé — em
qualquer lugar): funções `SUM`, `COUNT`, `AVG`, `CONCAT`, `UPPER`,
`LOWER`, `TRIM(caminho)` (tira espaço do início/fim — útil pra campo de
sistema legado com largura fixa, tipo `"fatura": " 01156189"`; `{token}`/
`CONCAT` preservam o valor exatamente como veio, de propósito, então o
espaço só some se você pedir), `DATE(caminho, "saída"[, "entrada"])`, `CURRENCY(caminho, "R$")`,
`NUMBER(caminho, casas)` (tipo `%.2f` do C — controla quantas casas
decimais, sem separador de milhar/símbolo, que é o `CURRENCY`),
`IF(condição, "então", "senão")` (ver abaixo), e **aritmética simples**
(`{qtd * preco}`, `{subtotal - desconto}` — ver "Como uma expressão é lida"
abaixo). Uma função PODE receber outra função ou uma
expressão aritmética como argumento (ex:
`{CURRENCY(SUM(rows.total), "R$")}`), incluindo duas combinadas por
operador (`{SUM(a) - SUM(b)}` subtrai certo), com uma exceção: **o
argumento do próprio `SUM`, `COUNT` e `AVG` é sempre lido como um path
de array cru**, nunca resolvido como outra chamada de função ou
expressão aninhada — `{SUM(CONCAT(a, b))}` não funciona, o argumento
tem que ser um path simples tipo `rows.total`. O *resultado* deles,
porém, continua podendo entrar dentro de outra função por fora sem
problema (`{CURRENCY(SUM(rows.total), "R$")}` acima funciona porque
quem resolve o próprio argumento ali é o `CURRENCY`, não o `SUM`).

**Como uma expressão é lida.** `*` e `/` ligam mais forte que `+` e `-`, e
parênteses agrupam:

```
{qtd * preco + taxa}     -> qtd * preco, depois + taxa
{(base + taxa) * qtd}    -> base + taxa primeiro, depois * qtd
```

Uma regra é incomum e vale conhecer, porque é ela que permite uma chave
JSON com hífen ou com espaço: **um operador só é operador quando tem
espaço em branco dos dois lados.**

```
{my-key}    -> o path "my-key"         (não "my menos key")
{my key}    -> o path "my key"
{a - b}     -> subtração
{a -b}      -> nenhum dos dois: o path "a -b", que normalmente dá vazio
```

O mesmo vale pros operadores de comparação dentro do `IF`:
`IF(a == 2, …)` é comparação, `IF(a==2, …)` é um path chamado `a==2`.

Expressão que não consegue produzir número resolve pra **vazio** em vez de
falhar: `{"x" + 1}`, `{a / 0}` e um path que não existe se comportam
assim (um path ausente conta como `0` dentro de uma soma, então
`{naoexiste + a}` dá o valor de `a`). Erro de sintaxe — aspas não
fechadas, parêntese aberto — estoura com a posição, pra um template
mal-formado não renderizar em branco sem ninguém perceber.

`IF(condição, "então", "senão")` escolhe um dos dois últimos
argumentos — `condição` é uma comparação (`status == "paid"`,
`total > 100`; operadores `==`, `!=`, `>`, `>=`, `<`, `<=`, sempre
cercados de espaço) ou um path/expressão isolada, checado como
verdadeiro/falso (string vazia, `"0"` e `"false"` contam como falso,
qualquer outra coisa como verdadeiro). Só o lado escolhido é resolvido
de verdade — `{IF(temDesconto, valorDesconto, "0")}` não quebra mesmo
que `valorDesconto` não exista no dado quando `temDesconto` é falso.

`DATE`'s 3º argumento (opcional) diz o **formato de entrada** — sem ele,
`new Date(raw)` do JS tenta adivinhar, e uma data tipo `"10/04/2025"`
(dia 10) vira 10 de outubro (formato americano). Informando
`DATE(vencto, "DD/MM/YYYY", "DD/MM/YYYY")`, lê exatamente como escrito,
sem ambiguidade. As datas são sempre lidas/escritas em **UTC** (não no
fuso do navegador/servidor que gera o PDF) — uma data só (`"2026-07-01"`,
sem hora) sai igual ao que foi escrito não importa onde rodar; um
datetime com fuso explícito (`"...T23:30:00-03:00"`) é convertido pro
instante UTC equivalente.

## Seção repetida (master-detail / data band)

Uma `SectionSchema` é um retângulo puro — não guarda filhos, é só um
**grupo**: qualquer campo (texto, imagem, tabela) largado em cima dela no
canvas vira **membro** (via `BaseSchema.sectionId`), continuando um campo
normal do array plano `template.schemas` — mesma posição absoluta,
mesmo jeito de selecionar/editar/arrastar. Arrastar um campo pra FORA da
seção limpa o vínculo de novo (bidirecional). Uma seção só arrasta pela
**barra roxa no topo** ("Seção (repete) — arraste aqui pra mover") —
clicar em qualquer outro lugar dela (ou de um campo por cima) seleciona
normalmente, sem mover.

Vinculada (`type: "section"`, path pro array), a seção **repete uma vez
por item** do array — empilhando na vertical e paginando junto com o
resto do corpo (uma seção grande vira página nova como qualquer tabela).
Dentro dela:
- Qualquer texto membro resolve `{campo}` contra o **ITEM atual** (não o
  documento inteiro), e `{Line}`/`{index}` dá o número da repetição
  (1, 2, 3...).
- Uma **tabela membro sem vínculo próprio** mostra uma linha só, célula a
  célula, contra o item atual — célula vazia cai no nome da coluna direto
  (`head[i]` -> `{item[head[i]]}`), célula preenchida é um template de
  verdade (mesma sintaxe de texto, pode combinar campos).
- Uma **tabela membro COM vínculo `array`** (path relativo ao item, ex.
  Pedido → ItensPedido) é mestre-detalhe de verdade — uma linha por item
  do array aninhado, e a seção **cresce de altura** pra caber (o texto
  abaixo da tabela, se houver, desloca junto, mesmo se mais de uma tabela
  crescer na mesma seção).

Uma seção também pode ter **zero tabelas** — só campos de texto membros
já é um "boletim"/lista repetida válido.

## Tabela — cabeçalho, valor e rodapé (totais)

Além das colunas normais, uma tabela pode ter uma **linha de totais**
(`footer`) — uma célula por coluna, cada uma um template de verdade
(texto fixo e/ou `{token}`/`{SUM(...)}`); desenha só uma vez, na última
fatia, mesmo se a tabela paginar (nunca repete feito o cabeçalho).

Cor de fundo/texto e **tamanho de fonte** são configuráveis em três
níveis, do mais genérico ao mais específico — cabeçalho inteiro, linha de
valor inteira (todas as linhas de dado), rodapé inteiro (`headBackgroundColor`/
`headTextColor`/`headFontSize`, `bodyBackgroundColor`/`bodyTextColor`/
`bodyFontSize`, `footerBackgroundColor`/`footerTextColor`/`footerFontSize`
em `TableSchema`) — e por **coluna individual** via `columnStyles`
(header e valor separados, sobrescreve só aquela coluna). Sem nada
definido, cai no azul/branco/9pt de sempre — templates antigos não mudam
de aparência.

A lista "Colunas atuais da tabela" no painel deixa **arrastar pra
reordenar** (desloca `head`/`content`/`footer`/`columnStyles` juntos,
pelo índice) e tem um botão "+" pra adicionar coluna de uma fonte de
dados conhecida (mesma da seção dona, se a tabela for membro, ou do
próprio vínculo se for solta).

**Largura de coluna** (`columnWidths`, mm, uma entrada esparsa por
coluna) — largura explícita, definida pelo input numérico no painel de
estilo daquela coluna ou arrastando o divisor entre dois cabeçalhos de
coluna no canvas. Coluna sem largura própria divide, em partes iguais, o
que sobra da largura total da tabela; com `columnWidths` totalmente
ausente, toda coluna ainda divide a largura igualmente, igual sempre foi.

**Alinhamento de texto por bloco** — `headAlign`/`bodyAlign`/
`footerAlign` (`"left"` default/`"center"`/`"right"`) e
`headVerticalAlign`/`bodyVerticalAlign`/`footerVerticalAlign` (`"top"`/
`"middle"` default/`"bottom"`).

**Arredondamento de canto por bloco** — `headBorderRadius`/
`bodyBorderRadius`/`footerBorderRadius`, cada um um `TableCornerRadii`
(`{ topLeft?, topRight?, bottomLeft?, bottomRight? }`, mm; ausente/`0`
continua reto). Só os cantos que tocam a borda externa da tabela fazem
sentido por bloco (e é só isso que o painel mostra): cabeçalho arredonda
os cantos de cima, rodapé os de baixo, e o corpo também arredonda os de
baixo, mas só enquanto não há rodapé — com a linha de totais ligada, é o
rodapé que fecha os cantos de baixo.

**Linha zebrada** (`bodyBandColor`) — cor de fundo das linhas de dado de
índice ÍMPAR (0-based); linhas pares continuam com `bodyBackgroundColor`.
Ausente = sem zebra.

**Paletas prontas de estilo** (`TableSchema.colorPalette`) — um seletor
Paleta na aba Estilo, agrupado Claro/Médio/Escuro (azul/verde/laranja/
cinza, mais roxo em claro/médio, e um `default`), mesma ideia do
"Formatar como Tabela" do Excel (ver `TABLE_PALETTES`/
`TABLE_PALETTE_GROUPS` em `tableColors.ts`). Escolher um preenche
`headBackgroundColor`/`headTextColor`/`bodyBandColor` de uma vez —
continua editável à mão depois; `colorPalette` só guarda qual preset
mostrar selecionado da próxima vez, o `generatePdf` lê os campos de cor
de verdade, não o nome da paleta.

**Cabeçalho, rodapé e margens** (`Template.headerHeight/footerHeight/
marginLeft/marginRight`, em mm) — faixas que se repetem em **toda página**
do PDF gerado. Não existe campo de "zona" no schema: um campo cai
automaticamente no cabeçalho/rodapé/margem quando sua posição (x/y) fica
contida ali — é só onde ele tá, sem precisar marcar nada.

Fora do modo isolado (ver abaixo), um campo do cabeçalho/rodapé/margem
aparece no canvas só como contexto visual — meio apagado, sem clique,
sem arrastar/redimensionar (e vice-versa: campo do corpo trava enquanto
isolado). A lista lateral também só mostra o que é editável no modo
atual. Botão **"Editar cabeçalho/rodapé/margem"** isola a edição: some
com o corpo, mostra só a faixa vermelha, e todo campo novo criado nesse
modo já nasce dentro dela.

Dentro de um campo de texto que caia nessas faixas, os tokens especiais
`{pageNumber}` e `{pageCount}` funcionam direto no conteúdo (com ou sem
vínculo) e são resolvidos de novo em cada página — útil pra "Página 1 de
3" no rodapé.

**Paginação de verdade** — se uma tabela (ou seção repetida) do corpo
tiver mais linhas/itens do que cabem numa página, o `generatePdf` quebra
em várias páginas automaticamente. TODO item do corpo — tabela, seção,
texto, imagem — é processado numa sequência só, **ordenada por Y**:
quando um termina, o próximo continua logo abaixo (mesma página ou
nova, o que couber), preservando o espaçamento desenhado no editor
mesmo que algo antes tenha crescido (seção mestre-detalhe) ou mudado de
página — então dá pra colocar uma legenda/título ENTRE duas tabelas, ou
texto antes/depois de uma seção, que a posição relativa é respeitada.
No editor de cada tabela dá pra desligar "Repetir cabeçalho da tabela
nas próximas páginas" (default ligado).

**Texto — fundo e borda** — um campo de texto pode ter cor de fundo e
borda (`TextSchema.backgroundColor`/`borderColor`/`borderWidth`, em mm) —
útil pra faixa de título colorida, caixa de destaque etc. Sem nada
definido, fica transparente/sem borda, como sempre foi.

**Gráfico** (`ChartSchema`) — pizza ou barra sobre um array vinculado
(`Binding` do tipo `chart`: `path` do array, `labelColumn` a chave do
rótulo, `valueColumn` a chave numérica somada por rótulo — ex: trocar
`valueColumn` de `"valor"` pra `"quantidade"` sem mexer no resto). No
painel, campos ficam em três abas — **Dados** (ordenar por, agrupar em
"Outros" a partir de N, e o Vínculo com o JSON), **Estilo** (tipo, formato,
legenda, paleta de cores, exibir, formato do valor) e **Filtro** (ver
abaixo) — mesmo padrão de abas da tabela. Agrupa
os `topN` maiores (default 7, qualquer inteiro — `0` desliga o agrupamento e
mostra todo mundo) numa cor fixa cada e o resto numa fatia/barra "Outros" —
nunca estoura a paleta. `displayMode` escolhe se a legenda/rótulo mostra o
número bruto ou a porcentagem do total; `valueFormat` (`"number"` default
ou `"currency"`) formata a parte do valor bruto — `currencySymbol` (default
`"R$"`) e `decimals` (default 2) só valem quando `valueFormat` é
`"currency"`.

**Paleta de cores** (`ChartSchema.colorPalette`) — nome de uma paleta
pronta (ver `CHART_PALETTE_NAMES`/`CHART_PALETTE_LABELS` em
`chart/colors.ts`): `"default"`, `"classic"`, `"modern"`, `"vibrant"`,
`"pastel"`, `"grayscale"` — temas de cores prontos, mesma ideia de
qualquer editor de planilha/gráfico. String solta (não união fechada),
ausente cai em `"default"` sozinho — template salvo com nome de paleta
removida numa versão futura não quebra. `"custom"` usa
`ChartSchema.customPaletteColors` (`string[]`, até `CHART_PALETTE_SIZE`
cores hex) em vez de cor fixa — editável cor a cor no painel (aba
Estilo → Paleta de cores → escolher "Personalizada" revela os seletores);
sem nenhuma cor escolhida ainda, cai pra `"default"` até o primeiro
`onChangeCustomColors`.

**Filtro do gráfico** (aba própria "Filtro" no painel, separada de "Vínculo
com o JSON") — o `Binding` do tipo `chart` aceita `filters?:
ChartFilterGroup[]` (grupos combinados com **OU**; dentro de um grupo, as
condições combinam com **E** — filtro avançado com grupos E/OU
combináveis). Cada condição é `{ column, op, value }`, onde `column` é uma chave do
item do array vinculado (não precisa ser `labelColumn`/`valueColumn` — dá
pra filtrar por uma coluna e agregar por outra) e `op` é `"eq"` (`=`),
`"neq"` (`≠`), `"gt"` (`>`), `"gte"` (`≥`), `"lt"` (`<`), `"lte"` (`≤`) ou
`"contains"` (substring, case-insensitive). Comparação numérica quando os
dois lados dão pra converter em número, senão texto — sem filtro nenhum
(`filters` ausente/vazio), todo item entra, comportamento de sempre.

```ts
// só agentes com quantidade > 20 OU status "vip"
const binding: Binding = {
  schemaName: "meu_grafico",
  type: "chart",
  path: "vendasPorAgente",
  labelColumn: "label",
  valueColumn: "value",
  filters: [
    [{ column: "quantity", op: "gt", value: "20" }],
    [{ column: "status", op: "eq", value: "vip" }],
  ],
};
```

**Indicador** (`KpiSchema`) — cartão de KPI: fundo colorido sólido,
ícone, título, valor grande e legenda. `icon` é o nome de um ícone do
[Google Material Symbols](https://fonts.google.com/icons) (ex:
`bar_chart`, `attach_money`, `warning`) ou `"none"` — o seletor de ícone
do painel busca tanto pelo nome técnico quanto por um rótulo em
linguagem natural no `locale` ativo. `title`/`value`/`subtitle` são
texto comum (mesma sintaxe `{path}`/`{FUNÇÃO(...)}` de um campo de texto
solto) — sem `Binding` próprio, resolvidos direto contra o documento
inteiro na hora de gerar.

Cada um dos 4 sub-elementos (ícone/título/valor/legenda) é
independentemente **opcional** — `title`/`value`/`subtitle` podem
simplesmente ficar `undefined` (e `icon` já tinha `"none"`), e um
sub-elemento removido só não desenha. Selecionar um KPI sozinho (sem
seleção múltipla) mostra seus 4 sub-elementos na aba Campos, cada um com
um botão "+"/lixeira pra adicionar de volta ou remover.

Qualquer sub-elemento também pode ser **arrastado pra uma posição
própria** no canvas — `iconOffset`/`titleOffset`/`valueOffset`/
`subtitleOffset` (`{ x, y }` mm, relativo ao canto superior-esquerdo do
cartão; ausente = layout fixo original do cartão, então templates
existentes nunca mudam). Cada um nasce **travado** por padrão
(`iconLocked`/`titleLocked`/`valueLocked`/`subtitleLocked`, ausente/
`true` = travado) — destrave pelo cadeado ao lado dele na aba Campos
antes de arrastar. Clicar num sub-elemento (aba Campos ou direto no
canvas) foca ele, e a aba Estilo passa a mostrar só os controles
DAQUELE elemento, mais um link "← Estilo do card" pra voltar e, quando
ele já tem offset próprio, um botão "Redefinir posição" que limpa ele.

**Tamanho e orientação da página** — o `<Designer>` mostra um seletor de
tamanho (A4/A3/A5/Carta/Ofício) e orientação (retrato/paisagem) na aba
"Página"; `applyOrientation`/`orientationOf`/`matchPreset`/
`PAGE_SIZE_PRESETS` (exportados) fazem a mesma conta pra quem quiser
montar o próprio seletor.

**Fundo de página** (`Template.backgroundImage`) — uma imagem atrás de
tudo, tanto no editor quanto no PDF final. O botão "Imagem de fundo" do
`<Designer>` aceita PNG/JPEG e normaliza pra um PNG data URI; a conversão
fica em `fileToBackgroundImage` (exportado só internamente por ora). PDF
não é aceito: rasterizar um exigiria pdf.js no entry principal (ver o
entry `/preview` abaixo) — pra usar um papel timbrado que só existe em
PDF, exporte a página pra PNG antes.

**Fonte customizada** — passe `fontBytes` (bytes de um **TTF/OTF de
verdade**) em `generatePdf(..., { fontBytes })` pra acentuação/Unicode
completos via `fontkit`. Sem isso, cai no Helvetica padrão do pdf-lib
(WinAnsi — cobre a maioria dos acentos latinos, mas não tudo).

`.woff`/`.woff2` (o formato que pacotes tipo `@fontsource/*` distribuem)
também são aceitos — `normalizeFontBytes(bytes)` detecta e descomprime pro
TTF/OTF de verdade que o pdf-lib precisa, automaticamente (WOFF v1 é
simples o bastante pra descomprimir em JS puro, sem instalar nada a mais
— `tiny-inflate`, dependência real deste pacote. WOFF2 precisa de
`wawoff2`/WASM, que é uma **dependência peer opcional** — não vem
instalada sozinha, já que a maioria dos projetos nunca embute fonte
customizada nenhuma, e o descompressor é um binário WASM grande que
ninguém deveria pagar por padrão. Só rode `npm install wawoff2` se você
realmente for passar um arquivo `.woff2`; passar um `.woff2` sem ele
instalado lança um erro claro pedindo pra instalar ou converter a fonte
pra `.ttf`/`.otf` offline antes — nada quebra silenciosamente). O arquivo
resultante reordena as tabelas em ordem alfabética (característica normal
do formato WOFF, que não guarda a ordem física original) — isso não afeta
a fonte: mesmo glifo, métrica e mapeamento de caractere, validado com
`fontkit` (a mesma lib que o pdf-lib usa por baixo pra embutir a fonte).

**Régua e zoom** — régua em mm à esquerda/embaixo do canvas; barra
flutuante no rodapé com zoom -/+, ajustar à largura/altura e reset — não
afeta o PDF gerado, é só a visualização. Arrastar/redimensionar continua
correto em qualquer nível de zoom (react-rnd recebe o fator de escala).

**Preview do PDF real** (`<PdfPreview bytes={...} />`, de
`json-pdf-designer/preview`) — renderiza o PDF gerado (byte a byte, com
pdf.js) num `<canvas>` por página, mostrando tamanho/margens reais do
arquivo.

### O entry point `json-pdf-designer/preview`

Tudo que toca no pdf.js mora num entry point próprio:

```ts
import { PdfPreview, PdfPreviewModal, configurePdfWorker } from "json-pdf-designer/preview";
```

O `pdfjs-dist` é um **peer dependency opcional** (mesmo tratamento do
`wawoff2`), então o npm não instala por você — instale se usar o preview:

```bash
npm i pdfjs-dist
```

O motivo de não ser dependência normal: o pdf.js tem ~35MB instalado, e
como dependência do entry principal todo consumidor pagava por ele —
inclusive apps que só renderizam o `<Designer>` e nunca dão preview em
nada. Nada alcançável de `"json-pdf-designer"` ou
`"json-pdf-designer/server"` importa pdf.js (um teste,
`test/entryBoundaries.test.ts`, garante isso), então esses dois entries
funcionam com o `pdfjs-dist` ausente. O `examples/no-preview` é um app
funcionando que nunca o instala — e o build dele ainda varre o próprio
bundle procurando símbolos do pdf.js, porque o symlink `file:../..`
deixaria um import vazado resolver o pdf.js pelo repo pai.

Renderizar o preview é a **única** coisa pra que o pacote usa pdf.js.
Nada mais na API depende de o preview estar disponível.

### Worker do pdf.js — CDN por padrão vs. self-host

O preview precisa do *worker* do pdf.js (`pdf.worker.min.mjs`) rodando
separado da thread principal. Como o pacote é pré-compilado com `tsup`
(sem o asset-URL handling que o Vite faz em código de app), ele **não
empacota esse worker** — por padrão, `ensureWorker()` aponta pro CDN
oficial casado com a versão instalada:

```
https://cdn.jsdelivr.net/npm/pdfjs-dist@<versão>/build/pdf.worker.min.mjs
```

Isso funciona direto nos exemplos (`report-builder`/`custom-ui`) e em
qualquer app com saída livre pra internet. **Numa integração real**
(frontend atrás de CSP restrito, VPN, rede corporativa fechada, ou
qualquer ambiente que não pode depender da disponibilidade do
`jsdelivr.net` em produção), self-hoste o worker chamando
`configurePdfWorker(url)` **uma vez, antes do primeiro `<PdfPreview>`/
`<PdfPreviewModal>` renderizar** — no entrypoint do app, por exemplo.

Com Vite, importe o worker como asset (o `?url` faz o Vite copiar o
arquivo pro build e devolver a URL final, já com hash/CDN próprio do
app):

```ts
// main.tsx (ou qualquer módulo carregado antes da 1ª tela com preview)
import { configurePdfWorker } from "json-pdf-designer/preview";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

configurePdfWorker(pdfWorkerUrl);
```

Com outro bundler (webpack, esbuild direto, etc.), o equivalente é
copiar `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` pra uma pasta
estática servida pelo app e apontar a URL pública dele
(`configurePdfWorker("/static/pdf.worker.min.mjs")`).

Se `configurePdfWorker` nunca for chamado e o CDN estiver inacessível, o
preview simplesmente não renderiza (erro de rede no console) —
`generatePdf`/`downloadPdf` **não são afetados**, já que não usam pdf.js
(só o preview visual depende dele).

## Visibilidade condicional (`visibleWhen`)

Qualquer campo pode carregar uma condição. Ele só é desenhado quando ela é
verdadeira:

```ts
{ type: "text", content: "Desconto PJ", visibleWhen: 'cliente.tipo == "empresa"' }
{ type: "table", name: "vencidas", visibleWhen: "NOT pago" }
{ type: "kpi", visibleWhen: "total > 1000 AND NOT cancelado" }
```

A condição é uma **expressão sem chaves** — não é um template, então escreva
`total > 1000`, não `{total > 1000}`. Tudo que o motor de `{...}` entende vale
aqui: paths, comparações, `AND`/`OR`/`NOT`, funções (`COUNT(itens) > 0`),
aritmética. A verdade/falsidade segue a regra do formato: vazio, `"0"` e
`"false"` são falsos, qualquer outra coisa é verdadeira — então um path solto
também funciona (`visibleWhen: "pago"`).

No `<Designer>` existe um campo **"Mostrar só quando"** ao lado de
X/Y/largura/altura, e o erro de sintaxe aparece ao vivo embaixo dele.

**Funciona em todo tipo de campo**, tabela e seção repetida incluídas, e nas
faixas repetidas (cabeçalho/rodapé/margem). A condição de uma faixa pode usar
`pageNumber`/`pageCount`, porque essas são resolvidas por página — então "só na
última página" é:

```ts
{ type: "text", content: "Confira os totais", visibleWhen: "pageNumber == pageCount" }
```

### O que esconder faz com o layout

Esconder um item devolve a **altura** dele, e nada mais:

```
             visível                    "meio" escondido
  20mm  ┌───────────┐  topo        20mm  ┌───────────┐  topo
        └───────────┘  (10mm)            └───────────┘
  40mm  ┌───────────┐  meio
        └───────────┘  (10mm)
  60mm  ┌───────────┐  abaixo      50mm  ┌───────────┐  abaixo  <- subiu 10mm
        └───────────┘                    └───────────┘
```

O que vem depois sobe exatamente a altura escondida; o espaçamento autorado nos
dois lados continua valendo. Uma tabela escondida devolve **todas** as páginas
dela do mesmo jeito.

Uma exceção, e é a útil: esconder um campo que divide a linha com vizinhos
visíveis deixa o buraco. Campos no mesmo Y autorado são uma linha só — os
vizinhos precisam do lugar deles, então a linha mantém a altura. Escondendo
todos, a linha inteira sai.

### Condição inválida quer dizer visível

Condição que não parseia conta como **visível**, nunca escondida. Um erro de
digitação não pode fazer um campo desaparecer do relatório em silêncio — o
editor marca o campo (ícone de alerta na lista, mensagem embaixo do input) e o
campo continua aparecendo até alguém consertar.

É o mesmo acordo que os tokens `{...}` fazem: **a geração é tolerante, o editor
é estrito.** Expressão mal-formada renderiza vazio em vez de fazer o
`generatePdf` falhar — um campo em branco é melhor que nenhum documento — e o
erro aparece antes de gerar, onde ainda dá pra corrigir.

Pra conferir por conta própria (um backend recusando um template ruim, ou sua
própria UI de editor):

```ts
import { expressionError, templateExpressionErrors, expressionErrors } from "json-pdf-designer";
// também disponíveis em "json-pdf-designer/server"

expressionError("total > 1000");         // null — válida
expressionError("total >");              // "Expressão incompleta (posição 8 em …)"
templateExpressionErrors("a={x} b={y)"); // [{ token: "{y)", message: … }]
expressionErrors(schema, binding);        // toda expressão que um campo carrega
```

## Relatórios com várias páginas (`Template.pages`)

Por padrão um `Template` é UM design de página, repetido quantas vezes o
corpo precisar (paginação de tabela/seção) — isso continua igual. Como
opção, `Template.pages` deixa UM `Template` guardar vários designs de
página **diferentes** (tamanho, cabeçalho/rodapé, fundo, schemas próprios)
que o `generatePdf` desenha num PDF só, em sequência, com
`{pageNumber}`/`{pageCount}` continuando de um pra outro — se o design 1
termina na página física 2, o design 2 começa na página 3, não reinicia
na 1.

```ts
import { generatePdf, type Template } from "json-pdf-designer";

const template: Template = {
  page: { width: 210, height: 297 }, // ignorado quando `pages` existe
  schemas: [],
  pages: [
    { id: "capa", page: { width: 210, height: 297 }, schemas: [/* ... */] },
    { id: "detalhe", page: { width: 210, height: 297 }, headerHeight: 15, schemas: [/* ... */] },
  ],
};
const bytes = await generatePdf(template, data, bindings); // mesma chamada de sempre
```

- `data`/`Binding[]` são compartilhados entre TODAS as entradas de
  `pages` — nome de schema precisa ficar único no template inteiro, não
  só dentro de uma página.
- Um `Template` sem `pages` (todo template salvo antes desse recurso
  existir) continua se comportando exatamente como antes — `pages`
  ausente/vazio cai nos campos flat de sempre
  (`page`/`headerHeight`/`footerHeight`/`schemas`) como página implícita
  única, sem precisar migrar nada já salvo.
- O exemplo `report-builder` (ver "Exemplos" abaixo) constrói uma UI de
  abas de página em cima disso: cada aba edita uma entrada de
  `template.pages` com seu próprio `<Designer>`, enquanto as fontes de
  dados JSON continuam compartilhadas/globais entre todas as abas.

## Escrever uma expressão: o editor `ƒx`

O `<Designer>` tem um botão `ƒx` ao lado de todo campo que aceita expressão:
fórmula de coluna de tabela, cada célula da linha de totais,
título/valor/legenda do KPI e conteúdo de um campo de texto. Ele abre uma
janela com

- **os campos a que o schema está vinculado, à esquerda**, em dois grupos.
  Campos **de cada item** do array vinculado (`total`, sem prefixo) são os que
  resolvem dentro de uma linha de tabela ou de uma seção repetida; os
  **caminhos completos** (`faturas.total`) são o que uma agregação precisa. Um
  `SUM(total)` com o campo do primeiro grupo não acharia nada — os dois escopos
  são a razão de a lista ser dividida.
- **um editor multilinha com autocomplete**, oferecendo as funções acima mais
  `AND`/`OR`/`NOT`, com a dica de cada uma. Ele escreve os espaços que um
  operador precisa nos dois lados, então não consegue produzir operador de um
  lado só. As sugestões aparecem só **dentro** das chaves — fora delas é texto
  literal, e uma lista de funções ali só estorva.
- **validação ao vivo** — as mesmas mensagens do aviso de campo do editor.
  Erro de sintaxe bloqueia o salvar; operador suspeito só avisa.

O editor guarda o **valor do campo em si**, com as chaves, aberto já com o que
estava lá. Não há um segundo campo pra compor: a edição é no lugar, e prefixo
literal fica onde está (`FAT-{fatura}`). Clicar num campo da esquerda insere o
caminho nu dentro das chaves, ou `{caminho}` fora delas.

Ele também acusa **chave desbalanceada**, coisa que nada mais faz: o
resolvedor de template casa `/\{([^{}]+)\}/g`, então uma `{` sem par
simplesmente não casa e aquele trecho sai como texto literal no PDF —
`{CURRENCY(total` impresso na cara. Não é erro de sintaxe de expressão (o
parser nunca vê esse trecho) nem falha de geração; era só um campo saindo
errado em silêncio.

As peças são exportadas pra quem monta UI própria: `suggestAt`,
`applySuggestion`, `insertAtCaret`, `wordAtCaret`, `ALL_SUGGESTIONS`, mais
`tokenAtCaret` e `braceError` pro lado das chaves (também no
`json-pdf-designer/server` — são puras).

## Componentes de UI prontos

Se você não quer (ou não pode) montar a própria casca visual em volta do
`<Designer>`, o pacote também exporta os componentes prontos que ele usa
por dentro (`Button`, `Card`, `Input`, ícones etc — Tailwind, mesmo
estilo do painel de propriedades) e um `PdfPreviewModal` completo (esse
vem do entry `/preview`, porque usa pdf.js):

```tsx
import { Button, Card, CardHeader, CardTitle, Badge, Input, ColorInput, Textarea, Select } from "json-pdf-designer";
import { PdfPreviewModal } from "json-pdf-designer/preview";
import "json-pdf-designer/style.css";

<Card>
  <CardHeader>
    <CardTitle>Fontes de dados</CardTitle>
    <Button variant="ghost" size="icon"><IconX /></Button>
  </CardHeader>
  <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
</Card>
```

Nada disso é obrigatório — o exemplo `custom-ui` (ver "Exemplos" abaixo)
monta a casca inteira com CSS próprio, sem importar nenhum desses
componentes, pra provar que o `<Designer>` funciona igual dos dois jeitos.

## Versionamento de template (`Template.version`)

Um `Template` é um **formato de documento**, não uma estrutura interna. Uma vez
que ele vive num banco, sobrevive a qualquer versão deste pacote — então ele
carrega uma versão de formato:

```ts
type TemplateVersion = 1;

type Template = {
  version?: TemplateVersion; // ausente = 1
  page: PageSize;
  // ...
};
```

`version` é a versão do **formato JSON**, não a do pacote npm — o pacote vai de
2.0.0 pra 2.1.0 pra 3.0.0 sem o formato mudar. Ela só sobe quando a forma do
documento salvo muda.

`migrateTemplate(input)` normaliza um template vindo de qualquer lugar (banco,
arquivo, API) pro formato que este build entende:

```ts
import { migrateTemplate } from "json-pdf-designer";        // ou /server

const template = migrateTemplate(await db.templates.find(id));
```

- Template sem `version` é tratado como formato 1 — exato para todo template
  salvo antes do campo existir, já que nenhuma mudança de forma aconteceu
  desde então.
- O template devolvido sempre carrega a `version` corrente, então salvar de
  volta grava explícito e o próximo carregamento deixa de depender do default.
- Nunca muta a entrada.
- Uma `version` **maior** do que este build entende **estoura**. É de
  propósito: o arquivo foi escrito por um pacote mais novo e pode ter campos
  que este build ignoraria em silêncio — e um PDF faltando pedaço sem erro é
  pior que uma falha.

O `generatePdf` chama internamente, então nunca se gera PDF de um template não
migrado — você não precisa lembrar. Chame por conta própria quando carregar um
template **pra editar**, pro editor também trabalhar no formato corrente (ver
`parseProjectFile` em `examples/report-builder/src/lib/projectFile.ts`).

As migrações moram numa cadeia só, em `src/template/migrate.ts`, um degrau por
versão — nunca como `if (version === 1) … if (version === 2) …` espalhado
pelos chamadores. A cadeia está vazia hoje porque existe um formato; ela
existe *agora* porque introduzir isso depois de já haver template em banco de
produção custa muito mais.

## O que pode e o que não pode derrubar uma geração

O `generatePdf` traça uma linha: problema no **dado**, ou em conteúdo mal
formado, degrada — o campo renderiza vazio, um caractere é trocado, o PDF sai.
Problema **estrutural**, ou em que conteúdo sumiria em silêncio de um documento
que alguém assina, falha alto. Um relatório de 200 páginas não pode morrer
porque uma linha tinha um `\n`.

**Degrada (o PDF sai):**

| Situação | O que acontece |
|---|---|
| Caractere de controle no dado (`\n`, `\t`, NUL, C0/C1) | Vira espaço. Fonte nenhuma tem glifo pra esses, então é a única renderização possível |
| Expressão `{...}` inválida | Aquele token renderiza vazio; o editor marca o campo |
| Path que não resolve | Vazio |
| `data` null, array, string ou número | Ignorado; campos renderizam vazio |
| Array vinculado que é número, itens não-objeto, célula com valor objeto | Ignorado ou serializado |
| Cor inválida (`"banana"`, `"#zzz"`) | Cai no default |
| `fontSize` 0, negativo ou `NaN` | 0/negativo valem; `NaN` cai em 10 |
| Largura de campo 0 ou negativa | Vale (nada é desenhado) |
| Vínculo de imagem que resolve pra algo que não é data URI | Campo fica vazio |
| Repetição de seção mais alta que uma página inteira | É colocada mesmo assim, transbordando aquela página; a repetição seguinte começa numa nova |

**Falha alto (e por quê):**

| Situação | Erro | Por que não degradar |
|---|---|---|
| Caractere sem glifo na fonte **padrão** (emoji/CJK sem `fontBytes`) | `Campo "x": o caractere "🎉" (U+1F389) não existe na fonte usada …` | Ele *tem* glifo numa fonte completa — descartar removeria conteúdo em silêncio de um documento assinado. Passe `fontBytes`, ou tire do dado |
| Tamanho de página inválido (`NaN`, 0, negativo) | `Página "x": tamanho inválido …` | Estrutural: não há default sensato pra adivinhar |
| Imagem corrompida, num campo ou como fundo de página | `Campo "x": não deu pra ler essa imagem …` | Quem montou escolheu aquele arquivo; descartar em silêncio esconde o erro |
| Imagem acima de 15MB, ou mais de 200 imagens distintas | `… maior que o limite de 15MB …` | Protege quem gera (um template pode vir de fonte não confiável) |
| Documento acima de `maxPages` (default 5000) | `O documento passou de 5000 páginas ao paginar "x" …` | Relatório truncado que parece completo é pior que relatório nenhum. Filtre o dado, divida em vários PDFs, ou suba o `maxPages` |
| Passada de paginação que não consome nada | `Paginação travada em "x" …` | Bug de aritmética do pacote — girar até um contador esgotar escondia isso |
| `fontBytes` inválido | `Unknown font format` | Erro de quem chama, não do template nem do dado |
| `Template.version` mais nova que este build | `Template na versão N, mas este build só entende até a M` | Formato mais novo pode trazer campos que este build ignoraria em silêncio |

**Uma ressalva sobre o erro de glifo.** Ele só dispara com a fonte **padrão**
(Helvetica/WinAnsi). Com uma fonte embutida via `fontBytes`, um caractere que a
fonte não cobre é desenhado com o glifo `.notdef` dela — normalmente um branco
ou um quadrado — **sem erro nenhum**. Isso é comportamento do fontkit, não uma
escolha deste pacote, e significa que uma fonte customizada troca uma falha
alta por um branco silencioso. Se glifo ausente não pode passar despercebido,
confira o dado antes de gerar.

## API pública

Tudo abaixo vem de `json-pdf-designer`. A árvore do `generatePdf`
(Geração/Vínculos/Paletas de cor de gráfico e os tipos puros) também
está disponível sem React em `json-pdf-designer/server` — veja "Uso só
no servidor" acima.

```ts
// Componente
Designer                                   // canvas React completo (toolbar + lista + réguas + zoom + faixas)

// Idioma da UI (ver "Idioma da UI" acima)
I18nProvider, useT, useLocale, withInlineCode
type Locale, type Dict

// UI pronta (opcional — ver "Componentes de UI prontos" acima)
Button, Card, CardHeader, CardTitle, Badge, TabPanel, Modal, Input, ColorInput, Textarea, Select
IconPlus, IconX, IconTrash, IconGrip, IconLink, IconMinus, IconArrowsHorizontal,
IconArrowsVertical, IconDots, IconUpload, IconLock, IconLockOpen, IconBringToFront,
IconSendToBack, IconRefresh, IconDownload, IconFolderUp, IconAlertTriangle

// Geração
generatePdf(template, data, bindings, { fontBytes?, maxPages? }) => Promise<Uint8Array>
downloadPdf(bytes, filename?)
normalizeFontBytes(bytes)                  // detecta WOFF/WOFF2 e descomprime (rede de segurança — ver aviso acima)

// Vínculos
buildInputs(data, bindings)                // resolve todos os vínculos de uma vez
renderTemplate(template, data)             // resolve um template livre "{token}"
resolveToken(token, data)                  // resolve um token/função isolado
rowsFromArrayBinding(list, columns)        // array de objetos -> linhas de tabela
columnLabel(col), columnKey(col)
describeBinding(b, t?), describeBindingShort(b, t?)  // t: Dict, pra exibição na UI — default inglês
CUSTOM_FIELD_FUNCTIONS                     // lista das funções disponíveis (pra UI própria)
resolveChartItems(binding, data)           // vínculo "chart" -> [{label, value}] cru
aggregateChartItems(items, topN?, sortBy?, palette?)  // agrupa nos topN maiores + "Outros" (com cor)

// Paletas de cores do gráfico
CHART_COLORS, CHART_OTHER_COLOR, CHART_PALETTES, CHART_PALETTE_LABELS,
CHART_PALETTE_NAMES, CHART_PALETTE_SIZE, resolveChartPalette, resolveChartColors
type ChartPaletteName, type ChartPresetName

// Ícones do KPI
MATERIAL_ICON_GRID, MATERIAL_ICON_PATHS, MATERIAL_ICON_LABELS, MATERIAL_ICON_NAMES,
materialIconLabels(locale)                 // rótulos de busca de ícone em inglês ou português
type MaterialIconName

// Fábricas de schema (usadas por dentro pela toolbar "+", exportadas pra UI própria)
makeChartSchema(nextY, t?), makeKpiSchema(nextY, t?), makeSectionColumnPair(sectionId, column, x, y, t?)

// Zonas (cabeçalho/rodapé/margem)
classifyZone(schema, page, bands) => Zone  // "header" | "footer" | "marginLeft" | "marginRight" | "body"
isRedZone(zone), clampToZone(...)

// Unidades
mmToPx, pxToMm, mmToPt

// Página — tamanho e orientação
PAGE_SIZE_PRESETS                          // A4/A3/A5/Carta/Ofício, sempre em retrato
orientationOf(page), applyOrientation(page, orientation), matchPreset(page)

// Versão do formato de template (também em json-pdf-designer/server)
migrateTemplate(input) => Template          // normaliza template vindo de banco/arquivo/API
CURRENT_TEMPLATE_VERSION                    // versão de formato que este build escreve

// Erros de geração, como classes (também em json-pdf-designer/server) — ver "Modos de falha"
PageLimitError                              // documento acima do maxPages
UnsupportedGlyphError                       // caractere sem glifo na fonte
ExpressionError                             // base dos dois abaixo
ExpressionSyntaxError, ExpressionDepthError
DEFAULT_MAX_PAGES                           // 5000

// Validação de expressão (também em json-pdf-designer/server) — ver "Visibilidade condicional"
expressionError(source) => string | null    // uma expressão: o erro de sintaxe, ou null
templateExpressionErrors(template)          // todo {...} ruim de um template, com a mensagem
expressionErrors(schema, binding)           // toda expressão que um campo carrega
suspiciousOperator(source)                  // operador de um lado só: sintaxe válida, quase certamente engano
templateSuspiciousOperators(template)       // o mesmo, token a token
suggestAt(text, caret), applySuggestion(text, caret, s), insertAtCaret(text, caret, insert), wordAtCaret(text, caret), ALL_SUGGESTIONS
tokenAtCaret(template, caret), braceError(template, t?)     // o {...} em que o caret está; chave desbalanceada
fieldWarning(schema, binding, t?)           // a mensagem de alerta do editor pra um campo
dictFor(locale)                             // dicionário de tradução como valor, pro `t` acima
filterIncomplete(binding)
type SchemaExpressionError

// Tipos
Template, TemplatePage, TemplateVersion, Schema, TextSchema, TableSchema, TableColumnStyle, ImageSchema,
SectionSchema, ChartSchema, KpiSchema, KpiIcon, BaseSchema, PageSize, Binding,
TableColumn, DataSourceOption, SectionColumnDragPayload, Zone, Bands,
GeneratePdfOptions, Orientation
```

## O entry point `json-pdf-designer/preview`

Tudo que usa pdf.js. O `pdfjs-dist` é peer dependency opcional, então rode
`npm install pdfjs-dist` se você importar daqui — ver "Preview do PDF real"
acima pro motivo completo.

```ts
PdfPreview                                 // um <canvas> por página, renderiza os bytes gerados
PdfPreviewModal                            // modal completo em volta do PdfPreview (botão baixar/fechar)
configurePdfWorker(url)                    // self-host do worker do pdf.js em vez do CDN padrão
```


## Estrutura do pacote

```
src/
  types/
    schema.ts          -> Template/TemplatePage/Schema (text/table/image/section/chart/kpi) + TableColumnStyle
    binding.ts          -> TableColumn, Binding (inclui "chart": path/labelColumn/valueColumn/filters)
    dataSource.ts       -> DataSourceOption/DataSourceColumnType, SectionColumnDragPayload
  units.ts             -> conversões mm <-> px <-> pt + grade (GRID_SIZE_MM, snapToGrid)
  zones.ts             -> classifica campo em header/footer/margem/corpo + trava de arrasto
  materialIcons.ts     -> paths dos ícones Material Symbols + rótulos de busca EN/PT-BR (seletor do KPI)
  fieldWarnings.ts     -> mensagens de aviso "sem vínculo"/"filtro incompleto" (lista de campos, ícones de aba)
  pageSizes.ts         -> presets de tamanho de página + orientação (retrato/paisagem)
  numberFormat.ts      -> formatação de número pt-BR, compartilhada pelo cartão de KPI e por CURRENCY/NUMBER em bindings.ts
  schemaFactory.ts     -> cria schema novo (texto/tabela/imagem/seção/gráfico/kpi) + próximo Y livre
  kpiFormat.ts         -> formatação de valor do KPI + posição/trava por elemento (ícone/título/valor/legenda)
  errorUtils.ts        -> normaliza qualquer valor lançado numa mensagem de erro segura pra mostrar
  table/
    columns.ts         -> mantém head/content/footer/columnStyles de uma tabela sincronizados com o vínculo array
    colors.ts          -> presets de cor estilo Excel (grupos Claro/Médio/Escuro) pra cabeçalho/corpo/zebra
    layout.ts          -> resolveColumnWidthsMm — fonte única compartilhada pelo canvas e por render/renderTable.ts
    columnFormula.ts   -> parse/monta a fórmula de uma coluna calculada (CURRENCY/NUMBER/DATE/raw)
    columnResize.ts    -> a matemática do arrasto de redimensionar coluna (cresce um lado, encolhe+trava o outro)
  chart/
    colors.ts          -> paletas categóricas fixas do gráfico + rótulos
    format.ts          -> formatação de número/rótulo do gráfico
    pieGeometry.ts     -> caminho da fatia de pizza/rosca + ponto do rótulo, compartilhado pelo canvas e render/renderChart.ts
  i18n/
    en.ts, pt-BR.ts     -> texto da própria UI do Designer, um arquivo por idioma (en é o canônico)
    context.tsx, hooks.ts -> I18nProvider, useT, useLocale
    withInlineCode.tsx -> transforma os trechos `` `código` `` de uma string traduzida em <code> de verdade
  bindings/
    bindings.ts        -> resolve vínculos (scalar/array/keyvalue/template/section/chart/kpi)
                          + resolveChartItems/aggregateChartItems (vínculo "chart")
    builders.ts        -> os builders puros de vínculo por tipo de schema usados pelo BindingEditor.tsx, testáveis sem React
    columnParsing.ts   -> parse do texto livre "col, Rótulo={FUNÇÃO(...)}" da tabela
    splitDelimited.ts  -> separa por um delimitador respeitando aspas/parênteses (usado pelos dois acima)
  expressions/         -> o motor de {token}/{FUNÇÃO(...)}: parse -> AST -> evaluate
    tokenize.ts        -> caracteres -> tokens (operador só vale cercado de espaço)
    parse.ts           -> tokens -> AST, com precedência de operador e agrupamento de verdade
    evaluate.ts        -> AST + dado -> valor (sem eval/new Function)
    functions.ts       -> o registry de SUM/COUNT/AVG/CONCAT/DATE/CURRENCY/NUMBER/IF
    dataAccess.ts      -> busca de path + comparação de valor, compartilhados com os filtros de vínculo
    formatters.ts      -> formatação de DATE/CURRENCY (UTC-safe, número pt-BR)
  pdf/
    generate.ts        -> orquestrador fino: deriva o layout do corpo, dry-run de {pageCount}, e desenha —
                          pergunta pro layout/ onde tudo cai e desenha — sem decisão de paginação própria
    layout/            -> matemática pura, sem pdf-lib
      layoutDocument.ts-> A travessia de paginação: Template+dado -> LayoutDocument (páginas de Placements)
      layoutTypes.ts   -> tipos BodyItem/FlowBounds
      bodyLayout.ts    -> buildBodyItems (agrupa schemas em BodyItems por Y) + boundsOf/gapAfter
      pageLayout.ts    -> normalizePageDefs (página única vs. multi-página)
      sectionLayout.ts -> medição de seção (quantas repetições, quanto cada uma ocupa)
    render/
      index.ts         -> drawFieldOfType, o dispatcher por tipo (texto/imagem/tabela/gráfico/indicador)
      renderTable.ts   -> desenha tabela no pdf-lib em fatias (paginação), cabeçalho/valor/rodapé com cor/tamanho
      renderSection.ts -> desenha uma seção repetida, uma passada por item do array vinculado
      renderChart.ts   -> desenha pizza (fatias via drawSvgPath) ou barra + legenda no pdf-lib
      renderKpi.ts     -> desenha o cartão de indicador (fundo + ícone traçado + título/valor/legenda)
      renderText.ts, renderImage.ts -> os dois tipos de campo mais simples (renderImage.ts também guarda
                          os limites de segurança de tamanho/contagem de imagem)
    pagination.ts      -> divide o conteúdo do corpo entre páginas contra as faixas de cabeçalho/rodapé/margem
    tableMetrics.ts    -> altura de linha de tabela + linhas por fatia (sem pdf-lib, compartilhado com layout/)
    svgShapes.ts       -> roundedRectPath (raio uniforme ou por canto), compartilhado por render/renderTable.ts/render/renderKpi.ts
    textSafety.ts      -> sanitiza caractere de controle + erro de glifo com nome do campo (ver "Modos de falha")
    textLayout.ts      -> matemática de deslocamento alignX/alignY + truncateToWidth, compartilhado por render/renderTable.ts/render/renderText.ts
    resolvers.ts, color.ts -> pequenos helpers compartilhados por layout/ e render/
    fontUtils.ts       -> WOFF/WOFF2 -> TTF/OTF de verdade (zlib puro pro v1; v2 precisa
                          da dependência peer opcional `wawoff2`, carregada sob demanda,
                          não instalada por padrão)
    pdfWorker.ts       -> configuração do worker do pdf.js (compartilhada)
    backgroundImage.ts -> converte upload (PDF ou imagem) num PNG de fundo
    thirdParty.d.ts    -> tipos ambient pra wawoff2/tiny-inflate (sem @types próprio)
  designer/
    Designer.tsx       -> orquestrador do canvas React — seleção, clipboard, barra de abas, toda mutação de Template/Binding[]
    useTabBar.ts, useSelection.ts, useClipboardAndDelete.ts -> os hooks que compõem o Designer.tsx
    helpers.ts         -> helpers puros de posição de spawn/dedupe de nome/busca de fonte de dados usados pelo Designer.tsx
  components/
    PageCanvas.tsx     -> folha A4, réguas, zoom (zoom-aware drag/resize), grade, faixas vermelhas,
                          caixa de seleção, drag/resize/edição inline
    canvasGeometry.ts  -> matemática de hit-test de seção + seleção por caixa do PageCanvas.tsx (pura, testável)
    dragField.ts       -> lê o payload de um "chip" de campo arrastado do explorador de JSON
    dragGesture.ts     -> encanamento compartilhado de mousedown -> window mousemove/mouseup (arrasto do KPI, redimensionar coluna)
    FieldBox/          -> renderiza texto/tabela/imagem/seção/gráfico/kpi no canvas (um arquivo por tipo)
    FieldList.tsx      -> lista lateral de campos (selecionar/travar/remover, enviar-pra-trás/trazer-pra-frente)
    TemplateInspector.tsx -> árvore somente-leitura dos campos da página atual, agrupada por zona (header/corpo/rodapé)
    Toolbar.tsx        -> botões "+ texto/tabela/imagem/seção/gráfico/kpi"
    PropertyPanel.tsx  -> dispatcher fino pra um PropertyPanel<Tipo>.tsx por tipo de schema
    PropertyPanelText.tsx, PropertyPanelTable.tsx, PropertyPanelImage.tsx, PropertyPanelSection.tsx,
    PropertyPanelChart.tsx, PropertyPanelKpi.tsx, PropertyPanelFields.tsx -> conteúdo Dados/Estilo por tipo
    BindingEditor.tsx  -> UI do vínculo genérico (scalar/template/array/keyvalue/section/chart + colunas calculadas)
    Ruler.tsx          -> régua em mm (SVG)
    PdfPreview.tsx     -> preview do PDF gerado via pdf.js
    PdfPreviewModal.tsx-> modal completo em volta do PdfPreview (exportado, ver acima)
    ui/                -> Button, Input, Card, Select, Textarea, TabPanel, PalettePicker, CollapsibleSection,
                          ClearFieldButton, ícones — exportados (ver acima), usados por dentro do próprio Designer
  index.ts             -> exports públicos do pacote (nunca alcança o pdfjs-dist)
  preview.ts           -> entry "/preview": o ÚNICO grafo que pode importar pdfjs-dist
examples/
  report-builder/      -> app completo (fontes JSON, explorador de campos) usando a UI pronta do pacote
  custom-ui/           -> mesma ideia, casca 100% própria (CSS na mão, sem nenhum componente do pacote)
  headless-designer/   -> canvas feito à mão sobre json-pdf-designer/server, sem <Designer>/UI nenhuma do pacote
  no-preview/          -> gera + baixa sem preview e sem pdfjs-dist instalado (o gate do peer opcional)
```

## Exemplos

Quatro apps de exemplo em `examples/`, cada um com seu próprio README:

- **[report-builder](../examples/report-builder)** — designer completo (fontes de
  dados JSON, explorador de campos, 6 templates prontos) usando os
  componentes de UI do pacote (`Button`/`Card`/`Input`/`PdfPreviewModal`).
- **[custom-ui](../examples/custom-ui)** — versão enxuta (1 template fixo),
  casca inteira em CSS próprio, zero componente de UI do pacote — prova
  que o `<Designer>` funciona sem nenhum design system alheio.
- **[headless-designer](../examples/headless-designer)** — sem `<Designer>`
  nenhum: canvas de arrastar/redimensionar montado à mão sobre
  `generatePdf` + tipos de `json-pdf-designer/server`, mais o `PdfPreview`.
- **[no-preview](../examples/no-preview)** — gera e baixa o PDF sem tela de
  preview e sem o `pdfjs-dist` instalado; o app que prova que o entry
  principal nunca precisa do peer opcional.

Cada um roda independente (`npm install && npm run dev` dentro da pasta) —
não são workspaces do pacote, só apontam pra ele via `"json-pdf-designer":
"file:../.."` no próprio `package.json`.

## Build

```bash
npm run build       # tsup (JS+d.ts) + tailwindcss (dist/style.css)
npm run dev          # tsup --watch
npm run typecheck
```
