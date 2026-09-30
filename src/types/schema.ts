// The editor's data model — the unit of measure is always mm (see docs/ARCHITECTURE.md).

export type PageSize = { width: number; height: number };

export type BaseSchema = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // Locks the field on the canvas — it neither drags nor resizes while true
  // (it stays editable through the panel/inline editing, only the
  // position/size by mouse is blocked).
  locked?: boolean;
  // If the field was dropped onto a section (SectionSchema), its id is kept
  // here — it becomes a "member" of the group without leaving the flat array
  // of schemas and without changing coordinates (x/y stay absolute, like any
  // other field). Dragging it out of the section clears this again.
  sectionId?: string;
  // Conditional visibility — an expression evaluated against the real JSON at
  // generation time; the field is only drawn when it is true (the format's
  // truthiness rule: empty, "0" and "false" are false). WITHOUT the braces —
  // it is the bare expression, e.g. `customer.type == "company"`,
  // `total > 1000`, `paid AND NOT cancelled`.
  //
  // Absent = always visible (every template from before this field existed).
  // An invalid expression also counts as visible: a typo must not make a field
  // silently disappear from the report — the editor warns and the field keeps
  // showing up until someone fixes it.
  //
  // The effect on the flow: hiding an item reclaims its HEIGHT and nothing
  // more — what comes after moves up by exactly that height, and the authored
  // spacing on both sides still holds. Hiding ONE field of a row that has
  // visible neighbors leaves the hole, because the row still exists for the
  // others; hiding them all removes the whole row. See
  // pdf/layout/layoutDocument.ts.
  visibleWhen?: string;
};

export type TextSchema = BaseSchema & {
  type: "text";
  content: string;
  fontSize: number;
  fontColor: string;
  alignment: "left" | "center" | "right";
  // An optional background/border — for a colored title band, a highlight
  // box and so on (without it, transparent/borderless, as it always was).
  backgroundColor?: string;
  borderColor?: string;
  // Border thickness in mm — it only draws a border if borderColor AND
  // borderWidth (> 0) are both set.
  borderWidth?: number;
};

// The style of ONE column — the header (th) and the value/data (the body's
// td), without touching the footer (which stays a single style for the whole
// row). The index in the array matches the index in `head`/each row of `content`.
export type TableColumnStyle = {
  headBackgroundColor?: string;
  headTextColor?: string;
  headFontSize?: number;
  cellBackgroundColor?: string;
  cellTextColor?: string;
  cellFontSize?: number;
};

// Corner rounding — 4 independent values (mm), the same idea as CSS's
// per-corner border-radius. Absent = 0 (square), as it always was. Each block
// of the table (header/body/footer) has its own — only the corners touching
// the table's OUTER edge make visual sense (the header: only topLeft/topRight,
// since the body always draws right below it; the footer: only bottomLeft/
// bottomRight, for the mirror reason; the body: bottomLeft/bottomRight only
// matter when there is NO footer — with one, it is IT that closes the bottom
// corner). The editor (PropertyPanelTable.tsx) only shows the fields that make
// sense for each block.
export type TableCornerRadii = {
  topLeft?: number;
  topRight?: number;
  bottomLeft?: number;
  bottomRight?: number;
};

export type TableSchema = BaseSchema & {
  type: "table";
  head: string[];
  content: string[][];
  // The width (mm) of each column — the same index as `head`, sparse (an
  // index with no entry, or the whole array absent) like `columnStyles`. A
  // column with no width of its own splits, evenly, whatever is left of
  // `width` after subtracting the columns WITH an explicit width (see
  // resolveColumnWidthsMm in pdf/render/renderTable.ts) — with no width set at
  // all, it falls back to the usual even split. Kept in sync
  // (adding/removing/reordering a column) by tableColumns.ts, as
  // `columnStyles` already was.
  columnWidths?: (number | undefined)[];
  // Text alignment per whole BLOCK (header/body/footer) — not per column
  // (columnStyles is still only color/background/font size). Absent =
  // "left"/"middle", the usual behavior.
  headAlign?: "left" | "center" | "right";
  headVerticalAlign?: "top" | "middle" | "bottom";
  bodyAlign?: "left" | "center" | "right";
  bodyVerticalAlign?: "top" | "middle" | "bottom";
  footerAlign?: "left" | "center" | "right";
  footerVerticalAlign?: "top" | "middle" | "bottom";
  // Rounding per block — see TableCornerRadii above.
  headBorderRadius?: TableCornerRadii;
  bodyBorderRadius?: TableCornerRadii;
  footerBorderRadius?: TableCornerRadii;
  // When the table paginates (more rows than fit on one page), it repeats the
  // header on every new page — default true. false = the header only on the
  // first page, the rest is rows only.
  repeatHeader?: boolean;
  // The footer (totals) row — one cell per column, each a real TEMPLATE
  // (fixed text and/or {token}/{SUM(...)}), like text content. Resolved
  // against the whole document for a loose table (the same data as
  // {SUM(rows.total)} in any text), or against the current ITEM for a table
  // that is a section member. It draws only once — on the LAST slice, if the
  // table paginates (it never repeats per page, unlike the head).
  footer?: string[];
  // The header's colors/size — without this, it falls back to the usual
  // blue/white/9pt (it does not change a PDF already generated by old templates).
  headBackgroundColor?: string;
  headTextColor?: string;
  headFontSize?: number;
  // The colors/size of the VALUE row (the body, every data row) — without
  // this, the usual transparent/black/9pt.
  bodyBackgroundColor?: string;
  bodyTextColor?: string;
  bodyFontSize?: number;
  // The color of the "banded" row (an ODD row index, 0-based) — absent = no
  // banding, every row uses the usual bodyBackgroundColor. Choosing a
  // `colorPalette` preset (see tableColors.ts) fills this field
  // automatically, but it stays editable by hand afterwards.
  bodyBandColor?: string;
  // The color of the thin grid (0.5pt) between cells and around the table —
  // absent = the usual light gray (the same default as before this field
  // existed, it does not change a PDF already generated). A `colorPalette`
  // preset fills this field too, like bodyBandColor above.
  borderColor?: string;
  // The footer row's colors/size — without this, light gray/black/9pt.
  footerBackgroundColor?: string;
  footerTextColor?: string;
  footerFontSize?: number;
  // A per-column override (the header's and the value's color/background/
  // font size) — more specific than the "whole row" fields above. Sparse — an
  // index with no entry falls back to the whole table's row (header/value) defaults.
  columnStyles?: (TableColumnStyle | undefined)[];
  // The name of a ready-made preset from src/tableColors.ts (or
  // "custom"/absent = the manual fields above) — the same idea as
  // ChartSchema.colorPalette (see chartColors.ts). A free string (not a closed
  // union) for the same reason as KpiIcon/the chart's colorPalette: a preset
  // removed in an old template falls back to the manual fields on its own.
  colorPalette?: string;
};

export type ImageSchema = BaseSchema & {
  type: "image";
  content: string;
};

// A repeated section — a "data band": a rectangle that repeats once per item
// of a bound array, stacking vertically and paginating along with the rest of
// the body. It does not hold children — it is only a group: any field
// (text/image) dropped onto it on the canvas becomes a member (through
// BaseSchema.sectionId), keeping its position/size/editing identical to a
// normal body field. The section's width/height define the size of ONE
// repetition (the same size for all of them).
export type SectionSchema = BaseSchema & {
  type: "section";
};

// A pie/bar chart over a bound array (see the "chart" Binding) — it groups
// the rest into "Others" from `topN` on, so the color palette never overflows
// (see src/chartColors.ts).
export type ChartSchema = BaseSchema & {
  type: "chart";
  chartType: "pie" | "bar";
  // It only matters when chartType is "pie" — "donut" (with a hole in the
  // middle) or "full" (a full pie, each slice reaching the center). Optional
  // so as not to break a template saved before this field existed — an absent
  // value is treated as "donut" (see render/renderChart.ts/components/FieldBox/ChartField.tsx).
  pieStyle?: "donut" | "full";
  // It only matters when chartType is "pie". "right"/"left" (the absent
  // default is "right") is the legend as a list beside it; "top"/"bottom" the
  // same list above/below, taking the full width; "slices" draws no legend at
  // all — each slice's value/percentage is written on the slice itself (a
  // slice too small to fit the text simply gets no label).
  legendPosition?: "right" | "left" | "top" | "bottom" | "slices";
  // "both" shows the raw value AND the percentage together (e.g. "R$
  // 6.505.479,62 (17,3%)") — the % is always over the SAME bound column (the
  // "chart" Binding's valueColumn): switching the binding to "quantity"
  // already changes what the % represents, with no separate field for it.
  displayMode: "number" | "percent" | "both";
  // The name of a ready-made palette (see CHART_PALETTE_NAMES in
  // chartColors.ts — "default"/"classic"/"modern"/"vibrant"/"pastel"/
  // "grayscale"/"custom"). A loose string (not a closed union) for the same
  // reason as KpiIcon: the name of a removed palette in an old template falls
  // back to "default" on its own. "custom" uses `customPaletteColors` instead.
  colorPalette?: string;
  // Hand-picked colors — only used when colorPalette === "custom" (see
  // resolveChartColors in chartColors.ts). Absent/empty with "custom"
  // selected falls back to the "default" palette until the user picks at
  // least 1 color.
  customPaletteColors?: string[];
  // The raw value's format (it does not touch the percentage) — "number"
  // (the absent default) is the usual one (toLocaleString pt-BR, no symbol);
  // "currency" applies `currencySymbol` (absent default "R$") + `decimals`
  // (absent default 2), the same look as text/table's CURRENCY(...).
  valueFormat?: "number" | "currency";
  currencySymbol?: string;
  decimals?: number;
  // The thousands separator in the raw value — true/absent (the default) =
  // "10.000,00" (the usual behavior), false = "10000,00" (a decimal comma
  // only). It does not touch the percentage (always "42,5%").
  thousandsSeparator?: boolean;
  // The legend's font size (pt) (swatch + label + value) — only used when
  // chartType is "pie" and legendPosition is not "slices". Absent falls back
  // to the default (see DEFAULT_CHART_LEGEND_FONT_SIZE in pdf/render/renderChart.ts).
  legendFontSize?: number;
  // The sort criterion BEFORE cutting at topN — the default (absent) is
  // "value_desc" (largest first), as it always was.
  sortBy?: "value_desc" | "value_asc" | "label_asc" | "label_desc";
  topN?: number;
};

// "none" or the name of a Material Symbols icon (see materialIcons.ts,
// MATERIAL_ICON_NAMES) — a loose string (not a closed union) so as not to
// couple the data model to the available icon list, which may grow without
// breaking the type; an unknown icon (a name that is no longer in the list)
// simply draws nothing, both on the canvas and in the PDF.
export type KpiIcon = string;

// The key of each independent sub-element of the KPI card — used both for
// position/locking (KpiSchema below) and for selection on the Fields
// tab/contextual Style panel (see FieldList.tsx/Designer.tsx/
// PropertyPanelKpi.tsx). It is not a separate Schema — only one of the 4
// fixed roles inside ONE KpiSchema.
export type KpiElementKey = "icon" | "title" | "value" | "subtitle";

// The position (mm) of a sub-element, relative to the top-left corner of the
// CARD ITSELF — the same "distance from the top" convention schema.y already
// uses for the whole page (see render/renderKpi.ts/KpiField.tsx).
export type KpiElementOffset = { x: number; y: number };

// A KPI card — a solid colored background, an icon + title + large number +
// subtitle, like a dashboard's cards. title/value/subtitle are ordinary text
// templates (the same syntax as TextSchema — {path}/{FUNCTION(...)}), resolved
// against the whole document, with no separate Binding needed (see
// generate.ts). Each of the 4 sub-elements is optional (absent = removed, it
// does not draw) and may have its own position (offset) and its own lock
// (locked) — absent in both falls back to the usual fixed layout, locked (see
// kpi/card.ts/render/renderKpi.ts/KpiField.tsx), backward compatible with
// every template saved before this.
export type KpiSchema = BaseSchema & {
  type: "kpi";
  icon: KpiIcon;
  title?: string;
  value?: string;
  subtitle?: string;
  backgroundColor: string;
  textColor: string;
  // The font size (pt) of each of the card's texts — optional; absent falls
  // back to the default (see DEFAULT_KPI_*_FONT_SIZE in kpi/card.ts), so old
  // schemas keep the same appearance as always.
  titleFontSize?: number;
  valueFontSize?: number;
  subtitleFontSize?: number;
  // The icon's size (pt) — the same reason as fontSize above.
  iconSize?: number;
  // The rounding of the card's corners, in % (0 = square, 100 = a "pill",
  // see kpiBorderRadius in kpi/card.ts) — optional, absent falls back to the
  // default (old schemas keep the same appearance as always).
  borderRadius?: number;
  // Formats `value` as a pt-BR number (2 places) when it resolves to a plain
  // number — "none"/absent (the default) keeps the text as it is, "plain" =
  // "10000,00", "grouped" = "10.000,00" (see formatKpiValue in kpi/card.ts).
  // Text with a prefix/suffix passes through untouched.
  numberFormat?: "none" | "plain" | "grouped";
  // Each sub-element's own position (mm, relative to the card) — absent =
  // the computed default position (see defaultKpiElementPositions in
  // kpi/card.ts).
  iconOffset?: KpiElementOffset;
  titleOffset?: KpiElementOffset;
  valueOffset?: KpiElementOffset;
  subtitleOffset?: KpiElementOffset;
  // A per-sub-element drag lock — absent/true = locked (it does not drag,
  // the same default as the whole field's padlock); false = free to drag on
  // the canvas (see FieldList.tsx/KpiField.tsx).
  iconLocked?: boolean;
  titleLocked?: boolean;
  valueLocked?: boolean;
  subtitleLocked?: boolean;
};

export type Schema = TextSchema | TableSchema | ImageSchema | SectionSchema | ChartSchema | KpiSchema;

// One page "design" — the same shape Template had before multi-page existed,
// used inside Template.pages[] when there is more than one.
export type TemplatePage = {
  // Stable across edits (a tab key/undo/<Designer key=...>) — it is not
  // saved to or read from the PDF, it is only UI identity.
  id: string;
  // A tab label; the default is the index+1 ("Page N") when absent.
  name?: string;
  page: PageSize;
  headerHeight?: number;
  footerHeight?: number;
  marginLeft?: number;
  marginRight?: number;
  backgroundImage?: string;
  schemas: Schema[];
};

// The document FORMAT version — see src/template.ts. A single-member union
// on purpose: when version 2 exists, swapping it for `1 | 2` makes the
// compiler point at every place that has to decide between the two, instead of
// silently accepting `number`.
export type TemplateVersion = 1;

export type Template = {
  // Absent = format 1 (every template saved before this field existed).
  // `migrateTemplate` stamps the current version onto its output, so a
  // template that went through it never comes back without one.
  version?: TemplateVersion;
  page: PageSize;
  // Static bands (mm) that repeat on every generated page — a body field
  // automatically joins the header/footer when its Y position falls inside
  // that band (with no extra field to mark a "zone", it is only where it
  // sits). A large table in the body paginates on its own; the rest of the
  // body only appears on page 1 (or right after the table ends).
  headerHeight?: number;
  footerHeight?: number;
  marginLeft?: number;
  marginRight?: number;
  // A PNG data URI used as the page background in the editor and in the
  // generated PDF — a letterhead/pre-printed form behind the fields. Always
  // PNG: the upload converts any accepted image (see backgroundImage.ts).
  backgroundImage?: string;
  schemas: Schema[];
  // Multi-page: when present and non-empty, it is the source of truth — the
  // flat fields above (page/headerHeight/.../schemas) are ignored by
  // generatePdf/Designer. Absent/empty = the usual behavior (the flat fields
  // become the single implicit page). Every page shares the same
  // Binding[]/data — a schema name has to be unique in the whole Template, not
  // only within one page.
  pages?: TemplatePage[];
};
