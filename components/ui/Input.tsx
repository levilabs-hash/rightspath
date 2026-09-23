import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, ReactNode } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
};

export function Input({
  id,
  label,
  hint,
  error,
  className,
  ...props
}: InputProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-12 w-full rounded-input border bg-surface px-4 text-base text-ink placeholder:text-slate",
          error ? "border-red" : "border-border",
          className,
        )}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-sm leading-relaxed text-slate">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm leading-relaxed text-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
