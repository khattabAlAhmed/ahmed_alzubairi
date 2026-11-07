import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cx, FOCUS_RING } from "./cx";
import { Spinner } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "quiet";
export type ButtonSize = "sm" | "md" | "lg";

// Primary is gold with navy text (§13). Gold is never the text color, so no
// variant puts gold text on ivory or white.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent shadow-sm hover:opacity-90",
  secondary: "border border-text/50 bg-surface text-text hover:bg-text/5",
  quiet: "text-text hover:bg-text/10",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 px-3 text-sm",
  md: "h-11 gap-2 px-4 text-base",
  lg: "h-12 gap-2 px-6 text-lg",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cx(
    "inline-flex items-center justify-center rounded-md font-semibold whitespace-nowrap transition-opacity motion-reduce:transition-none",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    FOCUS_RING,
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks clicks. */
  loading?: boolean;
  /** Read by screen readers while loading, e.g. "Sending…". Required with `loading`. */
  loadingLabel?: string;
  /** An icon after the text. Directional icons must mirror themselves. */
  icon?: ReactNode;
};

export function Button({
  variant,
  size,
  loading = false,
  loadingLabel,
  icon,
  className,
  disabled,
  type = "button",
  onClick,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      // Stays focusable while loading, so focus isn't lost mid-submit.
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={loading ? (event) => event.preventDefault() : onClick}
      {...props}
    >
      {loading && <Spinner />}
      {children}
      {!loading && icon}
      {loading && loadingLabel && (
        <span className="sr-only" role="status">
          {loadingLabel}
        </span>
      )}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

/** A link that looks like a button. Use it for navigation, Button for actions. */
export function ButtonLink({
  variant,
  size,
  icon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {children}
      {icon}
    </Link>
  );
}
