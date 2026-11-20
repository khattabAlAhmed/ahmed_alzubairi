import { COURSE_TYPES, type CourseType } from "@repo/shared";
import { useTranslations } from "next-intl";
import { CourseCard, FilterChips } from "@/components/public/listing";
import { CourseSchedule } from "@/components/public/listing/course-card";
import { CONTAINER, EmptyNote } from "@/components/public/parts";
import { ButtonLink } from "@/components/ui";
import type { Course } from "@/lib/content/courses";
import { coursePath, CUSTOM_TRAINING_PATH, TRAINING_PATH } from "./paths";

/** The types a client registers for (§6.7). The card offers these a way in. */
const REGISTERABLE: readonly CourseType[] = ["in_person", "online_live"];

/**
 * The courses of the training page as a schedule (§6.7, CourseItem board),
 * with a chip per type that has a course. A recorded course shows "قريباً"
 * and no button; a full one shows "اكتملت المقاعد"; a custom one links to the
 * request form; the others link to the course page, where registration
 * happens.
 */
export function CourseList({ courses, type }: { courses: Course[]; type: CourseType | null }) {
  const t = useTranslations("Training");
  const tListing = useTranslations("PublicListing");
  const present = COURSE_TYPES.filter((item) => courses.some((course) => course.type === item));
  const shown = type ? courses.filter((course) => course.type === type) : courses;
  // An active filter keeps its chips even when nothing matches, so "All" can clear it.
  const chips = type && !present.includes(type) ? COURSE_TYPES.filter((item) => item === type || present.includes(item)) : present;

  return (
    <div className={`${CONTAINER} py-12 md:py-16`}>
      {(present.length > 1 || type !== null) && (
        <FilterChips
          label={t("typeFilter")}
          pathname={TRAINING_PATH}
          param="type"
          query={type ? { type } : {}}
          options={chips.map((item) => ({ value: item, label: tListing(`courseType.${item}`) }))}
          className="mb-8"
        />
      )}
      {shown.length === 0 ? (
        <EmptyNote text={type ? t("emptyFiltered") : t("empty")} />
      ) : (
        <CourseSchedule>
          {shown.map((course) => (
            <CourseCard
              key={course.id}
              href={coursePath(course.slug)}
              type={course.type}
              title={course.title}
              description={course.description}
              startsAt={course.startsAt}
              place={course.place}
              seats={
                course.seats !== null && course.seatsLeft !== null
                  ? { left: course.seatsLeft, total: course.seats }
                  : null
              }
              action={
                REGISTERABLE.includes(course.type) ? (
                  <ButtonLink href={coursePath(course.slug)} variant="primary" size="sm">
                    {t("viewCourse")}
                  </ButtonLink>
                ) : course.type === "custom" ? (
                  <ButtonLink href={CUSTOM_TRAINING_PATH} variant="secondary" size="sm">
                    {t("custom.linkFromCourse")}
                  </ButtonLink>
                ) : undefined
              }
            />
          ))}
        </CourseSchedule>
      )}
    </div>
  );
}
