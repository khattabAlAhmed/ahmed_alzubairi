import type { Locale } from "@repo/shared";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ConsultationButton } from "@/components/consultation-button";
import { CONTAINER } from "@/components/public/parts";
import { cx } from "@/components/ui/cx";
import type { PublicSiteSettings } from "@/lib/content";
import { formatNumber, whatsappHref } from "./format";
import { sectionHeadingId } from "./section";

/**
 * §6.2 #12, the page's close (the ConsultationCta board, as the home mockup
 * sets it): a quiet photo, the heading and intro set in the dashboard,
 * «اطلب استشارة», the direct channels from site settings as data rows, then
 * what happens next in three steps. An invitation to talk, never a banner.
 * Channels that aren't set are left out; numbers and addresses read LTR.
 */
export function ContactSection({
  heading,
  intro,
  settings,
  locale,
}: {
  heading: string;
  intro?: string;
  settings: Pick<PublicSiteSettings, "contactEmail" | "whatsappNumber">;
  locale: Locale;
}) {
  const t = useTranslations("Home");
  const tPages = useTranslations("Pages");
  const headingId = sectionHeadingId("contact");
  const steps = [tPages("ctaSteps.write"), tPages("ctaSteps.reply"), tPages("ctaSteps.meet")];

  const channels = [
    settings.whatsappNumber && {
      key: "whatsapp",
      label: t("whatsapp"),
      value: settings.whatsappNumber,
      href: whatsappHref(settings.whatsappNumber),
      newTab: true,
    },
    settings.contactEmail && {
      key: "email",
      label: t("email"),
      value: settings.contactEmail,
      href: `mailto:${settings.contactEmail}`,
      newTab: false,
    },
  ].filter((channel) => !!channel);

  return (
    <aside aria-labelledby={headingId} data-section="contact" className={cx(CONTAINER, "mt-section")}>
      <div className="grid gap-6 border-t-2 border-b border-t-rule border-b-line py-7 md:grid-cols-12 md:gap-gutter">
        <Image
          src="/images/the-table.webp"
          alt={tPages("ctaPhotoAlt")}
          width={600}
          height={400}
          sizes="(min-width: 1280px) 300px, (min-width: 768px) 25vw, 100vw"
          className="aspect-[3/2] w-full object-cover max-md:hidden md:col-span-3"
        />
        <div className="flex min-w-0 flex-col gap-3 md:col-span-9 lg:col-span-5">
          <h2 id={headingId} className="type-h2">
            {heading}
          </h2>
          {intro && <p className="max-w-[30em] text-pretty text-ink-2 type-body">{intro}</p>}
          <div className="mt-1.5">
            <ConsultationButton size="md" />
          </div>
          {channels.length > 0 && (
            <dl className="mt-2 border-t border-line">
              {channels.map((channel) => (
                <div key={channel.key} className="flex flex-col gap-0.5 border-b border-line py-2.5">
                  <dt className="text-ink-2 type-caption">{channel.label}</dt>
                  <dd className="min-w-0">
                    <a
                      href={channel.href}
                      dir="ltr"
                      className="font-mono text-[13px] break-all text-ink underline-offset-4 transition-state hover:underline focus-ring"
                      {...(channel.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    >
                      {channel.value}
                      {channel.newTab && <span className="sr-only"> {t("opensInNewTab")}</span>}
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <ol aria-label={tPages("ctaStepsLabel")} className="md:col-span-12 lg:col-span-4">
          {steps.map((step, index) => (
            <li
              key={step}
              className="grid grid-cols-[28px_minmax(0,1fr)] gap-2.5 border-b border-line py-2.5 type-small first:border-t"
            >
              <span aria-hidden="true" className="font-medium text-ink-2 tabular-nums">
                {formatNumber(index + 1, locale)}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
