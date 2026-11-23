import { DEFAULT_PAGE_SIZE } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Refusal } from "@/components/dashboard/refusal";
import {
  loadCourses,
  loadRegistrations,
  parseRegistrationParams,
  trainingAccess,
} from "@/components/dashboard/training/data";
import { courseTitle, registrationsPath, REGISTRATIONS_PATH } from "@/components/dashboard/training/format";
import { Paging } from "@/components/dashboard/training/paging";
import { RegistrationList } from "@/components/dashboard/training/registration-list";
import { TrainingNav } from "@/components/dashboard/training/section-nav";
import { Button, ButtonLink, Card, PageHeader, Select, TextField } from "@/components/ui";
import { requireTeamMember } from "@/lib/auth/gates";

type Params = Promise<{ locale: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * Course registrations (§6.20 Training), newest first, with the shared list
 * params. Opens with `training.manage`; the rows and the clients' names are
 * read with the member's own client, so RLS decides what shows (§5).
 */
export default async function RegistrationsPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  await requireTeamMember(params, "/dashboard/training/registrations");
  const access = await trainingAccess(params);
  if (!access.allowed) return <Refusal />;
  const { locale } = access;

  const list = parseRegistrationParams(await searchParams);
  const [t, all, courses, { registrations, total }] = await Promise.all([
    getTranslations("DashboardTraining"),
    getMessages(),
    loadCourses(),
    loadRegistrations(list),
  ]);
  const filtered = Boolean(list.search || list.course);
  const pages = Math.max(1, Math.ceil(total / list.pageSize));
  const link = (page: number) =>
    registrationsPath({ page, pageSize: list.pageSize, search: list.search, course: list.course });
  // A page past the end (an old link, or fewer matches now): the last page.
  if (list.page > pages) redirect(`/${locale}${link(pages)}`);
  const course = list.course ? courses.find((item) => item.id === list.course) : undefined;
  const courseName = course ? (courseTitle(course, locale) ?? t("list.noTitle")) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={courseName ? t("registrations.courseTitle", { title: courseName }) : t("registrations.title")}
        intro={t("registrations.intro")}
      />
      <TrainingNav current="registrations" />

      {/* A plain GET form: the filter lives in the address and works without scripts. */}
      <form
        key={[list.search, list.course].join("|")}
        method="get"
        role="search"
        aria-label={t("filters.label")}
        className="flex flex-wrap items-start gap-3"
      >
        {list.pageSize !== DEFAULT_PAGE_SIZE && <input type="hidden" name="pageSize" value={list.pageSize} />}
        <TextField
          label={t("filters.search")}
          hint={t("registrations.searchHint")}
          name="search"
          type="search"
          defaultValue={list.search ?? ""}
          maxLength={200}
          className="min-w-0 flex-1 basis-64"
        />
        <Select label={t("registrations.course")} name="course" defaultValue={list.course ?? ""} className="min-w-0 basis-64">
          <option value="">{t("filters.allCourses")}</option>
          {courses.map((item) => (
            <option key={item.id} value={item.id}>
              {courseTitle(item, locale) ?? t("list.noTitle")}
            </option>
          ))}
        </Select>
        {/* The label's line and its gap, so the buttons sit level with the fields. */}
        <div className="mt-6 flex gap-2">
          <Button type="submit" variant="secondary">
            {t("filters.apply")}
          </Button>
          {filtered && (
            <ButtonLink href={REGISTRATIONS_PATH} variant="quiet">
              {t("filters.clear")}
            </ButtonLink>
          )}
        </div>
      </form>

      <p role="status" className="text-sm text-ink-2">
        {t("registrations.count", { total })}
      </p>

      {registrations.length === 0 ? (
        <Card as="section">
          <h2 className="text-xl">{filtered ? t("registrations.emptyFiltered") : t("registrations.empty")}</h2>
        </Card>
      ) : (
        <NextIntlClientProvider locale={locale} messages={{ DashboardTraining: all.DashboardTraining }}>
          <RegistrationList registrations={registrations} locale={locale} showCourse={!list.course} />
        </NextIntlClientProvider>
      )}

      <Paging page={list.page} pages={pages} link={link} />
    </div>
  );
}
