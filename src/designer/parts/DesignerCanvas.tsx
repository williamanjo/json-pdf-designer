import type { CSSProperties } from "react";
import { PageCanvas } from "../../components/PageCanvas";
import { cx } from "../../components/ui/cx";
import { useDesignerActions, useDesignerConfig, useDesignerData, useDesignerSelection, useDesignerUi } from "../context/hooks";
import { useDesignerZoom } from "../context/useDesignerZoom";
import { useTabGate, type TabGate } from "./useTabGate";

export type DesignerCanvasProps = {
  className?: string;
  style?: CSSProperties;
  whenTab?: TabGate;
  /**
   * Hides the floating zoom bar. Use it with `useDesignerZoom()` to draw
   * your own, anywhere in the tree — including outside the canvas, which is
   * what CSS could not do (the `.jpd-zoombar` is `position: sticky` INSIDE
   * this box).
   */
  hideZoombar?: boolean;
};

// A placeable part: the sheet in mm, with per-field drag/resize (react-rnd),
// a marquee, rulers and the zoom bar.
//
// DIVISION OF RESPONSIBILITY, and it is not negotiable:
//
//   THE PART owns the sheet's geometry — mm→px, `transform: scale(zoom)`,
//   `transformOrigin`. `react-rnd` receives `scale={zoom}` and computes the
//   drag delta AGAINST it; a consumer overriding the transform makes the
//   field run away from the cursor.
//
//   THE CONSUMER owns the viewport that SCROLLS. That is what `className`/
//   `style` here reach: the outer box, not the sheet.
//
// THE ZOOM moved up to a context in 3.1.0, and the comment that used to be
// here said the opposite — worth recording why, because the old reason was
// not silly.
//
// It said: "dragging the slider would re-render every part if the value
// lived in the provider". True, if the value lived in one of the five
// contexts every part reads. But the zoom got a context of its OWN
// (`context/zoom.tsx`), so whoever does not call `useDesignerZoom()` stays
// put while the slider is dragged — and whoever builds their own layout can
// now read the zoom, fire fit/reset from outside, and draw their own bar.
//
// The `<PageCanvas>` here becomes CONTROLLED because of that. It still works
// without the props (internal state), which is the headless path.
//
// The root is the `<div data-scroll-root className="jpd-designer__canvas">`
// that `Designer.tsx` had — same box, same attribute.
export function DesignerCanvas({ whenTab, ...rest }: DesignerCanvasProps) {
  if (!useTabGate(whenTab)) return null;
  return <DesignerCanvasBody {...rest} />;
}

function DesignerCanvasBody({ className, style, hideZoombar = false }: Omit<DesignerCanvasProps, "whenTab">) {
  const { template } = useDesignerData();
  const { onCanvasDrop, gridSizeMm } = useDesignerConfig();
  const { isolateBands } = useDesignerUi();
  const { selectedIds, selectedKpiElement, setSelectedKpiElement, handleSelect, handleSelectMany } = useDesignerSelection();
  const { updateSchema, moveGroup, dropSectionColumn } = useDesignerActions();
  const { zoom, setZoom, viewportRef } = useDesignerZoom();

  return (
    // The canvas has a fixed INLINE width (contentWidth * zoom, in PageCanvas),
    // so it does not shrink — `flex-shrink` does not beat a declared width.
    // Without this box, an A4 page at 100% (810px) plus the 320px panel went
    // past the container's width and the panel left the viewport, visible
    // only by scrolling the whole page to the right. The `min-inline-size: 0`
    // on `.jpd-designer__canvas` lets the box shrink below its content, and
    // the `overflow-x: auto` puts the scrolling HERE, on the canvas, instead
    // of pushing the panel out.
    //
    // `data-scroll-root` marks THIS box as the viewport that scrolls, so
    // "fit width/height" measures the right space (see fitTo in
    // PageCanvas.tsx). Without the attribute, the selector there only had the
    // `[class*="overflow-auto"]`/`[class*="overflow-y-auto"]` arms — and
    // "overflow-x-auto" contains neither substring, so the closest found
    // nothing and fell back to `window.innerWidth`: the zoom came out
    // computed over the whole window, always larger than the real area.
    // The class arms stay as they are, for anyone wrapping this in an
    // `overflow-auto` box of their own — and they are now the ONLY way out
    // for that case, since `.jpd-designer__canvas` has no "overflow" in it.
    // `ref` for the zoom context: THIS box is the one that scrolls, and it is
    // the one `fitWidth()`/`fitHeight()` measures. The measurement used to
    // come from `closest()` starting at the clicked button — which works for
    // the default bar, living inside the canvas, and does not work for a
    // button the consumer puts anywhere else on screen.
    <div
      ref={viewportRef}
      data-scroll-root
      data-part="canvas"
      className={cx("jpd-designer__canvas", className)}
      style={style}
    >
      <PageCanvas
        page={template.page}
        schemas={template.schemas}
        headerHeight={template.headerHeight}
        footerHeight={template.footerHeight}
        marginLeft={template.marginLeft}
        marginRight={template.marginRight}
        gridSizeMm={gridSizeMm}
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
        zoom={zoom}
        onChangeZoom={setZoom}
        hideZoombar={hideZoombar}
      />
    </div>
  );
}
