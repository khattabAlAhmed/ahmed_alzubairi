import "server-only";
import type { Consultation, ConsultationDetailResponse, Locale } from "@repo/shared";
import { getServices } from "@/lib/content";
import { listConsultations, readConsultation } from "@/lib/consultations/handlers";
import { createConsultationStore } from "@/lib/consultations/store";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";

export type ConsultationRow = Consultation & {
  /** The service title in this language, or null when it isn't listed any more. */
  serviceTitle: string | null;
  /** The newest message, or the request itself when nothing was said yet. UTC. */
  lastActivityAt: string;
};

const store = () => createConsultationStore(createUserClient(), createServiceClient());

/** Service titles in this language, by id. Only published services are listed. */
async function serviceTitles(locale: Locale): Promise<Map<string, string>> {
  return new Map((await getServices(locale)).map((service) => [service.id, service.title]));
}

/**
 * The newest message time of each consultation, read through the user client
 * so RLS scopes it to what the caller sees.
 */
async function lastMessageTimes(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await createUserClient()
    .from("consultation_messages")
    .select("consultation_id, created_at")
    .in("consultation_id", ids)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`message times read failed: ${error.code}`);
  const times = new Map<string, string>();
  for (const row of data) {
    if (!times.has(row.consultation_id)) times.set(row.consultation_id, new Date(row.created_at).toISOString());
  }
  return times;
}

/** "استشاراتي": the caller's consultations, newest activity first. */
export async function readOwnConsultations(userId: string, locale: Locale): Promise<ConsultationRow[]> {
  const result = await listConsultations({ locale, userId, store: store() });
  if (result.status !== 200 || "error" in result.body) throw new Error(`consultation list failed: ${result.status}`);
  // A client's list holds only their own; the filter keeps it so for a team member too.
  const own = result.body.consultations.filter((item) => item.clientId === userId);
  const [titles, times] = await Promise.all([serviceTitles(locale), lastMessageTimes(own.map((item) => item.id))]);
  return own
    .map((item) => {
      const message = times.get(item.id);
      const candidates = [item.createdAt, message, item.closedAt].filter((value): value is string => Boolean(value));
      return {
        ...item,
        serviceTitle: item.serviceId ? (titles.get(item.serviceId) ?? null) : null,
        lastActivityAt: candidates.reduce((latest, value) => (value > latest ? value : latest)),
      };
    })
    .sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : a.lastActivityAt > b.lastActivityAt ? -1 : 0));
}

export type OwnConsultation = ConsultationDetailResponse & { serviceTitle: string | null };

/** One of the caller's consultations, or null when RLS hides it or it isn't theirs. */
export async function readOwnConsultation(
  id: string,
  userId: string,
  locale: Locale,
): Promise<OwnConsultation | null> {
  const result = await readConsultation(id, { locale, userId, store: store() });
  if (result.status === 404) return null;
  if (result.status !== 200 || "error" in result.body) throw new Error(`consultation read failed: ${result.status}`);
  const detail = result.body;
  // The client's page shows only their own; a team member works from the dashboard.
  if (detail.consultation.clientId !== userId) return null;
  const titles = await serviceTitles(locale);
  const serviceId = detail.consultation.serviceId;
  return { ...detail, serviceTitle: serviceId ? (titles.get(serviceId) ?? null) : null };
}

/** The published services in this language, for the form's picker. */
export async function readServiceOptions(locale: Locale) {
  return (await getServices(locale)).map(({ id, slug, title }) => ({ id, slug, title }));
}
