import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ClerkSignIn, ClerkSignUp } from "@/components/clerk/clerk-forms";
import { CheckIcon } from "@/components/icons";
import { cx } from "@/components/ui/cx";

/*
 * The SignIn board: Clerk's card on one side, and beside it why an account
 * is worth having, in his voice. Sign-up shows its two steps and what comes
 * next. The Clerk part reads the URL in the browser (clerk/clerk-forms.tsx);
 * this frame is rendered with the page, so its words need no client bundle.
 */

function Frame({ form, aside }: { form: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid w-full max-w-page items-start gap-8 lg:grid-cols-[5fr_6fr] lg:gap-16">
      <div className="min-w-0 [&_.cl-rootBox]:w-full [&_.cl-cardBox]:w-full [&_.cl-cardBox]:max-w-none">{form}</div>
      <div className="flex min-w-0 flex-col gap-3.5 lg:pt-5">{aside}</div>
    </div>
  );
}

const REASONS = ["consultations", "documents", "courses"] as const;

export function SignInForm() {
  const t = useTranslations("AuthReason.signIn");
  return (
    <Frame
      form={<ClerkSignIn />}
      aside={
        <>
          <p className="max-w-[24em] font-medium text-pretty type-h3">{t("reason")}</p>
          <ul className="border-t border-line">
            {REASONS.map((key) => (
              <li key={key} className="flex items-start gap-2.5 border-b border-line py-2.5 type-small">
                <CheckIcon aria-hidden="true" className="mt-1.5 size-3.5 shrink-0 text-ink-2" />
                {t(`reasons.${key}`)}
              </li>
            ))}
          </ul>
        </>
      }
    />
  );
}

export function SignUpForm() {
  const t = useTranslations("AuthReason.signUp");
  return (
    <Frame
      form={
        <div className="flex flex-col gap-4">
          {/* Two steps: the account now, then the details (onboarding). */}
          <ol aria-label={t("steps.label")} className="grid grid-cols-2 border-t border-line text-[13px]">
            <li aria-current="step" className={cx("py-2.5 text-ink shadow-[inset_0_2px_0_var(--accent)]")}>
              {t("steps.account")}
            </li>
            <li className="py-2.5 text-ink-2">{t("steps.details")}</li>
          </ol>
          <ClerkSignUp />
        </div>
      }
      aside={<p className="max-w-[28em] text-pretty text-ink-2 type-small">{t("note")}</p>}
    />
  );
}
