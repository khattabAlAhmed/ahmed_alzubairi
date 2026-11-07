import { FAQ_CATEGORIES } from "@repo/shared";
import { useTranslations } from "next-intl";
import { CONTAINER, EmptyNote, PageSection } from "@/components/public/projects";
import { cx } from "@/components/ui/cx";
import { ChevronDownIcon } from "@/components/ui/icons";
import type { Faq } from "@/lib/content";

/** `/faq` below its hero: the four §6.13 sections, each with its questions. */
export function FaqList({ faqs }: { faqs: Faq[] }) {
  const t = useTranslations("Catalog");
  const groups = FAQ_CATEGORIES.flatMap((category) => {
    const items = faqs.filter((faq) => faq.category === category);
    return items.length > 0 ? [{ category, items }] : [];
  });

  if (groups.length === 0) {
    return (
      <div className={cx(CONTAINER, "py-12 md:py-16")}>
        <EmptyNote text={t("noFaqs")} />
      </div>
    );
  }

  return (
    <div className={cx(CONTAINER, "py-12 md:py-16")}>
      {groups.length > 1 && (
        <nav aria-label={t("faqSectionsLabel")} className="mb-10">
          <ul className="flex flex-wrap gap-2">
            {groups.map(({ category }) => (
              <li key={category}>
                <a
                  href={`#faq-${category}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-text/20 px-3.5 text-sm font-semibold hover:bg-text/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {t(`faqCategory.${category}`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="flex max-w-3xl flex-col gap-12">
        {groups.map(({ category, items }) => (
          <PageSection key={category} id={`faq-${category}`} title={t(`faqCategory.${category}`)} className="scroll-mt-24">
            <ul className="divide-y divide-text/10 rounded-lg border border-text/10 bg-surface shadow-sm">
              {items.map((faq) => (
                <li key={faq.id}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                      <span className="text-pretty">{faq.question}</span>
                      <ChevronDownIcon aria-hidden="true" className="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                    </summary>
                    <p className="whitespace-pre-line text-pretty px-5 pb-5 leading-relaxed text-text-secondary">
                      {faq.answer}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </PageSection>
        ))}
      </div>
    </div>
  );
}
