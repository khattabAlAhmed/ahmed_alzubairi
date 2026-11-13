"use client";

import type { AdminRole, AdminTeamMember, ProfileStatus } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Badge, Button, Select } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { useRouter } from "@/i18n/navigation";
import { isAdminRole } from "@/lib/admin/team/rules";
import { LocalTime } from "./local-time";
import { grantableRoles, roleName } from "./permissions";
import { updateMember } from "./send";

type Notice = { tone: "status" | "alert"; text: string };

function MemberRow({
  member,
  roles,
  isSelf,
}: {
  member: AdminTeamMember;
  roles: AdminRole[];
  isSelf: boolean;
}) {
  const t = useTranslations("DashboardTeam.members");
  const tStatus = useTranslations("DashboardTeam.status");
  const locale = useLocale();
  const router = useRouter();
  const [roleId, setRoleId] = useState(member.roleId);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // After a refresh brings new stored values, the controls start from them.
  // The row keeps its notice, so "The account was disabled." stays on screen.
  const [stored, setStored] = useState(`${member.roleId}:${member.status}`);
  if (stored !== `${member.roleId}:${member.status}`) {
    setStored(`${member.roleId}:${member.status}`);
    setRoleId(member.roleId);
    setConfirming(false);
  }

  const role = roles.find((item) => item.id === member.roleId) ?? null;
  const isAdmin = isAdminRole(role);
  // The server refuses both anyway; the controls aren't offered.
  const locked = isSelf || isAdmin;
  const choices = grantableRoles(roles);
  const nextStatus: ProfileStatus = member.status === "active" ? "disabled" : "active";

  async function run(
    body: { roleId: string } | { status: ProfileStatus },
    done: string,
  ) {
    setBusy(true);
    setNotice(null);
    const result = await updateMember({ id: member.id, ...body });
    setBusy(false);
    setConfirming(false);
    if (!result.ok) {
      setNotice({ tone: "alert", text: result.message ?? t("failed") });
      return;
    }
    setNotice({ tone: "status", text: done });
    router.refresh();
  }

  return (
    <li className="space-y-3 p-4">
      {/* Names and emails are rendered as text, never as HTML (§9). */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="font-semibold break-words">
            <bdi>{member.fullName}</bdi>
            {isSelf && (
              <Badge className="ms-2 align-middle">{t("you")}</Badge>
            )}
          </p>
          <p className="text-sm break-all text-text-secondary">
            <bdi dir="ltr">{member.email}</bdi>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-sm text-text-secondary">
          <Badge tone={member.status === "active" ? "strong" : "neutral"}>
            {tStatus(member.status)}
          </Badge>
          <span>{role ? roleName(role, locale) : t("unknownRole")}</span>
          <span>
            {t("joined")}: <LocalTime value={member.createdAt} locale={locale} withTime={false} />
          </span>
        </div>
      </div>

      {locked ? (
        <p className="text-sm text-text-secondary">{isSelf ? t("selfNote") : t("adminNote")}</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label={t("roleFor", { name: member.fullName })}
            value={roleId}
            onChange={(event) => setRoleId(event.target.value)}
            disabled={busy}
            className="min-w-0 flex-1 basis-56"
          >
            {choices.map((item) => (
              <option key={item.id} value={item.id}>
                {roleName(item, locale)}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            disabled={busy || roleId === member.roleId}
            loading={busy && roleId !== member.roleId}
            loadingLabel={t("saving")}
            onClick={() => run({ roleId }, t("roleSaved"))}
          >
            {t("saveRole")}
          </Button>
          {!confirming && (
            <Button variant="quiet" disabled={busy} onClick={() => setConfirming(true)}>
              {member.status === "active" ? t("disable") : t("enable")}
            </Button>
          )}
        </div>
      )}

      {confirming && !locked && (
        <div
          role="group"
          aria-label={member.status === "active" ? t("disable") : t("enable")}
          className="space-y-3 rounded-md border border-text/20 bg-background p-3"
        >
          <p className="text-sm">
            {member.status === "active"
              ? t("confirmDisable", { name: member.fullName })
              : t("confirmEnable", { name: member.fullName })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              loading={busy}
              loadingLabel={t("saving")}
              onClick={() =>
                run(
                  { status: nextStatus },
                  nextStatus === "disabled" ? t("disabledDone") : t("enabledDone"),
                )
              }
            >
              {t("confirm")}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      {notice && (
        <p
          role={notice.tone}
          className={cx("text-sm font-semibold", notice.tone === "alert" ? "text-danger" : "text-text")}
        >
          {notice.text}
        </p>
      )}
    </li>
  );
}

/** The page's members. You can't act on yourself or on an admin: those rows have no controls. */
export function MemberList({
  members,
  roles,
  selfId,
}: {
  members: AdminTeamMember[];
  roles: AdminRole[];
  selfId: string;
}) {
  return (
    <ul className="divide-y divide-text/10 rounded-lg border border-text/10 bg-surface">
      {members.map((member) => (
        <MemberRow
          key={member.id}
          member={member}
          roles={roles}
          isSelf={member.id === selfId}
        />
      ))}
    </ul>
  );
}
