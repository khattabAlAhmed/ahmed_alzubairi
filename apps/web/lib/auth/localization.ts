import { arSA } from "@clerk/localizations";
import type { Locale } from "@repo/shared";
import type { Messages } from "next-intl";

// Clerk's strings go into every page's HTML. These are the ones sign-in and
// sign-up use, about a third of `arSA`. Add to this if a new Clerk component
// needs more, such as `userProfile` for <UserProfile />.
const USED_KEYS =
  /^(locale|signIn|signUp|formField|formButton|footer|dividerText|backButton|unstable__errors)/;

const arabic: Partial<typeof arSA> = Object.fromEntries(
  Object.entries(arSA).filter(([key]) => USED_KEYS.test(key)),
);

/**
 * Fills the strings `arSA` leaves in English, for the screens this site uses,
 * and replaces the `arSA` strings that have spelling mistakes (mostly a wrong
 * hamza, such as "أنشاء" for "إنشاء"). Only strings the email and password
 * flow can show are replaced.
 * Both languages go through here, so the text stays in `messages/`.
 */
export function clerkLocalization(locale: Locale, text: Messages["Clerk"]) {
  const base = locale === "ar" ? arabic : undefined;
  const strength = text.passwordStrength;
  const reset = text.resetPassword;

  return {
    ...base,
    formFieldInputPlaceholder__emailAddress: text.emailPlaceholder,
    formFieldInputPlaceholder__password: text.passwordPlaceholder,
    formFieldInputPlaceholder__signUpPassword: text.newPasswordPlaceholder,
    formFieldInputPlaceholder__firstName: text.firstNamePlaceholder,
    formFieldInputPlaceholder__lastName: text.lastNamePlaceholder,
    formFieldInput__emailAddress_format: text.emailFormat,
    formFieldHintText__optional: text.optional,
    footerActionLink__useAnotherMethod: text.useAnotherMethod,
    signInEnterPasswordTitle: text.enterPassword,
    unstable__errors: {
      ...base?.unstable__errors,
      form_password_incorrect: text.errors.passwordIncorrect,
      form_password_length_too_short: text.errors.passwordTooShort,
      form_password_matches_identifier: text.errors.passwordMatchesIdentifier,
      form_password_untrusted__sign_in: text.errors.passwordUntrusted,
      form_code_incorrect: text.errors.codeIncorrect,
      verification_expired: text.errors.codeExpired,
      form_param_format_invalid: text.errors.invalidFormat,
      too_many_requests: text.errors.tooManyRequests,
      form_identifier_exists__email_address: text.errors.emailTaken,
      form_param_format_invalid__email_address: text.errors.emailInvalid,
      form_param_max_length_exceeded__first_name: text.errors.firstNameTooLong,
      form_param_max_length_exceeded__last_name: text.errors.lastNameTooLong,
      form_password_pwned: text.errors.passwordPwned,
      form_password_pwned__sign_in: text.errors.passwordPwnedSignIn,
      form_password_size_in_bytes_exceeded: text.errors.passwordTooLong,
      zxcvbn: {
        ...base?.unstable__errors?.zxcvbn,
        couldBeStronger: strength.couldBeStronger,
        goodPassword: strength.good,
        suggestions: {
          ...base?.unstable__errors?.zxcvbn?.suggestions,
          allUppercase: strength.allUppercase,
          capitalization: strength.capitalization,
          longerKeyboardPattern: strength.longerKeyboardPattern,
        },
        warnings: {
          ...base?.unstable__errors?.zxcvbn?.warnings,
          common: strength.common,
          namesByThemselves: strength.namesByThemselves,
          pwned: strength.pwned,
          similarToCommon: strength.similarToCommon,
        },
      },
    },
    signIn: {
      ...base?.signIn,
      start: { ...base?.signIn?.start, titleCombined: text.titleCombined },
      password: {
        ...base?.signIn?.password,
        title: text.enterPassword,
        actionLink: text.useAnotherMethod,
      },
      alternativeMethods: {
        ...base?.signIn?.alternativeMethods,
        title: text.useAnotherMethod,
      },
      forgotPassword: {
        ...base?.signIn?.forgotPassword,
        subtitle: text.forgotPasswordSubtitle,
      },
      resetPassword: {
        ...base?.signIn?.resetPassword,
        title: reset.title,
        formButtonPrimary: reset.button,
        requiredMessage: reset.required,
        successMessage: reset.success,
      },
      resetPasswordMfa: {
        ...base?.signIn?.resetPasswordMfa,
        detailsLabel: reset.verifyIdentity,
      },
      passwordCompromised: {
        ...base?.signIn?.passwordCompromised,
        title: text.passwordCompromised,
      },
      passwordUntrusted: {
        ...base?.signIn?.passwordUntrusted,
        title: text.passwordUntrusted,
      },
    },
    signUp: {
      ...base?.signUp,
      start: {
        ...base?.signUp?.start,
        title: text.signUpTitle,
        titleCombined: text.signUpTitle,
        subtitleCombined: text.subtitleCombined,
      },
    },
  };
}
