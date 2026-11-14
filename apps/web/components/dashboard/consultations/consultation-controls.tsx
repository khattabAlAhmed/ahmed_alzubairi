"use client";

import { CONSULTATION_STATUSES, type ConsultationStatus } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button, Select } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { updateConsultation } from "./send";
import type { Assignee } from "./types";

/** Every status but `closed`: closing has its own button, and asks first. */
const OPEN_STATUSES = CONSULTATION_STATUSES.filter((status) => status !== "closed");

/**
 * The status control and the close button (§6.17). Shown only to a member who
 * may work on the consultation; the route checks again.
 */
export function StatusControl({
  id,
  status,
  update = updateConsultation,
}: {
  id: string;
  status: ConsultationStatus;
  update?: typeof updateConsultation;
}) {
  const t = useTranslations("DashboardConsultations.status");
  const tStatus = useTranslations("Workspace.status.consultation");
  const router = useRouter();
  const [value, setValue] = useState<ConsultationStatus>(status);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: ConsultationStatus) {
    setBusy(true);
    setError(null);
    const result = await update(id, { status: next });
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? t("failed"));
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (value !== status) void save(value);
  }

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <Select
          label={t("label")}
          value={value}
          onChange={(event) => setValue(event.target.value as ConsultationStatus)}
          disabled={busy}
          className="min-w-0 basis-48"
        >
          {OPEN_STATUSES.map((option) => (
            <option key={option} value={option}>
              {tStatus(option)}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" disabled={value === status} loading={busy} loadingLabel={t("saving")}>
          {t("save")}
        </Button>
      </form>

      {confirming ? (
        <div role="group" aria-label={t("close")} className="space-y-3 rounded-md border border-text/20 p-3">
          <p className="text-sm">{t("closeQuestion")}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void save("closed")} loading={busy} loadingLabel={t("saving")}>
              {t("closeConfirm")}
            </Button>
            <Button variant="quiet" onClick={() => setConfirming(false)} disabled={busy}>
              {t("closeCancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)} disabled={busy}>
          {t("close")}
        </Button>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The assign control (§6.17): active members holding `consultations.reply`.
 * Shown only with `consultations.assign`; the route checks again.
 */
export function AssignControl({
  id,
  assignedTo,
  assignees,
  update = updateConsultation,
}: {
  id: string;
  assignedTo: string | null;
  assignees: Assignee[];
  update?: typeof updateConsultation;
}) {
  const t = useTranslations("DashboardConsultations.assign");
  const router = useRouter();
  const [value, setValue] = useState(assignedTo ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = assignedTo ?? "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (value === current) return;
    setBusy(true);
    setError(null);
    const result = await update(id, { assignedTo: value === "" ? null : value });
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? t("failed"));
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label={t("label")}
          hint={t("hint")}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={busy}
          className="min-w-0 basis-64"
        >
          <option value="">{t("none")}</option>
          {assignees.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" disabled={value === current} loading={busy} loadingLabel={t("saving")}>
          {t("save")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
