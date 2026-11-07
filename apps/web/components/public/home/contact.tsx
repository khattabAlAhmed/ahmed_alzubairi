import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui";
import type { PublicSiteSettings } from "@/lib/content";
import { whatsappHref } from "./format";
import { HomeSectionShell } from "./section";

const CHANNEL =
  "flex h-full flex-col gap-1 rounded-lg border border-on-primary/20 p-5 hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** §6.2 #12: the channels set in site settings, and the contact page. */
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
      {channels.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((channel) => (
            <li key={channel.key}>
              <a
                href={channel.href}
                className={CHANNEL}
                {...(channel.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                <span className="text-sm text-on-primary/80">{channel.label}</span>
                {/* Numbers, addresses and links read left to right in both languages. */}
                <span className="break-all font-semibold">
                  <bdi dir="ltr">{channel.value}</bdi>
                </span>
                {channel.newTab && external}
              </a>
            </li>
          ))}
        </ul>
      )}
      <ButtonLink
        href="/contact"
        size="lg"
        className="mt-8 focus-visible:outline-accent!"
      >
        {t("sendMessage")}
      </ButtonLink>
    </HomeSectionShell>
  );
}
