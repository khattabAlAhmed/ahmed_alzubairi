import { useTranslations } from "next-intl";
import { whatsappHref } from "@/components/public/home/format";
import type { PublicSiteSettings } from "@/lib/content";

/**
 * A channel as a row (the ContactForm board): what it is, small, then the
 * number or address as the thing to press, in ink, underlined on hover.
 */
const CHANNEL =
  "group flex flex-col gap-0.5 border-b border-line py-2.5 text-ink no-underline transition-state hover:bg-surface-hover focus-ring";

/** Only plain web links reach an `href`: a stored `javascript:` or `data:` value never does. */
function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

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
    settings.linkedinUrl && isHttps(settings.linkedinUrl)
      ? {
          key: "linkedin",
          label: label("linkedin"),
          value: settings.linkedinUrl.replace(/^https:\/\/(www\.)?/, ""),
          href: settings.linkedinUrl,
          newTab: true,
        }
      : null,
    ...settings.socialLinks.filter((link) => isHttps(link.url)).map((link, index) => ({
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
      <h2 id="contact-channels-title" className="type-h3">
        {t("channelsTitle")}
      </h2>
      <ul className="mt-3 border-t border-line">
        {channels.map((channel) => (
          <li key={channel.key}>
            <a
              href={channel.href}
              className={CHANNEL}
              {...(channel.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              <span className="text-ink-2 type-caption">{channel.label}</span>
              {/* Numbers, addresses and links read left to right in both languages. */}
              <bdi
                dir="ltr"
                className="font-mono text-[14px] break-all underline-offset-4 decoration-1 group-hover:underline"
              >
                {channel.value}
              </bdi>
              {channel.newTab && <span className="sr-only">{t("opensInNewTab")}</span>}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
