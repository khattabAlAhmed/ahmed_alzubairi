import Image from "next/image";
import { useTranslations } from "next-intl";
import { ConsultationButton } from "@/components/consultation-button";
import { ButtonLink } from "@/components/ui";
import type { HomeSection } from "@/lib/content";
import { RING_ON_NAVY } from "../parts";

type HeroContent = Extract<HomeSection, { key: "hero" }>["content"];

/** §6.2 #1. The page's only h1 is the name. */
export function HeroSection({ content }: { content: HeroContent }) {
  const t = useTranslations("Home");

  return (
    <section aria-labelledby="home-hero-title" data-section="hero" className="bg-primary text-on-primary">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 md:grid-cols-[minmax(0,1fr)_auto] md:py-24">
        <div className="min-w-0">
          <span aria-hidden="true" className="mb-5 block h-0.5 w-14 rounded-full bg-accent" />
          <h1 id="home-hero-title" className="text-balance text-4xl leading-tight md:text-5xl">
            {content.name}
          </h1>
          <p className="mt-3 text-pretty text-xl text-on-primary/90 md:text-2xl">{content.title}</p>
          <p className="mt-5 max-w-prose text-pretty text-lg text-on-primary/80">{content.valueStatement}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/about" size="lg" className={RING_ON_NAVY}>
              {t("aboutCta")}
            </ButtonLink>
            {/* Secondary on navy: an outline instead of the button's own gold. */}
            <ConsultationButton
              className={`h-12! border border-on-primary/60 bg-transparent! px-6! text-lg! text-on-primary! shadow-none! hover:bg-on-primary/10! ${RING_ON_NAVY}`}
            />
          </div>
        </div>
        {content.photoUrl && (
          <div className="relative mx-auto aspect-[4/5] w-56 overflow-hidden rounded-xl border-2 border-accent shadow-lg sm:w-64 md:w-72 lg:w-80">
            <Image
              src={content.photoUrl}
              alt={t("photoAlt", { name: content.name })}
              fill
              priority
              sizes="(min-width: 1024px) 20rem, (min-width: 768px) 18rem, 16rem"
              className="object-cover"
            />
          </div>
        )}
      </div>
    </section>
  );
}
