import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Refusal } from "@/components/dashboard/refusal";
import { CourseList } from "@/components/dashboard/training/course-list";
import { loadCourses, trainingAccess } from "@/components/dashboard/training/data";
import { TRAINING_BASE } from "@/components/dashboard/training/format";
import { TrainingNav } from "@/components/dashboard/training/section-nav";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { requireTeamMember } from "@/lib/auth/gates";

/**
 * The courses (§6.20 Training). Opens with `training.manage`, checked here on
 * the server; the rows are read with the member's own client, so RLS checks
 * it again, and every route checks it for every write.
 */
export default async function TrainingPage({ params }: { params: Promise<{ locale: string }> }) {
  await requireTeamMember(params, "/dashboard/training");
  const access = await trainingAccess(params);
  if (!access.allowed) return <Refusal />;
  const { locale } = access;

  const [t, all, courses] = await Promise.all([
    getTranslations("DashboardTraining"),
    getMessages(),
    loadCourses(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        intro={t("intro")}
        actions={<ButtonLink href={`${TRAINING_BASE}/new`}>{t("add")}</ButtonLink>}
      />
      <TrainingNav current="courses" />
      <p role="status" className="text-sm text-ink-2">
        {t("count", { total: courses.length })}
      </p>

      {courses.length === 0 ? (
        <Card as="section">
          <h2 className="text-xl">{t("empty.title")}</h2>
          <p className="mt-2 text-ink-2">{t("empty.text")}</p>
        </Card>
      ) : (
        // The browser gets only this section's namespace.
        <NextIntlClientProvider locale={locale} messages={{ DashboardTraining: all.DashboardTraining }}>
          <CourseList courses={courses} locale={locale} />
        </NextIntlClientProvider>
      )}
    </div>
  );
}
