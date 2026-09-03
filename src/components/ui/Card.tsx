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

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(function CardTitle({ className, ...rest }, ref) {
  return <h3 ref={ref} {...rest} className={cx("jpd-card__title", className)} />;
});

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge({ className, ...rest }, ref) {
  return <span ref={ref} {...rest} className={cx("jpd-badge", className)} />;
});
