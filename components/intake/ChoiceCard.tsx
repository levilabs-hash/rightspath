import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function ChoiceCard({
  name,
  value,
  title,
  description,
  icon,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  title: string;
  description: string;
  icon: ReactNode;
  checked: boolean;
  onChange: () => void;
}) {
  const id = `${name}-${value}`;

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer gap-4 rounded-card border bg-surface p-6 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue",
        checked ? "border-blue bg-blue-soft" : "border-border hover:bg-paper",
      )}
    >
      <input
        id={id}
        className="sr-only focus-visible:outline-none"
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
      />
      <span className="mt-1 shrink-0 text-ink" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-4">
          <span className="text-lg font-medium text-ink">{title}</span>
          {checked ? (
            <span className="shrink-0 text-sm font-medium text-ink">Selected</span>
          ) : null}
        </span>
        <span className="mt-2 block text-sm leading-relaxed text-slate">
          {description}
        </span>
      </span>
    </label>
  );
}
