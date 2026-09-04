import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Dict } from "../i18n";
import { uid } from "../schemaFactory";
import type { Binding, Schema, Template } from "../types";
import { uniqueSchemaName } from "./helpers";
import { GRID_SIZE_MM, snapToGrid } from "../page/units";

// Delete/copiar/colar do canvas — extraído de DesignerInner (Designer.tsx)
// pra um hook próprio. Fica num arquivo .ts (não .tsx) porque só exporta
// hook, nunca componente — um .tsx só pode exportar componente (regra
// oxlint react(only-export-components), quebra o Fast Refresh senão),
// mesmo motivo de src/bindings/builders.ts e src/canvas/geometry.ts.

// Onde um campo colado nasce: um passo de grade abaixo/à direita do
// original, travado dentro da página.
//
// Extraído do handler pra ser TESTÁVEL: o resto do hook são dois
// `useEffect` que registram listener de teclado, e exercitar isso exigiria
// jsdom (que a suíte inteira evita — ver test/components/ui/, que usa
// renderToStaticMarkup). A regra de posição é a parte que tem como estar
// errada, e agora ela é uma função pura.
export function pastePosition(
  s: Pick<Schema, "x" | "y" | "width" | "height">,
  page: { width: number; height: number },
  gridMm: number
): { x: number; y: number } {
  // Desloca +1 passo de grade (não +8mm cru — arrastar SEMPRE cai num
  // múltiplo de gridMm via snapToGrid; colar sem alinhar deixa fora da
  // grade até o usuário arrastar manual pra "recolocar no lugar"). Trava
  // dentro da página por cima — campo já encostado na borda (tabela larga
  // com x+width quase no fim) não sai do grid.
  //
  // Arredonda o limite pra BAIXO (não snapToGrid, que arredonda pro mais
  // próximo e podia estourar a página por até meio passo).
  const maxX = Math.floor(Math.max(0, page.width - s.width) / gridMm) * gridMm;
  const maxY = Math.floor(Math.max(0, page.height - s.height) / gridMm) * gridMm;
  return {
    x: Math.min(snapToGrid(s.x + gridMm, gridMm), maxX),
    y: Math.min(snapToGrid(s.y + gridMm, gridMm), maxY),
  };
}

export type UseClipboardAndDeleteParams = {
  template: Template;
  bindings: Binding[];
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  onChangeTemplate: Dispatch<SetStateAction<Template>>;
  onChangeBindings: Dispatch<SetStateAction<Binding[]>>;
  // Dicionário i18n (useT()) — só pro sufixo de nome do "colar"
  // (t.schemaDefaults.pasteSuffix).
  t: Dict;
  // Passo da grade, vindo da config do <Designer>. Opcional: sem ele o
  // colar usava GRID_SIZE_MM direto, então um consumidor com
  // `gridSizeMm={2}` tinha arrasto alinhado em 2mm e colagem em 5mm — o
  // campo colado nascia fora da grade dele.
  gridSizeMm?: number;
};

// Só registra os 2 listeners de teclado (delete e copiar/colar) — não
// devolve nada, os dois efeitos são auto-contidos (o clipboard em si é um
// useRef interno, nunca precisou vazar pra fora do componente original).
export function useClipboardAndDelete({
  template,
  bindings,
  selectedIds,
  setSelectedIds,
  onChangeTemplate,
  onChangeBindings,
  t,
  gridSizeMm = GRID_SIZE_MM,
}: UseClipboardAndDeleteParams): void {
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
  }, [selectedIds, template.schemas, onChangeTemplate, onChangeBindings, setSelectedIds]);

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
      const nameMap = new Map<string, string>();
      const pasted = clip.schemas.map((s) => {
        const newName = uniqueSchemaName(s.name, usedNames, t.schemaDefaults.pasteSuffix);
        nameMap.set(s.name, newName);
        return {
          ...s,
          id: idMap.get(s.id) as string,
          name: newName,
          ...pastePosition(s, template.page, gridSizeMm),
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
    // `template.page` inteiro, e não `.width`/`.height` separados: o handler
    // passa o objeto pra `pastePosition`. Não alarga nada de verdade — todo
    // caminho que muda a página (setPagePreset/setPageOrientation) troca o
    // objeto, então a identidade muda exatamente quando os valores mudam.
  }, [selectedIds, template.schemas, template.page, bindings, onChangeTemplate, onChangeBindings, t, setSelectedIds, gridSizeMm]);
}
