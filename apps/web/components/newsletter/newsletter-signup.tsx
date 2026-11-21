import type { NewsletterSource } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { cx } from "@/components/ui/cx";
import { NewsletterForm } from "./newsletter-form";

/**
 * The newsletter signup (§6.15, NewsletterSignup board): a title, one line and
 * the form. `inline` sits after an article on the raised ground with the
 * quiet form; `footer` is the footer's plain copy. Use it wherever a signup
 * belongs, with that place as `source`. It reads no session and no data, so
 * it stays inside a static shell, and it brings its own words: the page needs
 * no message provider for it.
 */
export function NewsletterSignup({
  source,
  className,
  inFooter = false,
  inline = false,
}: {
  source: NewsletterSource;
  className?: string;
  /**
   * The footer's copy names its region apart, so a page with a second signup
   * (home, blog) doesn't have two landmarks called "Newsletter".
   */
  inFooter?: boolean;
  /** After an article: the raised ground and the compact form. */
  inline?: boolean;
}) {
  const t = useTranslations("Newsletter");
  const titleId = useId();

  return (
    <section
      {...(inFooter ? { "aria-label": t("footerLabel") } : { "aria-labelledby": titleId })}
      className={cx("flex flex-col gap-2", inline && "bg-surface p-4.5", className)}
    >
      <h2 id={titleId} className={cx("font-medium", inFooter ? "text-base" : "type-small")}>
        {t("title")}
      </h2>
      <p className="text-pretty text-ink-2 type-small">{t("intro")}</p>
      <NewsletterForm
        source={source}
        compact={inline}
        className="mt-1"
        labels={{
          email: t("email"),
          subscribe: t("subscribe"),
          subscribing: t("subscribing"),
          required: t("required"),
          emailInvalid: t("emailInvalid"),
          networkError: t("networkError"),
          internalError: t("errors.internal_error"),
          done: t("done"),
        }}
      />
    </section>
  );
}
