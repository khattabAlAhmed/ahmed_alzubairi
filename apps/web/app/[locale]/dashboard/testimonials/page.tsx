import { PERMISSIONS } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { mediaBase } from "@/components/dashboard/content/data";
import { sectionAccess } from "@/components/dashboard/gate";
import { Refusal } from "@/components/dashboard/refusal";
import { loadTrust } from "@/components/dashboard/testimonials/data";
import { TrustBoard } from "@/components/dashboard/testimonials/trust-board";
import { PageHeader } from "@/components/ui";
import { requireTeamMember } from "@/lib/auth/gates";

type Params = Promise<{ locale: string }>;

/**
 * Testimonials and logos (§6.11, §6.20). Open with `content.manage` (edit)
 * or `testimonials.approve` (approve); both are checked here, on the server,
 * and each route checks its own permission again.
 */
export default async function TestimonialsPage({ params }: { params: Params }) {
  await requireTeamMember(params, "/dashboard/testimonials");
  const [edit, approve] = await Promise.all([
    sectionAccess(params, PERMISSIONS.CONTENT_MANAGE),
    sectionAccess(params, PERMISSIONS.TESTIMONIALS_APPROVE),
  ]);
  if (!edit.allowed && !approve.allowed) return <Refusal />;

  const locale = edit.locale;
  const [t, messages] = await Promise.all([
    getTranslations("DashboardTrust.testimonials"),
    getMessages(),
  ]);
  const data = await loadTrust(locale, t("untitled"));

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} intro={t("intro")} eyebrow={t("eyebrow")} />
      {/* The browser gets only the namespaces the board and the editor use. */}
      <NextIntlClientProvider
        locale={locale}
        messages={{
          DashboardContent: messages.DashboardContent,
          DashboardEditor: messages.DashboardEditor,
          DashboardTrust: messages.DashboardTrust,
        }}
      >
        <TrustBoard
          {...data}
          mediaBase={mediaBase()}
          canEdit={edit.allowed}
          canApprove={approve.allowed}
        />
      </NextIntlClientProvider>
    </div>
  );
}
