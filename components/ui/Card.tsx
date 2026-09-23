import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  surface?: "card" | "panel";
};

const surfaces = {
  card: "rounded-card",
  panel: "rounded-surface",
};

export function Card({
  surface = "card",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "border border-border bg-surface p-6",
        surfaces[surface],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
