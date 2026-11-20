import type { ReactNode, SVGProps } from "react";
import type { FileKind } from "./workspace/format";

/**
 * The one icon set (DESIGN.md "Iconography", the Icons board): inline SVG,
 * 1.5 stroke, square caps, mitred joins, `currentColor`, 20 or 24 px.
 *
 * Icons are decorative: the word next to them carries the meaning, and an
 * icon-only button carries an `aria-label`. Never put one in a circle or a
 * colored square.
 *
 * Directional icons are drawn for Arabic, pointing to where Arabic reads on
 * to, and take `dir-icon`, which mirrors them in English.
 *
 * components/ui/icons.tsx, components/public/listing/icons.tsx and
 * components/workspace/icons.tsx re-export from here under their old names.
 */
export type IconProps = SVGProps<SVGSVGElement> & {
  /** 20 next to text, 24 alone in a 44 px button. */
  size?: 20 | 24;
};

function Icon({ size = 20, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

function withDir(className: string | undefined) {
  return className ? `dir-icon ${className}` : "dir-icon";
}

/* ---------------------------------------------------------- directional -- */

/** Forward: "next", "more", "send". Mirrors in English. */
export function ArrowForwardIcon({ className, ...props }: IconProps) {
  return (
    <Icon className={withDir(className)} {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Icon>
  );
}

/** A small forward chevron, for pagination. Mirrors in English. */
export function ChevronForwardIcon({ className, ...props }: IconProps) {
  return (
    <Icon className={withDir(className)} {...props}>
      <path d="M15 6l-6 6 6 6" />
    </Icon>
  );
}

/** A small back chevron. Mirrors in English. */
export function ChevronBackIcon({ className, ...props }: IconProps) {
  return (
    <Icon className={withDir(className)} {...props}>
      <path d="M9 6l6 6-6 6" />
    </Icon>
  );
}

/** Opens somewhere else. Mirrors in English. */
export function ExternalLinkIcon({ className, ...props }: IconProps) {
  return (
    <Icon className={withDir(className)} {...props}>
      <path d="M10 4H4v6M4 4l9 9M6 14v6h14V6h-6" />
    </Icon>
  );
}

/* ------------------------------------------------------------- the set -- */

export function DownloadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </Icon>
  );
}

/** A document. */
export function FileIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" />
    </Icon>
  );
}

/** Language. */
export function GlobeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </Icon>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6h16v12H4zM4 7l8 6 8-6" />
    </Icon>
  );
}

/** WhatsApp, in the set's line style rather than its logo. */
export function WhatsAppIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 19l1.2-3.6A7.5 7.5 0 1 1 9 18.4z" />
    </Icon>
  );
}

/** An appointment or a date. */
export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6h16v14H4zM4 10h16M9 3v5M15 3v5" />
    </Icon>
  );
}

export function PaperclipIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15 7l-6.5 6.5a2 2 0 0 0 3 3L18 10a4 4 0 0 0-6-6l-6.5 6.5a6 6 0 0 0 8.5 8.5L19 14" />
    </Icon>
  );
}

/** Done. */
export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
  );
}

/** Waiting. */
export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

/** Protected. */
export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />
    </Icon>
  );
}

/** View. */
export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

/** Play. Not mirrored: a play mark points the same way in every language. */
export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 4l12 8-12 8z" />
    </Icon>
  );
}

/* --------------------------------------------------- the rest, same line -- */

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
    </Icon>
  );
}

/** Not directional, so it doesn't mirror. */
export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 9l6 6 6-6" />
    </Icon>
  );
}

/** A place. */
export function PlaceIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.25" />
    </Icon>
  );
}

/** Online, on a screen. */
export function ScreenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 4.5h18v12H3zM8.5 20h7M12 16.5V20" />
    </Icon>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </Icon>
  );
}

export function VideoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 6h13v12H3zM16 10.5l5-3v9l-5-3z" />
    </Icon>
  );
}

/** Something needs attention. */
export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V13M12 16.5v.01" />
    </Icon>
  );
}

/** A missing photo, inside the hatched panel. */
export function ImageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4" />
    </Icon>
  );
}

/* Channel marks, drawn in the set's line rather than as brand logos. */

export function XLogoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 4h4l11 16h-4zM19.5 4l-6.3 7.2M10.8 13l-6.3 7" />
    </Icon>
  );
}

export function LinkedInIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 3.5h17v17h-17zM8 10.5V16M8 7.75v.01M11.5 16v-5.5M11.5 13a2.5 2.5 0 0 1 5 0v3" />
    </Icon>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 21v-8h2.75l.5-3.25H14.5V7.9c0-.9.45-1.65 1.75-1.65h1.6V3.4A19 19 0 0 0 15.5 3.2c-2.6 0-4.25 1.6-4.25 4.4v2.15H8.5V13h2.75v8" />
    </Icon>
  );
}

/** One icon per file group: the document with its type's mark. */
export function FileKindIcon({ kind, ...props }: IconProps & { kind: FileKind }) {
  return (
    <Icon {...props}>
      <path d="M7 3h7l4 4v14H7zM14 3v4h4" />
      {kind === "image" && <path d="M10 13.5v.01M17 18l-3-3-5 5" />}
      {kind === "xlsx" && <path d="M10 12h5M10 15h5M10 18h5M12.5 12v6" />}
      {kind === "docx" && <path d="M10 12h5M10 15h5M10 18h3" />}
      {kind === "pdf" && <path d="M10 14h2M10 17h5" />}
    </Icon>
  );
}

/** Loading. Turns slowly, and stops when the user asks for reduced motion. */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={`animate-spin motion-reduce:animate-none ${className}`}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}
