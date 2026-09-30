import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx, readPart, type PartStyle } from "./cx";
import { IconLock } from "./icons";

export type BulkLockedProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  hint: string;
  children: ReactNode;
  parts?: { hint?: PartStyle; content?: PartStyle };
};

// Wraps fields locked during bulk editing (several fields of the SAME type
// selected together, see Designer.tsx `bulkEditActive`) — a padlock visual
// plus pointer-events-none, so that block is not duplicated in every
// PropertyPanelXxx (Kpi/Chart/Text) that needs it.
export const BulkLocked = forwardRef<HTMLDivElement, BulkLockedProps>(function BulkLocked(
  { hint, children, className, parts, ...rest },
  ref
) {
  const hintPart = readPart(parts?.hint);
  const content = readPart(parts?.content);
  return (
    <div ref={ref} {...rest} className={cx("jpd-locked", className)}>
      <p className={cx("jpd-locked__hint", hintPart.className)} style={hintPart.style}>
        <IconLock /> {hint}
      </p>
      <div className={cx("jpd-locked__body", content.className)} style={content.style}>
        {children}
      </div>
    </div>
  );
});
