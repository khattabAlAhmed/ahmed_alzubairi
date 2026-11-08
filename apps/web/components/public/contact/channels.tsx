import { useTranslations } from "next-intl";
import { whatsappHref } from "@/components/public/home/format";
import type { PublicSiteSettings } from "@/lib/content";

const CHANNEL =
  "flex h-full flex-col gap-1 rounded-lg border border-text/15 bg-surface p-5 shadow-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

type Channel = { key: string; label: string; value: string; href: string; newTab: boolean };

/** The direct channels set in site settings (§6.14). Nothing shows for an unset one. */
export function contactChannels(
  settings: Pick<PublicSiteSettings, "contactEmail" | "whatsappNumber" | "linkedinUrl" | "socialLinks">,
  label: (key: "email" | "whatsapp" | "linkedin") => string,
): Channel[] {
  const channels: (Channel | null)[] = [
    settings.contactEmail
      ? {
          key: "email",
          label: label("email"),
          value: settings.contactEmail,
          href: `mailto:${settings.contactEmail}`,
          newTab: false,
        }
      : null,
    settings.whatsappNumber
      ? {
          key: "whatsapp",
          label: label("whatsapp"),
          value: settings.whatsappNumber,
          href: whatsappHref(settings.whatsappNumber),
          newTab: true,
        }
      : null,
    settings.linkedinUrl
      ? {
          key: "linkedin",
          label: label("linkedin"),
          value: settings.linkedinUrl.replace(/^https:\/\/(www\.)?/, ""),
          href: settings.linkedinUrl,
          newTab: true,
        }
      : null,
    ...settings.socialLinks.map((link, index) => ({
      key: `social-${index}`,
      label: link.platform,
      value: link.url.replace(/^https:\/\/(www\.)?/, ""),
      href: link.url,
      newTab: true,
    })),
  ];
  return channels.filter((channel) => channel !== null);
}

export function ContactChannels({ settings }: { settings: Parameters<typeof contactChannels>[0] }) {
  const t = useTranslations("Contact");
  const channels = contactChannels(settings, (key) => t(key));
  if (channels.length === 0) return null;

  return (
    <section aria-labelledby="contact-channels-title">
      <h2 id="contact-channels-title" className="text-2xl">
        {t("channelsTitle")}
      </h2>
      <ul className="mt-6 grid gap-4">
        {channels.map((channel) => (
          <li key={channel.key}>
            <a
              href={channel.href}
              className={CHANNEL}
              {...(channel.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              <span className="text-sm text-text-secondary">{channel.label}</span>
              {/* Numbers, addresses and links read left to right in both languages. */}
              <span className="break-all font-semibold">
                <bdi dir="ltr">{channel.value}</bdi>
              </span>
              {channel.newTab && <span className="sr-only">{t("opensInNewTab")}</span>}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
