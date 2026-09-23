import { cn } from "@/lib/cn";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-blue text-white hover:bg-blue-press",
  secondary: "border border-border bg-surface text-ink hover:bg-paper",
  ghost: "bg-transparent text-ink hover:bg-paper",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

type Common = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
};

type ButtonProps = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

type LinkButtonProps = Common & {
  href: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
};

function buttonClasses({
  variant = "primary",
  size = "lg",
  className,
}: Pick<Common, "variant" | "size" | "className">) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-button font-medium transition-[color,background-color,transform] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0",
    variants[variant],
    sizes[size],
    className,
  );
}

function isLinkButton(
  props: ButtonProps | LinkButtonProps,
): props is LinkButtonProps {
  return "href" in props;
}

export function Button(props: ButtonProps | LinkButtonProps) {
  const classNames = buttonClasses(props);

  if (isLinkButton(props)) {
    const external = props.href.startsWith("http");
    const hash = props.href.startsWith("#");

    if (external || hash) {
      return (
        <a
          href={props.href}
          className={classNames}
          aria-label={props["aria-label"]}
          onClick={props.onClick}
          target={external ? "_blank" : props.target}
          rel={external ? "noopener noreferrer" : props.rel}
        >
          {props.children}
        </a>
      );
    }

    return (
      <Link
        href={props.href}
        className={classNames}
        aria-label={props["aria-label"]}
        onClick={props.onClick}
      >
        {props.children}
      </Link>
    );
  }

  const { variant, size, className, children, type = "button", ...buttonProps } =
    props;

  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
