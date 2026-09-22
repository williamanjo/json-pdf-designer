import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx, readPart, type PartStyle } from "./cx";

export type CollapsibleSectionProps = Omit<HTMLAttributes<HTMLDetailsElement>, "children" | "title"> & {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  parts?: { summary?: PartStyle; content?: PartStyle };
};

// A shell repeated 3x in PropertyPanelTable.tsx (Header/Value/Totals, inside
// the "style" tab) — a native <details>/<summary>, with no React state,
// because the browser already handles expand/collapse on its own.
//
// The open/closed state has NO `data-*`: `<details>` already exposes the
// native `open` attribute, and the CSS targets it. The migration rule: where
// a native pseudo-class or attribute exists, use the native one.
export const CollapsibleSection = forwardRef<HTMLDetailsElement, CollapsibleSectionProps>(function CollapsibleSection(
  { title, defaultOpen, children, className, parts, ...rest },
  ref
) {
  const summary = readPart(parts?.summary);
  const content = readPart(parts?.content);
  return (
    <details ref={ref} open={defaultOpen} {...rest} className={cx("jpd-disclosure", className)}>
      <summary className={cx("jpd-disclosure__summary", summary.className)} style={summary.style}>
        {title}
      </summary>
      <div className={cx("jpd-disclosure__body", content.className)} style={content.style}>
        {children}
      </div>
    </details>
  );
});
