import type { NewsletterSource } from "@repo/shared";
import { useTranslations } from "next-intl";
import { NewsletterForm } from "@/components/newsletter";
import { CONTAINER } from "@/components/public/parts";
import { cx } from "@/components/ui/cx";
import { sectionHeadingId } from "./section";

/**
 * §6.2 #11, the NewsletterSignup board's home block: under the opening rule,
 * the heading and intro set in the dashboard on the start side, the address
 * and «اشترك» beside them; stacked on phones. Double opt-in through the
 * shared form, with source `home` (§6.15). The blog index uses the same
 * block (the Blog mockup), with source `blog`.
 */
export function NewsletterSection({
  heading,
  intro,
  source = "home",
}: {
  heading: string;
  intro?: string;
  /** Where the signup was made (§6.15). */
  source?: NewsletterSource;
}) {
  const t = useTranslations("Newsletter");
  const headingId = sectionHeadingId("newsletter");

  return (
    <section aria-labelledby={headingId} data-section="newsletter" className={cx(CONTAINER, "mt-section")}>
      <div className="grid gap-x-gutter gap-y-5 border-t-2 border-rule pt-5 md:grid-cols-12">
        <div className="flex flex-col gap-1.5 md:col-span-5">
          <h2 id={headingId} className="type-h2">
            {heading}
          </h2>
          {intro && <p className="text-pretty text-ink-2 type-small">{intro}</p>}
        </div>
        <NewsletterForm
          source={source}
          className="md:col-span-6 md:col-start-7"
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
      </div>
    </section>
  );
}
