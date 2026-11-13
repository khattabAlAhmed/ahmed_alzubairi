"use client";

import {
  createRoleRequestSchema,
  MAX_SHORT_TEXT_LENGTH,
  shortTextSchema,
  type AdminRole,
  type Permission,
} from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { Badge, Button, Card, Checkbox, TextField } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { useRouter } from "@/i18n/navigation";
import { isAdminRole } from "@/lib/admin/team/rules";
import {
  PERMISSION_LIST,
  permissionLabelKey,
  roleName,
  samePermissions,
  togglePermission,
} from "./permissions";
import { createRole, updateRole } from "./send";

type Notice = { ok: boolean; text: string };

function NoticeLine({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  return (
    <p
      role={notice.ok ? "status" : "alert"}
      className={cx("text-sm font-semibold", notice.ok ? "text-text" : "text-danger")}
    >
      {notice.text}
    </p>
  );
}

/** The 14 permissions as checkboxes, labelled with the §5 "what it allows" text. */
function PermissionChecklist({
  legend,
  value,
  onChange,
  disabled,
}: {
  legend: string;
  value: readonly Permission[];
  onChange?: (next: Permission[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("DashboardTeam");
  const id = useId();
  const held = new Set(value);

  return (
    <fieldset>
      <legend className="text-sm font-semibold">{legend}</legend>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {PERMISSION_LIST.map((key) => (
          <li key={key}>
            <Checkbox
              id={`${id}-${key}`}
              label={t(permissionLabelKey(key))}
              checked={held.has(key)}
              disabled={disabled}
              onChange={(event) => onChange?.(togglePermission(value, key, event.target.checked))}
            />
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/** One role: its names and its permissions. The admin role is shown read-only (§6.19). */
function RoleCard({ role }: { role: AdminRole }) {
  const t = useTranslations("DashboardTeam.roles");
  const locale = useLocale();
  const router = useRouter();
  const locked = isAdminRole(role);
  const [nameAr, setNameAr] = useState(role.nameAr);
  const [nameEn, setNameEn] = useState(role.nameEn);
  const [permissions, setPermissions] = useState<Permission[]>(role.permissions);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const name = roleName(role, locale);
  const headingId = useId();

  const changed =
    nameAr !== role.nameAr || nameEn !== role.nameEn || !samePermissions(permissions, role.permissions);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const ar = shortTextSchema.safeParse(nameAr);
    const en = shortTextSchema.safeParse(nameEn);
    if (!ar.success || !en.success) {
      setError(t("nameRequired"));
      return;
    }
    setError(undefined);
    setBusy(true);
    const result = await updateRole({
      id: role.id,
      nameAr: ar.data,
      nameEn: en.data,
      permissions,
    });
    setBusy(false);
    if (!result.ok) {
      setNotice({ ok: false, text: result.message ?? t("failed") });
      return;
    }
    setNotice({ ok: true, text: t("saved") });
    router.refresh();
  }

  return (
    <Card as="li" aria-labelledby={headingId} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={headingId} className="text-xl">
          <bdi>{name}</bdi>
        </h2>
        <Badge>{role.isSystem ? t("system") : t("custom")}</Badge>
        <span className="text-sm text-text-secondary">
          {t("key")}: <bdi dir="ltr">{role.key}</bdi>
        </span>
      </div>

      {locked ? (
        <>
          <p className="max-w-prose text-sm text-text-secondary">{t("adminLocked")}</p>
          <PermissionChecklist
            legend={t("permissionsFor", { name })}
            value={role.permissions}
            disabled
          />
        </>
      ) : (
        <form noValidate onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label={t("nameAr")}
              lang="ar"
              dir="rtl"
              value={nameAr}
              maxLength={MAX_SHORT_TEXT_LENGTH}
              onChange={(event) => setNameAr(event.target.value)}
              error={error}
            />
            <TextField
              label={t("nameEn")}
              lang="en"
              dir="ltr"
              value={nameEn}
              maxLength={MAX_SHORT_TEXT_LENGTH}
              onChange={(event) => setNameEn(event.target.value)}
            />
          </div>
          <PermissionChecklist
            legend={t("permissionsFor", { name })}
            value={permissions}
            onChange={setPermissions}
            disabled={busy}
          />
          <Button type="submit" disabled={!changed} loading={busy} loadingLabel={t("saving")}>
            {t("save")}
          </Button>
          <NoticeLine notice={notice} />
        </form>
      )}
    </Card>
  );
}

type AddErrors = { key?: string; names?: string };

/** A new role: key, two names, permissions. The key never changes afterwards. */
function AddRoleForm() {
  const t = useTranslations("DashboardTeam.roles");
  const router = useRouter();
  const [key, setKey] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [errors, setErrors] = useState<AddErrors>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const parsed = createRoleRequestSchema.safeParse({
      key: key.trim(),
      nameAr,
      nameEn,
      permissions,
    });
    if (!parsed.success) {
      const fields = new Set(parsed.error.issues.map((issue) => issue.path[0]));
      setErrors({
        key: fields.has("key") ? t("add.keyInvalid") : undefined,
        names: fields.has("nameAr") || fields.has("nameEn") ? t("nameRequired") : undefined,
      });
      return;
    }
    setErrors({});
    setBusy(true);
    const result = await createRole(parsed.data);
    setBusy(false);
    if (!result.ok) {
      setNotice({ ok: false, text: result.message ?? t("failed") });
      return;
    }
    setKey("");
    setNameAr("");
    setNameEn("");
    setPermissions([]);
    setNotice({ ok: true, text: t("add.created") });
    router.refresh();
  }

  return (
    <Card as="section" aria-labelledby="add-role-title" className="space-y-4">
      <div>
        <h2 id="add-role-title" className="text-xl">
          {t("add.title")}
        </h2>
        <p className="mt-1 max-w-prose text-sm text-text-secondary">{t("add.intro")}</p>
      </div>
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <TextField
          label={t("add.key")}
          hint={t("add.keyHint")}
          dir="ltr"
          autoComplete="off"
          spellCheck={false}
          value={key}
          maxLength={64}
          onChange={(event) => setKey(event.target.value)}
          error={errors.key}
          className="max-w-md"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label={t("nameAr")}
            lang="ar"
            dir="rtl"
            value={nameAr}
            maxLength={MAX_SHORT_TEXT_LENGTH}
            onChange={(event) => setNameAr(event.target.value)}
            error={errors.names}
          />
          <TextField
            label={t("nameEn")}
            lang="en"
            dir="ltr"
            value={nameEn}
            maxLength={MAX_SHORT_TEXT_LENGTH}
            onChange={(event) => setNameEn(event.target.value)}
          />
        </div>
        <PermissionChecklist
          legend={t("permissions")}
          value={permissions}
          onChange={setPermissions}
          disabled={busy}
        />
        <Button type="submit" loading={busy} loadingLabel={t("add.adding")}>
          {t("add.submit")}
        </Button>
        <NoticeLine notice={notice} />
      </form>
    </Card>
  );
}

/** Every role with its checklist, then the form that adds one. */
export function RoleEditor({ roles }: { roles: AdminRole[] }) {
  return (
    <div className="space-y-6">
      <ul className="space-y-4">
        {roles.map((role) => (
          // The key carries the stored values, so a refresh resets the card's own state.
          <RoleCard
            key={`${role.id}:${role.nameAr}:${role.nameEn}:${role.permissions.join()}`}
            role={role}
          />
        ))}
      </ul>
      <AddRoleForm />
    </div>
  );
}
