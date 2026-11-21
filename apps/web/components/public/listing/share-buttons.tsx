import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import { CopyLinkButton } from "./copy-link-button";
import { ExternalLinkIcon, MailIcon } from "@/components/icons";
import { SHARE_NETWORKS, shareHref } from "./links";

/** One row of the share column: the name, then a small glyph at the end. */
export const SHARE_ROW =
  "flex min-h-11 w-full items-center justify-between gap-3 border-b border-line text-sm text-ink no-underline transition-state hover:bg-surface-hover focus-ring focus-visible:-outline-offset-2";

/**
 * The share column (ArticleBody board): copy link first, then WhatsApp, X,
 * LinkedIn, Facebook and email, one row each under the 2px rule. Every
 * network is a plain link to its share page: no network script loads here.
 * `url` is the page's full canonical URL.
 */
export function ShareButtons({ url, title, className }: { url: string; title: string; className?: string }) {
  const t = useTranslations("PublicListing");

  return (
    <aside aria-label={t("shareLabel")} className={cx("flex flex-col border-t-2 border-rule", className)}>
      <CopyLinkButton
        url={url}
        labels={{ copy: t("copyLink"), copied: t("linkCopied"), failed: t("copyFailed") }}
        className={SHARE_ROW}
      />
      <ul>
        {SHARE_NETWORKS.map((network) => {
          const external = network !== "email";
          const name = t(`shareNetworks.${network}`);
          return (
            <li key={network}>
              <a
                href={shareHref(network, url, title)}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                aria-label={
                  external ? `${t("shareOn", { network: name })} ${t("opensInNewTab")}` : t("shareOn", { network: name })
                }
                className={SHARE_ROW}
              >
                {name}
                {external ? (
                  <ExternalLinkIcon aria-hidden="true" className="dir-icon size-3.5 text-ink-2" />
                ) : (
                  <MailIcon aria-hidden="true" className="size-3.5 text-ink-2" />
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
