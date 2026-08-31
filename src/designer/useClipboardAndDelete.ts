import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Dict } from "../i18n";
import { uid } from "../schemaFactory";
import type { Binding, Schema, Template } from "../types";
import { uniqueSchemaName } from "./helpers";
import { GRID_SIZE_MM, snapToGrid } from "../units";

// Delete/copiar/colar do canvas — extraído de DesignerInner (Designer.tsx)
// pra um hook próprio. Fica num arquivo .ts (não .tsx) porque só exporta
// hook, nunca componente — um .tsx só pode exportar componente (regra
// oxlint react(only-export-components), quebra o Fast Refresh senão),
// mesmo motivo de src/bindingBuilders.ts e src/canvasGeometry.ts.

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
  }, [selectedIds, template.schemas, template.page.width, template.page.height, bindings, onChangeTemplate, onChangeBindings, t, setSelectedIds]);
}
