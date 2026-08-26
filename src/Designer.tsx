import { useEffect, useRef, useState } from "react";
import type {
  Binding,
  DataSourceColumnType,
  DataSourceOption,
  Schema,
  SectionColumnDragPayload,
  SectionSchema,
  TableColumnStyle,
  Template,
} from "./types";
import { makeChartSchema, makeImageSchema, makeKpiSchema, makeSectionColumnPair, makeSectionSchema, makeTableSchema, makeTextSchema, nextFreeY, uid } from "./schemaFactory";
import { columnLabel } from "./bindings/bindings";
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
} from "./tableColumns";
import { classifyZone, isRedZone } from "./zones";
import { GRID_SIZE_MM, snapToGrid } from "./units";
import { fileToBackgroundImage } from "./pdf/backgroundImage";
import { toErrorMessage } from "./errorUtils";
import { applyOrientation, matchPreset, orientationOf, PAGE_SIZE_PRESETS } from "./pageSizes";
import { PageCanvas } from "./components/PageCanvas";
import { PropertyPanel } from "./components/PropertyPanel";
import { FieldList } from "./components/FieldList";
import { Toolbar } from "./components/Toolbar";
import { Button, Card, Input, Select } from "./components/ui";
import { IconUpload } from "./components/ui/icons";

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
};

// Canvas do editor: página em mm, cada campo arrasta/redimensiona livre
// (react-rnd). Seleção abre o painel de propriedades — que já inclui o
// vínculo com o JSON, sem ponte nenhuma (tudo é React normal).
export default function Designer({ template, onChangeTemplate, bindings, onChangeBindings, onCanvasDrop, dataSources }: Props) {
  // Seleção múltipla (Ctrl/Cmd+clique) — o último clicado é o "principal"
  // (quem aparece no painel de propriedades); os demais só ganham
  // destaque no canvas e movem junto quando o principal é arrastado.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;

  function handleSelect(id: string | null, additive?: boolean) {
    if (id === null) {
      setSelectedIds([]);
      return;
    }
    if (!additive) {
      setSelectedIds([id]);
      return;
    }
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // Caixa de seleção (arrastar no fundo do canvas) — substitui a seleção
  // pelos ids que caíram dentro da caixa, ou soma (Ctrl/Cmd segurado).
  function handleSelectMany(ids: string[], additive?: boolean) {
    setSelectedIds((prev) => {
      if (!additive) return ids;
      const merged = new Set(prev);
      for (const id of ids) merged.add(id);
      return Array.from(merged);
    });
  }

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

  // Enquanto isolado, campo novo nasce dentro da primeira faixa vermelha
  // disponível (header > footer > margem esquerda > direita) em vez da
  // posição padrão no corpo — senão nasceria escondido. maxHeight/maxWidth
  // limita o tamanho padrão do schema (ex: tabela de 30mm) pra não
  // extrapolar a faixa e cair de volta pro corpo por conta própria altura.
  function bandSpawnPosition(): { x: number; y: number; maxHeight?: number; maxWidth?: number } | null {
    const { headerHeight = 0, footerHeight = 0, marginLeft = 0, marginRight = 0, page } = template;
    if (headerHeight > 2) return { x: marginLeft + 2, y: 2, maxHeight: headerHeight - 3 };
    if (footerHeight > 2) return { x: marginLeft + 2, y: page.height - footerHeight + 2, maxHeight: footerHeight - 3 };
    if (marginLeft > 2) return { x: 2, y: 2, maxWidth: marginLeft - 3 };
    if (marginRight > 2) return { x: page.width - marginRight + 2, y: 2, maxWidth: marginRight - 3 };
    return null;
  }

  function addSchema(schema: Schema): Schema {
    let placed = schema;
    if (isolateBands) {
      const spawn = bandSpawnPosition();
      if (spawn) {
        placed = { ...schema, x: spawn.x, y: spawn.y };
        if (spawn.maxHeight !== undefined) placed.height = Math.max(2, Math.min(placed.height, spawn.maxHeight));
        if (spawn.maxWidth !== undefined) placed.width = Math.max(5, Math.min(placed.width, spawn.maxWidth));
      }
    } else {
      // Nasce sempre no CENTRO da área do corpo — não empilha mais embaixo
      // do último campo. Empilhar dependia de nextFreeY olhar só campos já
      // classificados como "corpo" (classifyZone), mas essa classificação
      // é só GEOMÉTRICA: um campo de rodapé posicionado um pouco fora do
      // footerHeight configurado (ex: y menor que page.height-footerHeight)
      // conta como corpo por acidente, virava o novo "chão", e todo campo
      // novo nascia empilhado logo abaixo dele — inclusive fora da página,
      // cada "+" clicado empurrando mais pra baixo em sequência. Nascer no
      // centro elimina essa dependência: a posição do próximo campo não
      // depende mais de onde os outros campos (mal classificados ou não)
      // já estão.
      const { headerHeight = 0, footerHeight = 0, marginLeft = 0, marginRight = 0, page } = template;
      // Seção sempre nasce esticada de ponta a ponta (esquerda/direita,
      // respeitando margem) — só a altura fica livre pra ajustar depois.
      const isSection = schema.type === "section";
      const width = isSection ? Math.max(20, page.width - marginLeft - marginRight) : schema.width;
      const bodyTop = headerHeight;
      const bodyBottom = page.height - footerHeight;
      const x = isSection ? marginLeft : Math.max(marginLeft + 2, marginLeft + (page.width - marginLeft - marginRight - width) / 2);
      const y = Math.max(bodyTop + 2, bodyTop + (bodyBottom - bodyTop - schema.height) / 2);
      placed = { ...schema, x: snapToGrid(x), y: snapToGrid(y), width };
    }
    onChangeTemplate((prev) => ({ ...prev, schemas: [...prev.schemas, placed] }));
    setSelectedIds([placed.id]);
    return placed;
  }

  // "Vazia" (sourcePath undefined) ou já vinculada a uma fonte de dados
  // conhecida (dataSources) — nesse caso o binding "section" já nasce
  // pronto, sem precisar digitar o path no BindingEditor depois.
  function createSection(sourcePath?: string) {
    const section = addSchema(makeSectionSchema(nextFreeY(template.schemas))) as SectionSchema;
    if (sourcePath) {
      onChangeBindings((prev) => [...prev, { schemaName: section.name, type: "section", path: sourcePath }]);
    }
    setShowSectionPicker(false);
  }

  // Soltar um "chip" de coluna (arrastado do PropertyPanel de uma seção
  // vinculada) no canvas — cria o par header+valor, já membros da seção.
  function dropSectionColumn(payload: SectionColumnDragPayload, xMm: number, yMm: number) {
    const { header, value, valueBinding } = makeSectionColumnPair(payload.sectionId, payload.column, xMm, yMm);
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

  // Delete/Backspace apaga TODOS os campos selecionados — só quando o foco
  // não tá num input/textarea/select/contenteditable, senão comeria o
  // backspace/delete de digitação normal (nome do campo, edição inline etc).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (selectedIds.length === 0) return;
      const target = e.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isEditable) return;
      e.preventDefault();
      const removedIds = new Set(selectedIds);
      const removedNames = template.schemas.filter((s) => removedIds.has(s.id)).map((s) => s.name);
      onChangeTemplate((prev) => ({
        ...prev,
        schemas: prev.schemas
          .filter((s) => !removedIds.has(s.id))
          .map((s) => (s.sectionId && removedIds.has(s.sectionId) ? { ...s, sectionId: undefined } : s)),
      }));
      onChangeBindings((prev) => prev.filter((b) => !removedNames.includes(b.schemaName)));
      setSelectedIds([]);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedIds, template.schemas, onChangeTemplate, onChangeBindings]);

  // Copiar/colar (Ctrl+C / Ctrl+V) — clipboard próprio guardado num ref
  // (não usa o clipboard do sistema, sem pedir permissão de navegador).
  // Colar cria cópia com id/nome novos, deslocada (+8mm) da original, já
  // selecionada pra dar pra arrastar de cara. Campo membro de seção
  // mantém o MESMO sectionId da seção original (ela ainda existe, não foi
  // duplicada) — só remapeia pra seção nova quando ela TAMBÉM tava
  // selecionada no copiar (grupo copiado inteiro fica junto na cópia, sem
  // se juntar à seção antiga).
  const clipboardRef = useRef<{ schemas: Schema[]; bindings: Binding[] } | null>(null);
  useEffect(() => {
    function isEditable(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;
    }

    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (!mod || (key !== "c" && key !== "v")) return;
      if (isEditable(document.activeElement)) return;

      if (key === "c") {
        if (selectedIds.length === 0) return;
        e.preventDefault();
        const idSet = new Set(selectedIds);
        const schemas = template.schemas.filter((s) => idSet.has(s.id));
        if (schemas.length === 0) return;
        const names = new Set(schemas.map((s) => s.name));
        const copiedBindings = bindings.filter((b) => names.has(b.schemaName));
        clipboardRef.current = JSON.parse(JSON.stringify({ schemas, bindings: copiedBindings }));
        return;
      }

      const clip = clipboardRef.current;
      if (!clip || clip.schemas.length === 0) return;
      e.preventDefault();
      const idMap = new Map<string, string>();
      clip.schemas.forEach((s) => idMap.set(s.id, uid()));
      const usedNames = new Set(template.schemas.map((s) => s.name));
      function freshName(base: string): string {
        let candidate = `${base}_copia`;
        while (usedNames.has(candidate)) candidate = `${base}_copia_${Math.random().toString(36).slice(2, 5)}`;
        usedNames.add(candidate);
        return candidate;
      }
      const nameMap = new Map<string, string>();
      const pasted = clip.schemas.map((s) => {
        const newName = freshName(s.name);
        nameMap.set(s.name, newName);
        // Desloca +1 passo de grade (não +8mm cru — arrastar SEMPRE cai num
        // múltiplo de GRID_SIZE_MM via snapToGrid; colar sem alinhar deixa
        // fora da grade até o usuário arrastar manual pra "recolocar no
        // lugar"). Trava dentro da página por cima — campo já encostado na
        // borda (tabela larga com x+width quase no fim) não sai do grid.
        // Arredonda o limite pra BAIXO (não snapToGrid, que arredonda pro
        // mais próximo e podia estourar a página por até meio passo).
        const maxX = Math.floor(Math.max(0, template.page.width - s.width) / GRID_SIZE_MM) * GRID_SIZE_MM;
        const maxY = Math.floor(Math.max(0, template.page.height - s.height) / GRID_SIZE_MM) * GRID_SIZE_MM;
        return {
          ...s,
          id: idMap.get(s.id) as string,
          name: newName,
          x: Math.min(snapToGrid(s.x + GRID_SIZE_MM), maxX),
          y: Math.min(snapToGrid(s.y + GRID_SIZE_MM), maxY),
          sectionId: s.sectionId && idMap.has(s.sectionId) ? idMap.get(s.sectionId) : s.sectionId,
        };
      });
      const pastedBindings = clip.bindings
        .filter((b) => nameMap.has(b.schemaName))
        .map((b) => ({ ...b, schemaName: nameMap.get(b.schemaName) as string }));
      onChangeTemplate((prev) => ({ ...prev, schemas: [...prev.schemas, ...pasted] }));
      onChangeBindings((prev) => [...prev, ...pastedBindings]);
      setSelectedIds(pasted.map((s) => s.id));
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedIds, template.schemas, template.page.width, template.page.height, bindings, onChangeTemplate, onChangeBindings]);

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

  // Fonte de dados conhecida da tabela, pra mostrar a lista de colunas
  // disponíveis pra adicionar com "+" (ver PropertyPanel.tsx) — dois casos:
  // 1) Tabela membro de uma seção (sectionId) — puxa a MESMA fonte da
  //    seção dona dela.
  // 2) Tabela solta (ou com vínculo próprio) já vinculada (type "array")
  //    a um path que bate com um dataSources conhecido — usa as colunas
  //    dele direto, mesmo fora de seção.
  function findTableDataSource(
    schema: Schema | null
  ): { path: string; columns: string[]; columnTypes?: Record<string, DataSourceColumnType> } | undefined {
    if (!schema || schema.type !== "table") return undefined;
    if (schema.sectionId) {
      const section = template.schemas.find(
        (s): s is SectionSchema => s.id === schema.sectionId && s.type === "section"
      );
      const sectionBinding = section
        ? bindings.find(
            (b): b is Extract<Binding, { type: "section" }> => b.schemaName === section.name && b.type === "section"
          )
        : undefined;
      if (sectionBinding) {
        const source = dataSources?.find((d) => d.path === sectionBinding.path);
        if (source?.columns && source.columns.length > 0) {
          return { path: source.path, columns: source.columns, columnTypes: source.columnTypes };
        }
      }
    }
    const ownBinding = bindings.find(
      (b): b is Extract<Binding, { type: "array" }> => b.schemaName === schema.name && b.type === "array"
    );
    if (ownBinding) {
      const source = dataSources?.find((d) => d.path === ownBinding.path);
      if (source?.columns && source.columns.length > 0) {
        return { path: source.path, columns: source.columns, columnTypes: source.columnTypes };
      }
    }
    return undefined;
  }

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
  function setTableHead(newHead: string[]) {
    if (!selectedId) return;
    onChangeTemplate((prev) => {
      const table = prev.schemas.find((s) => s.id === selectedId);
      if (!table || table.type !== "table") return prev;
      const newTable = reindexTableForNewHead(table, newHead);
      return { ...prev, schemas: prev.schemas.map((s) => (s.id === selectedId ? newTable : s)) };
    });
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
    const columnType = findTableDataSource(selected)?.columnTypes?.[column];
    const cell = buildColumnCell(column, columnType);
    onChangeTemplate((prev) => {
      const table = prev.schemas.find((s) => s.id === selectedId);
      if (!table || table.type !== "table") return prev;
      const newTable = addColumnToTable(table, column, cell);
      if (!newTable) return prev;
      return { ...prev, schemas: prev.schemas.map((s) => (s.id === selectedId ? newTable : s)) };
    });
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
    onChangeTemplate((prev) => {
      const table = prev.schemas.find((s) => s.id === selectedId);
      if (!table || table.type !== "table") return prev;
      const result = removeColumnFromTable(table, index);
      removedName = result.removedName;
      return { ...prev, schemas: prev.schemas.map((s) => (s.id === selectedId ? result.table : s)) };
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
    onChangeTemplate((prev) => {
      const table = prev.schemas.find((s) => s.id === selectedId);
      if (!table || table.type !== "table") return prev;
      const newTable = reorderTableColumnPure(table, fromIndex, toIndex);
      return { ...prev, schemas: prev.schemas.map((s) => (s.id === selectedId ? newTable : s)) };
    });
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
    onChangeTemplate((prev) => {
      const table = prev.schemas.find((s) => s.id === selectedId);
      if (!table || table.type !== "table") return prev;
      const newTable = setColumnStylePure(table, index, patch);
      return { ...prev, schemas: prev.schemas.map((s) => (s.id === selectedId ? newTable : s)) };
    });
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
    onChangeTemplate((prev) => {
      const table = prev.schemas.find((s) => s.id === selectedId);
      if (!table || table.type !== "table") return prev;
      const newTable = applyColumnCellToTable(table, index, cell);
      return { ...prev, schemas: prev.schemas.map((s) => (s.id === selectedId ? newTable : s)) };
    });
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
      setBackgroundUploadError(toErrorMessage(err, "Não deu pra carregar esse arquivo como fundo."));
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
        />

        <Card className="flex w-72 flex-shrink-0 flex-col gap-3 p-3.5">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">Campos</h3>
            <div className="max-h-48 overflow-y-auto">
              <FieldList
                schemas={fieldListSchemas}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onRemove={removeSchema}
                onToggleLock={(id) => updateSchema(id, { locked: !template.schemas.find((s) => s.id === id)?.locked })}
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 dark:border-gray-700">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">Editar campo</h3>
            {selectedIds.length > 1 && (
              <p className="mb-2 text-[11px] text-sky-600 dark:text-blue-400">
                {selectedIds.length} campos selecionados — arraste o de baixo pra mover todos junto. Editando: {selected?.name}.
              </p>
            )}
            {selected ? (
              <PropertyPanel
                key={selected.id}
                schema={selected}
                binding={bindings.find((b) => b.schemaName === selected.name)}
                onChangeSchema={(patch) => updateSchema(selected.id, patch)}
                onChangeBinding={(b) => handleChangeBinding(selected.name, b)}
                onRemove={() => removeSchema(selected.id)}
                onBringToFront={() => bringToFront(selected.id)}
                onSendToBack={() => sendToBack(selected.id)}
                dataSources={dataSources}
                tableDataSource={findTableDataSource(selected)}
                onSetHeadList={setTableHead}
                onAddTableColumn={addTableColumn}
                onRemoveTableColumn={removeTableColumn}
                onReorderTableColumn={reorderTableColumn}
                onSetColumnStyle={setColumnStyle}
                onSetColumnFormula={setColumnFormula}
              />
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-slate-400 dark:text-gray-400">Selecione um campo na lista ou no canvas pra editar, ou adicione um novo:</p>
                <Toolbar
                  onAddText={() => addSchema(makeTextSchema(nextFreeY(template.schemas)))}
                  onAddTable={() => addSchema(makeTableSchema(nextFreeY(template.schemas)))}
                  onAddImage={() => addSchema(makeImageSchema(nextFreeY(template.schemas)))}
                  onAddSection={() => setShowSectionPicker(true)}
                  onAddChart={() => addSchema(makeChartSchema(nextFreeY(template.schemas)))}
                  onAddKpi={() => addSchema(makeKpiSchema(nextFreeY(template.schemas)))}
                />
                {showSectionPicker && (
                  <div className="flex flex-col gap-1.5 rounded-lg border border-purple-300 bg-purple-50/60 p-2.5 dark:border-purple-700 dark:bg-purple-900/30">
                    <p className="text-xs font-medium text-purple-800 dark:text-purple-300">Que tipo de seção?</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Button variant="outline" onClick={() => createSection()}>
                        Vazia (grupo livre)
                      </Button>
                      {(dataSources ?? []).map((d) => (
                        <Button key={d.path} variant="outline" onClick={() => createSection(d.path)}>
                          {d.label}
                        </Button>
                      ))}
                    </div>
                    {(!dataSources || dataSources.length === 0) && (
                      <p className="text-[10px] text-purple-600 dark:text-purple-400">Nenhuma fonte de dados (array) detectada no JSON ainda.</p>
                    )}
                    <Button variant="ghost" onClick={() => setShowSectionPicker(false)}>
                      Cancelar
                    </Button>
                  </div>
                )}
                <div className="flex flex-col gap-2 border-t border-slate-200 pt-2 dark:border-gray-700">
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      label="Tamanho da página"
                      value={matchPreset(template.page) ?? ""}
                      onChange={(e) => setPagePreset(e.target.value)}
                    >
                      {!matchPreset(template.page) && <option value="">Personalizado</option>}
                      {PAGE_SIZE_PRESETS.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.label}
                        </option>
                      ))}
                    </Select>
                    <Select
                      label="Orientação"
                      value={orientationOf(template.page)}
                      onChange={(e) => setPageOrientation(e.target.value as "portrait" | "landscape")}
                    >
                      <option value="portrait">Retrato</option>
                      <option value="landscape">Paisagem</option>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Cabeçalho (mm)"
                      type="number"
                      min={0}
                      value={template.headerHeight ?? 0}
                      onChange={(e) => updatePageBand({ headerHeight: Number(e.target.value) || 0 })}
                    />
                    <Input
                      label="Rodapé (mm)"
                      type="number"
                      min={0}
                      value={template.footerHeight ?? 0}
                      onChange={(e) => updatePageBand({ footerHeight: Number(e.target.value) || 0 })}
                    />
                    <Input
                      label="Margem esq. (mm)"
                      type="number"
                      min={0}
                      value={template.marginLeft ?? 0}
                      onChange={(e) => updatePageBand({ marginLeft: Number(e.target.value) || 0 })}
                    />
                    <Input
                      label="Margem dir. (mm)"
                      type="number"
                      min={0}
                      value={template.marginRight ?? 0}
                      onChange={(e) => updatePageBand({ marginRight: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-sky-600 px-2.5 py-1 text-xs font-medium text-sky-600 hover:bg-sky-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-400/10">
                    <IconUpload /> PDF/imagem de fundo
                    <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={handleBackgroundUpload} hidden />
                  </label>
                  {template.backgroundImage && (
                    <Button variant="ghost" onClick={() => onChangeTemplate((prev) => ({ ...prev, backgroundImage: undefined }))}>
                      remover fundo
                    </Button>
                  )}
                  {backgroundUploadError && <span className="text-xs text-red-600">{backgroundUploadError}</span>}
                  <Button
                    variant={isolateBands ? "primary" : "outline"}
                    onClick={toggleIsolateBands}
                    title="Mostra só os campos do cabeçalho/rodapé/margem, esconde o resto da página"
                  >
                    {isolateBands ? "Editando cabeçalho/rodapé/margem" : "Editar cabeçalho/rodapé/margem"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
