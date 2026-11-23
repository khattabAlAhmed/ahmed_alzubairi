import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui";

/** What a member sees when they open a section without its permission. */
export async function Refusal() {
  const t = await getTranslations("DashboardContent.refusal");

  return (
    <section
      role="alert"
      className="border border-ink/10 bg-surface p-6"
    >
      <h1 className="text-2xl">{t("title")}</h1>
      <p className="mt-2 max-w-prose text-ink-2">{t("text")}</p>
      <ButtonLink href="/dashboard" variant="secondary" className="mt-4">
        {t("back")}
      </ButtonLink>
    </section>
  );
}
