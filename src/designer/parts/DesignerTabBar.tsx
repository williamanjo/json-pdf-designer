import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cx, readPart, type PartStyle } from "../../components/ui/cx";
import { IconAlertTriangle, IconChevronLeft, IconChevronRight, IconPlus, IconX } from "../../components/ui/icons";
import { useT } from "../../i18n";
import { useDesignerUi } from "../context/hooks";
import type { HideableTab } from "../useTabBar";
import { useTabGate, type TabGate } from "./useTabGate";

export type DesignerTabBarProps = {
  className?: string;
  style?: CSSProperties;
  whenTab?: TabGate;
  parts?: {
    // The strip that SCROLLS (the tabs only). The arrows and the "+" stay OUTSIDE it.
    strip?: PartStyle;
  };
};

// A placeable part: the side panel's tab bar (Fields/Data/Style/Filter/
// Page/Inspector), with drag-to-reorder, pin-hide on the "×", reopen on the
// "+", and the scroll arrows.
//
// It is NOT slottable through `components`: 2.1.1 was spent fitting 6 tabs
// into 290px, and a consumer's `Button` with its own `min-width` undoes that.
// It stays a raw `<button>` with our class.
//
// The root is `.jpd-tabs`, the SAME one `Designer.tsx` had.
export function DesignerTabBar({ whenTab, ...rest }: DesignerTabBarProps) {
  if (!useTabGate(whenTab)) return null;
  return <DesignerTabBarBody {...rest} />;
}

function DesignerTabBarBody({ className, style, parts }: Omit<DesignerTabBarProps, "whenTab">) {
  const t = useT();
  const {
    sidebarTab,
    setSidebarTab,
    setSidebarCollapsed,
    tabMenuOpen,
    setTabMenuOpen,
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
  } = useDesignerUi();

  // State that does NOT move up to the provider, and it is the only part with
  // that case: a DOM ref in a context would break the instant two tab bars
  // mounted — both would write to the same ref, and the scroll effect would
  // measure the wrong strip.
  const tabStripRef = useRef<HTMLDivElement>(null);
  // Can it still scroll each way? It decides whether each arrow appears. With
  // the scrollbar hidden, without the arrows there would be no clue at all
  // that a tab is out of sight.
  const [tabScroll, setTabScroll] = useState({ left: false, right: false });

  // Reads the strip's position and says which way it can still scroll. The
  // 1px margin is for the rounding of a fractional scrollLeft (browser zoom).
  function syncTabScroll() {
    const strip = tabStripRef.current;
    if (!strip) return;
    const max = strip.scrollWidth - strip.clientWidth;
    setTabScroll({ left: strip.scrollLeft > 1, right: strip.scrollLeft < max - 1 });
  }

  // One arrow step: 80% of the visible width, so there is always a reference
  // tab left over between one click and the next.
  //
  // Deliberately without `behavior: "smooth"`: there are environments where
  // smooth scrolling simply does not run (measured: an instant `scrollBy`
  // moves the strip, a smooth `scrollBy` leaves scrollLeft at 0 even seconds
  // later), and then the arrow looks dead. A jump with no animation is worse
  // visually and better functionally.
  function nudgeTabs(direction: -1 | 1) {
    const strip = tabStripRef.current;
    if (!strip) return;
    strip.scrollLeft += direction * Math.round(strip.clientWidth * 0.8);
    syncTabScroll();
  }

  // Brings the active tab into view in the scrolling strip. Without this,
  // switching tabs by another route (selecting a field switches to "data" on
  // its own, see useTabBar) would leave the active tab out of sight, with no
  // scrollbar to give the hint. It adjusts `scrollLeft` by hand instead of
  // `scrollIntoView` because the latter also scrolls the PAGE in some browsers.
  useEffect(() => {
    const strip = tabStripRef.current;
    const active = strip?.querySelector<HTMLElement>('[data-active="true"]');
    if (!strip) return;
    syncTabScroll();
    if (!active) return;
    // Rectangles, not `offsetLeft`: the buttons are `position: relative` and
    // the strip is not, so their `offsetParent` is an ancestor further up and
    // `offsetLeft` measures from the wrong place.
    const strato = strip.getBoundingClientRect();
    const aba = active.getBoundingClientRect();
    if (aba.left < strato.left) strip.scrollLeft -= strato.left - aba.left;
    else if (aba.right > strato.right) strip.scrollLeft += aba.right - strato.right;
    // Again after moving it: the assignment above changes scrollLeft
    // immediately, but the scroll event only arrives afterwards — without
    // this the arrows would be one click behind.
    syncTabScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarTab, orderedVisibleTabs.length]);

  const strip = readPart(parts?.strip);

  return (
    <div className={cx("jpd-tabs", className)} data-part="tab-bar" style={style}>
      {/* Scroll arrows — they only appear on the side that has a hidden
          tab. They sit outside the strip, like the "+": an arrow that scrolled
          along with the content would be of no use. */}
      {tabScroll.left && (
        <button
          type="button"
          onClick={() => nudgeTabs(-1)}
          aria-label={t.tabBar.scrollTabsLeft}
          title={t.tabBar.scrollTabsLeft}
          data-dir="left"
          className="jpd-tabs__btn"
        >
          <IconChevronLeft />
        </button>
      )}
      {/* The tab strip scrolls; the "+" below stays OUTSIDE it, otherwise it
          would be the first thing to leave the view precisely when there is a
          hidden tab to reopen. */}
      <div ref={tabStripRef} onScroll={syncTabScroll} className={cx("jpd-tabs__strip", strip.className)} style={strip.style}>
        {orderedVisibleTabs.map((tab) => (
          // The "x" that hides the tab used to be a <span role="button"> INSIDE
          // this <button>: nested interactive (invalid HTML) and, having no
          // tabIndex, hiding a tab was a mouse-only operation. Now they are
          // two sibling buttons inside this slot. The <button className="jpd-tab">
          // stays INTACT on purpose: its `data-active` is read by a
          // querySelector, by the CSS and by this JSX — the three places its
          // own comment says to change together.
          <span key={tab.key} className="jpd-tab__slot">
          <button
            type="button"
            // The ONLY site that writes the RAW boolean instead of
            // `cond || undefined`: the effect above does
            // `strip.querySelector('[data-active="true"]')` to bring the
            // active tab into view, and React serializes `false` as the
            // STRING "false" — which still matches `[data-active]`. With
            // `|| undefined` the attribute disappears from the inactive tab
            // and the selector would have to become `[data-active]`; either
            // form works, MIXING them makes the selector match every tab. The
            // CSS (`.jpd-tab[data-active="true"]`) agrees with this form —
            // touching it here means touching all three places.
            data-active={sidebarTab === tab.key}
            data-dragging={draggedTab === tab.key || undefined}
            draggable
            onDragStart={(e) => {
              setDraggedTab(tab.key);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (draggedTab && draggedTab !== tab.key) setDragOverTab(tab.key);
            }}
            onDragLeave={() => setDragOverTab((cur) => (cur === tab.key ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedTab) reorderTabs(draggedTab, tab.key);
              setDraggedTab(null);
              setDragOverTab(null);
            }}
            onDragEnd={() => {
              setDraggedTab(null);
              setDragOverTab(null);
            }}
            onClick={() => {
              setSidebarTab(tab.key);
              setSidebarCollapsed(false);
            }}
            onDoubleClick={() => setSidebarCollapsed((c) => !c)}
            title={t.tabBar.dragToReorder}
            className="jpd-tab"
          >
            {/* An indicator of where the dragged tab will land (before this one). */}
            {dragOverTab === tab.key && draggedTab && draggedTab !== tab.key && <span className="jpd-tab__dropmark" />}
            {tab.label}
            {tab.warning && <IconAlertTriangle className="jpd-warnicon jpd-warnicon--sm" />}
          </button>
          {/* Pin/hide — only on the active tab (otherwise they would not all fit
              on the bar together) — it vanishes for every field until reopened. */}
          {tab.removable && sidebarTab === tab.key && (
            <button
              type="button"
              aria-label={t.tabBar.pinAria(tab.label)}
              title={t.tabBar.pinTitle(tab.label)}
              onClick={() => hideOptionalTab(tab.key as HideableTab)}
              className="jpd-tab__pin"
            >
              {/* No className: the 10px size comes from the CSS
                  (`.jpd-tab__pin > svg`), because a <svg>'s `width`/`height`
                  are geometry properties — the CSS beats the 14 attribute
                  that icons.tsx writes. */}
              <IconX />
            </button>
          )}
          </span>
        ))}
      </div>

      {tabScroll.right && (
        <button
          type="button"
          onClick={() => nudgeTabs(1)}
          aria-label={t.tabBar.scrollTabsRight}
          title={t.tabBar.scrollTabsRight}
          data-dir="right"
          className="jpd-tabs__btn"
        >
          <IconChevronRight />
        </button>
      )}

      {/* "+" always at the end of the bar — it reopens a hidden tab and/or
          restores the default order/visibility. It only appears when there is
          something to do (a hidden tab, or an order already changed). */}
      {(addableOptionalTabs.length > 0 || tabsCustomized) && (
        <div className="jpd-tabs__more">
          <button
            type="button"
            onClick={() => setTabMenuOpen((o) => !o)}
            title={t.tabBar.reopenOrRestoreTitle}
            aria-label={t.tabBar.reopenOrRestoreTitle}
            className="jpd-tabs__btn"
          >
            <IconPlus />
          </button>
          {tabMenuOpen && (
            <div className="jpd-popover jpd-popover--anchor-right">
              {addableOptionalTabs.map((tab) => (
                <button key={tab.key} type="button" onClick={() => showOptionalTab(tab.key)} className="jpd-menuitem">
                  {tab.label}
                </button>
              ))}
              {tabsCustomized && (
                <>
                  {addableOptionalTabs.length > 0 && <div className="jpd-menu__sep" />}
                  <button type="button" onClick={restoreDefaultTabs} className="jpd-menuitem jpd-menuitem--muted">
                    {t.tabBar.restoreDefault}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
