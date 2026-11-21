import Image from "next/image";
import { useTranslations } from "next-intl";
import { ConsultationButton } from "@/components/consultation-button";
import { CONTAINER } from "@/components/public/parts";
import { PhotoMissing } from "@/components/public/listing/parts";
import { StatLedger } from "@/components/public/pages/identity";
import { ButtonLink } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import type { HomeSection, HomeStat } from "@/lib/content";

type HeroContent = Extract<HomeSection, { key: "hero" }>["content"];

/**
 * §6.2 #1, the dossier (Ahmed's choice, plan.md Phase 8; the Hero board): his
 * name (the page's h1) and title, then his statement and the two actions on
 * the start side; on the end side the 4:5 portrait, with the quick stats as a
 * quiet ledger beside it. Never a centred title with two buttons, no frame
 * around the photo, nothing counting up.
 *
 * On phones it reads down: the name, the statement, the photo at full width,
 * the buttons, then the ledger.
 */
export function HeroSection({
  content,
  stats = [],
  sample,
}: {
  content: HeroContent;
  stats?: readonly HomeStat[];
  /** The design-system page: its own id, and the name as a paragraph, not a second h1. */
  sample?: string;
}) {
  const t = useTranslations("Home");
  const tWork = useTranslations("ContentWork");
  const titleId = sample ? `${sample}-title` : "home-hero-title";
  const Title = sample ? "p" : "h1";
  const photo = content.photoUrl;
  const hasStats = stats.length > 0;

  return (
    <section
      aria-labelledby={titleId}
      data-section={sample ? undefined : "hero"}
      // A sample sits inside the design-system page's own column.
      className={cx(!sample && CONTAINER, !sample && "mt-8 md:mt-12")}
    >
      <div
        className={cx(
          "grid gap-x-gutter gap-y-6 border-t-2 border-rule pt-7 settle",
          "[grid-template-areas:'id'_'title'_'photo'_'actions'_'stats']",
          hasStats
            ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)_150px] lg:[grid-template-areas:'id_photo_stats'_'title_photo_stats'_'actions_photo_stats']"
            : "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:[grid-template-areas:'id_photo'_'title_photo'_'actions_photo']",
          "lg:grid-rows-[auto_auto_1fr]",
        )}
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[15px] text-ink-2 [grid-area:id]">
          {/* The page's one h1 is his name, small: the statement under it carries the size. */}
          <Title id={titleId} className="text-[17px] font-semibold text-ink">
            {content.name}
          </Title>
          <p>{content.title}</p>
        </div>
        <p className="type-display max-w-[14em] text-balance [grid-area:title] settle settle-2">{content.valueStatement}</p>
        <div className="flex flex-wrap items-center gap-4 self-end pb-2 [grid-area:actions] settle settle-3">
          <ButtonLink href="/about" size="lg">
            {t("aboutCta")}
          </ButtonLink>
          <ConsultationButton size="lg" variant="secondary" />
        </div>
        <figure className="relative aspect-[4/5] w-full self-end bg-surface [grid-area:photo] max-lg:max-w-[420px]">
          {photo ? (
            <Image
              src={photo}
              alt={t("photoAlt", { name: content.name })}
              fill
              priority={!sample}
              sizes="(min-width: 1280px) 26rem, (min-width: 1024px) 30vw, 420px"
              className="object-cover"
            />
          ) : (
            // Not uploaded yet: the hatched panel, never a broken image (DESIGN.md "Imagery").
            <PhotoMissing label={tWork("gallery.missing")} className="absolute inset-0" />
          )}
        </figure>
        {hasStats && <StatLedger stats={stats} className="self-end [grid-area:stats]" />}
      </div>
    </section>
  );
}
