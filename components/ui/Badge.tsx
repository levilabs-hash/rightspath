import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

type BadgeVariant = "neutral" | "known" | "missing" | "info";

const variants: Record<BadgeVariant, string> = {
  neutral: "border border-border bg-paper text-slate",
  known: "bg-green-soft text-green",
  missing: "bg-amber-soft text-amber",
  info: "bg-blue-soft text-blue",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function Badge({
  variant = "neutral",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2 py-1 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
