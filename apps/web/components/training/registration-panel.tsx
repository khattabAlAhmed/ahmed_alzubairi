import type { Locale } from "@repo/shared";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { CheckIcon } from "@/components/icons";
import { Button, buttonClasses, ButtonLink } from "@/components/ui";
import { MoreLink } from "@/components/public/parts";
import { cx } from "@/components/ui/cx";
import { onboardingPath, signInPath } from "@/lib/auth/return-path";
import { courseState, type Course } from "@/lib/content/courses";
import { readViewer, type Viewer } from "./data";
import { coursePath, CUSTOM_TRAINING_PATH, MY_COURSES_PATH } from "./paths";
import { RegisterButton } from "./register-button";

const NOTE = "text-pretty text-ink-2 type-small";
const HINT = "text-pretty text-[13px] text-ink-2";

function ExternalLink({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClasses({ variant: "secondary", className: "w-full" })}
    >
      {label}
      <span className="sr-only"> {hint}</span>
    </a>
  );
}

/**
 * What the course page offers this viewer, decided on the server for each
 * request: it reads the session, so the page renders it inside Suspense and
 * the rest of the page stays cached.
 *
 * Order matters. Someone registered sees that first, even when the course is
 * now full or over. A recorded course offers nothing. Then the course's own
 * state (full, closed), and only then who is asking.
 */
export async function RegistrationPanel({
  course,
  locale,
  viewer: given,
  now = new Date(),
}: {
  course: Pick<Course, "id" | "slug" | "type" | "startsAt" | "seatsLeft">;
  locale: Locale;
  /** For tests. The page lets the panel read it. */
  viewer?: Viewer;
  now?: Date;
}) {
  const t = await getTranslations({ locale, namespace: "Training" });
  const viewer = given ?? (await readViewer(course.id));
  const state = courseState(course, now);

  if (viewer.kind === "client" && viewer.registered) {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-success">
          <CheckIcon aria-hidden="true" className="size-3.5" />
          {t("register.registered")}
        </p>
        {viewer.onlineUrl && (
          <ExternalLink
            href={viewer.onlineUrl}
            label={t("course.openLink")}
            hint={t("course.opensInNewTab")}
          />
        )}
        <div>
          <MoreLink href={MY_COURSES_PATH} label={t("register.myCourses")} />
        </div>
      </div>
    );
  }

  if (state === "soon") return <p className={NOTE}>{t("register.soon")}</p>;
  if (course.type === "custom") {
    return (
      <div className="flex flex-col gap-3">
        <p className={NOTE}>{t("register.custom")}</p>
        <ButtonLink href={CUSTOM_TRAINING_PATH} variant="secondary" className="w-full">
          {t("custom.linkFromCourse")}
        </ButtonLink>
      </div>
    );
  }
  if (state === "ended") {
    return (
      <p className="font-medium type-small">
        {t("register.ended")}
      </p>
    );
  }
  if (state === "closed") return <p className={NOTE}>{t("register.closed")}</p>;
  if (state === "full") {
    return (
      <Button disabled className="w-full">
        {t("register.full")}
      </Button>
    );
  }

  // Back to this same page after sign-in or onboarding (§6.16).
  const here = `/${locale}${coursePath(course.slug)}`;
  if (viewer.kind === "signed_out") {
    return (
      <div className="flex flex-col gap-3">
        {/* A plain link: the path already carries the language. */}
        <a href={signInPath(locale, here)} className={buttonClasses({ className: "w-full" })}>
          {t("register.signIn")}
        </a>
        <p className={HINT}>{t("register.signInHint")}</p>
      </div>
    );
  }
  if (viewer.kind === "no_profile") {
    return (
      <a href={onboardingPath(locale, here)} className={buttonClasses({ className: "w-full" })}>
        {t("register.completeProfile")}
      </a>
    );
  }
  if (viewer.kind === "team") return <p className={NOTE}>{t("register.teamOnly")}</p>;

  return <RegisterButton courseId={course.id} />;
}

/**
 * The panel's frame (RegistrationPanel board): the raised ground under a 2px
 * rule, the course's facts as a ledger, then the panel itself.
 */
export function RegistrationFrame({
  facts,
  children,
  className,
}: {
  facts: { label: string; value: ReactNode }[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-3 border-t-2 border-rule bg-surface p-4.5", className)}>
      {facts.length > 0 && (
        <dl className="border-t border-line">
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-baseline justify-between gap-3 border-b border-line py-3">
              <dt className="text-sm text-ink-2">{fact.label}</dt>
              <dd className="text-base font-medium tabular-nums">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
    </div>
  );
}
