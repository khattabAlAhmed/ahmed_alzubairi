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
 * Fills the strings `arSA` leaves in English, for the screens this site uses.
 * Both languages go through here, so the text stays in `messages/`.
 */
export function clerkLocalization(locale: Locale, text: Messages["Clerk"]) {
  const base = locale === "ar" ? arabic : undefined;

  return {
    ...base,
    formFieldInputPlaceholder__emailAddress: text.emailPlaceholder,
    formFieldInputPlaceholder__password: text.passwordPlaceholder,
    formFieldInputPlaceholder__signUpPassword: text.newPasswordPlaceholder,
    formFieldInputPlaceholder__firstName: text.firstNamePlaceholder,
    formFieldInputPlaceholder__lastName: text.lastNamePlaceholder,
    formFieldInput__emailAddress_format: text.emailFormat,
    signIn: {
      ...base?.signIn,
      start: { ...base?.signIn?.start, titleCombined: text.titleCombined },
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
      start: { ...base?.signUp?.start, subtitleCombined: text.subtitleCombined },
    },
  };
}
