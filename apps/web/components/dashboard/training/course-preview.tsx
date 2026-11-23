"use client";

import { LOCALES, type Locale } from "@repo/shared";
import {
  NextIntlClientProvider,
  useLocale,
  useTimeZone,
  useTranslations,
  type AbstractIntlMessages,
} from "next-intl";
import { useEffect, useId, useState } from "react";
import { PreviewFrame, PREVIEW_WIDTHS, type PreviewWidth } from "@/components/dashboard/preview/preview-frame";
import { formatDate, metaSeparator } from "@/components/public/home/format";
import { CourseCard, SeatsMeter } from "@/components/public/listing";
import { CARD, CONTAINER, PageHero, PageSection, TextBlock } from "@/components/public/parts";
import { LocalDateTime } from "@/components/training/local-date-time";
import { coursePath, TRAINING_PATH } from "@/components/training/paths";
import { Button, Card } from "@/components/ui";
import type { CourseDetail } from "@/lib/content/courses";
import { previewCourse, type CourseValues } from "./format";

/**
 * The public messages the course views read, loaded in the browser only when
 * the preview opens, so the dashboard doesn't ship them up front.
 */
const LOADERS: Record<Locale, () => Promise<AbstractIntlMessages>> = {
  ar: async () => {
    const [base, listing, training] = await Promise.all([
      import("@/messages/ar.json"),
      import("@/messages/ar/PublicListing.json"),
      import("@/messages/ar/Training.json"),
    ]);
    return { ...base.default, PublicListing: listing.default, Training: training.default };
  },
  en: async () => {
    const [base, listing, training] = await Promise.all([
      import("@/messages/en.json"),
      import("@/messages/en/PublicListing.json"),
      import("@/messages/en/Training.json"),
    ]);
    return { ...base.default, PublicListing: listing.default, Training: training.default };
  },
};

/**
 * The course page (§6.7) as it will look once published, from the draft:
 * the same parts the public page is built from. The registration panel is a
 * still button: nothing in the preview registers or links anywhere.
 */
function CoursePageView({ course }: { course: CourseDetail }) {
  const t = useTranslations("Training");
  const tListing = useTranslations("PublicListing");
  const locale = useLocale();
  const recorded = course.type === "recorded";
  const online = course.type === "online_live";
  const full = course.seatsLeft !== null && course.seatsLeft <= 0;

  return (
    <main className="flex-1">
      <PageHero
        back={{ href: TRAINING_PATH, label: t("course.back") }}
        eyebrow={
          recorded
            ? `${tListing("courseType.recorded")}${metaSeparator(locale)}${tListing("comingSoon")}`
            : tListing(`courseType.${course.type}`)
        }
        title={course.title}
      />
      <div className={`${CONTAINER} grid gap-12 py-12 md:py-16 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]`}>
        <div className="space-y-12">
          <PageSection id="preview-course-about" title={t("course.about")}>
            <TextBlock text={course.description} />
          </PageSection>
          {course.audience && (
            <PageSection id="preview-course-audience" title={t("course.audience")}>
              <TextBlock text={course.audience} />
            </PageSection>
          )}
        </div>
        <aside className={`${CARD} h-fit space-y-6`}>
          <h2 className="text-xl">{t("course.details")}</h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-semibold text-text-secondary">{t("course.type")}</dt>
              <dd className="mt-1">{tListing(`courseType.${course.type}`)}</dd>
            </div>
            {!recorded && (
              <div>
                <dt className="text-sm font-semibold text-text-secondary">{t("course.date")}</dt>
                <dd className="mt-1">
                  {course.startsAt ? (
                    <LocalDateTime value={course.startsAt} fallback={formatDate(course.startsAt, locale)} />
                  ) : (
                    t("course.dateNotSet")
                  )}
                </dd>
              </div>
            )}
            {!recorded && (online || course.place) && (
              <div>
                <dt className="text-sm font-semibold text-text-secondary">{t("course.place")}</dt>
                <dd className="mt-1">{online ? t("course.online") : course.place}</dd>
              </div>
            )}
            {!recorded && course.type !== "custom" && (
              <div>
                <dt className="text-sm font-semibold text-text-secondary">{t("course.seats")}</dt>
                <dd className="mt-1">
                  {course.seats !== null && course.seatsLeft !== null ? (
                    <SeatsMeter left={course.seatsLeft} total={course.seats} />
                  ) : (
                    t("course.noLimit")
                  )}
                </dd>
              </div>
            )}
          </dl>
          {!recorded && course.type !== "custom" && (
            <div className="border-t border-text/10 pt-6">
              {full ? (
                <span className="inline-flex h-11 w-full items-center justify-center rounded-md border border-dashed border-text/40 px-4 font-semibold text-text-secondary">
                  {tListing("courseFull")}
                </span>
              ) : (
                <Button type="button" className="w-full" tabIndex={-1}>
                  {t("register.button")}
                </Button>
              )}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

/** The course's card on /training, as the list shows it. */
function CourseCardView({ course }: { course: CourseDetail }) {
  return (
    <div className={`${CONTAINER} py-12`}>
      <div className="max-w-sm">
        <CourseCard
          href={coursePath(course.slug || "preview")}
          type={course.type}
          title={course.title}
          description={course.description}
          startsAt={course.startsAt}
          place={course.place}
          seats={course.seats !== null && course.seatsLeft !== null ? { left: course.seatsLeft, total: course.seats } : null}
        />
      </div>
    </div>
  );
}

type Option<T extends string> = { value: T; label: string };

function Segmented<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="mt-1 inline-flex flex-wrap rounded-md border border-text/20 p-0.5">
        {options.map((option) => (
          <label
            key={option.value}
            className="cursor-pointer rounded px-3 py-1.5 text-sm has-checked:bg-text has-checked:text-background has-focus-visible:outline-2 has-focus-visible:outline-ring"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const cache = new Map<Locale, Promise<AbstractIntlMessages>>();

function loadMessages(locale: Locale): Promise<AbstractIntlMessages> {
  let pending = cache.get(locale);
  if (!pending) {
    pending = LOADERS[locale]();
    // A failed load can be tried again.
    pending.catch(() => cache.delete(locale));
    cache.set(locale, pending);
  }
  return pending;
}

/**
 * The preview before publishing (§6.20): the form's unsaved values as the
 * course page and its card on /training, in either language, light or dark,
 * at a phone or desktop width. Read-only: it never saves or publishes.
 */
export function CoursePreview({
  values,
  registrationCount,
}: {
  values: CourseValues;
  registrationCount: number;
}) {
  const t = useTranslations("DashboardTraining.preview");
  const pageLocale = useLocale() as Locale;
  const timeZone = useTimeZone();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [locale, setLocale] = useState<Locale>(pageLocale);
  const [view, setView] = useState<"page" | "card">("page");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [width, setWidth] = useState<PreviewWidth>("mobile");
  const [messages, setMessages] = useState<Partial<Record<Locale, AbstractIntlMessages>>>({});
  const [failedLocale, setFailedLocale] = useState<Locale | null>(null);

  const course = previewCourse(values, locale, registrationCount);
  const language = t(`languages.${locale}`);
  const loaded = messages[locale];

  useEffect(() => {
    if (!open || loaded) return;
    let live = true;
    loadMessages(locale).then(
      (value) => {
        if (!live) return;
        setMessages((current) => ({ ...current, [locale]: value }));
        setFailedLocale(null);
      },
      () => live && setFailedLocale(locale),
    );
    return () => {
      live = false;
    };
  }, [open, locale, loaded]);

  return (
    <Card as="section" compact aria-labelledby={`${id}-heading`} className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <h2 id={`${id}-heading`} className="text-lg">
            {t("heading")}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">{t("intro")}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? t("hide") : t("show")}
        </Button>
      </div>
      <div id={`${id}-body`} hidden={!open} className="space-y-4">
        {open && (
          <>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <Segmented
                legend={t("view")}
                name={`${id}-view`}
                value={view}
                options={[
                  { value: "page", label: t("views.page") },
                  { value: "card", label: t("views.card") },
                ]}
                onChange={setView}
              />
              <Segmented
                legend={t("language")}
                name={`${id}-locale`}
                value={locale}
                options={LOCALES.map((value) => ({ value, label: t(`languages.${value}`) }))}
                onChange={setLocale}
              />
              <Segmented
                legend={t("theme")}
                name={`${id}-theme`}
                value={theme}
                options={[
                  { value: "light", label: t("light") },
                  { value: "dark", label: t("dark") },
                ]}
                onChange={setTheme}
              />
              <Segmented
                legend={t("width")}
                name={`${id}-width`}
                value={width}
                options={(Object.keys(PREVIEW_WIDTHS) as PreviewWidth[]).map((value) => ({
                  value,
                  label: t(`widths.${value}`, { pixels: PREVIEW_WIDTHS[value] }),
                }))}
                onChange={setWidth}
              />
            </div>

            <div aria-live="polite" className="space-y-2">
              {values.status !== "published" && (
                <p className="rounded-md border border-text/20 p-3 text-sm">{t("draftNote")}</p>
              )}
              {!course && (
                <p className="rounded-md border border-danger p-3 text-sm">{t("incomplete", { language })}</p>
              )}
              {failedLocale === locale && (
                <p className="rounded-md border border-danger p-3 text-sm">{t("loadFailed")}</p>
              )}
            </div>

            {course && (
              <PreviewFrame
                title={t("frameTitle", { language })}
                locale={locale}
                dark={theme === "dark"}
                width={width}
              >
                {loaded ? (
                  <NextIntlClientProvider locale={locale} messages={loaded} timeZone={timeZone}>
                    {view === "page" ? <CoursePageView course={course} /> : <CourseCardView course={course} />}
                  </NextIntlClientProvider>
                ) : (
                  <p className="p-6 text-sm">{t("loading")}</p>
                )}
              </PreviewFrame>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
