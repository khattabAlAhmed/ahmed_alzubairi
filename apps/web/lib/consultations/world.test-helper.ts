/**
 * An in-memory database for the consultation tests. Its reads apply the same
 * rule as `visible_consultation_ids()` (§7): the client's own, the ones
 * assigned to an active member, or every one with `consultations.view_all`.
 */
import { PERMISSIONS, type Consultation, type Locale, type Permission } from "@repo/shared";
import { vi } from "vitest";
import type { ConsultationMail } from "./handlers";
import type { AttachmentState, ConsultationStore, StoredMessage } from "./store";

export const IDS = {
  consultationA: "11111111-1111-4111-8111-111111111111",
  consultationB: "22222222-2222-4222-8222-222222222222",
  unassigned: "33333333-3333-4333-8333-333333333333",
  closed: "44444444-4444-4444-8444-444444444444",
  service: "55555555-5555-4555-8555-555555555555",
  draftService: "66666666-6666-4666-8666-666666666666",
  fileReady: "77777777-7777-4777-8777-777777777771",
  fileOtherUser: "77777777-7777-4777-8777-777777777772",
  fileLinked: "77777777-7777-4777-8777-777777777773",
  fileUploading: "77777777-7777-4777-8777-777777777774",
  fileOtherConsultation: "77777777-7777-4777-8777-777777777775",
  fileReady2: "77777777-7777-4777-8777-777777777776",
  meeting: "88888888-8888-4888-8888-888888888888",
  oldMessage: "99999999-9999-4999-8999-999999999999",
} as const;

export const USERS = {
  admin: "user_admin",
  assistant: "user_assistant",
  editor: "user_editor",
  clientA: "user_client_a",
  clientB: "user_client_b",
  newClient: "user_client_new",
  disabledClient: "user_client_disabled",
} as const;

type Person = {
  roleId: string | null;
  status: "active" | "disabled";
  fullName: string;
  email: string;
  locale: Locale;
  permissions: Permission[];
};

const ALL = Object.values(PERMISSIONS);

const NOW = "2026-11-14T10:00:00.000Z";

function consultation(over: Partial<Consultation> & Pick<Consultation, "id" | "clientId">): Consultation {
  return {
    kind: "consultation",
    serviceId: IDS.service,
    title: "Test consultation",
    description: "Fake description",
    organization: null,
    status: "new",
    assignedTo: null,
    firstReplyAt: null,
    closedAt: null,
    createdAt: NOW,
    ...over,
  };
}

export function world() {
  const people: Record<string, Person> = {
    [USERS.admin]: { roleId: "role_admin", status: "active", fullName: "Test Admin", email: "admin@example.invalid", locale: "ar", permissions: ALL },
    [USERS.assistant]: {
      roleId: "role_assistant",
      status: "active",
      fullName: "Test Assistant",
      email: "assistant@example.invalid",
      locale: "en",
      permissions: [PERMISSIONS.CONSULTATIONS_REPLY, PERMISSIONS.MESSAGES_VIEW],
    },
    [USERS.editor]: {
      roleId: "role_editor",
      status: "active",
      fullName: "Test Editor",
      email: "editor@example.invalid",
      locale: "en",
      permissions: [PERMISSIONS.CONTENT_MANAGE],
    },
    [USERS.clientA]: { roleId: null, status: "active", fullName: "Test Client A", email: "a@example.invalid", locale: "en", permissions: [] },
    [USERS.clientB]: { roleId: null, status: "active", fullName: "Test Client B", email: "b@example.invalid", locale: "ar", permissions: [] },
    [USERS.disabledClient]: { roleId: null, status: "disabled", fullName: "Test Disabled", email: "d@example.invalid", locale: "en", permissions: [] },
  };

  const consultations: Consultation[] = [
    consultation({ id: IDS.consultationA, clientId: USERS.clientA, assignedTo: USERS.assistant, status: "in_progress" }),
    consultation({ id: IDS.consultationB, clientId: USERS.clientB }),
    consultation({ id: IDS.unassigned, clientId: USERS.clientA, title: "Unassigned" }),
    consultation({ id: IDS.closed, clientId: USERS.clientA, assignedTo: USERS.assistant, status: "closed" }),
  ];
  const messages: (StoredMessage & { consultationId: string })[] = [
    { id: IDS.oldMessage, consultationId: IDS.consultationA, senderId: USERS.clientA, body: "Hello", createdAt: "2026-11-14T09:00:00.000Z" },
  ];
  const attachments: (AttachmentState & { fileName: string })[] = [
    { id: IDS.fileReady, consultationId: IDS.consultationA, messageId: null, status: "ready", uploadedBy: USERS.clientA, fileName: "a.pdf" },
    { id: IDS.fileReady2, consultationId: IDS.consultationA, messageId: null, status: "ready", uploadedBy: USERS.clientA, fileName: "b.pdf" },
    { id: IDS.fileOtherUser, consultationId: IDS.consultationA, messageId: null, status: "ready", uploadedBy: USERS.assistant, fileName: "c.pdf" },
    { id: IDS.fileLinked, consultationId: IDS.consultationA, messageId: IDS.oldMessage, status: "ready", uploadedBy: USERS.clientA, fileName: "d.pdf" },
    { id: IDS.fileUploading, consultationId: IDS.consultationA, messageId: null, status: "uploading", uploadedBy: USERS.clientA, fileName: "e.pdf" },
    { id: IDS.fileOtherConsultation, consultationId: IDS.unassigned, messageId: null, status: "ready", uploadedBy: USERS.clientA, fileName: "f.pdf" },
  ];
  const notifications: { userId: string; type: string; consultationId: string }[] = [];
  const published = new Set<string>([IDS.service]);
  let nextId = 0;
  const newId = () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++nextId).padStart(12, "0")}`;

  const writes: string[] = [];

  const stored = (item: StoredMessage): StoredMessage => ({
    id: item.id,
    senderId: item.senderId,
    body: item.body,
    createdAt: item.createdAt,
  });

  function visible(viewer: string, item: Consultation) {
    const person = people[viewer];
    if (!person) return false;
    if (item.clientId === viewer) return true;
    if (item.assignedTo === viewer && person.status === "active") return true;
    return person.permissions.includes(PERMISSIONS.CONSULTATIONS_VIEW_ALL);
  }

  function storeFor(viewer: string): ConsultationStore {
    const shown = (id: string) => consultations.find((item) => item.id === id && visible(viewer, item));
    return {
      list: vi.fn(async () => consultations.filter((item) => visible(viewer, item))),
      get: vi.fn(async (id: string) => shown(id) ?? null),
      messages: vi.fn(async (id: string) =>
        shown(id) ? messages.filter((item) => item.consultationId === id).map(stored) : [],
      ),
      attachments: vi.fn(async (id: string) =>
        shown(id)
          ? attachments.flatMap((item) =>
              item.consultationId === id && item.status === "ready" && item.messageId
                ? [{ id: item.id, messageId: item.messageId, fileName: item.fileName, mime: "application/pdf", sizeBytes: 10, uploadedBy: item.uploadedBy, createdAt: NOW }]
                : [],
            )
          : [],
      ),
      meetings: vi.fn(async (id: string) =>
        id === IDS.consultationA && shown(id)
          ? [{ id: IDS.meeting, platform: "Zoom", url: "https://example.invalid/m", startsAt: NOW, durationMinutes: 30, createdAt: NOW }]
          : [],
      ),
      hasPermission: vi.fn(async (key: Permission) => people[viewer]?.permissions.includes(key) ?? false),
      ownProfile: vi.fn(async (userId: string) => {
        const person = people[userId];
        return person ? { roleId: person.roleId, status: person.status, fullName: person.fullName, email: person.email, locale: person.locale } : null;
      }),
      senderNames: vi.fn(async (ids: string[]) => new Map(ids.flatMap((id) => (people[id] ? [[id, people[id].fullName] as const] : [])))),
      isPublishedService: vi.fn(async (id: string) => published.has(id)),
      contact: vi.fn(async (userId: string) => {
        const person = people[userId];
        return person ? { email: person.email, locale: person.locale, active: person.status === "active" } : null;
      }),
      create: vi.fn(async (row) => {
        writes.push("consultation");
        const created = consultation({ id: newId(), clientId: row.clientId, serviceId: row.serviceId, title: row.title, description: row.description, organization: row.organization });
        consultations.push(created);
        return created;
      }),
      attachmentStates: vi.fn(async (ids: string[]) => attachments.filter((item) => ids.includes(item.id)).map((item) => ({ id: item.id, consultationId: item.consultationId, messageId: item.messageId, status: item.status, uploadedBy: item.uploadedBy }))),
      insertMessage: vi.fn(async (row) => {
        writes.push("message");
        const message = { id: newId(), consultationId: row.consultationId, senderId: row.senderId, body: row.body, createdAt: NOW };
        messages.push(message);
        return stored(message);
      }),
      linkAttachments: vi.fn(async ({ messageId, consultationId, uploadedBy, ids }) => {
        let linked = 0;
        for (const item of attachments) {
          if (ids.includes(item.id) && item.consultationId === consultationId && item.uploadedBy === uploadedBy && item.status === "ready" && item.messageId === null) {
            item.messageId = messageId;
            linked += 1;
          }
        }
        writes.push(`link:${linked}`);
        return linked;
      }),
      unlinkAttachments: vi.fn(async (messageId: string) => {
        for (const item of attachments) if (item.messageId === messageId) item.messageId = null;
        writes.push("unlink");
      }),
      deleteMessage: vi.fn(async (id: string) => {
        const index = messages.findIndex((item) => item.id === id);
        if (index >= 0) messages.splice(index, 1);
        writes.push("delete-message");
      }),
      markFirstReply: vi.fn(async (id: string) => {
        const item = consultations.find((row) => row.id === id);
        if (item && item.firstReplyAt === null) item.firstReplyAt = NOW;
        writes.push("first-reply");
      }),
      notify: vi.fn(async (row) => {
        notifications.push(row);
      }),
    };
  }

  const emails: { event: string; to: string; locale: Locale; payload: unknown }[] = [];
  const permissionEmails: { event: string; permission: string; payload: unknown; target?: unknown }[] = [];
  const mail: ConsultationMail = {
    queueEmail: vi.fn(async ({ event, to, payload }) => {
      emails.push({ event, to: to.email, locale: to.locale, payload });
      return true;
    }) as ConsultationMail["queueEmail"],
    queueEmailForPermission: vi.fn(async (event, permission, payload, target) => {
      permissionEmails.push({ event, permission, payload, target });
      return true;
    }) as ConsultationMail["queueEmailForPermission"],
  };
  const audit = vi.fn(async () => {});

  return { people, consultations, messages, attachments, notifications, published, writes, storeFor, emails, permissionEmails, mail, audit };
}
