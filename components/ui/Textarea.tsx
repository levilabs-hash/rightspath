import { cn } from "@/lib/cn";
import { forwardRef, type ReactNode, type TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ id, label, hint, error, className, ...props }, ref) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-64 w-full resize-y rounded-input border bg-surface px-4 py-4 text-base leading-relaxed text-ink placeholder:text-slate",
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
  },
);
