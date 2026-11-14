import {
  createConsultationRequestSchema,
  EMAIL_ADMIN_PERMISSION,
  PERMISSIONS,
  sendMessageRequestSchema,
  uuidSchema,
  type Consultation,
  type ConsultationDetailResponse,
  type ConsultationListResponse,
  type IdResponse,
  type Locale,
} from "@repo/shared";
import type { AuditEntry } from "@/lib/admin/audit";
import type { queueEmail, queueEmailForPermission } from "@/lib/email/queue";
import { baseFail, ownFail, type Result } from "./errors";
import type { ConsultationStore } from "./store";

/** The email queue (lib/email/queue.ts), behind an interface so tests can replace it. */
export type ConsultationMail = {
  queueEmail: typeof queueEmail;
  queueEmailForPermission: typeof queueEmailForPermission;
};

export type ConsultationDeps = {
  locale: Locale;
  /** The signed-in user from the session, or null. */
  userId: string | null;
  store: ConsultationStore;
};

export type WriteDeps = ConsultationDeps & {
  mail: ConsultationMail;
  audit: (entry: AuditEntry) => Promise<void>;
};

/** Logs what failed and a code only: never an address, a name or message text. */
function logFailure(what: string, error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  console.error(`consultations: ${what} failed (${typeof code === "string" ? code : "error"})`);
}

const notFound = (locale: Locale) => ownFail("not_found", 404, "notFound", locale);

/** `GET /api/consultations`: what RLS shows the caller, newest first. */
export async function listConsultations({
  locale,
  userId,
  store,
}: ConsultationDeps): Promise<Result<ConsultationListResponse>> {
  if (!userId) return baseFail("unauthenticated", 401, locale);
  return { status: 200, body: { consultations: await store.list() } };
}

/**
 * `GET /api/consultations/:id`: the consultation, its messages in time order
 * with sender names, its ready attachments linked to messages, and its
 * meetings. RLS decides what the caller sees; a consultation it hides is 404.
 * Team profiles are hidden from clients by RLS, so the senders' names (and
 * only their names) are read with the service client, after RLS has shown the
 * consultation.
 */
export async function readConsultation(
  id: string,
  { locale, userId, store }: ConsultationDeps,
): Promise<Result<ConsultationDetailResponse>> {
  if (!userId) return baseFail("unauthenticated", 401, locale);
  if (!uuidSchema.safeParse(id).success) return notFound(locale);

  const consultation = await store.get(id);
  if (!consultation) return notFound(locale);

  const [stored, attachments, meetings] = await Promise.all([
    store.messages(id),
    store.attachments(id),
    store.meetings(id),
  ]);
  const names = await store.senderNames([...new Set(stored.map((message) => message.senderId))]);
  const messages = stored.map((message) => ({
    ...message,
    senderName: names.get(message.senderId) ?? "",
  }));
  return { status: 200, body: { consultation, messages, attachments, meetings } };
}

/**
 * `POST /api/consultations`: a client with a complete, active profile asks
 * for a consultation on a published service. It starts as `new`. The admin
 * gets `consultation_new` (and a dashboard notification), the client
 * `consultation_received`. A failed email never fails the request.
 */
export async function createConsultation(
  body: unknown,
  { locale, userId, store, mail }: WriteDeps,
): Promise<Result<IdResponse>> {
  if (!userId) return baseFail("unauthenticated", 401, locale);
  const parsed = createConsultationRequestSchema.safeParse(body);
  if (!parsed.success) return baseFail("validation_failed", 400, locale);

  const profile = await store.ownProfile(userId);
  if (!profile) return ownFail("profile_incomplete", 403, "profileRequired", locale);
  if (profile.roleId !== null) return ownFail("forbidden", 403, "clientsOnly", locale);
  if (profile.status !== "active") return ownFail("forbidden", 403, "accountDisabled", locale);
  if (!(await store.isPublishedService(parsed.data.serviceId))) {
    return ownFail("validation_failed", 400, "serviceUnavailable", locale);
  }

  const consultation = await store.create({
    clientId: userId,
    serviceId: parsed.data.serviceId,
    title: parsed.data.title,
    description: parsed.data.description,
    organization: parsed.data.organization ?? null,
  });

  const fields = { consultationId: consultation.id, title: consultation.title };
  await mail.queueEmailForPermission(
    "consultation_new",
    EMAIL_ADMIN_PERMISSION,
    { ...fields, clientName: profile.fullName.trim() || profile.email },
    { entity: "consultations", entityId: consultation.id },
  );
  await mail.queueEmail({
    event: "consultation_received",
    to: { email: profile.email, locale: profile.locale },
    payload: fields,
  });
  return { status: 201, body: { id: consultation.id } };
}

/** Whether the caller may post on a consultation RLS has shown them. */
export type PostAccess =
  | { ok: true; fromClient: boolean }
  | { ok: false; reason: "forbidden" | "closed" };

/**
 * The rule for posting (messages here, attachments in lib/attachments): the
 * client on their own consultation, or a team member with
 * `consultations.view_all`, or with `consultations.reply` on one assigned to
 * them. A closed consultation takes nothing. Call it only on a consultation
 * the user client returned, so RLS has already decided it is visible.
 */
export async function postAccess(
  consultation: Consultation,
  userId: string,
  store: Pick<ConsultationStore, "hasPermission">,
): Promise<PostAccess> {
  const fromClient = consultation.clientId === userId;
  if (!fromClient) {
    const [viewAll, reply] = await Promise.all([
      store.hasPermission(PERMISSIONS.CONSULTATIONS_VIEW_ALL),
      store.hasPermission(PERMISSIONS.CONSULTATIONS_REPLY),
    ]);
    if (!viewAll && !(reply && consultation.assignedTo === userId)) {
      return { ok: false, reason: "forbidden" };
    }
  }
  if (consultation.status === "closed") return { ok: false, reason: "closed" };
  return { ok: true, fromClient };
}

/**
 * Emails `consultation_reply` to the other side. A client's message goes to
 * the assigned member (with a dashboard notification), or to the admin while
 * nobody active is assigned; a team member's goes to the client. Nothing here
 * fails the request.
 */
async function queueReply(
  consultation: Consultation,
  fromClient: boolean,
  { store, mail }: WriteDeps,
) {
  const payload = { consultationId: consultation.id, title: consultation.title };
  const target = { entity: "consultations", entityId: consultation.id };
  try {
    if (!fromClient) {
      const client = await store.contact(consultation.clientId);
      if (client) {
        await mail.queueEmail({
          event: "consultation_reply",
          to: { email: client.email, locale: client.locale },
          payload,
        });
      }
      return;
    }
    const assignee = consultation.assignedTo ? await store.contact(consultation.assignedTo) : null;
    if (!consultation.assignedTo || !assignee?.active) {
      await mail.queueEmailForPermission("consultation_reply", EMAIL_ADMIN_PERMISSION, payload, target);
      return;
    }
    const queued = await mail.queueEmail({
      event: "consultation_reply",
      to: { email: assignee.email, locale: assignee.locale },
      payload,
    });
    if (queued) {
      await store.notify({
        userId: consultation.assignedTo,
        type: "consultation_reply",
        consultationId: consultation.id,
      });
    }
  } catch (error) {
    logFailure("reply email", error);
  }
}

/**
 * `POST /api/consultations/:id/messages`. The client on their own
 * consultation, or a team member who may post (see `postAccess`). A closed
 * consultation refuses (409). Attachments must be the sender's own `ready`
 * files on this consultation that no message holds yet; they are linked to
 * the new message. A team member's message sets `first_reply_at` once and is
 * written to the audit log, without its text.
 */
export async function sendMessage(
  id: string,
  body: unknown,
  deps: WriteDeps,
): Promise<Result<IdResponse>> {
  const { locale, userId, store } = deps;
  if (!userId) return baseFail("unauthenticated", 401, locale);
  if (!uuidSchema.safeParse(id).success) return notFound(locale);
  const parsed = sendMessageRequestSchema.safeParse(body);
  if (!parsed.success) return baseFail("validation_failed", 400, locale);

  const consultation = await store.get(id);
  if (!consultation) return notFound(locale);
  const access = await postAccess(consultation, userId, store);
  if (!access.ok) {
    return access.reason === "closed"
      ? ownFail("conflict", 409, "closed", locale)
      : ownFail("forbidden", 403, "replyForbidden", locale);
  }
  const { fromClient } = access;

  const ids = [...new Set(parsed.data.attachmentIds ?? [])];
  if (ids.length > 0) {
    const states = await store.attachmentStates(ids);
    const usable =
      states.length === ids.length &&
      states.every(
        (item) =>
          item.consultationId === id &&
          item.uploadedBy === userId &&
          item.status === "ready" &&
          item.messageId === null,
      );
    if (!usable) return ownFail("validation_failed", 400, "attachmentInvalid", locale);
  }

  const message = await store.insertMessage({
    consultationId: id,
    senderId: userId,
    body: parsed.data.body ?? null,
  });
  if (ids.length > 0) {
    const linked = await store.linkAttachments({
      messageId: message.id,
      consultationId: id,
      uploadedBy: userId,
      ids,
    });
    if (linked !== ids.length) {
      // Another message took a file meanwhile. Put the ones linked here back
      // first: deleting the message would delete its attachments with it.
      await store.unlinkAttachments(message.id);
      await store.deleteMessage(message.id);
      return ownFail("conflict", 409, "attachmentTaken", locale);
    }
  }

  if (!fromClient) {
    if (consultation.firstReplyAt === null) await store.markFirstReply(id);
    await deps.audit({
      actorId: userId,
      action: "consultation.reply",
      entity: "consultations",
      entityId: id,
      metadata: { messageId: message.id, attachments: ids.length },
    });
  }
  await queueReply(consultation, fromClient, deps);

  return { status: 201, body: { id: message.id } };
}
