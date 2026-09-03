import type { Dispatch, SetStateAction } from "react";
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
import { makeSectionColumnPair, makeSectionSchema, nextFreeY } from "../schemaFactory";
import { columnLabel } from "../bindings/bindings";
import { fileToBackgroundImage } from "../pdf/backgroundImage";
import { toErrorMessage } from "../errorUtils";
import {
  addColumnToArrayBinding,
  addColumnToTable,
  applyColumnCellToTable,
  buildColumnCell,
  computeColumnFormulaCell,
  mirrorCellsToArrayBinding,
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
import { computeSpawnPosition, findTableDataSource } from "./helpers";
import { applyOrientation, orientationOf, PAGE_SIZE_PRESETS } from "../pageSizes";
import type { Dict } from "../i18n";

// Toda mutação de template/bindings do editor, fora do componente.
//
// POR QUE ISTO EXISTE — duas razões, e a segunda é a que manda:
//
// 1. Testabilidade. Enquanto estas funções viviam dentro do Designer.tsx,
//    a lógica mais delicada do pacote (espelhar célula de tabela no vínculo,
//    remapear bindings.schemaName no rename, reindexar coluna por NOME,
//    limpar sectionId órfão) não tinha um único teste — precisaria montar o
//    componente inteiro. Como fábrica, dá pra capturar os updaters
//    despachados e aplicá-los num template de mentira. Ver
//    test/designer/actions.test.ts.
//
// 2. Identidade estável. As peças do editor (DesignerCanvas,
//    DesignerPropertyPanel, ...) vão receber estas funções por contexto. Se
//    o objeto de actions fosse recriado a cada render, o valor do contexto
//    mudaria a cada tecla digitada e `React.memo` em qualquer peça viraria
//    inútil PRA SEMPRE — o consumidor não teria como optar por sair. Por
//    isso NADA reativo entra por parâmetro: tudo que muda ao longo do tempo
//    (template, bindings, seleção, modo isolado, dicionário) é lido de
//    `latest.current`, uma ref atribuída durante o render. Com isso a
//    fábrica é chamada uma vez, com lista de dependência vazia.
//
// O QUE NÃO MUDOU: a autoridade da ESCRITA é o `prev` de dentro do callback
// funcional — é o que impede dois cliques em sequência rápida de um
// sobrescrever o array inteiro por cima do outro (foi assim que um "orgao"
// foi parar no índice de "tarKandir", ver o comentário longo mais abaixo).
// `latest.current` informa DECISÃO de escrita secundária (ex: "a célula
// mudou, então o vínculo precisa acompanhar?") e leitura de guarda (ex:
// "esse nome já existe?"). Ler da ref é equivalente ao closure de antes — o
// React recria o handler a cada render, então o handler clicado já era o do
// render mais novo —, ou seja: sem regressão, e sem promessa de ter
// consertado a corrida de dois cliques na escrita PAREADA (template +
// bindings), que segue igual.
//
// TRÊS EXCEÇÕES CONHECIDAS, em que conteúdo escrito ainda deriva de snapshot.
// Estão listadas aqui porque a regra acima, sem elas, seria mentira:
//
// 1. `setTableHead` — `oldHead` sai do snapshot e serve de mapa nome→índice
//    pra reindexar `binding.columns`. Duas edições rápidas do head escrevem
//    valor de coluna errado sob um rótulo: é a classe original do bug, ainda
//    viva. Consertar exige casar por `columnLabel(binding.columns[i])` em vez
//    de por `oldHead`, o que muda a semântica no caso de head e columns
//    dessincronizados (que os testes de table/columns fixam) — mudança de
//    comportamento, não cabe num commit de refactor.
// 2. `setColumnFormula` — só o lado do VÍNCULO (`rawPath`/`headFallback`);
//    a célula, que é quem decide o PDF, já vem do `prev`.
// 3. `addSchema` — `computeSpawnPosition` precisa do template pra achar
//    posição livre, e a função devolve o schema posicionado de forma
//    SÍNCRONA porque `createSection` precisa do nome dele pra criar o
//    vínculo na mesma ação. Dois "+ texto" muito rápidos nascem na mesma
//    coordenada. Trade-off de desenho, não descuido.
// TUDO que muda ao longo do tempo mora aqui — inclusive os próprios
// setters. Os `onChange*` vêm do consumidor (o `report-builder` monta os
// dele em cima de undo/redo + autosave), então não há garantia de que sejam
// estáveis entre renders; passá-los por parâmetro faria a fábrica ser
// recriada junto. Com eles na ref, a lista de dependência do useMemo é
// VAZIA de verdade.
export type DesignerLatest = {
  template: Template;
  bindings: Binding[];
  selectedId: string | null;
  isolateBands: boolean;
  t: Dict;
  dataSources: DataSourceOption[] | undefined;
  // Passo da grade (config do <Designer>). Entra AQUI e nao por parametro
  // pelo mesmo motivo do resto: a fabrica roda uma vez, com lista de
  // dependencia vazia, e todo valor que muda entre renders tem de ser lido
  // na hora do evento.
  gridSizeMm: number | undefined;
  onChangeTemplate: Dispatch<SetStateAction<Template>>;
  onChangeBindings: Dispatch<SetStateAction<Binding[]>>;
  setSelectedIds: (ids: string[]) => void;
  // Estado que nao e do template, mas cuja ESCRITA e mutador: o modo
  // isolado (toggle limpa a selecao junto) e o erro de upload de fundo.
  // Sao `useState` setters, ja estaveis por contrato do React — estao na
  // ref por uniformidade, nao por necessidade.
  setIsolateBands: Dispatch<SetStateAction<boolean>>;
  setBackgroundUploadError: (message: string | null) => void;
};

export type DesignerActions = ReturnType<typeof makeDesignerActions>;

export function makeDesignerActions(latest: { current: DesignerLatest }) {
  // Repasses finos, pros corpos abaixo ficarem legíveis (e idênticos aos que
  // viviam no componente).
  const onChangeTemplate: Dispatch<SetStateAction<Template>> = (u) => latest.current.onChangeTemplate(u);
  const onChangeBindings: Dispatch<SetStateAction<Binding[]>> = (u) => latest.current.onChangeBindings(u);
  const setSelectedIds = (ids: string[]) => latest.current.setSelectedIds(ids);

  // Atalhos de leitura. Sempre chamados na hora do evento, nunca guardados.
  const schemas = () => latest.current.template.schemas;
  const selectedSchema = () => schemas().find((s) => s.id === latest.current.selectedId) ?? null;
  const selectedTable = () => {
    const s = selectedSchema();
    return s && s.type === "table" ? s : null;
  };

  function mirrorTableCellsToBinding(table: TableSchema, nextContent: string[][]) {
    onChangeBindings((prev) => {
      const binding = prev.find((b) => b.schemaName === table.name);
      if (binding?.type !== "array") return prev;
      const columns = mirrorCellsToArrayBinding(binding, table.head, table.content[0], nextContent[0]);
      if (!columns) return prev;
      return prev.map((b) => (b === binding ? { ...b, columns } : b));
    });
  }

  function updateSchema(id: string, patch: Partial<Schema>) {
    const before = schemas().find((s) => s.id === id);
    onChangeTemplate((prev) => ({
      ...prev,
      schemas: prev.schemas.map((s) => (s.id === id ? ({ ...s, ...patch } as Schema) : s)),
    }));
    // Célula de tabela editada direto no canvas: a célula É a fórmula da
    // coluna (generate.ts resolve a linha a partir de `content`), então o
    // vínculo tem de acompanhar. Sem isto o painel "ƒx" seguia mostrando a
    // fórmula antiga — dois valores pra mesma coisa, e o que aparecia no
    // painel não era o que ia sair no PDF. O caminho contrário (editar pelo
    // ƒx) já espelhava, em setColumnFormula.
    // `patch` é Partial<Schema> (união), e `content` não existe em
    // SectionSchema — o acesso precisa do estreitamento explícito.
    const nextContent = (patch as Partial<TableSchema>).content;
    if (before?.type === "table" && Array.isArray(nextContent)) {
      mirrorTableCellsToBinding(before, nextContent);
    }
  }

  // Renomear pela aba Campos (FieldList.tsx) — nome vazio ou já usado por
  // outro campo é ignorado (mesma regra de unicidade do "colar", ver
  // freshName/usedNames em useClipboardAndDelete.ts). Precisa remapear
  // `bindings` também — sem isso, um vínculo existente
  // ("Binding.schemaName") apontando pro nome antigo para de bater com o
  // schema renomeado (generate.ts resolve vínculo por nome) e
  // silenciosamente some do PDF gerado.
  function renameSchema(id: string, rawName: string) {
    const newName = rawName.trim();
    if (!newName) return;
    const all = schemas();
    const current = all.find((s) => s.id === id);
    if (!current || current.name === newName) return;
    if (all.some((s) => s.id !== id && s.name === newName)) return;
    const oldName = current.name;
    onChangeTemplate((prev) => ({
      ...prev,
      schemas: prev.schemas.map((s) => (s.id === id ? { ...s, name: newName } : s)),
    }));
    onChangeBindings((prev) => prev.map((b) => (b.schemaName === oldName ? { ...b, schemaName: newName } : b)));
  }

  // Mesmo patch em TODOS os ids de uma vez — usado só na edição em bloco
  // (ver BULK_EDIT_TYPES no Designer): mudar o estilo com vários campos do
  // MESMO tipo selecionados aplica em todos juntos, não só no último.
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
      const next = prev.schemas.slice();
      const [item] = next.splice(idx, 1);
      next.push(item);
      return { ...prev, schemas: next };
    });
  }

  function sendToBack(id: string) {
    onChangeTemplate((prev) => {
      const idx = prev.schemas.findIndex((s) => s.id === id);
      if (idx <= 0) return prev;
      const next = prev.schemas.slice();
      const [item] = next.splice(idx, 1);
      next.unshift(item);
      return { ...prev, schemas: next };
    });
  }

  // Posição de nascimento (centro do corpo, ou dentro da faixa vermelha
  // quando isolado) — ver computeSpawnPosition em helpers.ts. Devolve o
  // schema JÁ posicionado porque createSection precisa do nome dele pra
  // criar o vínculo na mesma ação.
  function addSchema(schema: Schema): Schema {
    const { template, isolateBands, gridSizeMm } = latest.current;
    const placed = computeSpawnPosition(template, schema, isolateBands, gridSizeMm);
    onChangeTemplate((prev) => ({ ...prev, schemas: [...prev.schemas, placed] }));
    setSelectedIds([placed.id]);
    return placed;
  }

  // "Vazia" (sourcePath undefined) ou já vinculada a uma fonte de dados
  // conhecida (dataSources) — nesse caso o binding "section" já nasce
  // pronto, sem precisar digitar o path no BindingEditor depois.
  //
  // Fechar o seletor de seção é decisão de QUEM CHAMA (o estado dele é
  // local da toolbar, não do editor).
  function createSection(sourcePath?: string) {
    const { t, gridSizeMm } = latest.current;
    const section = addSchema(makeSectionSchema(nextFreeY(schemas(), gridSizeMm), t)) as SectionSchema;
    if (sourcePath) {
      onChangeBindings((prev) => [...prev, { schemaName: section.name, type: "section", path: sourcePath }]);
    }
    return section;
  }

  // Soltar um "chip" de coluna (arrastado do PropertyPanel de uma seção
  // vinculada) no canvas — cria o par header+valor, já membros da seção.
  function dropSectionColumn(payload: SectionColumnDragPayload, xMm: number, yMm: number) {
    const { t } = latest.current;
    const { header, value, valueBinding } = makeSectionColumnPair(payload.sectionId, payload.column, xMm, yMm, t);
    onChangeTemplate((prev) => ({ ...prev, schemas: [...prev.schemas, header, value] }));
    onChangeBindings((prev) => [...prev, valueBinding]);
  }

  function removeSchema(id: string) {
    const schema = schemas().find((s) => s.id === id);
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
      const schema = schemas().find((s) => s.name === schemaName);
      const hadBindingBefore = latest.current.bindings.some((b) => b.schemaName === schemaName);
      if (schema && schema.type === "table" && !hadBindingBefore) {
        const newHead = binding.columns.map((c) => columnLabel(c));
        const newContent = [binding.columns.map((c) => (typeof c === "string" ? `{${c}}` : c.formula))];
        updateSchema(schema.id, { head: newHead, content: newContent, footer: undefined, columnStyles: undefined });
      }
    }
    setBinding(schemaName, binding);
  }

  // TODAS as funções de coluna abaixo (setTableHead/addTableColumn/
  // removeTableColumn/reorderTableColumn/setColumnStyle/setColumnFormula)
  // recalculam a TABELA de dentro do próprio callback funcional (nunca a
  // partir de um schema fechado no render) — 2 cliques em sequência rápida
  // (antes do 1º re-render acontecer) liam o MESMO schema desatualizado, e o
  // 2º clique sobrescrevia o array inteiro por cima do 1º (não só não via a
  // mudança do outro — APAGAVA ela). Foi exatamente como um "orgao" foi
  // parar no índice de "tarKandir": um clique de "+" usou uma cópia de
  // head/columns de ANTES do clique anterior aplicar, reescreveu o array
  // inteiro com base nela, e derrubou a adição alheia.
  //
  // updateSelectedTable centraliza o find/guard/map repetido (acha a tabela
  // selecionada dentro do `prev` funcional, confere que é mesmo type
  // "table", aplica o `mutator` recebido e substitui de volta no array) —
  // cada função só passa a lógica de coluna que muda, delegada pras funções
  // puras de src/table/columns.ts.
  // `mutator` pode devolver undefined pra "sem mudança" (ex: coluna
  // duplicada em addColumnToTable).
  function updateSelectedTable(mutator: (table: TableSchema) => TableSchema | null | undefined) {
    const { selectedId } = latest.current;
    if (!selectedId) return;
    onChangeTemplate((prev) => {
      const table = prev.schemas.find((s) => s.id === selectedId);
      if (!table || table.type !== "table") return prev;
      const newTable = mutator(table);
      if (!newTable) return prev;
      return { ...prev, schemas: prev.schemas.map((s) => (s.id === selectedId ? newTable : s)) };
    });
  }

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
  function setTableHead(newHead: string[]) {
    const table = selectedTable();
    if (!table) return;
    const schemaName = table.name;
    const oldHead = table.head;
    updateSelectedTable((t) => reindexTableForNewHead(t, newHead));
    onChangeBindings((prev) => {
      const existingBinding = prev.find((b) => b.schemaName === schemaName);
      if (existingBinding?.type !== "array") return prev;
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
    const table = selectedTable();
    if (!table) return;
    const schemaName = table.name;
    const columnType = findTableDataSource(table, schemas(), latest.current.bindings, latest.current.dataSources)?.columnTypes?.[column];
    const cell = buildColumnCell(column, columnType);
    updateSelectedTable((t) => addColumnToTable(t, column, cell));
    onChangeBindings((prev) => {
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
    const table = selectedTable();
    if (!table) return;
    const schemaName = table.name;
    let removedName: string | undefined;
    updateSelectedTable((t) => {
      const result = removeColumnFromTable(t, index);
      removedName = result.removedName;
      return result.table;
    });
    onChangeBindings((prev) => {
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
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    const table = selectedTable();
    if (!table) return;
    const schemaName = table.name;
    const headLength = table.head.length;
    updateSelectedTable((t) => reorderTableColumnPure(t, fromIndex, toIndex));
    onChangeBindings((prev) => {
      const existingBinding = prev.find((b) => b.schemaName === schemaName);
      if (existingBinding?.type !== "array") return prev;
      const columns = reorderArrayBindingColumns(existingBinding, headLength, fromIndex, toIndex);
      if (!columns) return prev;
      return prev.map((b) => (b === existingBinding ? { ...b, columns } : b));
    });
  }

  // Estilo (cor/fundo/tamanho) por coluna, header e valor — botão de
  // pincel na lista de colunas do painel. Mescla no índice, sem mexer
  // no resto (undefined num campo do patch limpa só aquele campo).
  function setColumnStyle(index: number, patch: Partial<TableColumnStyle>) {
    updateSelectedTable((t) => setColumnStylePure(t, index, patch));
  }

  // Largura de UMA coluna — input numérico do painel (arrastar a divisão
  // no canvas já grava `columnWidths` direto via onUpdateSchema genérico,
  // ver TableField.tsx). Mesmo padrão funcional de setColumnStyle acima.
  function setColumnWidth(index: number, widthMm: number | undefined) {
    updateSelectedTable((t) => setColumnWidthPure(t, index, widthMm));
  }

  // Fórmula de UMA coluna do vínculo "array" — botão "ƒx" na lista de
  // colunas do painel (só aparece pra tabela vinculada de verdade; sem
  // vínculo, o template já é editável direto na célula da tabela). Vazio
  // volta a ser coluna crua (só o nome); com texto, vira {label, formula}.
  function setColumnFormula(index: number, formula: string) {
    const table = selectedTable();
    if (!table) return;
    const schemaName = table.name;
    // content[i] é quem manda na hora de resolver a célula (ver generate.ts) —
    // sem espelhar aqui, o token bruto que já tava em content (ex: "{tarKandir}")
    // continua ganhando de qualquer fórmula nova salva só no binding, e a
    // edição pelo ƒx não tem efeito nenhum no PDF.
    //
    // A CÉLULA é recalculada de dentro do updater, a partir do `prev` — é ela
    // que decide o que sai no PDF, então não pode vir de snapshot.
    updateSelectedTable((t) => {
      const { cell } = computeColumnFormulaCell(formula, t.content[0]?.[index], t.head[index]);
      return applyColumnCellToTable(t, index, cell);
    });
    // `rawPath`/`headFallback` do lado do VÍNCULO ainda saem do snapshot: são
    // dois dispatches separados (template e bindings) e o updater de um não
    // pode ler o `prev` do outro. Mesma limitação de escrita pareada descrita
    // no comentário de abertura — o lado que decide o PDF é o de cima.
    const { rawPath } = computeColumnFormulaCell(formula, table.content[0]?.[index], table.head[index]);
    const headFallback = table.head[index];
    onChangeBindings((prev) => {
      const existingBinding = prev.find((b) => b.schemaName === schemaName);
      if (existingBinding?.type !== "array") return prev;
      const columns = setColumnFormulaOnArrayBinding(existingBinding, index, formula, rawPath, headFallback);
      return prev.map((b) => (b === existingBinding ? { ...b, columns } : b));
    });
  }

  function updatePageBand(patch: Partial<Pick<Template, "headerHeight" | "footerHeight" | "marginLeft" | "marginRight">>) {
    onChangeTemplate((prev) => ({ ...prev, ...patch }));
  }

  // Troca o tamanho/orientação da página — preserva a orientação atual ao
  // trocar de preset, e preserva o preset (largura/altura) ao só girar.
  function setPagePreset(presetName: string) {
    const preset = PAGE_SIZE_PRESETS.find((p) => p.name === presetName);
    if (!preset) return;
    // A orientação sai do `prev`, não de um snapshot: girar a página e trocar
    // o preset em sequência rápida liam a MESMA orientação velha e a segunda
    // ação desfazia a primeira.
    onChangeTemplate((prev) => ({ ...prev, page: applyOrientation(preset.size, orientationOf(prev.page)) }));
  }

  function setPageOrientation(orientation: "portrait" | "landscape") {
    onChangeTemplate((prev) => ({ ...prev, page: applyOrientation(prev.page, orientation) }));
  }

  // PNG data URI de fundo (letterhead). Escrita crua no template — o
  // caminho de "usuário escolheu um arquivo" é `handleBackgroundUpload`
  // abaixo, que lê/converte e reporta erro.
  function setBackgroundImage(backgroundImage: string | undefined) {
    onChangeTemplate((prev) => ({ ...prev, backgroundImage }));
  }

  // Modo isolado (só cabeçalho/rodapé/margem visíveis). Limpa a seleção
  // ANTES de virar a chave: os dois conjuntos de campo são disjuntos (ver
  // o filtro de fieldListSchemas), então manter a seleção deixaria o painel
  // de propriedades editando um campo que o canvas não mostra mais.
  function toggleIsolateBands() {
    latest.current.setSelectedIds([]);
    latest.current.setIsolateBands((v) => !v);
  }

  // Upload de imagem de fundo. Mutador, e não helper do componente, porque
  // o único caminho de sucesso dele é `setBackgroundImage` — e o de falha
  // precisa do dicionário, que já mora na ref.
  //
  // `e.target.value = ""` antes de qualquer await: sem isso, escolher o
  // MESMO arquivo de novo (depois de um erro, ou depois de remover o fundo)
  // não dispara `change`, e o upload "não responde".
  async function handleBackgroundUpload(e: { target: HTMLInputElement }) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const { t, setBackgroundUploadError } = latest.current;
    setBackgroundUploadError(null);
    try {
      setBackgroundImage(await fileToBackgroundImage(file));
    } catch (err) {
      // PDF corrompido ou canvas 2D indisponível fazem fileToBackgroundImage
      // rejeitar — sem isto a promise quebrava em silêncio (só console) e o
      // upload "sumia" sem o usuário entender por quê.
      setBackgroundUploadError(toErrorMessage(err, t.pageSettings.backgroundUploadError));
    }
  }

  return {
    updateSchema,
    updateSchemas,
    renameSchema,
    moveGroup,
    bringToFront,
    sendToBack,
    addSchema,
    createSection,
    dropSectionColumn,
    removeSchema,
    setBinding,
    handleChangeBinding,
    setTableHead,
    addTableColumn,
    removeTableColumn,
    reorderTableColumn,
    setColumnStyle,
    setColumnWidth,
    setColumnFormula,
    updatePageBand,
    setPagePreset,
    setPageOrientation,
    setBackgroundImage,
    toggleIsolateBands,
    handleBackgroundUpload,
  };
}
