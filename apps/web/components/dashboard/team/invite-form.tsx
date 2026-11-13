"use client";

import { emailSchema, type AdminRole } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button, Card, Select, TextField } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { useRouter } from "@/i18n/navigation";
import { grantableRoles, roleName } from "./permissions";
import { inviteMember } from "./send";

type Errors = { email?: string; roleId?: string };

/** Email and role. The admin role is never offered (§6.19); the route refuses it too. */
export function InviteForm({ roles }: { roles: AdminRole[] }) {
  const t = useTranslations("DashboardTeam.invite");
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const choices = grantableRoles(roles);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const parsed = emailSchema.safeParse(email.trim());
    const found: Errors = {
      email: parsed.success ? undefined : t("emailRequired"),
      roleId: choices.some((role) => role.id === roleId) ? undefined : t("roleRequired"),
    };
    setErrors(found);
    if (!parsed.success || found.roleId) return;

    setBusy(true);
    const result = await inviteMember({ email: parsed.data, roleId });
    setBusy(false);
    if (!result.ok) {
      setNotice({ ok: false, text: result.message ?? t("failed") });
      return;
    }
    setEmail("");
    setRoleId("");
    setNotice({ ok: true, text: t("sent") });
    router.refresh();
  }

  return (
    <Card as="section" aria-labelledby="invite-title">
      <h2 id="invite-title" className="text-xl">
        {t("title")}
      </h2>
      <p className="mt-1 max-w-prose text-sm text-text-secondary">{t("intro")}</p>
      <form noValidate onSubmit={onSubmit} className="mt-4 flex flex-wrap items-start gap-3">
        <TextField
          label={t("email")}
          type="email"
          name="email"
          dir="ltr"
          autoComplete="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          maxLength={254}
          className="min-w-0 flex-1 basis-64"
        />
        <Select
          label={t("role")}
          name="roleId"
          value={roleId}
          onChange={(event) => setRoleId(event.target.value)}
          error={errors.roleId}
          className="min-w-0 flex-1 basis-48"
        >
          <option value="">{t("chooseRole")}</option>
          {choices.map((role) => (
            <option key={role.id} value={role.id}>
              {roleName(role, locale)}
            </option>
          ))}
        </Select>
        <Button type="submit" loading={busy} loadingLabel={t("sending")} className="sm:mt-6">
          {t("send")}
        </Button>
      </form>
      {notice && (
        <p
          role={notice.ok ? "status" : "alert"}
          className={cx("mt-3 text-sm font-semibold", notice.ok ? "text-text" : "text-danger")}
        >
          {notice.text}
        </p>
      )}
    </Card>
  );
}
