import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ArrowForwardIcon, CheckIcon, DownloadIcon } from "@/components/icons";
import { StatNumber } from "@/components/public/home/stat-number";
import { localizeStatValue } from "@/components/public/home/stat-value";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import type { ExpertiseArea, HomeStat, Partner, Service, TimelineItem } from "@/lib/content";

/*
 * The content components of the identity pages (components.md §5, first
 * half), in "The record": hierarchy from type, space and hairlines, never a
 * grid of cards, never icons in circles. The home sections and the about,
 * expertise, services and clients pages are built from these, and the
 * design-system page shows each in its states.
 */

type HeadingLevel = 2 | 3;

function Heading({ level, className, children }: { level: HeadingLevel; className?: string; children: ReactNode }) {
  const Tag = level === 2 ? "h2" : "h3";
  return <Tag className={className}>{children}</Tag>;
}

/** The "more" arrow: drawn for Arabic, mirrored in English. */
function MoreArrow({ className }: { className?: string }) {
  return <ArrowForwardIcon aria-hidden="true" className={cx("size-[18px] shrink-0 text-ink-2", className)} />;
}

/* ---------------------------------------------------------- quiet stat -- */

/**
 * The quick stats as a band (the QuietStat board, 1): the 2px rule, then each
 * number over the sentence that says what it means, with hairlines between.
 * Static: nothing counts up. Values come from `home_stats`, never from code.
 */
export function StatBand({ stats, className }: { stats: readonly HomeStat[]; className?: string }) {
  return (
    <dl className={cx("grid border-t-2 border-rule sm:grid-cols-2 lg:grid-cols-4", className)}>
      {stats.map((stat) => (
        <div
          key={stat.id}
          className={cx(
            "flex flex-col-reverse justify-end gap-1.5 border-b border-line py-[18px] sm:pe-6",
            // A hairline between cells, none at the start of a row: 2 a row, then 4.
            "sm:even:border-s sm:even:ps-6",
            "lg:even:border-s-0 lg:even:ps-0 lg:[&:not(:nth-child(4n+1))]:border-s lg:[&:not(:nth-child(4n+1))]:ps-6",
          )}
        >
          <dt className="type-small text-pretty text-ink-2">{stat.label}</dt>
          <dd className="text-[40px] leading-[1.2] font-medium">
            <StatNumber value={stat.value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The quick stats as a ledger (the QuietStat board, 3, and beside the
 * portrait on the Hero board): label and value on one line, hairlines between.
 */
export function StatLedger({ stats, className }: { stats: readonly HomeStat[]; className?: string }) {
  return (
    <dl className={cx("border-t border-line", className)}>
      {stats.map((stat) => (
        <div key={stat.id} className="flex items-baseline justify-between gap-3 border-b border-line py-3">
          <dt className="text-sm text-ink-2">{stat.label}</dt>
          <dd className="font-medium">
            <StatNumber value={stat.value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A number inside one of his sentences (the QuietStat board, 2): tabular, in
 * the page's digits, underlined in the accent. The sentence around it says
 * what it means.
 */
export function InlineStat({ value }: { value: string }) {
  return <StatNumber value={value} className="border-b-2 border-accent" />;
}

/* ------------------------------------------------------ expertise area -- */

/**
 * The areas of expertise as chapters (the ExpertiseArea board): each one the
 * 2px rule, its name, one sentence, what it covers, and a quiet foot line. The
 * whole chapter is one link. No icons, no cards.
 */
export function ExpertiseChapters({
  areas,
  headingLevel = 3,
  covers,
  meta,
}: {
  areas: readonly ExpertiseArea[];
  headingLevel?: HeadingLevel;
  /** What each area covers, by area id: its services, for example. */
  covers?: Readonly<Record<string, readonly string[]>>;
  /** A quiet line at the foot, by area id: real counts, in the page's digits. */
  meta?: Readonly<Record<string, string>>;
}) {
  return (
    <ul className="grid gap-x-gutter gap-y-10 md:grid-cols-3">
      {areas.map((area) => {
        const items = covers?.[area.id] ?? [];
        return (
          <li key={area.id} className="flex min-w-0">
            <Link
              href={`/expertise/${area.slug}`}
              className="group flex w-full flex-col gap-3.5 border-t-2 border-rule pt-[18px] pb-[22px] text-ink no-underline focus-ring"
            >
              <Heading level={headingLevel} className="type-h2 text-balance decoration-1 underline-offset-8 group-hover:underline">
                {area.title}
              </Heading>
              <p className="type-small text-pretty text-ink-2">{area.summary}</p>
              {items.length > 0 && (
                <ul className="border-t border-line">
                  {items.map((item) => (
                    <li key={item} className="border-b border-line py-2 text-[15px]">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              <span className="mt-auto flex items-center justify-between gap-3 text-[13px] text-ink-2">
                <span>{meta?.[area.id]}</span>
                <MoreArrow />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------ audience -- */

/**
 * Who he works with (the Audience board, §6.2 "لمن أعمل"): rows read across,
 * the 2px rule over them and hairlines between, not three cards. On phones
 * each row is one block.
 */
export function AudienceRows({
  items,
  headingLevel = 3,
}: {
  items: readonly { title: string; description?: string | null }[];
  headingLevel?: HeadingLevel;
}) {
  return (
    <ul className="border-t-2 border-rule">
      {items.map((item, index) => (
        <li
          key={index}
          className="grid items-baseline gap-2 border-b border-line py-5 md:grid-cols-[minmax(0,3fr)_minmax(0,9fr)] md:gap-gutter"
        >
          <Heading level={headingLevel} className="type-h3 text-balance">
            {item.title}
          </Heading>
          {item.description && <p className="type-body max-w-measure text-pretty">{item.description}</p>}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------- service -- */

/**
 * The services as an index (the ServiceList board): one row each, name, one
 * line of his, a quiet meta column and the arrow. The row named in `openId`
 * is the featured one: on the surface, a little larger. Each row is a link.
 */
export function ServiceRows({
  services,
  openId,
  headingLevel = 3,
  meta,
}: {
  services: readonly Service[];
  /** The featured row, shown open. */
  openId?: string | null;
  headingLevel?: HeadingLevel;
  /** A quiet column by service id, e.g. its number of stages. */
  meta?: Readonly<Record<string, string>>;
}) {
  return (
    <ul className="border-t-2 border-rule">
      {services.map((service) => {
        const open = service.id === openId;
        return (
          <li key={service.id} className="border-b border-line">
            <Link
              href={`/services/${service.slug}`}
              className={cx(
                "group grid items-baseline gap-x-gutter gap-y-1.5 text-ink no-underline transition-state hover:bg-surface-hover focus-ring",
                "grid-cols-[minmax(0,1fr)_24px] md:grid-cols-[minmax(0,4fr)_minmax(0,6fr)_minmax(0,2fr)_24px]",
                open ? "bg-surface px-4 py-[22px]" : "py-4",
              )}
            >
              <Heading
                level={headingLevel}
                className={cx("type-h3 col-start-1 text-balance decoration-1 underline-offset-6 group-hover:underline", open && "md:text-2xl")}
              >
                {service.title}
              </Heading>
              <span className="col-start-1 row-start-2 flex flex-col gap-2 md:col-start-2 md:row-start-1">
                <span className={cx("text-pretty", open ? "type-body" : "type-small text-ink-2")}>{service.summary}</span>
              </span>
              <span className="col-start-1 row-start-3 text-[13px] text-ink-2 md:col-start-3 md:row-start-1">
                {meta?.[service.id]}
              </span>
              <MoreArrow className="col-start-2 row-start-1 self-center md:col-start-4" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Non-blank lines, without list markers the editor may have typed. */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-•*]|\d+[.)-]|[٠-٩]+[.)-])\s+/, "").trim())
    .filter((line) => line !== "");
}

/**
 * Who a service suits and what the client gets (the Service mockup): two
 * columns, each opened by the 2px rule at the same height. Who it suits is a
 * record row with its label; what you get is a list with a check before each
 * item when the editor wrote one per line.
 */
export function ServiceFacts({ audience, deliverables }: { audience: string | null; deliverables: string | null }) {
  const t = useTranslations("Pages");
  const gets = deliverables ? splitLines(deliverables) : [];
  return (
    <div className="grid gap-x-gutter gap-y-8 md:grid-cols-2">
      {audience && (
        <section
          aria-labelledby="service-audience"
          className="grid grid-cols-[var(--label-col)_minmax(0,1fr)] content-start gap-4 border-t-2 border-b border-t-rule border-b-line py-3.5"
        >
          <h2 id="service-audience" className="type-small text-ink-2">
            {t("audience")}
          </h2>
          <p className="type-body whitespace-pre-line text-pretty">{audience}</p>
        </section>
      )}
      {deliverables && (
        <section aria-labelledby="service-deliverables" className="flex flex-col border-t-2 border-rule">
          <h2 id="service-deliverables" className="type-small py-2.5 text-ink-2">
            {t("deliverables")}
          </h2>
          {gets.length > 1 ? (
            <ul className="border-t border-line">
              {gets.map((item, index) => (
                <li key={index} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5 border-b border-line py-2 text-[15px] leading-[1.8]">
                  <CheckIcon aria-hidden="true" className="mt-1 size-5 text-accent" />
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-small border-t border-line pt-3 whitespace-pre-line text-pretty">{deliverables}</p>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * Work stages (the ServicePage board): numbered columns under the 2px rule,
 * hairlines between, when the editor wrote one stage per line; otherwise the
 * text as written. Each line may be "name: what happens".
 *
 * Below the wide layout an even number of stages reads two by two (the
 * Services mockup's 2×2 at 375 px); an odd number stays one column, so no
 * stage is left alone on its last row (the Service mockup).
 */
export function StageStrip({ text, formatIndex }: { text: string; formatIndex: (n: number) => string }) {
  const lines = splitLines(text);
  if (lines.length < 2) return <p className="type-body whitespace-pre-line text-pretty">{text}</p>;
  const pairs = lines.length % 2 === 0;
  return (
    <ol
      className={cx(
        "grid border-t-2 border-rule",
        pairs && "grid-cols-2",
        lines.length >= 5 ? "lg:grid-cols-5" : lines.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
      )}
    >
      {lines.map((line, index) => {
        const [name, ...rest] = line.split(/[:：]\s*/);
        const note = rest.join(": ");
        return (
          <li
            key={index}
            className={cx(
              "flex min-w-0 flex-col gap-1.5 border-b border-line py-3.5 pe-4",
              // A hairline between the two columns, none at the start of a row.
              pairs && "max-lg:even:border-s max-lg:even:ps-4",
              "lg:[&:not(:first-child)]:border-s lg:[&:not(:first-child)]:ps-4",
            )}
          >
            <b className="text-[13px] font-medium text-ink-2 tabular-nums">{formatIndex(index + 1)}</b>
            <span className="type-small font-medium text-pretty">{note ? name : line}</span>
            {note && <span className="type-caption text-pretty text-ink-2">{note}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The request beside a service (the ServicePage board): on the surface, under
 * the 2px rule, sticky while the page scrolls on wide screens.
 */
export function RequestPanel({
  title,
  action,
  children,
  after,
}: {
  title: string;
  action: ReactNode;
  /** His note above the button. */
  children?: ReactNode;
  /** A note under the button. */
  after?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-t-2 border-rule bg-surface p-5 lg:sticky lg:top-20">
      <p className="type-h3 text-balance">{title}</p>
      {children}
      {action}
      {after}
    </div>
  );
}

/* ------------------------------------------------------ career timeline -- */

/**
 * A period or a year as the editor wrote it, in the page's digits (DESIGN.md
 * "Numbers": Arabic-Indic on an Arabic page). In Arabic it keeps the page's
 * direction, so "٢٠١٦ – ٢٠٢٠" starts on the start side as the About mockup
 * shows; in English it stays isolated left to right.
 */
function Period({ value }: { value: string }) {
  const locale = useLocale();
  const text = localizeStatValue(value, locale);
  return locale === "ar" ? <span className="[unicode-bidi:isolate]">{text}</span> : <bdi>{text}</bdi>;
}

/** A period still running: a start and a dash with no end year ("2020 – الآن", "2020–present", "2020 –"). */
export function isOngoing(period: string | null): boolean {
  if (!period) return false;
  const [, end] = period.split(/\s*[–—-]\s*/);
  return end !== undefined && !/[0-9٠-٩]/.test(end);
}

/** The spine's piece in a row: it runs into the rows above and below, and stops at the first and last marks. */
function spineSpan(index: number, count: number) {
  if (index === 0) return "top-2.5 -bottom-3.5";
  if (index === count - 1) return "-top-3.5 h-6";
  return "-top-3.5 -bottom-3.5";
}

/**
 * The career as a spine (the CareerTimeline board): the period on the start
 * side, a thin line with a small square at each role, then the role and one
 * line. The current role alone is in the accent.
 */
export function CareerTimeline({ items, label }: { items: readonly TimelineItem[]; label?: string }) {
  return (
    <ol aria-label={label}>
      {items.map((item, index) => {
        const now = isOngoing(item.period);
        return (
          <li key={item.id} className="grid grid-cols-[88px_20px_minmax(0,1fr)] gap-3 py-3.5 sm:grid-cols-[110px_20px_minmax(0,1fr)] sm:gap-4">
            <span className={cx("pt-0.5 text-end text-sm tabular-nums", now ? "text-accent" : "text-ink-2")}>
              {item.period && <Period value={item.period} />}
            </span>
            <span aria-hidden="true" className="relative flex justify-center">
              {items.length > 1 && <span className={cx("absolute border-s border-line-strong", spineSpan(index, items.length))} />}
              <i className={cx("relative mt-[9px] size-[9px] border-[1.5px]", now ? "border-accent bg-accent" : "border-ink bg-bg")} />
            </span>
            <div className="min-w-0">
              <h3 className="type-h3 text-balance">{item.title}</h3>
              {item.description && <p className="type-small text-pretty text-ink-2">{item.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* --------------------------------------------- qualifications and values -- */

/**
 * Qualifications (the Qualifications board): a table under the 2px rule, the
 * qualification, who gave it, and the year in tabular figures.
 */
export function QualificationList({ items, label }: { items: readonly TimelineItem[]; label?: string }) {
  const t = useTranslations("ContentIdentity.qualifications");
  return (
    <table aria-label={label} className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-t-2 border-b border-t-rule border-b-line text-[13px] text-ink-2">
          <th scope="col" className="px-3 py-2.5 text-start font-medium whitespace-nowrap max-sm:ps-0">
            {t("qualification")}
          </th>
          <th scope="col" className="px-3 py-2.5 text-start font-medium whitespace-nowrap">
            {t("institution")}
          </th>
          <th scope="col" className="px-3 py-2.5 text-start font-medium whitespace-nowrap max-sm:pe-0">
            {t("year")}
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className="border-b border-line align-baseline">
            <td className="px-3 py-3 font-medium text-pretty max-sm:ps-0">{item.title}</td>
            <td className="px-3 py-3 text-pretty text-ink-2">{item.description}</td>
            <td className="px-3 py-3 tabular-nums max-sm:pe-0">{item.period && <Period value={item.period} />}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The CV as one row under the 2px rule (the Qualifications board): an icon, its name, and «تنزيل». */
export function CvLink({ href, label, detail }: { href: string; label: string; detail?: string }) {
  const t = useTranslations("ContentIdentity.cv");
  return (
    <a
      href={href}
      download
      className="group grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3.5 border-t-2 border-b border-t-rule border-b-line py-3.5 text-ink no-underline focus-ring"
    >
      <DownloadIcon aria-hidden="true" className="size-6 text-ink-2" />
      <span className="flex flex-col">
        <span className="type-small font-medium">{label}</span>
        {detail && (
          <span aria-hidden="true" dir="ltr" className="mono-meta text-start text-ink-2">
            {detail}
          </span>
        )}
      </span>
      {/* The link's name is the label; this repeats it as the board's action word. */}
      <span aria-hidden="true" className="border-b border-current py-1 text-[15px] text-accent transition-state group-hover:text-ink">
        {t("download")}
      </span>
    </a>
  );
}

/** One value of his: the short rule, then what it means in practice. */
export type ValueItem = { term: string; definition: string };

/**
 * His values and working method as definitions (the Qualifications board,
 * beside the table): each rule in his words over a hairline, what it means
 * under it in the secondary ink. No icons, no numbers, no cards.
 */
export function ValueList({ items, label }: { items: readonly ValueItem[]; label?: string }) {
  return (
    <dl aria-label={label}>
      {items.map((item) => (
        <div key={item.term}>
          <dt className="border-t border-line pt-3.5 text-[19px] font-medium text-pretty">{item.term}</dt>
          <dd className="pb-3.5 text-[15px] leading-[1.85] text-pretty text-ink-2">{item.definition}</dd>
        </div>
      ))}
    </dl>
  );
}

/* --------------------------------------------------- organization logos -- */

/**
 * Approved organizations as a register (the OrganizationLogos board): a grid
 * of hairline cells, each logo in grey at one size with the name under it.
 * Calm, low on the page, never a wall. `lib/content` gives only partners with
 * consent confirmed, admin approval and published (§6.11); a hidden name
 * never reaches here.
 */
export function OrganizationRegister({
  partners,
  more,
}: {
  partners: readonly Partner[];
  /** The last cell: the way to every organization. */
  more?: { href: string; label: string; note?: string };
}) {
  const t = useTranslations("Catalog");
  return (
    <ul className="grid grid-cols-2 border-s border-t border-line sm:grid-cols-3 lg:grid-cols-6">
      {partners.map((partner) => (
        <li key={partner.id} className="flex min-h-[132px] min-w-0 flex-col justify-between gap-3 border-e border-b border-line p-4">
          {partner.logoUrl ? (
            <span className="relative block h-10 w-full opacity-80 grayscale">
              <Image
                src={partner.logoUrl}
                alt={t("partnerLogo", { name: partner.name })}
                fill
                sizes="10rem"
                className="object-contain object-[center_left] rtl:object-[center_right]"
              />
            </span>
          ) : (
            <span aria-hidden="true" />
          )}
          {/* Under a logo, the name is already the logo's alt: shown, not read twice. */}
          <span
            aria-hidden={partner.logoUrl ? "true" : undefined}
            className={cx("text-pretty", partner.logoUrl ? "type-caption text-ink-2" : "type-small text-ink")}
          >
            {partner.name}
          </span>
        </li>
      ))}
      {more && (
        <li className="flex min-h-[132px] flex-col justify-between gap-3 border-e border-b border-line p-4">
          <Link
            href={more.href}
            className="inline-flex items-center gap-2 self-start border-b border-current py-1 text-[15px] text-accent transition-state hover:text-ink focus-ring"
          >
            {more.label}
            <ArrowForwardIcon aria-hidden="true" className="size-4" />
          </Link>
          {more.note && <span className="type-caption text-ink-2">{more.note}</span>}
        </li>
      )}
    </ul>
  );
}

/* ---------------------------------------------------------- testimonial -- */

export type TestimonialData = { id: string; quote: string; author: string; organization: string | null };

/**
 * Testimonials (the Testimonial board): the first in full, with the label
 * column beside it, the others as short excerpts in a column. Each comes from
 * a real thank-you letter, shown only with consent and admin approval
 * (§6.11); the letter itself never shows.
 */
export function TestimonialSet({ testimonials, source }: { testimonials: readonly TestimonialData[]; source?: string }) {
  const [first, ...rest] = testimonials;
  if (!first) return null;
  return (
    <div className={cx("grid gap-x-gutter gap-y-10", rest.length > 0 && "lg:grid-cols-12")}>
      <figure
        className={cx(
          "grid gap-4 border-t-2 border-rule pt-5 sm:grid-cols-[var(--label-col)_minmax(0,1fr)] sm:gap-6",
          rest.length > 0 && "lg:col-span-7",
        )}
      >
        {/* The label column: where the words come from, when the page says it. */}
        <p className="type-caption text-ink-2">{source}</p>
        <div className="flex min-w-0 flex-col gap-[18px]">
          <blockquote className="max-w-[30em] text-[22px] leading-[1.8] font-normal text-pretty whitespace-pre-line md:text-[26px] [:lang(en)_&]:leading-[1.5]">
            {first.quote}
          </blockquote>
          <figcaption className="flex flex-col gap-0.5">
            <span className="type-small font-medium">{first.author}</span>
            {first.organization && <span className="type-caption text-ink-2">{first.organization}</span>}
          </figcaption>
        </div>
      </figure>
      {rest.length > 0 && (
        <div className="border-t-2 border-rule lg:col-span-5">
          {rest.map((testimonial) => (
            <figure key={testimonial.id} className="flex flex-col gap-2 border-b border-line py-4">
              <blockquote className="type-body text-pretty whitespace-pre-line">{testimonial.quote}</blockquote>
              <figcaption className="type-caption text-ink-2">
                {[testimonial.author, testimonial.organization].filter(Boolean).join(" · ")}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
