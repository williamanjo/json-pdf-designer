import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "./cx";
import { IconX } from "./icons";
import { useUiComponents } from "./useUiComponents";

// A generic "clear the field back to its default" button — it generalizes the
// pattern repeated in ResetPositionButton (PropertyPanelKpi.tsx), the two
// inline backgroundColor/borderColor buttons (PropertyPanelText.tsx) and
// clearColumnStyle/clearFormula (PropertyPanelTable.tsx). The conditional
// visibility ("it only appears when the field holds a non-default value")
// stays the decision of whoever CALLS this component — it only renders.
//
// Two variants, covering the 4 existing calls:
// - "icon" (default): a square ghost button with IconX + a `title` tooltip.
// - "text": a small text button, no icon, red on hover.
export type ClearFieldButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  onClick: () => void;
  // Variant "icon": the tooltip text (the title attribute). Variant "text":
  // the button's visible content.
  label: string;
  variant?: "icon" | "text";
};

export const ClearFieldButton = forwardRef<HTMLButtonElement, ClearFieldButtonProps>(function ClearFieldButton(
  { onClick, label, variant = "icon", className, ...rest },
  ref
) {
  // COMPOSED, not a slottable primitive: it reads the registry so it composes
  // the CONSUMER's `Button` when there is one. That is why swapping `Button`
  // also restyles the "clear field" buttons scattered across the panels,
  // without the consumer having to know they exist.
  const { Button } = useUiComponents();
  if (variant === "text") {
    return (
      <button ref={ref} type="button" onClick={onClick} {...rest} className={cx("jpd-linkbtn", className)}>
        {label}
      </button>
    );
  }

  // The icon variant COMPOSES the kit's Button instead of repeating its
  // classes — which is why `cx` has to be idempotent: the consumer's
  // `className` passes through here and again inside it.
  return (
    <Button ref={ref} variant="ghost" size="icon" onClick={onClick} title={label} className={className} {...rest}>
      <IconX />
    </Button>
  );
});
