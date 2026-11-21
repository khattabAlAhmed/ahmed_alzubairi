import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui";
import type { PublicSiteSettings } from "@/lib/content";
import { whatsappHref } from "./format";
import { HomeSectionShell } from "./section";

/** A channel as a row of the list: what it is, then the number or address as data. */
const CHANNEL =
  "flex flex-col gap-0.5 border-b border-line py-2.5 text-ink no-underline transition-state hover:bg-surface-hover focus-ring";

/**
 * §6.2 #12, quick contact on the home page (the QuickContact board's
 * channels): each channel set in site settings as a row, then the contact page.
 */
export function ContactSection({
  heading,
  intro,
  settings,
}: {
  heading: string;
  intro?: string;
  settings: Pick<PublicSiteSettings, "contactEmail" | "whatsappNumber" | "linkedinUrl">;
}) {
  const t = useTranslations("Home");
  const external = <span className="sr-only">{t("opensInNewTab")}</span>;

  const channels = [
    settings.contactEmail && {
      key: "email",
      label: t("email"),
      value: settings.contactEmail,
      href: `mailto:${settings.contactEmail}`,
      newTab: false,
    },
    settings.whatsappNumber && {
      key: "whatsapp",
      label: t("whatsapp"),
      value: settings.whatsappNumber,
      href: whatsappHref(settings.whatsappNumber),
      newTab: true,
    },
    settings.linkedinUrl && {
      key: "linkedin",
      label: t("linkedin"),
      value: settings.linkedinUrl.replace(/^https:\/\/(www\.)?/, ""),
      href: settings.linkedinUrl,
      newTab: true,
    },
  ].filter((channel) => !!channel);

  return (
    <HomeSectionShell sectionKey="contact" heading={heading} intro={intro ?? t("contactIntro")} band="navy">
      <div className="grid gap-8 md:grid-cols-12 md:gap-gutter">
        {channels.length > 0 && (
          <ul className="border-t border-line md:col-span-6 lg:col-span-5">
            {channels.map((channel) => (
              <li key={channel.key}>
                <a
                  href={channel.href}
                  className={CHANNEL}
                  {...(channel.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  <span className="type-small font-medium">{channel.label}</span>
                  {/* Numbers, addresses and links read left to right in both languages. */}
                  <bdi dir="ltr" className="font-mono text-[13px] break-all text-ink-2">
                    {channel.value}
                  </bdi>
                  {channel.newTab && external}
                </a>
              </li>
            ))}
          </ul>
        )}
        <div className="md:col-span-6 lg:col-span-4">
          <ButtonLink href="/contact" variant="secondary">
            {t("sendMessage")}
          </ButtonLink>
        </div>
      </div>
    </HomeSectionShell>
  );
}
