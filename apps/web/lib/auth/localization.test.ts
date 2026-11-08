import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import { clerkLocalization } from "./localization";

describe("clerkLocalization", () => {
  it("fills the gaps in arSA and keeps its other strings", () => {
    const result = clerkLocalization("ar", ar.Clerk);
    expect(result.formFieldInputPlaceholder__emailAddress).toBe(
      ar.Clerk.emailPlaceholder,
    );
    expect(result.signIn.start.titleCombined).toBe(ar.Clerk.titleCombined);
    expect(result.signIn.start.title).toBeTruthy();
    expect(result.signUp.start.title).toBeTruthy();
  });

  it("fills the errors arSA lacks and keeps the ones it has", () => {
    const errors = clerkLocalization("ar", ar.Clerk).unstable__errors;
    expect(errors.form_password_incorrect).toBe(
      ar.Clerk.errors.passwordIncorrect,
    );
    expect(errors.form_identifier_not_found).toBeTruthy();
  });

  it("leaves out strings for components the site doesn't use", () => {
    const result = clerkLocalization("ar", ar.Clerk);
    expect(result).not.toHaveProperty("userProfile");
    expect(result).not.toHaveProperty("organizationProfile");
  });

  it("adds no Arabic to English", () => {
    const result = clerkLocalization("en", en.Clerk);
    expect(result.signIn.start.title).toBeUndefined();
    expect(result.formFieldInputPlaceholder__password).toBe(
      en.Clerk.passwordPlaceholder,
    );
  });
});

// DaVinci replaced arSA strings with spelling mistakes (mostly a wrong hamza)
// in P1F-T14 (commit 220f78f, PR #15). Each corrected string is pinned here as
// a literal, so an edit to localization.ts or to messages/ar.json that undoes
// one fails this test.
const CORRECTED_AR: readonly (readonly [path: string, value: string])[] = [
  ["formFieldHintText__optional", "اختياري"],
  ["footerActionLink__useAnotherMethod", "استخدم طريقة أخرى"],
  ["signInEnterPasswordTitle", "أدخل كلمة المرور"],
  ["unstable__errors.form_identifier_exists__email_address", "هذا البريد الإلكتروني مستخدم بالفعل. جرّب بريدًا آخر."],
  ["unstable__errors.form_param_format_invalid__email_address", "أدخل بريدًا إلكترونيًا صالحًا."],
  ["unstable__errors.form_param_max_length_exceeded__first_name", "يجب ألا يتجاوز الاسم الأول 256 حرفًا."],
  ["unstable__errors.form_param_max_length_exceeded__last_name", "يجب ألا يتجاوز اسم العائلة 256 حرفًا."],
  ["unstable__errors.form_password_pwned", "لا يمكن استخدام كلمة المرور هذه لأنها ظهرت في تسريب بيانات. اختر كلمة مرور أخرى."],
  ["unstable__errors.form_password_pwned__sign_in", "لا يمكن استخدام كلمة المرور هذه لأنها ظهرت في تسريب بيانات. أعد تعيين كلمة المرور."],
  ["unstable__errors.form_password_size_in_bytes_exceeded", "كلمة المرور أطول من الحد المسموح. اختر كلمة مرور أقصر أو احذف بعض الرموز الخاصة."],
  ["unstable__errors.zxcvbn.couldBeStronger", "كلمة المرور مقبولة، لكن يمكن أن تكون أقوى. جرّب إضافة أحرف أكثر."],
  ["unstable__errors.zxcvbn.goodPassword", "كلمة المرور تستوفي جميع المتطلبات اللازمة."],
  ["unstable__errors.zxcvbn.suggestions.allUppercase", "اجعل بعض الأحرف كبيرة، لا كلها."],
  ["unstable__errors.zxcvbn.suggestions.capitalization", "اجعل أكثر من الحرف الأول كبيرًا."],
  ["unstable__errors.zxcvbn.suggestions.longerKeyboardPattern", "استخدم أنماطًا أطول على لوحة المفاتيح، وغيّر اتجاه الكتابة عدة مرات."],
  ["unstable__errors.zxcvbn.warnings.common", "كلمة المرور هذه شائعة الاستخدام."],
  ["unstable__errors.zxcvbn.warnings.namesByThemselves", "الأسماء أو الألقاب وحدها سهلة التخمين."],
  ["unstable__errors.zxcvbn.warnings.pwned", "كُشفت كلمة المرور هذه في تسريب بيانات على الإنترنت."],
  ["unstable__errors.zxcvbn.warnings.similarToCommon", "كلمة المرور هذه تشبه كلمات مرور شائعة الاستخدام."],
  ["signIn.password.title", "أدخل كلمة المرور"],
  ["signIn.password.actionLink", "استخدم طريقة أخرى"],
  ["signIn.alternativeMethods.title", "استخدم طريقة أخرى"],
  ["signIn.forgotPassword.subtitle", "لإعادة تعيين كلمة المرور"],
  ["signIn.resetPassword.title", "إعادة تعيين كلمة المرور"],
  ["signIn.resetPassword.formButtonPrimary", "إعادة تعيين كلمة المرور"],
  ["signIn.resetPassword.requiredMessage", "لأسباب أمنية، يلزم إعادة تعيين كلمة المرور."],
  ["signIn.resetPassword.successMessage", "تم تغيير كلمة المرور بنجاح. جارٍ تسجيل دخولك، يرجى الانتظار قليلًا."],
  ["signIn.resetPasswordMfa.detailsLabel", "نحتاج إلى التحقق من هويتك قبل إعادة تعيين كلمة المرور."],
  ["signUp.start.title", "إنشاء حساب جديد"],
  ["signUp.start.titleCombined", "إنشاء حساب جديد"],
];

/** Reads a dotted key path from the localization object. */
function at(source: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        node !== null && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined,
      source,
    );
}

describe("clerkLocalization: corrected Arabic spellings", () => {
  const result = clerkLocalization("ar", ar.Clerk);

  it("pins all 30 strings corrected in 220f78f", () => {
    expect(CORRECTED_AR).toHaveLength(30);
    expect(new Set(CORRECTED_AR.map(([path]) => path)).size).toBe(30);
  });

  it.each(CORRECTED_AR)("%s keeps its corrected spelling", (path, value) => {
    expect(at(result, path)).toBe(value);
  });
});
