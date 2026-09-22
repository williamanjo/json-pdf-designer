import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "./cx";

export type CardProps = HTMLAttributes<HTMLDivElement>;
export type CardTitleProps = HTMLAttributes<HTMLHeadingElement>;
export type BadgeProps = HTMLAttributes<HTMLSpanElement>;

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card({ className, ...rest }, ref) {
  return <div ref={ref} {...rest} className={cx("jpd-card", className)} />;
});

export const CardHeader = forwardRef<HTMLDivElement, CardProps>(function CardHeader({ className, ...rest }, ref) {
  return <div ref={ref} {...rest} className={cx("jpd-card__header", className)} />;
});

// `children` is destructured instead of arriving in the spread, and that is not
// style: with `<h3 {...rest} />`, `jsx-a11y/heading-has-content` has NO way to
// see any content and flags an empty heading. Written this way the rule stays
// on and still catches a real `<CardTitle />` with no content.
export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(function CardTitle({ className, children, ...rest }, ref) {
  return (
    <h3 ref={ref} {...rest} className={cx("jpd-card__title", className)}>
      {children}
    </h3>
  );
});

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge({ className, ...rest }, ref) {
  return <span ref={ref} {...rest} className={cx("jpd-badge", className)} />;
});
