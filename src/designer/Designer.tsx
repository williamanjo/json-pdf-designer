import { useState } from "react";
import type {
  Binding,
  DataSourceOption,
  Schema,
  SectionColumnDragPayload,
  SectionSchema,
  TableColumnStyle,
  TableSchema,
  Template,
} from "../types";
import { makeChartSchema, makeImageSchema, makeKpiSchema, makeSectionColumnPair, makeSectionSchema, makeTableSchema, makeTextSchema, nextFreeY } from "../schemaFactory";
import { columnLabel } from "../bindings/bindings";
import {
  addColumnToArrayBinding,
  addColumnToTable,
  applyColumnCellToTable,
  buildColumnCell,
  computeColumnFormulaCell,
  reindexArrayBindingForNewHead,
  reindexTableForNewHead,
  removeColumnFromArrayBinding,
  removeColumnFromTable,
  reorderArrayBindingColumns,
  reorderTableColumn as reorderTableColumnPure,
  setColumnFormulaOnArrayBinding,
  setColumnStyle as setColumnStylePure,
  setColumnWidth as setColumnWidthPure,
} from "../table/columns";
import { classifyZone, isRedZone } from "../zones";
import { computeSpawnPosition, findTableDataSource } from "./helpers";
import { fileToBackgroundImage } from "../pdf/backgroundImage";
import { toErrorMessage } from "../errorUtils";
import { filterIncomplete } from "../fieldWarnings";
import { I18nProvider, useT, type Locale } from "../i18n";
import { applyOrientation, matchPreset, orientationOf, PAGE_SIZE_PRESETS } from "../pageSizes";
import { PageCanvas } from "../components/PageCanvas";
import { PropertyPanel } from "../components/PropertyPanel";
import { FilterTab } from "../components/FilterTab";
import { PositionFields } from "../components/PropertyPanelFields";
import { FieldList } from "../components/FieldList";
import { Toolbar } from "../components/Toolbar";
import { Badge, Button, Card, CardHeader, Input, Select, TabPanel } from "../components/ui";
import { IconAlertTriangle, IconPlus, IconUpload, IconX } from "../components/ui/icons";
import { useTabBar, FILTERABLE_TYPES, type HideableTab, type TabKey } from "./useTabBar";
import { useSelection } from "./useSelection";
import { useClipboardAndDelete } from "./useClipboardAndDelete";

type Props = {
  template: Template;
  // Aceita o setState do React direto (forma funcional inclusa) — evita
  // sobrescrever uma mudança concorrente por causa de closure velha (ex:
  // dois campos adicionados em sequência rápida, antes do primeiro render
  // acontecer).
  onChangeTemplate: React.Dispatch<React.SetStateAction<Template>>;
  bindings: Binding[];
  onChangeBindings: React.Dispatch<React.SetStateAction<Binding[]>>;
  // Passthrough pro container do canvas — usado por quem quer soltar campos
  // externos (ex: um explorador de campos de JSON) direto na página.
  onCanvasDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  // Arrays conhecidos do JSON de exemplo — vira dropdown "Data Source" no
  // vínculo de tabela (ver BindingEditor). Sem isso, path digitado livre.
  dataSources?: DataSourceOption[];
  // Idioma da UI do designer (botões, abas, avisos) — default "en". Só
  // afeta o que este componente FALA com quem monta o relatório; não
  // muda como o PDF gerado formata data/moeda (isso é {DATE(...)}/
  // {CURRENCY(...)} escrito no próprio template, ver bindings.ts).
  locale?: Locale;
};

// Canvas do editor: página em mm, cada campo arrasta/redimensiona livre
// (react-rnd). Seleção abre o painel de propriedades — que já inclui o
// vínculo com o JSON, sem ponte nenhuma (tudo é React normal). Provider
// de i18n fica AQUI FORA (não dá pra um componente consumir o contexto
// que ele mesmo declara) — a lógica de verdade mora em DesignerInner.
export default function Designer({ locale = "en", ...props }: Props) {
  return (
    <I18nProvider locale={locale}>
      <DesignerInner {...props} />
    </I18nProvider>
  );
}

function DesignerInner({ template, onChangeTemplate, bindings, onChangeBindings, onCanvasDrop, dataSources }: Omit<Props, "locale">) {
  const t = useT();
  // Aba do painel lateral direito — "Campos" (lista) e "Página"
  // (tamanho/orientação/margem/fundo) sempre acessíveis; "Dados"/"Estilo"/
  // "Filtro" só existem enquanto um campo está selecionado (ver guarda
  // dentro de useTabBar, que troca de volta pra "campos" quando a seleção
  // some). Declarado cedo (junto com sidebarCollapsed/tabMenuOpen) porque
  // useSelection/useTabBar abaixo precisam dos setters já prontos.
  const [sidebarTab, setSidebarTab] = useState<TabKey>("campos");
  // Duplo clique na aba ativa fecha (encolhe) o conteúdo; clique simples
  // reabre — ver TabPanel/comentário equivalente em PropertyPanelChart.tsx.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Menu "+" (lista as abas escondidas que caberiam pro campo atual).
  const [tabMenuOpen, setTabMenuOpen] = useState(false);

  // Seleção de campos do canvas (Ctrl/Cmd+clique, caixa de seleção) e
  // sub-elemento de KPI focado — ver src/designer/useSelection.ts.
  const { selectedIds, setSelectedIds, selectedId, selectedKpiElement, setSelectedKpiElement, handleSelect, handleSelectMany } =
    useSelection(setSidebarCollapsed);

  // Modo isolado: esconde o corpo, mostra só cabeçalho/rodapé/margem, pra
  // editar essas faixas sem o resto da página atrapalhar.
  const [isolateBands, setIsolateBands] = useState(false);
  // "+ seção" não cria na hora — abre esse seletor primeiro (vazia, ou já
  // vinculada a uma fonte de dados conhecida).
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  // PDF corrompido ou canvas 2D indisponível fazem fileToBackgroundImage
  // rejeitar — sem isso a promise quebrava em silêncio (console only),
  // upload "sumia" sem o usuário entender por quê.
  const [backgroundUploadError, setBackgroundUploadError] = useState<string | null>(null);

  function updateSchema(id: string, patch: Partial<Schema>) {
    onChangeTemplate((prev) => ({
      ...prev,
      schemas: prev.schemas.map((s) => (s.id === id ? ({ ...s, ...patch } as Schema) : s)),
    }));
  }

  // Renomear pela aba Campos (FieldList.tsx) — nome vazio ou já usado por
  // outro campo é ignorado (mesma regra de unicidade do "colar", ver
  // freshName/usedNames mais abaixo). Precisa remapear `bindings` também
  // (mesma ideia do nameMap do "colar" logo abaixo, só que pra 1 campo só)
  // — sem isso, um vínculo existente ("Binding.schemaName") apontando pro
  // nome antigo para de bater com o schema renomeado (generate.ts resolve
  // vínculo por nome) e silenciosamente some do PDF gerado.
  function renameSchema(id: string, rawName: string) {
    const newName = rawName.trim();
    if (!newName) return;
    const current = template.schemas.find((s) => s.id === id);
    if (!current || current.name === newName) return;
    if (template.schemas.some((s) => s.id !== id && s.name === newName)) return;
    const oldName = current.name;
    onChangeTemplate((prev) => ({
      ...prev,
      schemas: prev.schemas.map((s) => (s.id === id ? { ...s, name: newName } : s)),
    }));
    onChangeBindings((prev) => prev.map((b) => (b.schemaName === oldName ? { ...b, schemaName: newName } : b)));
  }

  // Mesmo patch em TODOS os ids de uma vez — usado só na edição em bloco
  // (ver BULK_EDIT_TYPES abaixo): mudar o estilo com vários campos do MESMO
  // tipo selecionados aplica em todos juntos, não só no último clicado.
  function updateSchemas(ids: string[], patch: Partial<Schema>) {
    const idSet = new Set(ids);
    onChangeTemplate((prev) => ({
      ...prev,
      schemas: prev.schemas.map((s) => (idSet.has(s.id) ? ({ ...s, ...patch } as Schema) : s)),
    }));
  }

  // Arrastar um campo que faz parte de uma seleção múltipla move os outros
  // selecionados ao vivo — posição ABSOLUTA (original + delta desde o
  // início do arrasto, calculado no PageCanvas via snapshot), não
  // incremental, senão cada frame do onDrag divergiria do anterior.
  function moveGroup(updates: Array<{ id: string; x: number; y: number }>) {
    if (updates.length === 0) return;
    const byId = new Map(updates.map((u) => [u.id, u]));
    onChangeTemplate((prev) => ({
      ...prev,
      schemas: prev.schemas.map((s) => {
        const u = byId.get(s.id);
        return u ? { ...s, x: u.x, y: u.y } : s;
      }),
    }));
  }

  // Reordena a pilha de desenho (z-order) — quem vem depois no array
  // aparece por cima no canvas E no PDF gerado.
  function bringToFront(id: string) {
    onChangeTemplate((prev) => {
      const idx = prev.schemas.findIndex((s) => s.id === id);
      if (idx === -1 || idx === prev.schemas.length - 1) return prev;
      const schemas = prev.schemas.slice();
      const [item] = schemas.splice(idx, 1);
      schemas.push(item);
      return { ...prev, schemas };
    });
  }

  function sendToBack(id: string) {
    onChangeTemplate((prev) => {
      const idx = prev.schemas.findIndex((s) => s.id === id);
      if (idx <= 0) return prev;
      const schemas = prev.schemas.slice();
      const [item] = schemas.splice(idx, 1);
      schemas.unshift(item);
      return { ...prev, schemas };
    });
  }

  // Posição de nascimento (centro do corpo, ou dentro da faixa vermelha
  // quando isolado) — ver computeSpawnPosition em helpers.ts.
  function addSchema(schema: Schema): Schema {
    const placed = computeSpawnPosition(template, schema, isolateBands);
    onChangeTemplate((prev) => ({ ...prev, schemas: [...prev.schemas, placed] }));
    setSelectedIds([placed.id]);
    return placed;
  }

  // "Vazia" (sourcePath undefined) ou já vinculada a uma fonte de dados
  // conhecida (dataSources) — nesse caso o binding "section" já nasce
  // pronto, sem precisar digitar o path no BindingEditor depois.
  function createSection(sourcePath?: string) {
    const section = addSchema(makeSectionSchema(nextFreeY(template.schemas), t)) as SectionSchema;
    if (sourcePath) {
      onChangeBindings((prev) => [...prev, { schemaName: section.name, type: "section", path: sourcePath }]);
    }
    setShowSectionPicker(false);
  }

  // Soltar um "chip" de coluna (arrastado do PropertyPanel de uma seção
  // vinculada) no canvas — cria o par header+valor, já membros da seção.
  function dropSectionColumn(payload: SectionColumnDragPayload, xMm: number, yMm: number) {
    const { header, value, valueBinding } = makeSectionColumnPair(payload.sectionId, payload.column, xMm, yMm, t);
    onChangeTemplate((prev) => ({ ...prev, schemas: [...prev.schemas, header, value] }));
    onChangeBindings((prev) => [...prev, valueBinding]);
  }

  function removeSchema(id: string) {
    const schema = template.schemas.find((s) => s.id === id);
    onChangeTemplate((prev) => ({
      ...prev,
      // Filho de uma seção apagada vira campo solto de novo (limpa
      // sectionId) — sem isso ficava com um id órfão apontando pra
      // seção que não existe mais e sumia do PDF gerado (silencioso,
      // sem erro nenhum) mesmo continuando visível no canvas.
      schemas: prev.schemas
        .filter((s) => s.id !== id)
        .map((s) => (s.sectionId === id ? { ...s, sectionId: undefined } : s)),
    }));
    if (schema) {
      const removedName = schema.name;
      onChangeBindings((prev) => prev.filter((b) => b.schemaName !== removedName));
    }
    setSelectedIds([]);
  }

  // Delete/Backspace (apaga selecionados) e Ctrl+C/Ctrl+V (copiar/colar) —
  // ver src/designer/useClipboardAndDelete.ts.
  useClipboardAndDelete({ template, bindings, selectedIds, setSelectedIds, onChangeTemplate, onChangeBindings, t });

  function setBinding(schemaName: string, binding: Binding | null) {
    onChangeBindings((prev) => {
      const rest = prev.filter((b) => b.schemaName !== schemaName);
      return binding ? [...rest, binding] : rest;
    });
  }

  // Vínculo "array" novo (1ª vez, ainda sem binding nenhum) numa tabela —
  // sincroniza head/content com as colunas do vínculo antes de salvar.
  // Sem isso, uma tabela recém-criada (head placeholder "Coluna 1"/
  // "Coluna 2") que escolhe um Data Source no BindingEditor ganhava um
  // binding.columns cheio (todas as colunas da fonte) enquanto head
  // continuava com só 2 — desalinhado desde o clique em "Vincular", antes
  // de qualquer "+"/remover acontecer (cada "+" subsequente só piorava,
  // já achando a coluna "já presente" no binding inflado e nunca
  // adicionando de verdade). Vínculo JÁ EXISTENTE sendo só editado (path
  // trocado etc) não mexe em head — só a criação do zero.
  function handleChangeBinding(schemaName: string, binding: Binding | null) {
    if (binding?.type === "array") {
      const schema = template.schemas.find((s) => s.name === schemaName);
      const hadBindingBefore = bindings.some((b) => b.schemaName === schemaName);
      if (schema && schema.type === "table" && !hadBindingBefore) {
        const newHead = binding.columns.map((c) => columnLabel(c));
        const newContent = [binding.columns.map((c) => (typeof c === "string" ? `{${c}}` : c.formula))];
        updateSchema(schema.id, { head: newHead, content: newContent, footer: undefined, columnStyles: undefined });
      }
    }
    setBinding(schemaName, binding);
  }

  const selected = template.schemas.find((s) => s.id === selectedId) ?? null;
  const selectedBinding = selected ? bindings.find((b) => b.schemaName === selected.name) : undefined;

  // Edição em bloco: vários campos do MESMO tipo selecionados juntos (texto
  // com texto, KPI com KPI, gráfico com gráfico) — só pra esses 3 tipos,
  // que já têm uma separação clara de que campo é "estilo" (aplica em todos
  // sem problema) e o que é "dados" (cada um tem o próprio conteúdo/vínculo,
  // trava pra edição individual). Tipo misto ou tabela/imagem/seção
  // continua no comportamento de sempre (só o último selecionado edita).
  const BULK_EDIT_TYPES = ["text", "kpi", "chart"] as const;
  const selectedSchemas = template.schemas.filter((s) => selectedIds.includes(s.id));
  const bulkEditActive =
    selectedIds.length > 1 &&
    selectedSchemas.length > 1 &&
    (BULK_EDIT_TYPES as readonly string[]).includes(selectedSchemas[0].type) &&
    selectedSchemas.every((s) => s.type === selectedSchemas[0].type);
  // Ícone de alerta na própria aba — mesma regra de FieldList.tsx
  // (fieldWarnings.ts), só que dividida por aba: falta vínculo aparece em
  // "Dados", filtro incompleto aparece em "Filtro".
  const dadosWarning = !!selected && (selected.type === "section" || selected.type === "chart") && !selectedBinding;
  const filtroWarning = !!selected && (FILTERABLE_TYPES as readonly string[]).includes(selected.type) && filterIncomplete(selectedBinding);
  const filterColumns =
    selected &&
    (FILTERABLE_TYPES as readonly string[]).includes(selected.type) &&
    (selectedBinding?.type === "chart" || selectedBinding?.type === "array" || selectedBinding?.type === "kpi")
      ? dataSources?.find((d) => d.path === selectedBinding.path)?.columns ?? []
      : [];

  // Barra de abas do painel lateral (ordem/fixar-esconder/elegibilidade) —
  // ver src/designer/useTabBar.ts.
  const {
    orderedVisibleTabs,
    addableOptionalTabs,
    tabsCustomized,
    reorderTabs,
    hideOptionalTab,
    showOptionalTab,
    restoreDefaultTabs,
    draggedTab,
    setDraggedTab,
    dragOverTab,
    setDragOverTab,
  } = useTabBar({ t, selected, dadosWarning, filtroWarning, sidebarTab, setSidebarTab, setSidebarCollapsed, setTabMenuOpen });

  // "+" na lista de campos da seção (dentro do painel da tabela) — adiciona
  // a coluna no cabeçalho da tabela e já escreve "{coluna}" na célula (em
  // vez de deixar vazia) — fica visível e editável direto, igual um campo
  // de texto vinculado; dá pra combinar com outro campo depois
  // ("{coluna} - {outra}", ver resolveNestedTableRows no generate.ts). Não
  // precisa criar vínculo — só faz sentido um "array" de verdade se a
  // tabela for mestre-detalhe de um array ANINHADO, feito à mão pelo
  // BindingEditor com um path diferente do da seção.
  // Editar "Colunas (cabeçalho, vírgula)" à mão — reescreve `head` inteiro
  // de uma vez (não é add/remove de 1 índice, é a lista toda substituída).
  // Pra cada nome do NOVO head, acha esse MESMO nome no head ANTIGO e
  // carrega o que tava naquele índice (content/footer/columnStyles/
  // binding.columns) — por NOME, não por posição. Só por posição (ex:
  // truncar/preencher no índice) já deixou um bug de verdade: reduzir de
  // 9 pra 1 coluna ("fatura") simplesmente pegava o índice 0 de tudo, que
  // era "orgao" (1ª coluna do binding original) — o valor certo de
  // "fatura" (índice 2) nunca era encontrado, PDF saía com órgão sob o
  // rótulo fatura, silencioso. Nome novo sem correspondência antiga vira
  // coluna crua (mesmo padrão do "+" de sempre).
  // TODAS as funções de coluna abaixo (setTableHead/addTableColumn/
  // removeTableColumn/reorderTableColumn/setColumnStyle/setColumnFormula)
  // recalculam a tabela/vínculo de dentro do PRÓPRIO callback funcional do
  // onChangeTemplate/onChangeBindings (nunca a partir de `selected`/
  // `bindings` fechados no render) — 2 cliques em sequência rápida (antes
  // do 1º re-render acontecer) liam o MESMO `selected`/`existingBinding`
  // desatualizado, e o 2º clique sobrescrevia o array inteiro por cima do
  // 1º (não só não via a mudança do outro — APAGAVA ela). Foi exatamente
  // como um "orgao" foi parar no índice de "tarKandir": um clique de "+"
  // usou uma cópia de head/columns de ANTES do clique anterior aplicar,
  // reescreveu o array inteiro com base nela, e derrubou a adição alheia.
  // `selectedId`/`schemaName` (nunca mudam por essas ações) são os únicos
  // valores lidos do closure — o CONTEÚDO (head/content/columns/...) vem
  // sempre do `prev` de dentro do callback, que reflete a cadeia real de
  // atualizações já aplicadas, clique a clique.
  //
  // updateSelectedTable centraliza o find/guard/map repetido nas 7 funções
  // abaixo (acha a tabela selecionada dentro do `prev` funcional, confere
  // que é mesmo type "table", aplica o `mutator` recebido e substitui de
  // volta no array) — cada função só passa a lógica de coluna que muda
  // (delegada pras funções puras de src/tableColumns.ts, que não mudam).
  // `mutator` pode devolver undefined pra "sem mudança" (ex: coluna
  // duplicada em addColumnToTable), mesmo padrão que já existia.
  function updateSelectedTable(mutator: (table: TableSchema) => TableSchema | null | undefined) {
    if (!selectedId) return;
    onChangeTemplate((prev) => {
      const table = prev.schemas.find((s) => s.id === selectedId);
      if (!table || table.type !== "table") return prev;
      const newTable = mutator(table);
      if (!newTable) return prev;
      return { ...prev, schemas: prev.schemas.map((s) => (s.id === selectedId ? newTable : s)) };
    });
  }

  function setTableHead(newHead: string[]) {
    if (!selectedId) return;
    updateSelectedTable((table) => reindexTableForNewHead(table, newHead));
    onChangeBindings((prev) => {
      const schemaName = selected?.name;
      const existingBinding = prev.find((b) => b.schemaName === schemaName);
      if (existingBinding?.type !== "array") return prev;
      const oldHead = selected && selected.type === "table" ? selected.head : [];
      const columns = reindexArrayBindingForNewHead(existingBinding, oldHead, newHead);
      return prev.map((b) => (b === existingBinding ? { ...b, columns } : b));
    });
  }

  // Se o valor de exemplo desse campo no JSON é numérico (typeof number,
  // visto em findTableDataSource -> dataSources[].columnTypes), a coluna
  // já nasce formatada como moeda (2 casas, R$) em vez de token cru — não
  // precisa abrir o "ƒx" depois só pra marcar "isso aqui é dinheiro".
  // Texto/outro tipo continua exatamente como sempre (token cru).
  function addTableColumn(column: string) {
    if (!selectedId) return;
    const columnType = findTableDataSource(selected, template.schemas, bindings, dataSources)?.columnTypes?.[column];
    const cell = buildColumnCell(column, columnType);
    updateSelectedTable((table) => addColumnToTable(table, column, cell));
    onChangeBindings((prev) => {
      const schemaName = selected?.name;
      const existingBinding = prev.find((b) => b.schemaName === schemaName);
      if (existingBinding?.type !== "array") return prev;
      const newColumn = columnType === "number" ? { label: column, formula: cell } : column;
      const columns = addColumnToArrayBinding(existingBinding, column, newColumn);
      if (!columns) return prev;
      return prev.map((b) => (b === existingBinding ? { ...b, columns } : b));
    });
  }

  // Remove a coluna do cabeçalho/linhas de preview pelo índice — inclui
  // as placeholder "Coluna 1"/"Coluna 2" (tabela recém-criada, antes de
  // vincular a nada) e as que vieram do "+" da fonte de dados.
  //
  // A remoção do `head`/`content` é por índice (fonte de verdade direta),
  // mas do binding.columns é por NOME — head e columns podem dessincronizar
  // (ex: usuário editou o texto livre "Colunas, vírgula" sem mexer no
  // vínculo), e remover por índice ali arriscava tirar a coluna ERRADA do
  // binding. Por nome, na pior hipótese não acha e não tira nada (seguro).
  function removeTableColumn(index: number) {
    if (!selectedId) return;
    let removedName: string | undefined;
    updateSelectedTable((table) => {
      const result = removeColumnFromTable(table, index);
      removedName = result.removedName;
      return result.table;
    });
    onChangeBindings((prev) => {
      const schemaName = selected?.name;
      const existingBinding = prev.find((b) => b.schemaName === schemaName);
      if (existingBinding?.type !== "array") return prev;
      const columns = removeColumnFromArrayBinding(existingBinding, removedName);
      if (!columns) return prev;
      return prev.map((b) => (b === existingBinding ? { ...b, columns } : b));
    });
  }

  // Arrastar pra reordenar (lista "Colunas atuais da tabela" no painel) —
  // desloca head/content/footer juntos (índice é a fonte de verdade dos
  // três). O binding.columns só reordena junto se o tamanho bater com o
  // head — senão fica como tá, pra não arriscar embaralhar valor errado
  // sob rótulo errado (mesma cautela do remove por nome).
  function reorderTableColumn(fromIndex: number, toIndex: number) {
    if (!selectedId || fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    updateSelectedTable((table) => reorderTableColumnPure(table, fromIndex, toIndex));
    onChangeBindings((prev) => {
      const schemaName = selected?.name;
      const existingBinding = prev.find((b) => b.schemaName === schemaName);
      if (existingBinding?.type !== "array") return prev;
      const headLength = selected && selected.type === "table" ? selected.head.length : -1;
      const columns = reorderArrayBindingColumns(existingBinding, headLength, fromIndex, toIndex);
      if (!columns) return prev;
      return prev.map((b) => (b === existingBinding ? { ...b, columns } : b));
    });
  }

  // Estilo (cor/fundo/tamanho) por coluna, header e valor — botão de
  // pincel na lista de colunas do painel. Mescla no índice, sem mexer
  // no resto (undefined num campo do patch limpa só aquele campo).
  function setColumnStyle(index: number, patch: Partial<TableColumnStyle>) {
    if (!selectedId) return;
    updateSelectedTable((table) => setColumnStylePure(table, index, patch));
  }

  // Largura de UMA coluna — input numérico do painel (arrastar a divisão
  // no canvas já grava `columnWidths` direto via onUpdateSchema genérico,
  // ver TableField.tsx). Mesmo padrão funcional de setColumnStyle acima.
  function setColumnWidth(index: number, widthMm: number | undefined) {
    if (!selectedId) return;
    updateSelectedTable((table) => setColumnWidthPure(table, index, widthMm));
  }

  // Fórmula de UMA coluna do vínculo "array" — botão "ƒx" na lista de
  // colunas do painel (só aparece pra tabela vinculada de verdade; sem
  // vínculo, o template já é editável direto na célula da tabela). Vazio
  // volta a ser coluna crua (só o nome); com texto, vira {label, formula}.
  function setColumnFormula(index: number, formula: string) {
    if (!selectedId) return;
    // content[i] é quem manda na hora de resolver a célula (ver generate.ts) —
    // sem espelhar aqui, o token bruto que já tava em content (ex: "{tarKandir}")
    // continua ganhando de qualquer fórmula nova salva só no binding, e a
    // edição pelo ƒx não tem efeito nenhum no PDF.
    const currentCell = selected && selected.type === "table" ? selected.content[0]?.[index] : undefined;
    const headFallback = selected && selected.type === "table" ? selected.head[index] : undefined;
    const { cell, rawPath } = computeColumnFormulaCell(formula, currentCell, headFallback);
    updateSelectedTable((table) => applyColumnCellToTable(table, index, cell));
    onChangeBindings((prev) => {
      const schemaName = selected?.name;
      const existingBinding = prev.find((b) => b.schemaName === schemaName);
      if (existingBinding?.type !== "array") return prev;
      const columns = setColumnFormulaOnArrayBinding(existingBinding, index, formula, rawPath, headFallback);
      return prev.map((b) => (b === existingBinding ? { ...b, columns } : b));
    });
  }

  // A lista espelha o que o canvas mostra: no modo isolado só a faixa
  // vermelha (cabeçalho/rodapé/margem); fora dele, só o corpo — senão a
  // lista mostraria campo escondido no canvas, sem jeito de clicar nele.
  const bandsForList = {
    headerHeight: template.headerHeight ?? 0,
    footerHeight: template.footerHeight ?? 0,
    marginLeft: template.marginLeft ?? 0,
    marginRight: template.marginRight ?? 0,
  };
  const fieldListSchemas = template.schemas.filter((s) => {
    const inRedZone = isRedZone(classifyZone(s, template.page, bandsForList));
    return isolateBands ? inRedZone : !inRedZone;
  });

  function updatePageBand(
    patch: Partial<Pick<Template, "headerHeight" | "footerHeight" | "marginLeft" | "marginRight">>
  ) {
    onChangeTemplate((prev) => ({ ...prev, ...patch }));
  }

  // Troca o tamanho/orientação da página — preserva a orientação atual ao
  // trocar de preset, e preserva o preset (largura/altura) ao só girar.
  function setPagePreset(presetName: string) {
    const preset = PAGE_SIZE_PRESETS.find((p) => p.name === presetName);
    if (!preset) return;
    const orientation = orientationOf(template.page);
    onChangeTemplate((prev) => ({ ...prev, page: applyOrientation(preset.size, orientation) }));
  }

  function setPageOrientation(orientation: "portrait" | "landscape") {
    onChangeTemplate((prev) => ({ ...prev, page: applyOrientation(prev.page, orientation) }));
  }

  function toggleIsolateBands() {
    setSelectedIds([]);
    setIsolateBands((v) => !v);
  }

  async function handleBackgroundUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBackgroundUploadError(null);
    try {
      const backgroundImage = await fileToBackgroundImage(file);
      onChangeTemplate((prev) => ({ ...prev, backgroundImage }));
    } catch (err) {
      setBackgroundUploadError(toErrorMessage(err, t.pageSettings.backgroundUploadError));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-4">
        <PageCanvas
          page={template.page}
          schemas={template.schemas}
          headerHeight={template.headerHeight}
          footerHeight={template.footerHeight}
          marginLeft={template.marginLeft}
          marginRight={template.marginRight}
          isolateBands={isolateBands}
          backgroundImage={template.backgroundImage}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onSelectMany={handleSelectMany}
          onUpdateSchema={updateSchema}
          onMoveGroup={moveGroup}
          onCanvasDrop={onCanvasDrop}
          onDropSectionColumn={dropSectionColumn}
          selectedKpiElement={selectedKpiElement}
          onSelectKpiElement={setSelectedKpiElement}
        />

        <Card className="flex w-80 flex-shrink-0 flex-col gap-3 p-3.5">
          <div className="flex flex-nowrap items-center gap-0.5 border-b border-slate-200 dark:border-gray-700">
            {orderedVisibleTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                draggable
                onDragStart={(e) => { setDraggedTab(tab.key); e.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(e) => { e.preventDefault(); if (draggedTab && draggedTab !== tab.key) setDragOverTab(tab.key); }}
                onDragLeave={() => setDragOverTab((cur) => (cur === tab.key ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedTab) reorderTabs(draggedTab, tab.key);
                  setDraggedTab(null);
                  setDragOverTab(null);
                }}
                onDragEnd={() => { setDraggedTab(null); setDragOverTab(null); }}
                onClick={() => { setSidebarTab(tab.key); setSidebarCollapsed(false); }}
                onDoubleClick={() => setSidebarCollapsed((c) => !c)}
                title={t.tabBar.dragToReorder}
                className={`relative flex flex-shrink-0 cursor-grab items-center gap-0.5 whitespace-nowrap px-2 py-1.5 text-xs font-medium active:cursor-grabbing ${
                  draggedTab === tab.key ? "opacity-40" : ""
                } ${
                  sidebarTab === tab.key
                    ? "border-b-2 border-sky-500 text-sky-600 dark:border-blue-400 dark:text-blue-400"
                    : "text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {/* Indicador de onde a aba arrastada vai parar (antes desta). */}
                {dragOverTab === tab.key && draggedTab && draggedTab !== tab.key && (
                  <span className="absolute -left-0.5 top-0.5 bottom-0.5 w-0.5 rounded bg-sky-500 dark:bg-blue-400" />
                )}
                {tab.label}
                {tab.warning && <IconAlertTriangle className="h-3 w-3 flex-shrink-0 text-amber-500 dark:text-amber-400" />}
                {/* Fixar/esconder — só na aba ativa (senão não cabe todo mundo
                    junto na barra) — some pra todo campo até reabrir no "+". */}
                {tab.removable && sidebarTab === tab.key && (
                  <span
                    role="button"
                    aria-label={t.tabBar.pinAria(tab.label)}
                    title={t.tabBar.pinTitle(tab.label)}
                    onClick={(e) => { e.stopPropagation(); hideOptionalTab(tab.key as HideableTab); }}
                    className="-mr-1 cursor-pointer rounded p-0.5 text-current opacity-60 hover:bg-slate-200 hover:opacity-100 dark:hover:bg-gray-600"
                  >
                    <IconX className="h-2.5 w-2.5" />
                  </span>
                )}
              </button>
            ))}

            {/* "+" sempre no final da barra — reabre aba escondida e/ou
                restaura ordem/visibilidade padrão. Só aparece quando há
                algo pra mexer (aba escondida ou ordem já alterada). */}
            {(addableOptionalTabs.length > 0 || tabsCustomized) && (
              <div className="relative ml-auto flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setTabMenuOpen((o) => !o)}
                  title={t.tabBar.reopenOrRestoreTitle}
                  aria-label={t.tabBar.reopenOrRestoreTitle}
                  className="flex items-center justify-center rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-gray-500 dark:hover:bg-gray-700"
                >
                  <IconPlus className="h-3.5 w-3.5" />
                </button>
                {tabMenuOpen && (
                  <div className="absolute right-0 top-full z-10 mt-1 flex flex-col gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-md dark:border-gray-600 dark:bg-gray-800">
                    {addableOptionalTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => showOptionalTab(tab.key)}
                        className="whitespace-nowrap rounded-md px-2 py-1 text-left text-xs text-slate-700 hover:bg-sky-50 dark:text-gray-200 dark:hover:bg-blue-400/10"
                      >
                        {tab.label}
                      </button>
                    ))}
                    {tabsCustomized && (
                      <>
                        {addableOptionalTabs.length > 0 && <div className="my-0.5 border-t border-slate-200 dark:border-gray-600" />}
                        <button
                          type="button"
                          onClick={restoreDefaultTabs}
                          className="whitespace-nowrap rounded-md px-2 py-1 text-left text-xs text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-700"
                        >
                          {t.tabBar.restoreDefault}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <TabPanel collapsed={sidebarCollapsed}>
          {sidebarTab === "campos" && (
            <>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{t.fieldsPanel.heading}</h3>
                <div className="max-h-48 overflow-y-auto">
                  <FieldList
                    schemas={fieldListSchemas}
                    selectedIds={selectedIds}
                    onSelect={handleSelect}
                    onRemove={removeSchema}
                    onToggleLock={(id) => updateSchema(id, { locked: !template.schemas.find((s) => s.id === id)?.locked })}
                    onBringToFront={bringToFront}
                    onSendToBack={sendToBack}
                    bindings={bindings}
                    onRename={renameSchema}
                    selectedKpiElement={selectedKpiElement}
                    onSelectKpiElement={setSelectedKpiElement}
                    onChangeSchema={updateSchema}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 dark:border-gray-700">
                <p className="text-xs text-slate-400 dark:text-gray-400">{t.fieldsPanel.selectHint}</p>
                <Toolbar
                  onAddText={() => addSchema(makeTextSchema(nextFreeY(template.schemas), t))}
                  onAddTable={() => addSchema(makeTableSchema(nextFreeY(template.schemas), t))}
                  onAddImage={() => addSchema(makeImageSchema(nextFreeY(template.schemas), t))}
                  onAddSection={() => setShowSectionPicker(true)}
                  onAddChart={() => addSchema(makeChartSchema(nextFreeY(template.schemas), t))}
                  onAddKpi={() => addSchema(makeKpiSchema(nextFreeY(template.schemas), t))}
                />
                {showSectionPicker && (
                  <div className="flex flex-col gap-1.5 rounded-lg border border-purple-300 bg-purple-50/60 p-2.5 dark:border-purple-700 dark:bg-purple-900/30">
                    <p className="text-xs font-medium text-purple-800 dark:text-purple-300">{t.fieldsPanel.sectionTypeQuestion}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Button variant="outline" onClick={() => createSection()}>
                        {t.fieldsPanel.sectionEmpty}
                      </Button>
                      {(dataSources ?? []).map((d) => (
                        <Button key={d.path} variant="outline" onClick={() => createSection(d.path)}>
                          {d.label}
                        </Button>
                      ))}
                    </div>
                    {(!dataSources || dataSources.length === 0) && (
                      <p className="text-[10px] text-purple-600 dark:text-purple-400">{t.fieldsPanel.noDataSource}</p>
                    )}
                    <Button variant="ghost" onClick={() => setShowSectionPicker(false)}>
                      {t.fieldsPanel.cancel}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {(sidebarTab === "dados" || sidebarTab === "estilo" || sidebarTab === "filtro") && selected && (
            <div className="flex flex-col gap-3">
              {/* Enviar/trazer e remover já vivem na linha selecionada da
                  lista (aba "Campos") — sem duplicar aqui. */}
              <CardHeader>
                <Badge>{selected.name}</Badge>
              </CardHeader>
              {selectedIds.length > 1 && (
                <p className="text-[11px] text-sky-600 dark:text-blue-400">
                  {bulkEditActive ? t.fieldsPanel.bulkEditBanner(selectedIds.length) : t.fieldsPanel.multiSelected(selectedIds.length, selected.name)}
                </p>
              )}

              {sidebarTab === "dados" && (
                <PositionFields schema={selected} onChangeSchema={(patch) => updateSchema(selected.id, patch)} />
              )}

              {(sidebarTab === "dados" || sidebarTab === "estilo") && (
                <PropertyPanel
                  key={selected.id}
                  schema={selected}
                  binding={selectedBinding}
                  activeTab={sidebarTab}
                  bulkEdit={bulkEditActive}
                  onChangeSchema={(patch) => (bulkEditActive ? updateSchemas(selectedIds, patch) : updateSchema(selected.id, patch))}
                  onChangeBinding={(b) => handleChangeBinding(selected.name, b)}
                  dataSources={dataSources}
                  tableDataSource={findTableDataSource(selected, template.schemas, bindings, dataSources)}
                  onSetHeadList={setTableHead}
                  onAddTableColumn={addTableColumn}
                  onRemoveTableColumn={removeTableColumn}
                  onReorderTableColumn={reorderTableColumn}
                  onSetColumnStyle={setColumnStyle}
                  onSetColumnWidth={setColumnWidth}
                  onSetColumnFormula={setColumnFormula}
                  selectedKpiElement={selectedKpiElement}
                  onSelectKpiElement={setSelectedKpiElement}
                />
              )}

              {sidebarTab === "filtro" && (FILTERABLE_TYPES as readonly string[]).includes(selected.type) && (
                (selected.type === "chart" && selectedBinding?.type === "chart") ||
                (selected.type === "table" && selectedBinding?.type === "array") ||
                (selected.type === "kpi" && selectedBinding?.type === "kpi") ? (
                  <FilterTab
                    binding={selectedBinding as Extract<Binding, { type: "chart" | "array" | "kpi" }>}
                    onChangeBinding={(b) => handleChangeBinding(selected.name, b)}
                    columns={filterColumns}
                  />
                ) : (
                  <p className="text-xs text-slate-400 dark:text-gray-400">{t.fieldsPanel.filterNeedsBinding}</p>
                )
              )}
            </div>
          )}

          {sidebarTab === "pagina" && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <Select
                  label={t.pageSettings.pageSize}
                  value={matchPreset(template.page) ?? ""}
                  onChange={(e) => setPagePreset(e.target.value)}
                >
                  {!matchPreset(template.page) && <option value="">{t.pageSettings.customSize}</option>}
                  {PAGE_SIZE_PRESETS.map((p) => (
                    <option key={p.name} value={p.name}>
                      {t.pageSizeLabels[p.name as keyof typeof t.pageSizeLabels] ?? p.label}
                    </option>
                  ))}
                </Select>
                <Select
                  label={t.pageSettings.orientation}
                  value={orientationOf(template.page)}
                  onChange={(e) => setPageOrientation(e.target.value as "portrait" | "landscape")}
                >
                  <option value="portrait">{t.pageSettings.portrait}</option>
                  <option value="landscape">{t.pageSettings.landscape}</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label={t.pageSettings.header}
                  type="number"
                  min={0}
                  value={template.headerHeight ?? 0}
                  onChange={(e) => updatePageBand({ headerHeight: Number(e.target.value) || 0 })}
                />
                <Input
                  label={t.pageSettings.footer}
                  type="number"
                  min={0}
                  value={template.footerHeight ?? 0}
                  onChange={(e) => updatePageBand({ footerHeight: Number(e.target.value) || 0 })}
                />
                <Input
                  label={t.pageSettings.marginLeft}
                  type="number"
                  min={0}
                  value={template.marginLeft ?? 0}
                  onChange={(e) => updatePageBand({ marginLeft: Number(e.target.value) || 0 })}
                />
                <Input
                  label={t.pageSettings.marginRight}
                  type="number"
                  min={0}
                  value={template.marginRight ?? 0}
                  onChange={(e) => updatePageBand({ marginRight: Number(e.target.value) || 0 })}
                />
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-sky-600 px-2.5 py-1 text-xs font-medium text-sky-600 hover:bg-sky-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-400/10">
                <IconUpload /> {t.pageSettings.backgroundUpload}
                <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={handleBackgroundUpload} hidden />
              </label>
              {template.backgroundImage && (
                <Button variant="ghost" onClick={() => onChangeTemplate((prev) => ({ ...prev, backgroundImage: undefined }))}>
                  {t.pageSettings.removeBackground}
                </Button>
              )}
              {backgroundUploadError && <span className="text-xs text-red-600">{backgroundUploadError}</span>}
              <Button
                variant={isolateBands ? "primary" : "outline"}
                onClick={toggleIsolateBands}
                title={t.pageSettings.isolateTitle}
              >
                {isolateBands ? t.pageSettings.isolateOn : t.pageSettings.isolateOff}
              </Button>
            </div>
          )}
          </TabPanel>
        </Card>
      </div>
    </div>
  );
}
