import { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import type { PageSize, Schema, SectionColumnDragPayload } from "../types";
import { SECTION_COLUMN_MIME } from "../schemaFactory";
import { GRID_SIZE_MM, mmToPx, pxToMm, snapToGrid } from "../units";
import { classifyZone, clampToZone, isRedZone } from "../zones";
import { FieldBox } from "./FieldBox";
import { Ruler } from "./Ruler";
import { IconArrowsHorizontal, IconArrowsVertical, IconDots, IconMinus, IconPlus } from "./ui/icons";

type Props = {
  page: PageSize;
  schemas: Schema[];
  // Faixas estáticas (mm) que se repetem em toda página do PDF gerado — a
  // paginação/repetição de verdade é responsabilidade do generate.ts; aqui
  // só marca a região em vermelho e trava os campos dentro dela (campo do
  // corpo não atravessa pra faixa vermelha, e vice-versa).
  headerHeight?: number;
  footerHeight?: number;
  marginLeft?: number;
  marginRight?: number;
  // Modo isolado: some com os campos do corpo, mostra só os da faixa
  // vermelha — pra editar cabeçalho/rodapé/margem sem o resto atrapalhar.
  isolateBands?: boolean;
  // PNG data URI de fundo (letterhead/modelo) — fica atrás dos campos
  // tanto aqui quanto no PDF gerado.
  backgroundImage?: string;
  // Todos os campos selecionados — o último da lista é o "principal"
  // (quem o PropertyPanel edita). Ctrl/Cmd+clique adiciona/remove da
  // seleção em vez de substituir.
  selectedIds: string[];
  onSelect: (id: string | null, additive?: boolean) => void;
  // Caixa de seleção (arrastar no fundo vazio do canvas) — substitui (ou
  // soma, com Ctrl/Cmd) a seleção pelos campos cuja caixa cruza a área
  // arrastada.
  onSelectMany?: (ids: string[], additive?: boolean) => void;
  onUpdateSchema: (id: string, patch: Partial<Schema>) => void;
  // Arrastar um campo que faz parte de uma seleção múltipla desloca os
  // outros selecionados junto, ao vivo (posição absoluta = original + delta
  // desde o início do arrasto, não incremental — ver drag snapshot abaixo).
  onMoveGroup?: (updates: Array<{ id: string; x: number; y: number }>) => void;
  onCanvasDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  // Soltar um "chip" de coluna (arrastado do PropertyPanel de uma seção
  // vinculada a um array com colunas conhecidas) — cria o par header+valor
  // na posição solta (ver PropertyPanel.tsx/schemaFactory.ts).
  onDropSectionColumn?: (payload: SectionColumnDragPayload, xMm: number, yMm: number) => void;
  // Tamanho (mm) da grade — desenha o quadriculado de fundo (igual o
  // Stimulsoft) e trava arrastar/redimensionar nesse passo. 0/negativo
  // desliga a grade (posição livre, sem quadriculado). Default 5mm.
  gridSizeMm?: number;
};

const RULER_THICKNESS = 16;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;
// Altura (mm) da barra "section-drag-handle" no topo da seção
// (FieldBox/SectionField.tsx, h-4 = 16px) — usada pra caixa de seleção só
// pegar a seção quando cruza
// essa faixa, não o corpo inteiro.
const SECTION_HEADER_HEIGHT_MM = pxToMm(16);

// A "folha" — tamanho real em mm convertido pra px, com sombra de papel.
// Cada campo é um <Rnd> (react-rnd) livre pra arrastar/redimensionar.
// Régua à esquerda/embaixo mostra o tamanho real em mm. Duplo clique num
// campo de texto/tabela liga edição inline (digita direto em cima do
// campo); em imagem, abre o seletor de arquivo pra trocar. Barra flutuante
// no rodapé controla o zoom da visualização (não afeta o PDF gerado).
export function PageCanvas({
  page,
  schemas,
  headerHeight = 0,
  footerHeight = 0,
  marginLeft = 0,
  marginRight = 0,
  isolateBands = false,
  backgroundImage,
  selectedIds,
  onSelect,
  onSelectMany,
  onUpdateSchema,
  onMoveGroup,
  onCanvasDrop,
  onDropSectionColumn,
  gridSizeMm = GRID_SIZE_MM,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const bands = { headerHeight, footerHeight, marginLeft, marginRight };
  const gridPx = gridSizeMm > 0 ? mmToPx(gridSizeMm) : 0;

  // Segurar Shift libera do quadriculado — posição/tamanho livre enquanto
  // durar o arrasto. react-draggable lê o prop de grade de novo a cada
  // frame do gesto (não só no início), então isso reage em tempo real —
  // já dá pra soltar o Shift no meio do arrasto que volta a travar.
  const [shiftHeld, setShiftHeld] = useState(false);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Shift") setShiftHeld(true);
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "Shift") setShiftHeld(false);
    }
    function onBlur() {
      setShiftHeld(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const dragResizeGrid: [number, number] | undefined = gridPx > 0 && !shiftHeld ? [gridPx, gridPx] : undefined;
  const visibleSchemas = isolateBands
    ? schemas.filter((s) => isRedZone(classifyZone(s, page, bands)))
    : schemas;

  // Posição (mm) de todo selecionado no instante em que o arrasto começou —
  // permite calcular a posição de cada um (original + delta total desde o
  // início) em vez de somar deltas incrementais, que divergiriam a cada
  // frame do onDrag. null = não tá arrastando um grupo agora.
  const dragSnapshotRef = useRef<Map<string, { x: number; y: number }> | null>(null);

  // Caixa de seleção: mousedown no fundo vazio começa a acompanhar o mouse
  // (janela toda, não só o canvas — senão soltar fora da folha perderia o
  // "mouseup"), desenha o retângulo, e no soltar seleciona quem cruzar.
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const suppressClickRef = useRef(false);

  function stopEditing() {
    setEditingId(null);
  }

  function handleBackgroundMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    // Fundo da página OU fundo de uma seção (classe "section-body") contam
    // como "vazio" pra começar a caixa — assim dá pra selecionar campos que
    // estão dentro/por cima de uma seção sem mover ela (só a barra do topo
    // arrasta a seção — ver dragHandleClassName). Campo de verdade (Rnd
    // próprio) nunca bate aqui, e a seção só entra na seleção resultante se
    // a caixa cruzar a faixa do header dela (ver hit-test abaixo).
    const targetEl = e.target as HTMLElement;
    const isEmptyArea = targetEl === e.currentTarget || targetEl.classList.contains("section-body");
    if (!isEmptyArea || !onSelectMany) return;
    const pageRect = e.currentTarget.getBoundingClientRect();
    const additive = e.ctrlKey || e.metaKey;
    const start = { x: e.clientX, y: e.clientY };
    let dragged = false;
    setMarqueeRect({ x: e.clientX - pageRect.left, y: e.clientY - pageRect.top, width: 0, height: 0 });

    function onMouseMove(ev: MouseEvent) {
      const x = Math.min(start.x, ev.clientX) - pageRect.left;
      const y = Math.min(start.y, ev.clientY) - pageRect.top;
      const width = Math.abs(ev.clientX - start.x);
      const height = Math.abs(ev.clientY - start.y);
      if (width > 3 || height > 3) dragged = true;
      setMarqueeRect({ x, y, width, height });
    }

    function onMouseUp(ev: MouseEvent) {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      setMarqueeRect(null);
      if (!dragged) return;
      suppressClickRef.current = true;
      const rectMm = {
        x1: pxToMm((Math.min(start.x, ev.clientX) - pageRect.left) / zoom),
        y1: pxToMm((Math.min(start.y, ev.clientY) - pageRect.top) / zoom),
        x2: pxToMm((Math.max(start.x, ev.clientX) - pageRect.left) / zoom),
        y2: pxToMm((Math.max(start.y, ev.clientY) - pageRect.top) / zoom),
      };
      // Seção só entra na seleção se a caixa cruzar a faixa do HEADER dela
      // (mesma altura da barra "section-drag-handle") — cruzar só o corpo
      // (onde os campos membros ficam desenhados) nunca seleciona a seção,
      // só os campos que estiverem por baixo da caixa.
      const hit = visibleSchemas
        .filter((s) => {
          const testHeight = s.type === "section" ? Math.min(s.height, SECTION_HEADER_HEIGHT_MM) : s.height;
          return s.x < rectMm.x2 && s.x + s.width > rectMm.x1 && s.y < rectMm.y2 && s.y + testHeight > rectMm.y1;
        })
        .map((s) => s.id);
      onSelectMany?.(hit, additive);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    const raw = e.dataTransfer.getData(SECTION_COLUMN_MIME);
    if (raw && onDropSectionColumn) {
      e.preventDefault();
      const payload = JSON.parse(raw) as SectionColumnDragPayload;
      const rect = e.currentTarget.getBoundingClientRect();
      const rawXMm = pxToMm((e.clientX - rect.left) / zoom);
      const rawYMm = pxToMm((e.clientY - rect.top) / zoom);
      // Segurando Shift ao soltar = posição livre, sem cair na grade.
      const xMm = e.shiftKey ? rawXMm : snapToGrid(rawXMm, gridSizeMm);
      const yMm = e.shiftKey ? rawYMm : snapToGrid(rawYMm, gridSizeMm);
      onDropSectionColumn(payload, xMm, yMm);
      return;
    }
    onCanvasDrop?.(e);
  }

  // Centro do campo caindo dentro do retângulo de uma seção = vira membro
  // dela (sectionId) — fora de qualquer seção = limpa o vínculo de grupo.
  function findSectionAt(x: number, y: number, width: number, height: number, excludeId: string) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    return schemas.find(
      (s) => s.id !== excludeId && s.type === "section" && cx >= s.x && cx <= s.x + s.width && cy >= s.y && cy <= s.y + s.height
    );
  }

  function clampZoom(z: number) {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  }

  function fitTo(dimension: "width" | "height", origin: HTMLElement | null) {
    const viewport = origin?.closest<HTMLElement>('[data-scroll-root], [class*="overflow-auto"], [class*="overflow-y-auto"]');
    const pageSizePx = dimension === "width" ? mmToPx(page.width) : mmToPx(page.height);
    const available = dimension === "width" ? (viewport?.clientWidth ?? window.innerWidth) : (viewport?.clientHeight ?? window.innerHeight);
    setZoom(clampZoom((available - RULER_THICKNESS - 32) / pageSizePx));
  }

  const contentWidth = RULER_THICKNESS + mmToPx(page.width);
  const contentHeight = mmToPx(page.height) + RULER_THICKNESS;

  return (
    <div style={{ position: "relative", width: contentWidth * zoom, height: contentHeight * zoom + 56 }}>
      <div style={{ width: contentWidth, height: contentHeight, transform: `scale(${zoom})`, transformOrigin: "top left" }}>
        <div className="flex">
          <Ruler orientation="vertical" lengthMm={page.height} thickness={RULER_THICKNESS} />
          <div
            className="bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1),0_8px_24px_rgba(15,23,42,0.08)]"
            // position:relative inline (não via classe Tailwind) — o Tailwind
            // do app consumidor só escaneia o próprio src dele, não o código
            // desta lib; "relative" nunca era gerado, então os campos (Rnd,
            // position:absolute) perdiam o ancestral posicionado certo e
            // ficavam presos na tela ao rolar em vez de rolar com a página.
            style={{ position: "relative", width: mmToPx(page.width), height: mmToPx(page.height) }}
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              onSelect(null);
              stopEditing();
            }}
            onMouseDown={handleBackgroundMouseDown}
            onDrop={handleDrop}
            onDragOver={onCanvasDrop || onDropSectionColumn ? (e) => e.preventDefault() : undefined}
          >
            {marqueeRect && (
              <div
                className="pointer-events-none absolute z-20 border border-sky-500 bg-sky-500/10"
                style={{ left: marqueeRect.x, top: marqueeRect.y, width: marqueeRect.width, height: marqueeRect.height }}
              />
            )}
            {backgroundImage && (
              // eslint-disable-next-line jsx-a11y/alt-text
              <img
                src={backgroundImage}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
            )}
            {gridPx > 0 && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(100,116,139,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,0.18) 1px, transparent 1px)",
                  backgroundSize: `${gridPx}px ${gridPx}px`,
                }}
              />
            )}
            {headerHeight > 0 && (
              <div
                className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden border-b border-dashed border-red-400 bg-red-500/15"
                style={{ height: mmToPx(headerHeight) }}
              >
                <span className="absolute left-1 top-0.5 rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-medium text-white">
                  Cabeçalho — repete em toda página
                </span>
              </div>
            )}
            {footerHeight > 0 && (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden border-t border-dashed border-red-400 bg-red-500/15"
                style={{ height: mmToPx(footerHeight) }}
              >
                <span className="absolute left-1 top-0.5 rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-medium text-white">
                  Rodapé — repete em toda página
                </span>
              </div>
            )}
            {marginLeft > 0 && (
              <div
                className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden border-r border-dashed border-red-400 bg-red-500/15"
                style={{ width: mmToPx(marginLeft) }}
              >
                <span
                  className="absolute left-0.5 top-1 whitespace-nowrap rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-medium text-white"
                  style={{ transform: "rotate(90deg)", transformOrigin: "left top" }}
                >
                  Margem esquerda
                </span>
              </div>
            )}
            {marginRight > 0 && (
              <div
                className="pointer-events-none absolute inset-y-0 right-0 overflow-hidden border-l border-dashed border-red-400 bg-red-500/15"
                style={{ width: mmToPx(marginRight) }}
              >
                <span
                  className="absolute right-0.5 top-1 whitespace-nowrap rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-medium text-white"
                  style={{ transform: "rotate(90deg)", transformOrigin: "right top" }}
                >
                  Margem direita
                </span>
              </div>
            )}
            {isolateBands && (
              <div
                className="pointer-events-none absolute bg-slate-900/10"
                style={{
                  left: mmToPx(marginLeft),
                  top: mmToPx(headerHeight),
                  width: mmToPx(page.width - marginLeft - marginRight),
                  height: mmToPx(page.height - headerHeight - footerHeight),
                }}
              />
            )}

            {visibleSchemas.map((schema) => {
              const isEditing = editingId === schema.id;
              const zone = classifyZone(schema, page, bands);
              // Fora do modo isolado, um campo do cabeçalho/rodapé/margem
              // aparece (contexto visual) mas fica travado — só editável
              // de verdade ligando "Editar cabeçalho/rodapé/margem" (e
              // vice-versa: campo do corpo trava enquanto isolado). Mesmo
              // tratamento visual/funcional do cadeado manual.
              const inWrongMode = isolateBands ? zone === "body" : isRedZone(zone);
              const isLocked = schema.locked || inWrongMode;
              return (
                <Rnd
                  key={schema.id}
                  size={{ width: mmToPx(schema.width), height: mmToPx(schema.height) }}
                  position={{ x: mmToPx(schema.x), y: mmToPx(schema.y) }}
                  bounds="parent"
                  // A folha inteira vive dentro de um transform:scale(zoom) —
                  // sem avisar o react-rnd disso, ele lê o delta do mouse em
                  // px de TELA e soma direto na posição (que é px SEM escala,
                  // 1:1 com mm), então arrastar/redimensionar em qualquer
                  // zoom != 100% desloca o dobro/metade do esperado e o
                  // campo "foge" do cursor durante o gesto.
                  scale={zoom}
                  disableDragging={isEditing || isLocked}
                  enableResizing={!isEditing && !isLocked}
                  dragGrid={dragResizeGrid}
                  resizeGrid={dragResizeGrid}
                  dragHandleClassName={schema.type === "section" ? "section-drag-handle" : undefined}
                  onDragStart={() => {
                    if (!onMoveGroup) return;
                    // Seção sempre arrasta os membros dela junto (sectionId),
                    // além do grupo de seleção múltipla, se houver.
                    const idsToTrack = new Set<string>([schema.id]);
                    if (schema.type === "section") {
                      for (const s of schemas) {
                        if (s.sectionId === schema.id) idsToTrack.add(s.id);
                      }
                    }
                    if (selectedIds.length > 1 && selectedIds.includes(schema.id)) {
                      for (const id of selectedIds) idsToTrack.add(id);
                    }
                    if (idsToTrack.size <= 1) return;
                    const snapshot = new Map<string, { x: number; y: number }>();
                    for (const id of idsToTrack) {
                      const s = schemas.find((x) => x.id === id);
                      if (s) snapshot.set(id, { x: s.x, y: s.y });
                    }
                    dragSnapshotRef.current = snapshot;
                  }}
                  onDrag={(_e, d) => {
                    const snapshot = dragSnapshotRef.current;
                    if (!snapshot || !onMoveGroup) return;
                    const original = snapshot.get(schema.id);
                    if (!original) return;
                    const deltaX = pxToMm(d.x) - original.x;
                    const deltaY = pxToMm(d.y) - original.y;
                    const updates = Array.from(snapshot.entries())
                      .filter(([id]) => id !== schema.id)
                      .map(([id, pos]) => ({ id, x: pos.x + deltaX, y: pos.y + deltaY }));
                    if (updates.length > 0) onMoveGroup(updates);
                  }}
                  onDragStop={(_e, d) => {
                    // dragGrid do react-rnd só trava o PASSO do arrasto (delta
                    // relativo ao ponto onde o gesto começou) — um campo que
                    // nasceu fora da grade (posicionado com Shift) continua
                    // fora dela pra sempre, só marchando em passos de 5mm a
                    // partir do offset torto. Sem Shift AGORA, o esperado é
                    // voltar pra grade de verdade (múltiplo absoluto), não só
                    // manter o deslocamento original.
                    const rawX = pxToMm(d.x);
                    const rawY = pxToMm(d.y);
                    const snappedX = shiftHeld ? rawX : snapToGrid(rawX, gridSizeMm);
                    const snappedY = shiftHeld ? rawY : snapToGrid(rawY, gridSizeMm);
                    const clamped = clampToZone(zone, snappedX, snappedY, schema.width, schema.height, page, bands);
                    if (schema.type === "text" || schema.type === "image" || schema.type === "table") {
                      const target = findSectionAt(clamped.x, clamped.y, schema.width, schema.height, schema.id);
                      onUpdateSchema(schema.id, { ...clamped, sectionId: target?.id });
                    } else {
                      onUpdateSchema(schema.id, clamped);
                    }
                    const snapshot = dragSnapshotRef.current;
                    if (snapshot && onMoveGroup) {
                      const original = snapshot.get(schema.id);
                      if (original) {
                        const deltaX = clamped.x - original.x;
                        const deltaY = clamped.y - original.y;
                        const updates = Array.from(snapshot.entries())
                          .filter(([id]) => id !== schema.id)
                          .map(([id, pos]) => ({ id, x: pos.x + deltaX, y: pos.y + deltaY }));
                        if (updates.length > 0) onMoveGroup(updates);
                      }
                    }
                    dragSnapshotRef.current = null;
                  }}
                  onResizeStop={(_e, _dir, ref, _delta, pos) => {
                    // Mesmo raciocínio do onDragStop: sem Shift, largura/altura
                    // e posição final voltam pro múltiplo absoluto da grade,
                    // mesmo que o campo tenha nascido/ficado torto antes.
                    const rawWidth = pxToMm(ref.offsetWidth);
                    const rawHeight = pxToMm(ref.offsetHeight);
                    const width = shiftHeld ? rawWidth : snapToGrid(rawWidth, gridSizeMm);
                    const height = shiftHeld ? rawHeight : snapToGrid(rawHeight, gridSizeMm);
                    const rawX = pxToMm(pos.x);
                    const rawY = pxToMm(pos.y);
                    const snappedX = shiftHeld ? rawX : snapToGrid(rawX, gridSizeMm);
                    const snappedY = shiftHeld ? rawY : snapToGrid(rawY, gridSizeMm);
                    const clamped = clampToZone(zone, snappedX, snappedY, width, height, page, bands);
                    onUpdateSchema(schema.id, { width, height, ...clamped });
                  }}
                  onClick={(e: { stopPropagation: () => void; ctrlKey: boolean; metaKey: boolean }) => {
                    e.stopPropagation();
                    // Clique "fantasma" que o navegador dispara logo depois
                    // de soltar uma caixa de seleção iniciada em cima deste
                    // campo (ex: fundo de uma seção) — sem isso, esse clique
                    // trocaria a seleção que a caixa acabou de montar.
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false;
                      return;
                    }
                    if (inWrongMode) return;
                    onSelect(schema.id, e.ctrlKey || e.metaKey);
                  }}
                  onDoubleClick={(e: { stopPropagation: () => void }) => {
                    e.stopPropagation();
                    if (inWrongMode) return;
                    onSelect(schema.id);
                    if (schema.type !== "image" && schema.type !== "section") {
                      setEditingId(schema.id);
                    }
                  }}
                  className="transition-shadow"
                  style={{
                    border: selectedIds.includes(schema.id) ? "2px solid #0284c7" : isLocked ? "1px dashed #f59e0b" : "1px dashed #cbd5e1",
                    boxShadow: selectedIds.includes(schema.id) ? "0 0 0 3px rgba(2,132,199,0.15)" : undefined,
                    boxSizing: "border-box",
                    opacity: inWrongMode ? 0.55 : 1,
                    cursor: isEditing ? "text" : isLocked ? "not-allowed" : undefined,
                  }}
                >
                  <FieldBox
                    schema={schema}
                    editing={isEditing}
                    onUpdate={(patch) => onUpdateSchema(schema.id, patch)}
                    onStopEditing={stopEditing}
                  />
                </Rnd>
              );
            })}
          </div>
        </div>
        <div className="flex">
          <div style={{ width: RULER_THICKNESS, flexShrink: 0 }} />
          <Ruler orientation="horizontal" lengthMm={page.width} thickness={RULER_THICKNESS} />
        </div>
      </div>

      <div
        className="pointer-events-auto sticky bottom-4 left-0 mt-4 flex w-fit items-center gap-1 rounded-full bg-slate-800/90 px-2 py-1.5 text-white shadow-lg backdrop-blur"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Diminuir zoom"
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10"
          onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
        >
          <IconMinus />
        </button>
        <span className="w-10 text-center text-xs font-medium tabular-nums">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          aria-label="Aumentar zoom"
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10"
          onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
        >
          <IconPlus />
        </button>
        <div className="mx-1 h-4 w-px bg-white/20" />
        <button
          type="button"
          aria-label="Ajustar à largura"
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10"
          onClick={(e) => fitTo("width", e.currentTarget)}
        >
          <IconArrowsHorizontal />
        </button>
        <button
          type="button"
          aria-label="Ajustar à altura"
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10"
          onClick={(e) => fitTo("height", e.currentTarget)}
        >
          <IconArrowsVertical />
        </button>
        <div className="mx-1 h-4 w-px bg-white/20" />
        <button
          type="button"
          aria-label="Redefinir zoom"
          title="Redefinir zoom (100%)"
          className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10"
          onClick={() => setZoom(1)}
        >
          <IconDots />
        </button>
      </div>
    </div>
  );
}
