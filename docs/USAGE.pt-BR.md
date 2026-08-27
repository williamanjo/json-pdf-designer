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
import { I18nProvider, PdfPreview } from "json-pdf-designer";

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
remove direto), **Página** (tamanho/orientação, cabeçalho/rodapé/margem,
PDF/imagem de fundo, toggle "editar cabeçalho/rodapé/margem") sempre
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
decimais, sem separador de milhar/símbolo, que é o `CURRENCY`), e
**aritmética simples** (`{qtd * preco}`, `{subtotal - desconto}` — da
esquerda pra direita, sem precedência de operador). Uma função PODE
receber outra função ou uma expressão aritmética como argumento (ex:
`{CURRENCY(SUM(rows.total), "R$")}`), com uma exceção: **duas chamadas de
função combinadas por operador na mesma expressão** (`{SUM(a) - SUM(b)}`)
não resolve certo — nesse caso, pré-calcule o valor no JSON ou separe em
dois tokens.

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
`chartColors.ts`): `"default"`, `"classic"`, `"modern"`, `"vibrant"`,
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

**Tamanho e orientação da página** — o `<Designer>` mostra um seletor de
tamanho (A4/A3/A5/Carta/Ofício) e orientação (retrato/paisagem) na aba
"Página"; `applyOrientation`/`orientationOf`/`matchPreset`/
`PAGE_SIZE_PRESETS` (exportados) fazem a mesma conta pra quem quiser
montar o próprio seletor.

**Fundo de página** (`Template.backgroundImage`) — uma imagem (ou a
primeira página de um PDF, rasterizada uma vez no upload) atrás de tudo,
tanto no editor quanto no PDF final. Botão "PDF/imagem de fundo" no
`<Designer>`; a conversão fica em `fileToBackgroundImage` (exportado só
internamente por ora).

**Fonte customizada** — passe `fontBytes` (bytes de um **TTF/OTF de
verdade**) em `generatePdf(..., { fontBytes })` pra acentuação/Unicode
completos via `fontkit`. Sem isso, cai no Helvetica padrão do pdf-lib
(WinAnsi — cobre a maioria dos acentos latinos, mas não tudo).

`.woff`/`.woff2` (o formato que pacotes tipo `@fontsource/*` distribuem)
também são aceitos — `normalizeFontBytes(bytes)` detecta e descomprime pro
TTF/OTF de verdade que o pdf-lib precisa, automaticamente (WOFF2 via
`wawoff2`/WASM; WOFF v1 é mais simples — zlib puro por tabela, decodificado
em JS puro, sem WASM nenhum, via `tiny-inflate`). O arquivo resultante
reordena as tabelas em ordem alfabética (característica normal do formato
WOFF, que não guarda a ordem física original) — isso não afeta a fonte:
mesmo glifo, métrica e mapeamento de caractere, validado com `fontkit`
(a mesma lib que o pdf-lib usa por baixo pra embutir a fonte).

**Régua e zoom** — régua em mm à esquerda/embaixo do canvas; barra
flutuante no rodapé com zoom -/+, ajustar à largura/altura e reset — não
afeta o PDF gerado, é só a visualização. Arrastar/redimensionar continua
correto em qualquer nível de zoom (react-rnd recebe o fator de escala).

**Preview do PDF real** (`<PdfPreview bytes={...} />`) — renderiza o PDF
gerado (byte a byte, com pdf.js) num `<canvas>` por página, mostrando
tamanho/margens reais do arquivo.

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
import { configurePdfWorker } from "json-pdf-designer";
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

## Componentes de UI prontos

Se você não quer (ou não pode) montar a própria casca visual em volta do
`<Designer>`, o pacote também exporta os componentes prontos que ele usa
por dentro (`Button`, `Card`, `Input`, ícones etc — Tailwind, mesmo
estilo do painel de propriedades) e um `PdfPreviewModal` completo:

```tsx
import { Button, Card, CardHeader, CardTitle, Badge, Input, ColorInput, Textarea, Select, PdfPreviewModal } from "json-pdf-designer";
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

## API pública

```ts
// Componente
Designer                                   // canvas React completo (toolbar + lista + réguas + zoom + faixas)
PdfPreview, configurePdfWorker             // preview do PDF gerado
PdfPreviewModal                            // modal completo em volta do PdfPreview (botão baixar/fechar)

// Idioma da UI (ver "Idioma da UI" acima)
I18nProvider, useT, useLocale, withInlineCode
type Locale, type Dict

// UI pronta (opcional — ver "Componentes de UI prontos" acima)
Button, Card, CardHeader, CardTitle, Badge, TabPanel, Input, ColorInput, Textarea, Select
IconPlus, IconX, IconTrash, IconGrip, IconLink, IconMinus, IconArrowsHorizontal,
IconArrowsVertical, IconDots, IconUpload, IconLock, IconLockOpen, IconBringToFront,
IconSendToBack, IconRefresh, IconDownload, IconFolderUp, IconAlertTriangle

// Geração
generatePdf(template, data, bindings, { fontBytes? }) => Promise<Uint8Array>
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

// Tipos
Template, Schema, TextSchema, TableSchema, TableColumnStyle, ImageSchema,
SectionSchema, ChartSchema, KpiSchema, KpiIcon, BaseSchema, PageSize, Binding,
TableColumn, DataSourceOption, SectionColumnDragPayload, Zone, Bands,
GeneratePdfOptions, Orientation
```

## Estrutura do pacote

```
src/
  types/
    schema.ts          -> Template/Schema (text/table/image/section/chart/kpi) + TableColumnStyle
    binding.ts          -> TableColumn, Binding (inclui "chart": path/labelColumn/valueColumn/filters)
    dataSource.ts       -> DataSourceOption/DataSourceColumnType, SectionColumnDragPayload
  units.ts             -> conversões mm <-> px <-> pt + grade (GRID_SIZE_MM, snapToGrid)
  zones.ts             -> classifica campo em header/footer/margem/corpo + trava de arrasto
  chartColors.ts       -> paletas categóricas fixas do gráfico + rótulos
  materialIcons.ts     -> paths dos ícones Material Symbols + rótulos de busca EN/PT-BR (seletor do KPI)
  fieldWarnings.ts     -> mensagens de aviso "sem vínculo"/"filtro incompleto" (lista de campos, ícones de aba)
  pageSizes.ts         -> presets de tamanho de página + orientação (retrato/paisagem)
  schemaFactory.ts     -> cria schema novo (texto/tabela/imagem/seção/gráfico/indicador) + próximo Y livre
  tableColumns.ts      -> mantém head/content/footer/columnStyles de uma tabela sincronizados com o vínculo array
  i18n/
    en.ts, pt-BR.ts     -> texto da própria UI do Designer, um arquivo por idioma (en é o canônico)
    context.tsx, hooks.ts -> I18nProvider, useT, useLocale
  bindings/
    bindings.ts        -> resolve vínculos + funções (SUM/COUNT/CONCAT/DATE/CURRENCY/NUMBER...) + aritmética
                          + resolveChartItems/aggregateChartItems (vínculo "chart")
    columnParsing.ts   -> parse do texto livre "col, Rótulo={FUNÇÃO(...)}" da tabela
  pdf/
    generate.ts        -> gera o PDF de verdade (pdf-lib): paginação unificada (tabela/seção/texto/imagem
                          numa sequência só por Y), mestre-detalhe, faixas repetidas, fundo, fonte
    drawTable.ts       -> desenha tabela no pdf-lib em fatias (paginação), cabeçalho/valor/rodapé com cor/tamanho
    drawSection.ts     -> desenha uma seção repetida, uma passada por item do array vinculado
    drawChart.ts       -> desenha pizza (fatias via drawSvgPath) ou barra + legenda no pdf-lib
    drawKpi.ts         -> desenha o cartão de indicador (fundo + ícone traçado + título/valor/legenda)
    pagination.ts      -> divide o conteúdo do corpo entre páginas contra as faixas de cabeçalho/rodapé/margem
    resolvers.ts, color.ts -> pequenos helpers compartilhados pelos módulos draw*
    fontUtils.ts       -> WOFF/WOFF2 -> TTF/OTF de verdade (zlib puro pro v1, WASM pro v2)
    pdfWorker.ts       -> configuração do worker do pdf.js (compartilhada)
    backgroundImage.ts -> converte upload (PDF ou imagem) num PNG de fundo
    thirdParty.d.ts    -> tipos ambient pra wawoff2/tiny-inflate (sem @types próprio)
  Designer.tsx         -> orquestrador do canvas React — seleção, clipboard, barra de abas, toda mutação de Template/Binding[]
  components/
    PageCanvas.tsx     -> folha A4, réguas, zoom (zoom-aware drag/resize), grade, faixas vermelhas,
                          caixa de seleção, drag/resize/edição inline
    FieldBox/          -> renderiza texto/tabela/imagem/seção/gráfico/indicador no canvas (um arquivo por tipo)
    FieldList.tsx      -> lista lateral de campos (selecionar/travar/remover, enviar-pra-trás/trazer-pra-frente)
    Toolbar.tsx        -> botões "+ texto/tabela/imagem/seção/gráfico/indicador"
    PropertyPanel.tsx  -> dispatcher fino pra um PropertyPanel<Tipo>.tsx por tipo de schema
    PropertyPanelText.tsx, PropertyPanelTable.tsx, PropertyPanelImage.tsx, PropertyPanelSection.tsx,
    PropertyPanelChart.tsx, PropertyPanelKpi.tsx, PropertyPanelFields.tsx -> conteúdo Dados/Estilo por tipo
    BindingEditor.tsx  -> UI do vínculo genérico (scalar/template/array/keyvalue/section/chart + colunas calculadas)
    Ruler.tsx          -> régua em mm (SVG)
    PdfPreview.tsx     -> preview do PDF gerado via pdf.js
    PdfPreviewModal.tsx-> modal completo em volta do PdfPreview (exportado, ver acima)
    ui/                -> Button, Input, Card, Select, Textarea, TabPanel, ícones — exportados (ver acima),
                          usados por dentro do próprio Designer (PropertyPanel/Toolbar/BindingEditor)
  index.ts             -> exports públicos do pacote
examples/
  report-builder/      -> app completo (fontes JSON, explorador de campos) usando a UI pronta do pacote
  custom-ui/           -> mesma ideia, casca 100% própria (CSS na mão, sem nenhum componente do pacote)
```

## Exemplos

Dois apps de exemplo em `examples/`, cada um com seu próprio README:

- **[report-builder](../examples/report-builder)** — designer completo (fontes de
  dados JSON, explorador de campos, 6 templates prontos) usando os
  componentes de UI do pacote (`Button`/`Card`/`Input`/`PdfPreviewModal`).
- **[custom-ui](../examples/custom-ui)** — versão enxuta (1 template fixo),
  casca inteira em CSS próprio, zero componente de UI do pacote — prova
  que o `<Designer>` funciona sem nenhum design system alheio.

Cada um roda independente (`npm install && npm run dev` dentro da pasta) —
não são workspaces do pacote, só apontam pra ele via `"json-pdf-designer":
"file:../.."` no próprio `package.json`.

## Build

```bash
npm run build       # tsup (JS+d.ts) + tailwindcss (dist/style.css)
npm run dev          # tsup --watch
npm run typecheck
```
