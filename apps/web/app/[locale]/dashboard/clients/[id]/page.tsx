import { clerkUserIdSchema } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AccountControl } from "@/components/dashboard/clients/account-control";
import { clientAccess, loadClient } from "@/components/dashboard/clients/data";
import { Refusal } from "@/components/dashboard/refusal";
import { LocalTime } from "@/components/dashboard/team/local-time";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { requireTeamMember } from "@/lib/auth/gates";

type Params = Promise<{ locale: string; id: string }>;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  );
}

/**
 * One client's profile (§6.20). Read through RLS, so a scoped member gets
 * "not found" for a client outside their work (§5). Disable and reactivate
 * show only with `clients.view_all`; the route checks it again.
 */
export default async function ClientPage({ params }: { params: Params }) {
  await requireTeamMember(params, "/dashboard/clients/[id]");
  const access = await clientAccess(params);
  if (!access.allowed) return <Refusal />;
  const { locale } = access;

  const id = clerkUserIdSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const [t, all, client] = await Promise.all([
    getTranslations("DashboardClients"),
    getMessages(),
    loadClient(id.data),
  ]);
  if (!client) notFound();
  const none = <span className="text-text-secondary">{t("detail.none")}</span>;

  return (
    <div className="space-y-6">
      <ButtonLink href="/dashboard/clients" variant="quiet" size="sm">
        {t("detail.back")}
      </ButtonLink>
      <PageHeader title={client.fullName} />

      {/* Every value is rendered as text, never as HTML (§9). */}
      <Card as="section" aria-labelledby="profile-title">
        <h2 id="profile-title" className="text-xl">
          {t("detail.profile")}
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t("detail.fullName")}>
            <bdi>{client.fullName}</bdi>
          </Field>
          <Field label={t("detail.email")}>
            <bdi dir="ltr" className="break-all">
              {client.email}
            </bdi>
          </Field>
          <Field label={t("detail.phone")}>
            <bdi dir="ltr">{client.phone}</bdi>
          </Field>
          <Field label={t("detail.orgType")}>
            {client.orgType ? t(`orgTypes.${client.orgType}`) : none}
          </Field>
          <Field label={t("detail.orgName")}>
            {client.orgName ? <bdi>{client.orgName}</bdi> : none}
          </Field>
          <Field label={t("detail.jobTitle")}>
            {client.jobTitle ? <bdi>{client.jobTitle}</bdi> : none}
          </Field>
          <Field label={t("detail.language")}>{t(`locales.${client.locale}`)}</Field>
          <Field label={t("detail.joined")}>
            <LocalTime value={client.createdAt} locale={locale} />
          </Field>
        </dl>
      </Card>

      <Card as="section" aria-labelledby="account-title" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="account-title" className="text-xl">
            {t("account.title")}
          </h2>
          <Badge tone={client.status === "active" ? "strong" : "neutral"}>
            {t(`status.${client.status}`)}
          </Badge>
        </div>
        <p className="text-text-secondary">
          {client.status === "active" ? t("account.activeText") : t("account.disabledText")}
        </p>
        {access.canManage && (
          <NextIntlClientProvider locale={locale} messages={{ DashboardClients: all.DashboardClients }}>
            <AccountControl id={client.id} name={client.fullName} status={client.status} />
          </NextIntlClientProvider>
        )}
      </Card>

      {/* Phase 4 fills this block with consultations and document requests. */}
      <Card as="section" aria-labelledby="history-title">
        <h2 id="history-title" className="text-xl">
          {t("detail.history")}
        </h2>
        <div className="mt-4 rounded-md border border-dashed border-text/20 p-6 text-center">
          <p className="font-semibold">{t("detail.historyEmptyTitle")}</p>
          <p className="mt-1 text-sm text-text-secondary">{t("detail.historyEmptyText")}</p>
        </div>
      </Card>
    </div>
  );
}
