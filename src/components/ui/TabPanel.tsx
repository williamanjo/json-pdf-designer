import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx, readPart, type PartStyle } from "./cx";

export type TabPanelProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  collapsed: boolean;
  children: ReactNode;
  parts?: { content?: PartStyle };
};

// Collapses the active tab's content by shrinking it instead of merely
// hiding it — used everywhere there are tabs (the Designer's Fields/Page
// sidebar, and Data/Style/Filter inside the field editor).
//
// `gridTemplateRows` left the inline `style` and became `data-collapsed`: the
// mechanics (grid `1fr` -> `0fr`) are the same, but the theme now controls
// duration/curve, and the consumer's `style` no longer fights the component's.
// See `.jpd-tabpanel` in theme.css for why `min-height: 0` is there.
export const TabPanel = forwardRef<HTMLDivElement, TabPanelProps>(function TabPanel(
  { collapsed, children, className, parts, ...rest },
  ref
) {
  const content = readPart(parts?.content);
  return (
    <div ref={ref} {...rest} data-collapsed={collapsed || undefined} className={cx("jpd-tabpanel", className)}>
      <div className={cx("jpd-tabpanel__body", content.className)} style={content.style}>
        {children}
      </div>
    </div>
  );
});
