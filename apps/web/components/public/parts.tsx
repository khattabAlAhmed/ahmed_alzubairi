import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";
import { ConsultationButton } from "@/components/consultation-button";
import { ArrowForwardIcon } from "@/components/icons";
import { formatNumber, metaSeparator } from "@/components/public/home/format";
import { buttonClasses } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";

/**
 * The page column: `container` (1312) of content, centered, with the page
 * margin outside it (16 on phones, 32 from 768, 48 from 1280; the Grid board).
 */
export const CONTAINER = "mx-auto w-full max-w-[calc(var(--container)+2*var(--page-margin))] px-page-margin";

/**
 * A bounded item, until the content tasks turn each list into its own record
 * shape. Square, a hairline edge, on the page ground: no shadow, no raised
 * fill (DESIGN.md "Colour": `surface` is not a card behind every item).
 */
export const CARD = "relative border border-line bg-bg p-6";

/** One fact in a page header's ledger, its value already in the page's digits. */
export type PageFact = { label: string; value: string };

/** A fact as the ledger shows it: the value may also be a link, e.g. a service's area. */
export type LedgerFact = { label: string; value: ReactNode };

/**
 * A page header's title: `type-h1`, a step smaller on phones and tablets where
 * the columns stack (28px Arabic, 26px English, the mockups' size below 900px),
 * so a three-line title reads as two. The line height stays the script's own.
 */
export const PAGE_TITLE = "type-h1 max-md:text-[28px] max-md:[:lang(en)_&]:text-[26px] settle";

/**
 * The top of every main page (the PageHeader board): the 2px rule, then three
 * columns. The start one says where you are (the section, or the way back);
 * the middle one holds the title and one sentence of his; the end one lists
 * the page's facts as a ledger. Never a centred hero. On phones the columns
 * stack. An optional 4:5 photo of him takes the end column (the About page),
 * with the facts under it when both are given. A page with no facts can put
 * its own short block there instead (`aside`, e.g. the Documents steps).
 */
export function PageHero({
  eyebrow,
  back,
  title,
  intro,
  actions,
  facts,
  photo,
  aside,
}: {
  /** Where the page sits, e.g. the section's name. */
  eyebrow?: string;
  back?: { href: string; label: string };
  title: string;
  /** One sentence of his (SOUL.md principle 1). */
  intro?: ReactNode;
  actions?: ReactNode;
  facts?: readonly LedgerFact[];
  /** A 4:5 photo in the end column. */
  photo?: { src: string; alt: string };
  /** A short block in the end column, after the facts when both are given. Not with `photo`. */
  aside?: ReactNode;
}) {
  return (
    <header className={cx(CONTAINER, "mt-8 md:mt-12")}>
      <div className="grid gap-5 border-t-2 border-rule pt-6 pb-10 md:grid-cols-12 md:gap-gutter">
        <div className="type-small flex flex-col items-start gap-2 text-ink-2 md:col-span-3">
          {back && <MoreLink href={back.href} label={back.label} back />}
          {eyebrow && <p>{eyebrow}</p>}
        </div>
        <div className="flex min-w-0 flex-col gap-4 md:col-span-9 lg:col-span-6">
          <h1 className={PAGE_TITLE}>{title}</h1>
          {intro && <div className="type-body max-w-measure text-pretty text-ink-2 settle settle-2">{intro}</div>}
          {actions && <div className="mt-2 flex flex-wrap items-center gap-4">{actions}</div>}
        </div>
        {photo ? (
          <div className="flex flex-col gap-6 self-start md:col-span-12 lg:col-span-3">
            <figure className="relative aspect-[4/5] w-full max-w-[420px] bg-surface">
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                priority
                sizes="(min-width: 1024px) 20rem, 420px"
                className="object-cover"
              />
            </figure>
            {facts && facts.length > 0 && <Ledger facts={facts} />}
          </div>
        ) : aside ? (
          <div className="flex min-w-0 flex-col gap-6 self-start md:col-span-12 lg:col-span-3">
            {facts && facts.length > 0 && <Ledger facts={facts} />}
            {aside}
          </div>
        ) : (
          facts && facts.length > 0 && <Ledger facts={facts} className="self-start md:col-span-12 lg:col-span-3" />
        )}
      </div>
    </header>
  );
}

/** Numbers as evidence: label and value on one line, hairlines between. */
export function Ledger({ facts, className }: { facts: readonly LedgerFact[]; className?: string }) {
  return (
    <dl className={cx("border-t border-line", className)}>
      {facts.map((fact) => (
        <div key={fact.label} className="flex items-baseline justify-between gap-3 border-b border-line py-3">
          <dt className="text-sm text-ink-2">{fact.label}</dt>
          <dd className="font-medium">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A section's head (the SectionShell board): the 2px rule, the title on the
 * start side, a line of his in the middle, and "see all" with the count on the
 * end side. It stands alone: a section can be hidden or moved without
 * breaking what's around it. On phones the three stack.
 */
export function SectionHead({
  id,
  title,
  intro,
  more,
}: {
  id: string;
  title: string;
  intro?: ReactNode;
  more?: { href: string; label: string; count?: string };
}) {
  return (
    <div className="grid items-baseline gap-3 border-t-2 border-rule pt-5 md:grid-cols-12 md:gap-gutter">
      <h2 id={id} className="type-h2 md:col-span-4">
        {title}
      </h2>
      {intro && <p className="type-small text-pretty text-ink-2 md:col-span-5">{intro}</p>}
      {more && (
        <div className={cx("md:justify-self-end", intro ? "md:col-span-3" : "md:col-span-8")}>
          <MoreLink href={more.href} label={more.label} count={more.count} />
        </div>
      )}
    </div>
  );
}

/** A titled block in a page's body, with the section head of the SectionShell board. */
export function PageSection({
  id,
  title,
  intro,
  more,
  children,
  className,
}: {
  id: string;
  title: string;
  intro?: ReactNode;
  more?: { href: string; label: string; count?: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={className}>
      <SectionHead id={id} title={title} intro={intro} more={more} />
      <div className="mt-8">{children}</div>
    </section>
  );
}

/** Plain text from a long-text field, keeping the editor's line breaks. */
export function TextBlock({ text }: { text: string }) {
  return <p className="max-w-prose whitespace-pre-line text-pretty leading-relaxed">{text}</p>;
}

/**
 * The "more" link (the Link board): it says where it goes and how much is
 * there ("All projects · 38"; an em dash in Arabic, see `metaSeparator`), in the accent with a hairline under it, and an
 * arrow that mirrors with the language. `back` turns the arrow around and
 * puts it first, for links that lead back up, such as "All services".
 */
export function MoreLink({
  href,
  label,
  back = false,
  count,
}: {
  href: string;
  label: string;
  back?: boolean;
  /** How many items wait there, formatted in the page's digits. */
  count?: string;
}) {
  const locale = useLocale();
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 border-b border-current py-1 text-[15px] text-accent transition-state hover:text-ink focus-ring"
    >
      {back && <ArrowForwardIcon aria-hidden="true" className="size-4 rotate-180" />}
      {count ? `${label}${metaSeparator(locale)}${count}` : label}
      {!back && <ArrowForwardIcon aria-hidden="true" className="size-4" />}
    </Link>
  );
}

/**
 * The closing invitation on public pages (the ConsultationCta board): a quiet
 * photo, his invitation with «اطلب استشارة» and a direct line, and what happens
 * next in three steps. An invitation to talk, never a coloured banner.
 */
export function ConsultationCta() {
  const t = useTranslations("Pages");
  const locale = useLocale();
  const steps = [t("ctaSteps.write"), t("ctaSteps.reply"), t("ctaSteps.meet")];
  const titleId = useId();

  return (
    <aside aria-labelledby={titleId} className={cx(CONTAINER, "mt-section")}>
      <div className="grid gap-6 border-t-2 border-b border-t-rule border-b-line py-7 md:grid-cols-12 md:gap-gutter">
        <Image
          src="/images/the-table.webp"
          alt={t("ctaPhotoAlt")}
          width={600}
          height={400}
          sizes="(min-width: 1280px) 300px, (min-width: 768px) 25vw, 100vw"
          className="aspect-[3/2] w-full object-cover max-md:hidden md:col-span-3"
        />
        <div className="flex min-w-0 flex-col gap-3 md:col-span-9 lg:col-span-5">
          <h2 id={titleId} className="type-h2">
            {t("ctaTitle")}
          </h2>
          <p className="type-body max-w-[30em] text-pretty text-ink-2">{t("ctaText")}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-6 gap-y-2">
            <ConsultationButton size="md" />
            <Link href="/contact" className={buttonClasses({ variant: "quiet" })}>
              {t("ctaDirect")}
            </Link>
          </div>
        </div>
        <ol aria-label={t("ctaStepsLabel")} className="md:col-span-12 lg:col-span-4">
          {steps.map((step, index) => (
            <li
              key={step}
              className="type-small grid grid-cols-[28px_minmax(0,1fr)] gap-2.5 border-b border-line py-2.5 first:border-t"
            >
              <span aria-hidden="true" className="font-medium text-ink-2 tabular-nums">
                {formatNumber(index + 1, locale === "ar" ? "ar" : "en")}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}

