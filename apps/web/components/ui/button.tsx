import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cx } from "./cx";
import { Spinner } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/*
 * The Button board (DESIGN.md "The record"): square corners, no shadow, 200ms
 * color changes only. Primary is the one accent action on a screen and turns
 * ink on hover; secondary is an ink outline; quiet is an accent underline;
 * danger is a danger outline, for deletes behind a confirmation.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-accent text-on-accent hover:bg-ink hover:text-bg active:bg-ink active:text-bg",
  secondary: "border-ink bg-transparent text-ink hover:bg-surface-hover active:bg-ink active:text-bg",
  quiet:
    "border-transparent bg-transparent text-accent underline decoration-1 underline-offset-6 hover:decoration-2 active:text-ink",
  danger: "border-danger bg-transparent text-danger hover:bg-surface-hover active:bg-danger active:text-bg",
};

// Quiet has no box, so it keeps only a 44px target and a sliver of padding.
const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-10 gap-2 px-4 text-sm",
  md: "min-h-12 gap-2.5 px-6 text-base",
  lg: "min-h-14 gap-2.5 px-8 text-[17px]",
};

const QUIET_SIZE = "min-h-11 gap-2 px-0.5";

// Disabled is a flat surface with ink-2 text and a hairline. Quiet has no
// box, so its disabled state is ink-2 text alone.
const DISABLED =
  "disabled:cursor-not-allowed disabled:border-line disabled:bg-surface disabled:text-ink-2 disabled:no-underline " +
  "aria-disabled:cursor-not-allowed";
const DISABLED_QUIET = "disabled:cursor-not-allowed disabled:text-ink-2 disabled:no-underline aria-disabled:cursor-not-allowed";

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
    "inline-flex cursor-pointer items-center justify-center border leading-tight font-medium whitespace-nowrap transition-state",
    "focus-ring",
    VARIANTS[variant],
    variant === "quiet" ? cx(QUIET_SIZE, size === "sm" ? "text-sm" : "text-base") : SIZES[size],
    variant === "quiet" ? DISABLED_QUIET : DISABLED,
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
  /** An icon after the text. Directional icons (`dir-icon`) mirror themselves. */
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
