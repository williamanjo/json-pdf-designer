import { useCallback, useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import type { KpiElementKey, PageSize, Schema, SectionColumnDragPayload } from "../types";
import { clampZoom, ZOOM_FIT_INSET_PX, ZOOM_STEP } from "../canvas/zoomScale";
import { findSectionAt, schemasInRect } from "../canvas/geometry";
import { SECTION_COLUMN_MIME } from "../schemaFactory";
import { GRID_SIZE_MM, mmToPx, pxToMm, snapToGrid } from "../page/units";
import { classifyZone, clampToZone, isRedZone } from "../page/zones";
import { useT } from "../i18n";
import { FieldBox } from "./FieldBox";
import { Ruler } from "./Ruler";
import { IconArrowsHorizontal, IconArrowsVertical, IconDots, IconMinus, IconPlus } from "./ui/icons";

type Props = {
  page: PageSize;
  schemas: Schema[];
  // Static bands (mm) that repeat on every page of the generated PDF — the
  // real pagination/repetition is generate.ts's responsibility; here it only
  // marks the region in red and locks the fields inside it (a body field does
  // not cross into the red band, and vice versa).
  headerHeight?: number;
  footerHeight?: number;
  marginLeft?: number;
  marginRight?: number;
  // Isolated mode: it removes the body's fields and shows only those of the
  // red band — to edit the header/footer/margin without the rest getting in the way.
  isolateBands?: boolean;
  // The background PNG data URI (letterhead/form) — it sits behind the fields
  // both here and in the generated PDF.
  backgroundImage?: string;
  // Every selected field — the last of the list is the "primary" one (the one
  // the PropertyPanel edits). Ctrl/Cmd+click adds to/removes from the
  // selection instead of replacing it.
  selectedIds: string[];
  onSelect: (id: string | null, additive?: boolean) => void;
  // The marquee (dragging on the canvas's empty background) — it replaces (or
  // adds to, with Ctrl/Cmd) the selection with the fields whose box crosses
  // the dragged area.
  onSelectMany?: (ids: string[], additive?: boolean) => void;
  onUpdateSchema: (id: string, patch: Partial<Schema>) => void;
  // Dragging a field that is part of a multiple selection shifts the other
  // selected ones along with it, live (an absolute position = original +
  // delta since the start of the drag, not incremental — see the drag snapshot).
  onMoveGroup?: (updates: Array<{ id: string; x: number; y: number }>) => void;
  onCanvasDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  // Dropping a column "chip" (dragged from the PropertyPanel of a section
  // bound to an array with known columns) — it creates the header+value pair
  // at the dropped position (see PropertyPanel.tsx/schemaFactory.ts).
  onDropSectionColumn?: (payload: SectionColumnDragPayload, xMm: number, yMm: number) => void;
  // The grid's size (mm) — it draws the background grid and snaps
  // dragging/resizing to that step. 0/negative turns the grid off (free
  // positioning, no grid). Default 5mm.
  gridSizeMm?: number;
  // The focused KPI sub-element (icon/title/value/subtitle) and the selection
  // — see KpiField.tsx/Designer.tsx. It only has an effect on "kpi" fields.
  selectedKpiElement?: KpiElementKey | null;
  onSelectKpiElement?: (el: KpiElementKey) => void;
  // CONTROLLED ZOOM, optional. Omitted, the component stays the owner of its
  // own zoom (internal state) — which is what the headless path uses, and is
  // the long-standing behavior.
  //
  // Passed, the value comes from outside and every change leaves through
  // `onChangeZoom`. That is how the `<DesignerCanvas>` wires the zoom to the
  // provider's context without this component knowing a provider exists.
  zoom?: number;
  onChangeZoom?: (zoom: number) => void;
  // Hides the floating zoom bar, for whoever draws their own elsewhere on
  // screen. The zoom keeps working — only the default control goes away.
  hideZoombar?: boolean;
};

const RULER_THICKNESS = 16;

// The "sheet" — the real size in mm converted to px, with a paper shadow.
// Each field is an <Rnd> (react-rnd) free to drag/resize. A ruler on the
// left/bottom shows the real size in mm. A double click on a text/table field
// turns on inline editing (typing right on top of the field); on an image, it
// opens the file picker to swap it. A floating bar at the bottom controls the
// view's zoom (it does not affect the generated PDF).
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
  selectedKpiElement = null,
  onSelectKpiElement,
  zoom: zoomProp,
  onChangeZoom,
  hideZoombar = false,
}: Props) {
  const t = useT();
  const [editingId, setEditingId] = useState<string | null>(null);

  // Controlled or not, decided by the PRESENCE of the prop — the usual React
  // pattern. The internal state keeps existing in both cases because
  // switching from one to the other mid-life is not a case worth supporting:
  // a defined `zoomProp` rules, full stop.
  const [zoomInterno, setZoomInterno] = useState(1);
  const controlado = zoomProp !== undefined;
  const zoom = controlado ? clampZoom(zoomProp) : zoomInterno;

  // It accepts a value OR an updater, like `setState`, because the buttons
  // here use the updater form (`z => z - STEP`) and it must not depend on a
  // stale closure over `zoom`.
  const setZoom = useCallback(
    (proximo: number | ((anterior: number) => number)) => {
      if (controlado) {
        // In controlled mode the value's owner is the caller; we resolve the
        // updater against the prop's CURRENT value and report it.
        const resolvido = typeof proximo === "function" ? proximo(clampZoom(zoomProp)) : proximo;
        onChangeZoom?.(clampZoom(resolvido));
        return;
      }
      setZoomInterno((anterior) => clampZoom(typeof proximo === "function" ? proximo(anterior) : proximo));
    },
    [controlado, zoomProp, onChangeZoom]
  );
  const bands = { headerHeight, footerHeight, marginLeft, marginRight };
  const gridPx = gridSizeMm > 0 ? mmToPx(gridSizeMm) : 0;

  // Holding Shift frees it from the grid — free position/size for as long as
  // the drag lasts. react-draggable reads the grid prop again on every frame
  // of the gesture (not only at the start), so this reacts in real time —
  // releasing Shift mid-drag already snaps it back.
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

  // The position (mm) of everything selected at the instant the drag started —
  // it allows computing each one's position (original + the total delta since
  // the start) instead of summing incremental deltas, which would diverge on
  // every onDrag frame. null = not dragging a group right now.
  const dragSnapshotRef = useRef<Map<string, { x: number; y: number }> | null>(null);

  // The marquee: a mousedown on the empty background starts following the
  // mouse (the whole window, not only the canvas — otherwise releasing
  // outside the sheet would lose the "mouseup"), draws the rectangle, and on
  // release selects whoever it crosses.
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const suppressClickRef = useRef(false);

  function stopEditing() {
    setEditingId(null);
  }

  function handleBackgroundMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    // The page background OR a section's background (the "jpd-section__body"
    // class) count as "empty" for starting the marquee — that way fields that
    // are inside/on top of a section can be selected without moving it (only
    // the top bar drags the section — see dragHandleClassName). A real field
    // (an <Rnd> of its own) never matches here, and the section only enters the
    // resulting selection if the box crosses its header band (see the hit-test).
    //
    // This class is a CONTRACT with FieldBox/SectionField.tsx, read by JS and
    // not only by CSS: renaming it there without renaming it here silently
    const targetEl = e.target as HTMLElement;
    const isEmptyArea = targetEl === e.currentTarget || targetEl.classList.contains("jpd-section__body");
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
      const hit = schemasInRect(visibleSchemas, rectMm).map((s) => s.id);
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
      // Holding Shift on release = free position, without snapping to the grid.
      const xMm = e.shiftKey ? rawXMm : snapToGrid(rawXMm, gridSizeMm);
      const yMm = e.shiftKey ? rawYMm : snapToGrid(rawYMm, gridSizeMm);
      onDropSectionColumn(payload, xMm, yMm);
      return;
    }
    onCanvasDrop?.(e);
  }

  function fitTo(dimension: "width" | "height", origin: HTMLElement | null) {
    const viewport = origin?.closest<HTMLElement>('[data-scroll-root], [class*="overflow-auto"], [class*="overflow-y-auto"]');
    const pageSizePx = dimension === "width" ? mmToPx(page.width) : mmToPx(page.height);
    const available = dimension === "width" ? (viewport?.clientWidth ?? window.innerWidth) : (viewport?.clientHeight ?? window.innerHeight);
    setZoom(clampZoom((available - ZOOM_FIT_INSET_PX) / pageSizePx));
  }

  const contentWidth = RULER_THICKNESS + mmToPx(page.width);
  const contentHeight = mmToPx(page.height) + RULER_THICKNESS;

  return (
    <div className="jpd-canvas" style={{ width: contentWidth * zoom, height: contentHeight * zoom + 56 }}>
      <div className="jpd-canvas__zoom" style={{ width: contentWidth, height: contentHeight, transform: `scale(${zoom})` }}>
        <div className="jpd-canvas__row">
          <Ruler orientation="vertical" lengthMm={page.height} thickness={RULER_THICKNESS} />
          <div
            className="jpd-page"
            // position:relative continua INLINE (não vai pro .jpd-page do
            // theme.css) de propósito: é o contrato de posicionamento do
            // react-rnd. Os campos são Rnd (position:absolute) e precisam
            // deste ancestral posicionado; uma regra de folha de estilo pode
            // ser sobrescrita pelo consumidor (a @layer perde de qualquer CSS
            // sem layer), e aí os campos ficariam presos na tela ao rolar em
            // vez de rolar com a página. Inline nenhum CSS de consumidor
            // desliga sem `!important`.
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
                className="jpd-marquee"
                style={{ left: marqueeRect.x, top: marqueeRect.y, width: marqueeRect.width, height: marqueeRect.height }}
              />
            )}
            {backgroundImage && (
              // eslint-disable-next-line jsx-a11y/alt-text
              <img src={backgroundImage} alt="" className="jpd-page__bg" />
            )}
            {gridPx > 0 && (
              // Só o PASSO da grade fica inline (vem de gridSizeMm); os dois
              // gradientes são literal fixo e moraram pro CSS.
              <div className="jpd-grid-overlay" style={{ backgroundSize: `${gridPx}px ${gridPx}px` }} />
            )}
            {headerHeight > 0 && (
              <div className="jpd-band" data-band="header" style={{ height: mmToPx(headerHeight) }}>
                <span className="jpd-band__label" data-band="header">
                  {t.pageCanvas.headerBand}
                </span>
              </div>
            )}
            {footerHeight > 0 && (
              <div className="jpd-band" data-band="footer" style={{ height: mmToPx(footerHeight) }}>
                <span className="jpd-band__label" data-band="footer">
                  {t.pageCanvas.footerBand}
                </span>
              </div>
            )}
            {marginLeft > 0 && (
              <div className="jpd-band" data-band="left" style={{ width: mmToPx(marginLeft) }}>
                <span className="jpd-band__label" data-band="left">
                  {t.pageCanvas.marginLeftBand}
                </span>
              </div>
            )}
            {marginRight > 0 && (
              <div className="jpd-band" data-band="right" style={{ width: mmToPx(marginRight) }}>
                <span className="jpd-band__label" data-band="right">
                  {t.pageCanvas.marginRightBand}
                </span>
              </div>
            )}
            {isolateBands && (
              <div
                className="jpd-page__dim"
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
                  // Contrato com FieldBox/SectionField.tsx: o react-rnd monta
                  // um seletor `.<classe>` e casa no DOM por conta própria, então
                  // a string tem de ser IGUAL à className escrita lá.
                  dragHandleClassName={schema.type === "section" ? "jpd-section__handle" : undefined}
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
                    // react-rnd dispara onDragStop mesmo num clique sem
                    // arrastar (mousedown+mouseup no mesmo lugar conta como
                    // "drag" de 0px) — sem esse corte, um campo que nasceu
                    // fora da grade (colado ou com Shift) voltava pra grade
                    // sozinho só por ter sido CLICADO/selecionado, sem o
                    // usuário ter arrastado nada.
                    if (Math.abs(pxToMm(d.x) - schema.x) < 0.01 && Math.abs(pxToMm(d.y) - schema.y) < 0.01) {
                      dragSnapshotRef.current = null;
                      return;
                    }
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
                      const target = findSectionAt(schemas, clamped.x, clamped.y, schema.width, schema.height, schema.id);
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
                  // `className` e `data-*` desconhecidos do <Rnd> chegam no
                  // div renderizado: o Rnd só extrai a lista de props que
                  // conhece e repassa o resto pro <Resizable>, que passa o
                  // `className` direto e espalha todo prop fora da lista dele
                  // (os `data-*` inclusive) no nó. Verificado no
                  // react-rnd/lib/index.js e re-resizable/lib/index.js.
                  className="jpd-field"
                  data-selected={selectedIds.includes(schema.id) || undefined}
                  data-locked={isLocked || undefined}
                  data-wrongmode={inWrongMode || undefined}
                  data-editing={isEditing || undefined}
                  // `cursor` é o ÚNICO que continua inline: o react-rnd compõe
                  // o style final como {...resizableStyle, ...cursorStyle,
                  // ...style} e o cursorStyle dele é `cursor: move`/`auto`
                  // INLINE — qualquer classe perde disso, só um inline
                  // posterior ganha (e o nosso é o último do spread).
                  //
                  // `boxSizing: "border-box"` saiu daqui porque o
                  // re-resizable já o força inline DEPOIS do nosso style
                  // (index.js: `{...this.props.style, ...sizeStyle,
                  // boxSizing: 'border-box'}`) — it was a dead declaration.
                  style={{ cursor: isEditing ? "text" : isLocked ? "not-allowed" : undefined }}
                >
                  <FieldBox
                    schema={schema}
                    editing={isEditing}
                    onUpdate={(patch) => onUpdateSchema(schema.id, patch)}
                    onStopEditing={stopEditing}
                    selected={selectedIds.length === 1 && selectedIds[0] === schema.id}
                    zoom={zoom}
                    selectedKpiElement={selectedIds.includes(schema.id) ? selectedKpiElement : null}
                    onSelectKpiElement={onSelectKpiElement}
                  />
                </Rnd>
              );
            })}
          </div>
        </div>
        <div className="jpd-canvas__row">
          <div className="jpd-ruler__corner" style={{ width: RULER_THICKNESS }} />
          <Ruler orientation="horizontal" lengthMm={page.width} thickness={RULER_THICKNESS} />
        </div>
      </div>

      {!hideZoombar && (
      <div className="jpd-zoombar" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label={t.pageCanvas.zoomOut}
          className="jpd-zoombar__btn"
          onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
        >
          <IconMinus />
        </button>
        <span className="jpd-zoombar__value">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          aria-label={t.pageCanvas.zoomIn}
          className="jpd-zoombar__btn"
          onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
        >
          <IconPlus />
        </button>
        <div className="jpd-zoombar__sep" />
        <button
          type="button"
          aria-label={t.pageCanvas.fitWidth}
          className="jpd-zoombar__btn"
          onClick={(e) => fitTo("width", e.currentTarget)}
        >
          <IconArrowsHorizontal />
        </button>
        <button
          type="button"
          aria-label={t.pageCanvas.fitHeight}
          className="jpd-zoombar__btn"
          onClick={(e) => fitTo("height", e.currentTarget)}
        >
          <IconArrowsVertical />
        </button>
        <div className="jpd-zoombar__sep" />
        <button
          type="button"
          aria-label={t.pageCanvas.resetZoom}
          title={t.pageCanvas.resetZoomTitle}
          className="jpd-zoombar__btn"
          onClick={() => setZoom(1)}
        >
          <IconDots />
        </button>
      </div>
      )}
    </div>
  );
}
