import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";

/** The placeholder signature, until Ahmed's scan is uploaded (docs/design/letter-placeholder.md). */
export const SIGNATURE_PLACEHOLDER = {
  /** Dark ink, for the light theme. */
  ink: "/images/signature-placeholder.svg",
  /** Light ink, for the dark theme. */
  light: "/images/signature-placeholder-light.svg",
} as const;

/**
 * The Signature board: Ahmed's scanned signature, one file per theme (dark
 * ink on the light ground, a light copy on the dark one, never an automatic
 * color inversion), 220 × 84, alt «توقيع أحمد». It appears under the letter
 * only. A script font pretending to be a signature is never used.
 *
 * Both files are plain `<img>` elements, so an SVG is never inlined: the
 * uploaded scans are PNG, and the placeholders are our own SVG files. A theme
 * without an uploaded scan uses the placeholder.
 *
 * `theme` forces one file, for a panel whose theme differs from the page's
 * (the design-system page). Without it, the page's theme picks.
 */
export function Signature({
  inkUrl,
  lightUrl,
  theme,
  className,
}: {
  /** Dark ink, for the light theme (`signatureUrl`). */
  inkUrl?: string | null;
  /** Light ink, for the dark theme (`signatureDarkUrl`). */
  lightUrl?: string | null;
  theme?: "light" | "dark";
  className?: string;
}) {
  const t = useTranslations("Voice");
  const ink = inkUrl || SIGNATURE_PLACEHOLDER.ink;
  const light = lightUrl || SIGNATURE_PLACEHOLDER.light;
  const image = (src: string, show: string, which: "ink" | "light") => (
    // A scan or our own SVG at a fixed size: no optimisation to gain, and an SVG must stay out of the DOM.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={t("signatureAlt")}
      width={220}
      height={84}
      loading="lazy"
      data-signature={which}
      className={cx("block h-auto w-[220px] max-w-full", show)}
    />
  );

  if (theme === "light") return <div className={className}>{image(ink, "", "ink")}</div>;
  if (theme === "dark") return <div className={className}>{image(light, "", "light")}</div>;
  return (
    <div className={className}>
      {image(ink, "dark:hidden", "ink")}
      {image(light, "hidden dark:block", "light")}
    </div>
  );
}
