// Modelo de dados do editor — unidade de medida é sempre mm (ver docs/ARCHITECTURE.md).

export type PageSize = { width: number; height: number };

export type BaseSchema = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // Trava o campo no canvas — não arrasta nem redimensiona enquanto true
  // (continua editável pelo painel/edição inline, só a posição/tamanho
  // via mouse que fica bloqueada).
  locked?: boolean;
  // Se o campo foi largado em cima de uma seção (SectionSchema), guarda o
  // id dela aqui — vira "membro" do grupo sem sair do array plano de
  // schemas nem mudar de coordenada (x/y continuam absolutos, iguais a
  // qualquer outro campo). Arrastar pra fora da seção limpa isso de novo.
  sectionId?: string;
};

export type TextSchema = BaseSchema & {
  type: "text";
  content: string;
  fontSize: number;
  fontColor: string;
  alignment: "left" | "center" | "right";
  // Fundo/borda opcionais — pra faixa de título colorida, caixa de
  // destaque etc (sem isso, fica transparente/sem borda, como sempre foi).
  backgroundColor?: string;
  borderColor?: string;
  // Espessura da borda em mm — só desenha borda se borderColor E
  // borderWidth (> 0) estiverem definidos.
  borderWidth?: number;
};

// Estilo de UMA coluna — header (th) e valor/dado (td do corpo), sem
// mexer no rodapé (que continua um estilo único pra linha toda). Índice
// no array bate com o índice em `head`/cada linha de `content`.
export type TableColumnStyle = {
  headBackgroundColor?: string;
  headTextColor?: string;
  headFontSize?: number;
  cellBackgroundColor?: string;
  cellTextColor?: string;
  cellFontSize?: number;
};

export type TableSchema = BaseSchema & {
  type: "table";
  head: string[];
  content: string[][];
  // Quando a tabela pagina (mais linhas do que cabem numa página), repete
  // o cabeçalho em cada página nova — default true. false = cabeçalho só
  // na primeira página, o resto é só linhas.
  repeatHeader?: boolean;
  // Linha de rodapé (totais) — uma célula por coluna, cada uma um TEMPLATE
  // de verdade (texto fixo e/ou {token}/{SUM(...)}), igual conteúdo de
  // texto. Resolvida contra o documento inteiro pra tabela solta (mesmo
  // dado de {SUM(rows.total)} num texto qualquer), ou contra o ITEM atual
  // pra tabela membro de seção. Desenha só uma vez — na ÚLTIMA fatia,
  // se a tabela paginar (nunca repete por página, ao contrário do head).
  footer?: string[];
  // Cores/tamanho do cabeçalho — sem isso, cai no azul/branco/9pt de sempre
  // (não muda PDF já gerado por templates antigos).
  headBackgroundColor?: string;
  headTextColor?: string;
  headFontSize?: number;
  // Cores/tamanho da linha de VALOR (corpo, todas as linhas de dado) — sem
  // isso, transparente/preto/9pt de sempre.
  bodyBackgroundColor?: string;
  bodyTextColor?: string;
  bodyFontSize?: number;
  // Cores/tamanho da linha de rodapé — sem isso, cinza claro/preto/9pt.
  footerBackgroundColor?: string;
  footerTextColor?: string;
  footerFontSize?: number;
  // Override por coluna (cor/fundo/tamanho de fonte do header e do valor)
  // — mais específico que os campos "linha toda" acima. Sparse — índice
  // sem entrada cai nos defaults da linha (header/valor) da tabela toda.
  columnStyles?: (TableColumnStyle | undefined)[];
};

export type ImageSchema = BaseSchema & {
  type: "image";
  content: string;
};

// Seção repetida — um "data band": retângulo que
// repete uma vez por item de um array vinculado, empilhando na vertical e
// paginando junto com o resto do corpo. Não guarda filhos — é só um grupo:
// qualquer campo (texto/imagem) largado em cima dela no canvas vira membro
// (via BaseSchema.sectionId), mantendo posição/tamanho/edição idênticos a
// um campo normal do corpo. Largura/altura da seção definem o tamanho de
// UMA repetição (mesmo tamanho pra todas).
export type SectionSchema = BaseSchema & {
  type: "section";
};

// Gráfico pizza/barra sobre um array vinculado (ver Binding "chart") —
// agrupa o resto em "Outros" a partir de `topN` pra paleta de cor nunca
// estourar (ver src/chartColors.ts).
export type ChartSchema = BaseSchema & {
  type: "chart";
  chartType: "pie" | "bar";
  // Só importa quando chartType é "pie" — "donut" (rosca, com furo no
  // meio) ou "full" (pizza cheia, cada fatia vai até o centro). Opcional
  // pra não quebrar template salvo antes desse campo existir — trata
  // ausente como "donut" (ver drawChart.ts/components/FieldBox/ChartField.tsx).
  pieStyle?: "donut" | "full";
  // Só importa quando chartType é "pie". "right"/"left" (default ausente
  // é "right") é a legenda em lista ao lado; "top"/"bottom" a mesma lista
  // acima/abaixo, ocupando a largura toda; "slices" não desenha legenda
  // nenhuma — o valor/porcentagem de cada fatia é escrito em cima dela
  // mesma (fatia pequena demais pra caber o texto simplesmente não recebe
  // rótulo).
  legendPosition?: "right" | "left" | "top" | "bottom" | "slices";
  // "both" mostra o valor bruto E a porcentagem juntos (ex: "R$ 6.505.479,62
  // (17,3%)") — a % é sempre sobre a MESMA coluna vinculada (valueColumn do
  // Binding "chart"): trocar o vínculo pra "quantidade" já muda o que a %
  // representa, sem precisar de campo à parte pra isso.
  displayMode: "number" | "percent" | "both";
  // Nome de uma paleta pronta (ver CHART_PALETTE_NAMES em chartColors.ts —
  // "default"/"classic"/"modern"/"vibrant"/"pastel"/"grayscale"/"custom").
  // String solta (não união fechada) pelo mesmo motivo do KpiIcon: nome de
  // paleta removida num template antigo cai pra "default" sozinho, sem
  // quebrar. "custom" usa `customPaletteColors` no lugar de cor fixa.
  colorPalette?: string;
  // Cores escolhidas à mão — só usadas quando colorPalette === "custom"
  // (ver resolveChartColors em chartColors.ts). Ausente/vazio com
  // "custom" selecionado cai pra paleta "default" até o usuário escolher
  // pelo menos 1 cor.
  customPaletteColors?: string[];
  // Formato do valor bruto (não mexe na porcentagem) — "number" (default
  // ausente) é o de sempre (toLocaleString pt-BR, sem símbolo); "currency"
  // aplica `currencySymbol` (default "R$" ausente) + `decimals` (default 2
  // ausente), mesma cara do CURRENCY(...) de texto/tabela (ver drawChart.ts).
  valueFormat?: "number" | "currency";
  currencySymbol?: string;
  decimals?: number;
  // Separador de milhar no valor bruto — true/ausente (default) = "10.000,00"
  // (comportamento de sempre), false = "10000,00" (só vírgula decimal, sem
  // pontuar os milhares). Não mexe na porcentagem (sempre "42,5%").
  thousandsSeparator?: boolean;
  // Tamanho de fonte (pt) da legenda (swatch + rótulo + valor) — só usada
  // quando chartType é "pie" e legendPosition não é "slices". Ausente cai
  // no default (ver DEFAULT_CHART_LEGEND_FONT_SIZE em pdf/drawChart.ts).
  legendFontSize?: number;
  // Critério de ordenação ANTES de cortar em topN — default (ausente) é
  // "value_desc" (maior primeiro), igual sempre foi.
  sortBy?: "value_desc" | "value_asc" | "label_asc" | "label_desc";
  topN?: number;
};

// "none" ou o nome de um ícone do Material Symbols (ver materialIcons.ts,
// MATERIAL_ICON_NAMES) — string solta (não union fechada) pra não acoplar
// o modelo de dados à lista de ícones disponível, que pode crescer sem
// quebrar o tipo; ícone desconhecido (nome que não existe mais na lista)
// simplesmente não desenha nada, tanto no canvas quanto no PDF.
export type KpiIcon = string;

// Cartão de indicador (KPI) — fundo colorido sólido, ícone + título +
// número grande + legenda, tipo os cartões de um dashboard. title/value/
// subtitle são templates de texto comuns (mesma sintaxe de TextSchema —
// {path}/{FUNÇÃO(...)}), resolvidos contra o documento inteiro, sem
// precisar de um Binding à parte (ver generate.ts).
export type KpiSchema = BaseSchema & {
  type: "kpi";
  icon: KpiIcon;
  title: string;
  value: string;
  subtitle: string;
  backgroundColor: string;
  textColor: string;
  // Tamanho de fonte (pt) de cada texto do cartão — opcional; ausente cai
  // no default (ver DEFAULT_KPI_*_FONT_SIZE em kpiFormat.ts), então schemas
  // antigos continuam com a mesma aparência de sempre.
  titleFontSize?: number;
  valueFontSize?: number;
  subtitleFontSize?: number;
  // Tamanho do ícone (pt) — mesmo motivo do fontSize acima.
  iconSize?: number;
  // Arredondamento dos cantos do cartão, em % (0 = reto, 100 = "pílula",
  // ver kpiBorderRadius em kpiFormat.ts) — opcional, ausente cai no default
  // (schemas antigos continuam com a mesma aparência de sempre).
  borderRadius?: number;
  // Formata `value` como número pt-BR (2 casas) quando ele resolve pra um
  // número puro — "none"/ausente (default) mantém o texto como está,
  // "plain" = "10000,00", "grouped" = "10.000,00" (ver formatKpiValue em
  // kpiFormat.ts). Texto com prefixo/sufixo passa direto, sem tocar.
  numberFormat?: "none" | "plain" | "grouped";
};

export type Schema = TextSchema | TableSchema | ImageSchema | SectionSchema | ChartSchema | KpiSchema;

// Um "design" de página — mesmo formato que Template tinha antes de existir
// multi-página, usado dentro de Template.pages[] quando há mais de uma.
export type TemplatePage = {
  // Estável entre edições (chave de aba/undo/<Designer key=...>) — não é
  // salvo/lido do PDF, só identidade de UI.
  id: string;
  // Rótulo de aba; default é o índice+1 ("Página N") quando ausente.
  name?: string;
  page: PageSize;
  headerHeight?: number;
  footerHeight?: number;
  marginLeft?: number;
  marginRight?: number;
  backgroundImage?: string;
  schemas: Schema[];
};

export type Template = {
  page: PageSize;
  // Faixas estáticas (mm) que se repetem em toda página gerada — um campo
  // do corpo entra automaticamente no cabeçalho/rodapé quando sua posição Y
  // cai dentro dessa faixa (sem campo extra pra marcar "zona", é só olhar
  // onde ele tá). Tabela grande no corpo pagina por conta própria; o resto
  // do corpo só aparece na página 1 (ou logo após a tabela terminar).
  headerHeight?: number;
  footerHeight?: number;
  marginLeft?: number;
  marginRight?: number;
  // PNG data URI usado como fundo da página no editor e no PDF gerado —
  // letterhead/modelo pré-impresso por trás dos campos, sempre resolvido
  // pra imagem (ver backgroundImage.ts).
  backgroundImage?: string;
  schemas: Schema[];
  // Multi-página: quando presente e não-vazio, é a fonte da verdade — os
  // campos flat acima (page/headerHeight/.../schemas) são ignorados por
  // generatePdf/Designer. Ausente/vazio = comportamento de sempre (os
  // campos flat viram a única página implícita). Todas as páginas
  // compartilham o mesmo Binding[]/dado — nome de schema precisa ser único
  // no Template inteiro, não só dentro de uma página.
  pages?: TemplatePage[];
};
