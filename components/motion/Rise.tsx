import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Rise({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const style: CSSProperties | undefined =
    delay > 0 ? { animationDelay: `${delay}s` } : undefined;

  return (
    <div className={cn("rise-in", className)} style={style}>
      {children}
    </div>
  );
}
