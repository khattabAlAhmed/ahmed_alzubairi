import { FAQ_CATEGORIES } from "@repo/shared";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/empty-state";
import { SectionIndex } from "@/components/public/section-index";
import { cx } from "@/components/ui/cx";
import type { Faq } from "@/lib/content";

/**
 * One question (FAQ board): the question as the summary with a plus that turns
 * into a minus, the answer under it at reading measure. Every question on the
 * page shares one `name`, so opening one closes the open one.
 */
export function FaqItem({ question, answer, open = false }: { question: string; answer: string; open?: boolean }) {
  return (
    <details name="faq" open={open} className="group border-b border-line">
      <summary
        className={cx(
          "grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_24px] items-center gap-4 py-4 text-[19px] leading-[1.7] font-medium",
          "focus-ring focus-visible:-outline-offset-2 [&::-webkit-details-marker]:hidden",
        )}
      >
        <span className="text-pretty">{question}</span>
        <span aria-hidden="true" className="relative size-4 justify-self-center">
          <span className="absolute inset-x-0 top-[7px] border-t-[1.5px] border-current" />
          <span className="absolute inset-x-0 top-[7px] rotate-90 border-t-[1.5px] border-current transition-transform duration-200 group-open:rotate-0 motion-reduce:transition-none" />
        </span>
      </summary>
      <p className="max-w-measure whitespace-pre-line text-pretty pb-5 type-body">{answer}</p>
    </details>
  );
}

/**
 * `/faq` below its hero (§6.13, FAQ board): the section index with counts
 * beside the questions, grouped by the four sections, one open at a time.
 */
export function FaqList({
  faqs,
}: {
  faqs: Faq[];
  /** Kept for the design-system page: the list no longer draws the page container. */
  bare?: boolean;
}) {
  const t = useTranslations("Catalog");
  const groups = FAQ_CATEGORIES.flatMap((category) => {
    const items = faqs.filter((faq) => faq.category === category);
    return items.length > 0 ? [{ category, items }] : [];
  });

  if (groups.length === 0) {
    return <EmptyState level={2} title={t("faqPage.empty.title")} text={t("faqPage.empty.text")} />;
  }

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-gutter">
      {groups.length > 1 && (
        <SectionIndex
          label={t("faqSectionsLabel")}
          items={groups.map(({ category, items }) => ({
            label: t(`faqCategory.${category}`),
            href: `#faq-${category}`,
            count: items.length,
          }))}
          className="self-start lg:sticky lg:top-24 lg:col-span-3"
        />
      )}
      <div className={cx("flex min-w-0 flex-col gap-12", groups.length > 1 ? "lg:col-span-9" : "lg:col-span-12 max-w-3xl")}>
        {groups.map(({ category, items }) => (
          <section key={category} id={`faq-${category}`} aria-labelledby={`faq-${category}-title`} className="scroll-mt-24">
            <h2 id={`faq-${category}-title`} className="pb-3 text-ink-2 type-small">
              {t(`faqCategory.${category}`)}
            </h2>
            <div className="border-t-2 border-rule">
              {items.map((faq) => (
                // The first question starts open, so the page shows what an answer looks like.
                <FaqItem key={faq.id} question={faq.question} answer={faq.answer} open={faq === groups[0].items[0]} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
