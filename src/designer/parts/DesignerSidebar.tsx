import type { CSSProperties } from "react";
import { cx, readPart, type PartStyle } from "../../components/ui/cx";
import { useUiComponents } from "../../components/ui/useUiComponents";
import { useDesignerUi } from "../context/hooks";
import { DesignerFieldList } from "./DesignerFieldList";
import { DesignerFilterPanel } from "./DesignerFilterPanel";
import { DesignerInspector } from "./DesignerInspector";
import { DesignerPageSettings } from "./DesignerPageSettings";
import { DesignerPropertyPanel } from "./DesignerPropertyPanel";
import { DesignerTabBar } from "./DesignerTabBar";
import { DesignerToolbar } from "./DesignerToolbar";

export type DesignerSidebarProps = {
  className?: string;
  style?: CSSProperties;
  parts?: {
    // A barra de abas.
    tabBar?: PartStyle;
    // A caixa que colapsa (o `<TabPanel>`).
    panel?: PartStyle;
  };
};

// A CONVENIENCE part: the whole sidebar, the way the `<Designer>` assembles
// it — a tab bar on top, and the active tab's content below, in a box that
// collapses on a double click.
//
// It is the ONLY part that imports other parts (an invariant guarded by
// partBoundaries.test.ts). It exists because reproducing the seven-block tab
// gate by hand is tedious and easy to get wrong — but it is only sugar:
// whoever wants another layout mounts the parts directly, with whatever
// `whenTab` they like (or none at all).
//
// THE COLLAPSE lives only here, and not in each part. The `<TabPanel>` trick
// is a grid `1fr`→`0fr`, which requires a `flex column` parent with
// `min-block-size: 0` — a standalone part does not guarantee that, so it
// would animate wrongly in silence instead of degrading. The tab bar WRITES
// the flag (double click) and the sidebar READS it.
export function DesignerSidebar({ className, style, parts }: DesignerSidebarProps) {
  const { Card, TabPanel } = useUiComponents();
  const { sidebarCollapsed } = useDesignerUi();
  const tabBar = readPart(parts?.tabBar);
  const panel = readPart(parts?.panel);

  return (
    <Card className={cx("jpd-sidebar", className)} data-part="sidebar" style={style}>
      <DesignerTabBar className={tabBar.className} style={tabBar.style} />
      <TabPanel collapsed={sidebarCollapsed} className={panel.className} style={panel.style}>
        {/* The "Fields" tab has TWO sibling blocks, and they are siblings on
            purpose: the 8px gap of `.jpd-tabpanel__body` separates the list
            from the action footer. Wrapping the two in one more level would
            collapse that gap. */}
        <DesignerFieldList whenTab="campos" />
        <DesignerToolbar whenTab="campos" />

        {/* Two instances of the SAME panel, one per half. It is exactly what
            `section` exists to allow — and inside the sidebar only one tab is
            active, so only one of them renders. */}
        <DesignerPropertyPanel whenTab="dados" section="dados" />
        <DesignerPropertyPanel whenTab="estilo" section="estilo" />
        <DesignerFilterPanel whenTab="filtro" />

        <DesignerPageSettings whenTab="pagina" />
        <DesignerInspector whenTab="inspetor" />
      </TabPanel>
    </Card>
  );
}
