import { describe, expect, it } from "vitest";
import { z } from "zod";
import projectDoc from "../../docs/project.md?raw";
import {
  CONTENT_TYPES,
  contentCreateBodySchemas,
  contentRowSchemas,
  contentUpdateBodySchemas,
  type ContentType,
} from "./content";
import { ROUTES, type RouteContract, type RouteName } from "./routes";

const ID = "123e4567-e89b-42d3-a456-426614174000";
const OTHER_ID = "123e4567-e89b-42d3-a456-426614174001";
const NOW = "2026-11-07T10:00:00.000Z";
const FUTURE = "2999-01-01T00:00:00.000Z";
const URL_OK = "https://example.com/file";
const PDF = "application/pdf";
const OK = { ok: true };

type Pair = { ok: unknown; bad: unknown };
type Case = {
  params?: Pair;
  query?: Pair;
  body?: Pair;
  response?: Pair;
};

const ID_PARAMS: Pair = { ok: { id: ID }, bad: { id: "1" } };
const OK_RESPONSE: Pair = { ok: OK, bad: { ok: false } };
const ID_RESPONSE: Pair = { ok: { id: ID }, bad: { id: "1" } };
const URL_RESPONSE: Pair = { ok: { url: URL_OK }, bad: { url: "nope" } };

const consultation = {
  id: ID,
  kind: "consultation",
  clientId: "user_1",
  serviceId: ID,
  title: "Title",
  description: "Text",
  organization: null,
  status: "new",
  assignedTo: null,
  firstReplyAt: null,
  closedAt: null,
  createdAt: NOW,
};
const meeting = {
  platform: "Zoom",
  url: URL_OK,
  startsAt: NOW,
  durationMinutes: 30,
};
const adminDocument = {
  id: ID,
  category: "thank_you_letter",
  titleAr: "شكر",
  titleEn: "Thanks",
  mime: PDF,
  accessMode: "view",
  status: "draft",
};
const documentBody = {
  category: "thank_you_letter",
  titleAr: "شكر",
  titleEn: "Thanks",
  accessMode: "view",
  status: "draft",
  key: "abc.pdf",
};
const course = {
  id: ID,
  slug: "course",
  type: "online_live",
  titleAr: null,
  titleEn: "Course",
  descriptionAr: null,
  descriptionEn: null,
  audienceAr: null,
  audienceEn: null,
  startsAt: NOW,
  placeAr: null,
  placeEn: null,
  onlineUrl: URL_OK,
  seats: 10,
  status: "published",
};
const client = {
  id: "user_1",
  fullName: "Name",
  email: "a@example.com",
  phone: "+966500000000",
  orgType: null,
  orgName: null,
  jobTitle: null,
  locale: "ar",
  status: "active",
  createdAt: NOW,
};
const member = {
  id: "user_2",
  fullName: "Name",
  email: "a@example.com",
  roleId: ID,
  status: "active",
  createdAt: NOW,
};
const role = {
  id: ID,
  key: "editor",
  nameAr: "محرر",
  nameEn: "Editor",
  isSystem: false,
  permissions: ["content.manage"],
};
const clerkEvent = {
  type: "user.updated",
  object: "event",
  data: {
    id: "user_1",
    first_name: "A",
    last_name: null,
    primary_email_address_id: "idn_1",
    email_addresses: [{ id: "idn_1", email_address: "a@example.com" }],
    extra: true,
  },
};
const resendEvent = {
  type: "contact.updated",
  created_at: NOW,
  data: { id: ID, email: "a@example.com", unsubscribed: true },
};

/** A valid and a refused input for every schema of every non-content route. */
const CASES: Record<
  Exclude<
    RouteName,
    | "GET /api/admin/content/:type"
    | "POST /api/admin/content/:type"
    | "PATCH /api/admin/content/:type"
  >,
  Case
> = {
  "POST /api/contact": {
    body: {
      ok: {
        name: "N",
        email: "a@example.com",
        orgType: "company",
        subject: "S",
        message: "M",
      },
      bad: { name: "N", email: "a@example.com", subject: "S", message: "M" },
    },
    response: OK_RESPONSE,
  },
  "POST /api/newsletter/subscribe": {
    body: {
      ok: { email: "a@example.com", locale: "ar", source: "footer" },
      bad: { email: "a@example.com", locale: "ar", source: "twitter" },
    },
    response: OK_RESPONSE,
  },
  "GET /api/newsletter/confirm": {
    query: { ok: { token: "t" }, bad: { token: "" } },
  },
  "POST /api/resources/:id/download": {
    params: ID_PARAMS,
    body: {
      ok: { email: "a@example.com", consent: true },
      bad: { consent: true },
    },
    response: URL_RESPONSE,
  },
  "POST /api/training/custom-requests": {
    body: {
      ok: {
        orgName: "Org",
        traineeCount: 20,
        topic: "Topic",
        suggestedDate: "2027-01-31",
        contactEmail: "a@example.com",
      },
      bad: {
        orgName: "Org",
        traineeCount: 0,
        topic: "Topic",
        suggestedDate: "2027-01-31",
        contactEmail: "a@example.com",
      },
    },
    response: OK_RESPONSE,
  },
  "POST /api/profile": {
    body: {
      ok: {
        phone: "+966501234567",
        termsAccepted: true,
        timezone: "Asia/Riyadh",
      },
      bad: { phone: "+966501234567", timezone: "Asia/Riyadh" },
    },
    response: OK_RESPONSE,
  },
  "PATCH /api/profile": {
    body: { ok: { notifyOptional: false }, bad: {} },
    response: OK_RESPONSE,
  },
  "POST /api/account/disable": {
    body: { ok: {}, bad: { reason: "x" } },
    response: {
      ok: { ok: true, closedConsultations: 2 },
      bad: { ok: true, closedConsultations: -1 },
    },
  },
  "POST /api/notifications/read": {
    body: { ok: { ids: [ID] }, bad: { ids: [] } },
    response: { ok: { unread: 0 }, bad: { unread: -1 } },
  },
  "GET /api/consultations": {
    response: {
      ok: { consultations: [consultation] },
      bad: { consultations: [{ ...consultation, status: "rejected" }] },
    },
  },
  "POST /api/consultations": {
    body: {
      ok: { serviceId: ID, title: "T", description: "D" },
      bad: { title: "T", description: "D" },
    },
    response: ID_RESPONSE,
  },
  "GET /api/consultations/:id": {
    params: ID_PARAMS,
    response: {
      ok: {
        consultation,
        messages: [
          {
            id: ID,
            senderId: "user_1",
            senderName: "N",
            body: "Hello",
            createdAt: NOW,
          },
        ],
        attachments: [
          {
            id: ID,
            messageId: ID,
            fileName: "a.pdf",
            mime: PDF,
            sizeBytes: 1,
            uploadedBy: "user_1",
            createdAt: NOW,
          },
        ],
        meetings: [{ id: ID, ...meeting, createdAt: NOW }],
      },
      bad: {
        consultation,
        messages: [],
        attachments: [
          {
            id: ID,
            messageId: ID,
            fileName: "a.pdf",
            mime: PDF,
            sizeBytes: 1,
            uploadedBy: "user_1",
            createdAt: NOW,
            storageKey: "secret",
          },
        ],
        meetings: [],
      },
    },
  },
  "POST /api/consultations/:id/messages": {
    params: ID_PARAMS,
    body: { ok: { attachmentIds: [ID] }, bad: { attachmentIds: [] } },
    response: ID_RESPONSE,
  },
  "POST /api/consultations/:id/attachments/upload-url": {
    params: ID_PARAMS,
    body: {
      ok: { fileName: "a.pdf", mime: PDF, sizeBytes: 100 },
      bad: { fileName: "a.docm", mime: PDF, sizeBytes: 100 },
    },
    response: {
      ok: { url: URL_OK, attachmentId: ID },
      bad: { url: URL_OK },
    },
  },
  "POST /api/consultations/:id/attachments/finalize": {
    params: ID_PARAMS,
    body: { ok: { attachmentId: ID }, bad: {} },
    response: OK_RESPONSE,
  },
  "GET /api/attachments/:id": { params: ID_PARAMS, response: URL_RESPONSE },
  "POST /api/document-requests": {
    body: {
      ok: { documentIds: [ID, OTHER_ID], purpose: "P" },
      bad: { documentIds: [], purpose: "P" },
    },
    response: { ok: { requestIds: [ID] }, bad: { requestIds: [] } },
  },
  "GET /api/documents/:id/open": {
    params: ID_PARAMS,
    query: { ok: { action: "download" }, bad: { action: "print" } },
    response: {
      ok: { url: URL_OK, expiresInSeconds: 60, accessMode: "view" },
      bad: { url: URL_OK, expiresInSeconds: 3600, accessMode: "view" },
    },
  },
  "POST /api/courses/:id/register": {
    params: ID_PARAMS,
    response: OK_RESPONSE,
  },
  "PATCH /api/admin/consultations/:id": {
    params: ID_PARAMS,
    body: { ok: { assignedTo: null }, bad: {} },
    response: OK_RESPONSE,
  },
  "POST /api/admin/consultations/:id/meetings": {
    params: ID_PARAMS,
    body: {
      ok: meeting,
      bad: { ...meeting, url: "http://example.com" },
    },
    response: ID_RESPONSE,
  },
  "PATCH /api/admin/consultations/:id/meetings": {
    params: ID_PARAMS,
    body: {
      ok: { meetingId: ID, durationMinutes: 45 },
      bad: { meetingId: ID },
    },
    response: OK_RESPONSE,
  },
  "PATCH /api/admin/testimonials/:id/approve": {
    params: ID_PARAMS,
    body: { ok: { approved: true }, bad: { approved: "yes" } },
    response: OK_RESPONSE,
  },
  "PATCH /api/admin/partners/:id/approve": {
    params: ID_PARAMS,
    body: { ok: { approved: false }, bad: { approvedBy: "user_1" } },
    response: OK_RESPONSE,
  },
  "POST /api/admin/document-requests/:id/recommend": {
    params: ID_PARAMS,
    body: {
      ok: { recommendation: "needs_clarification", note: "N" },
      bad: { recommendation: "reject" },
    },
    response: OK_RESPONSE,
  },
  "POST /api/admin/document-requests/:id/decide": {
    params: ID_PARAMS,
    body: {
      ok: { decision: "grant", expiresAt: FUTURE },
      bad: { decision: "reject" },
    },
    response: OK_RESPONSE,
  },
  "GET /api/admin/documents": {
    response: {
      ok: { documents: [adminDocument] },
      bad: { documents: [{ ...adminDocument, storageKey: "secret" }] },
    },
  },
  "POST /api/admin/documents": {
    body: {
      ok: documentBody,
      bad: { ...documentBody, category: "other" },
    },
    response: ID_RESPONSE,
  },
  "PATCH /api/admin/documents": {
    body: { ok: { id: ID, status: "published" }, bad: { id: ID } },
    response: OK_RESPONSE,
  },
  "POST /api/admin/uploads/upload-url": {
    body: {
      ok: { target: "resource", fileName: "a.docx", mime: documentMime(), sizeBytes: 1 },
      bad: { target: "document", fileName: "a.docx", mime: documentMime(), sizeBytes: 1 },
    },
    response: {
      ok: { url: URL_OK, key: "abc" },
      bad: { url: URL_OK, key: "" },
    },
  },
  "POST /api/admin/uploads/finalize": {
    body: {
      ok: { target: "media", key: "abc" },
      bad: { target: "avatar", key: "abc" },
    },
    response: OK_RESPONSE,
  },
  "GET /api/admin/courses": {
    response: {
      ok: { courses: [course] },
      bad: { courses: [{ ...course, type: "webinar" }] },
    },
  },
  "POST /api/admin/courses": {
    body: {
      ok: { slug: "c", type: "custom", status: "draft" },
      bad: { slug: "c", type: "webinar", status: "draft" },
    },
    response: ID_RESPONSE,
  },
  "PATCH /api/admin/courses": {
    body: { ok: { id: ID, seats: 5 }, bad: { id: ID } },
    response: OK_RESPONSE,
  },
  "GET /api/admin/clients": {
    query: {
      ok: { page: "2", pageSize: "50", search: "name", status: "disabled" },
      bad: { status: "banned" },
    },
    response: {
      ok: { clients: [client], total: 1 },
      bad: { clients: [{ ...client, status: "banned" }], total: 1 },
    },
  },
  "PATCH /api/admin/clients": {
    body: {
      ok: { id: "user_1", status: "disabled" },
      bad: { id: "user_1", phone: "1" },
    },
    response: OK_RESPONSE,
  },
  "GET /api/admin/team": {
    query: { ok: { status: "active" }, bad: { pageSize: "101" } },
    response: {
      ok: {
        members: [member],
        total: 1,
        invitations: [{ email: "b@example.com", roleId: ID, createdAt: NOW }],
      },
      bad: { members: [member], total: 1, invitations: [{ email: "b" }] },
    },
  },
  "POST /api/admin/team": {
    body: {
      ok: { email: "a@example.com", roleId: ID },
      bad: { email: "nope", roleId: ID },
    },
    response: OK_RESPONSE,
  },
  "PATCH /api/admin/team": {
    body: { ok: { id: "user_1", roleId: ID }, bad: { id: "user_1" } },
    response: OK_RESPONSE,
  },
  "GET /api/admin/roles": {
    response: {
      ok: { roles: [role] },
      bad: { roles: [{ ...role, permissions: ["nope"] }] },
    },
  },
  "POST /api/admin/roles": {
    body: {
      ok: {
        key: "editor_two",
        nameAr: "محرر",
        nameEn: "Editor",
        permissions: ["content.manage"],
      },
      bad: {
        key: "Editor Two",
        nameAr: "محرر",
        nameEn: "Editor",
        permissions: [],
      },
    },
    response: ID_RESPONSE,
  },
  "PATCH /api/admin/roles": {
    body: {
      ok: { id: ID, permissions: ["team.manage"] },
      bad: { id: ID, key: "renamed" },
    },
    response: OK_RESPONSE,
  },
  "PATCH /api/admin/settings": {
    body: { ok: { key: "cv_visible", value: true }, bad: { value: true } },
    response: OK_RESPONSE,
  },
  "PATCH /api/admin/email-templates": {
    body: {
      ok: {
        event: "meeting",
        subjectAr: "ع",
        subjectEn: "S",
        bodyAr: "ن",
        bodyEn: "B",
      },
      bad: {
        event: "party",
        subjectAr: "ع",
        subjectEn: "S",
        bodyAr: "ن",
        bodyEn: "B",
      },
    },
    response: OK_RESPONSE,
  },
  "PATCH /api/admin/messages": {
    body: { ok: { id: ID, read: true }, bad: { id: ID, read: "yes" } },
    response: OK_RESPONSE,
  },
  "GET /api/admin/newsletter/export": {
    response: { ok: "email\na@example.com\n", bad: { rows: [] } },
  },
  "DELETE /api/admin/:type/:id": {
    params: {
      ok: { type: "posts", id: ID },
      bad: { type: "audit_log", id: ID },
    },
    body: { ok: { confirm: ID }, bad: { confirm: "yes" } },
    response: OK_RESPONSE,
  },
  "POST /api/clerk/webhook": {
    body: { ok: clerkEvent, bad: { ...clerkEvent, type: "user.created" } },
    response: OK_RESPONSE,
  },
  "POST /api/resend/webhook": {
    body: { ok: resendEvent, bad: { ...resendEvent, data: { email: "x" } } },
    response: OK_RESPONSE,
  },
  "POST /api/cron/hourly": {
    response: {
      ok: { retried: 3, sent: 2, failed: 1 },
      bad: { retried: 3, sent: 2 },
    },
  },
  "GET /api/posthog-config": {
    response: {
      ok: { key: "phc_1", host: "https://eu.i.posthog.com" },
      bad: { key: "phc_1" },
    },
  },
};

function documentMime() {
  return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

/** Reads every route from the §8 tables, so the test follows the doc itself. */
function readSection8Routes(): string[] {
  const section = projectDoc.slice(
    projectDoc.indexOf("## 8. API routes"),
    projectDoc.indexOf("## 9. Security rules"),
  );
  return section
    .split(/\r?\n/)
    .filter((line) => line.startsWith("| `"))
    .flatMap((line) => {
      const firstCell = line.split(" | ")[0] ?? "";
      let methods: string[] = [];
      return [...firstCell.matchAll(/`([^`]+)`/g)].flatMap(([, route = ""]) => {
        const parts = route.split(" ");
        const path = parts.at(-1) ?? "";
        if (parts.length === 2) methods = (parts[0] ?? "").split("/");
        return methods.map((method) => `${method} ${path}`);
      });
    });
}

describe("ROUTES", () => {
  const documented = readSection8Routes();

  it("reads the §8 tables", () => {
    expect(documented.length).toBeGreaterThan(40);
    expect(documented).toContain("GET /api/admin/roles");
    expect(documented).toContain("PATCH /api/admin/partners/:id/approve");
  });

  it("lists every §8 route, and nothing else", () => {
    expect(Object.keys(ROUTES).toSorted()).toEqual(documented.toSorted());
  });

  it("has no DELETE on the content route", () => {
    expect(documented).not.toContain("DELETE /api/admin/content/:type");
  });

  it.each(Object.entries(ROUTES) as [RouteName, RouteContract][])(
    "%s has a response type",
    (_name, route) => {
      expect(
        route.response ?? route.responseFor ?? route.redirects,
      ).toBeDefined();
    },
  );
});

describe.each(Object.entries(CASES) as [RouteName, Case][])("%s", (name, cases) => {
  const route = ROUTES[name] as RouteContract;
  const parts = ["params", "query", "body", "response"] as const;

  it("has a case for each of its schemas", () => {
    for (const part of parts) {
      expect(Boolean(cases[part])).toBe(Boolean(route[part]));
    }
  });

  it.each(parts.filter((part) => route[part]))("%s", (part) => {
    const schema = route[part] as z.ZodType;
    const pair = cases[part] as Pair;
    expect(schema.safeParse(pair.ok).error).toBeUndefined();
    expect(schema.safeParse(pair.bad).success).toBe(false);
  });
});

describe("content routes", () => {
  const validBodies: Record<Exclude<ContentType, "home_sections">, object> = {
    home_stats: { status: "draft", value: "15" },
    pages: {
      status: "published",
      key: "about",
      bodyAr: { type: "doc", content: [{ type: "paragraph" }] },
    },
    timeline_items: { status: "draft", kind: "career" },
    expertise_areas: { status: "draft", slug: "governance" },
    services: { status: "draft", slug: "الحوكمة-المؤسسية" },
    projects: {
      status: "draft",
      slug: "project",
      images: [{ key: "a.png", altAr: "صورة" }],
      serviceIds: [ID],
    },
    faqs: { status: "draft", category: "account" },
    partners: { status: "draft", logoKey: "a.png", consentConfirmed: true },
    testimonials: { status: "draft", letterKey: "a.pdf", partnerId: ID },
    posts: { status: "draft", slugEn: "english-only", titleEn: "T" },
    resources: {
      status: "draft",
      kind: "guide",
      key: "a.pdf",
      access: "email",
    },
    media_items: { status: "draft", category: "conferences" },
  };

  const creatable = Object.keys(validBodies) as (keyof typeof validBodies)[];

  it("has 13 types", () => {
    expect(CONTENT_TYPES).toHaveLength(13);
  });

  it.each(creatable)("POST %s accepts a valid body", (type) => {
    const route = ROUTES["POST /api/admin/content/:type"];
    expect(
      route.bodyFor(type)?.safeParse(validBodies[type]).error,
    ).toBeUndefined();
  });

  it.each(creatable)("POST %s refuses an unknown field", (type) => {
    const body = { ...validBodies[type], nope: true };
    expect(contentCreateBodySchemas[type].safeParse(body).success).toBe(false);
  });

  it.each(creatable)("POST %s refuses a bad status", (type) => {
    const body = { ...validBodies[type], status: "archived" };
    expect(contentCreateBodySchemas[type].safeParse(body).success).toBe(false);
  });

  it("POST home_sections has no body: the 12 are seeded", () => {
    const route = ROUTES["POST /api/admin/content/:type"];
    expect(route.bodyFor("home_sections")).toBeUndefined();
  });

  it.each(creatable)("PATCH %s needs an id and one field", (type) => {
    const schema = contentUpdateBodySchemas[type];
    expect(schema.safeParse({ id: ID, status: "draft" }).success).toBe(true);
    expect(schema.safeParse({ id: ID }).success).toBe(false);
    expect(schema.safeParse({ status: "draft" }).success).toBe(false);
  });

  it("PATCH home_sections goes by key", () => {
    const schema = contentUpdateBodySchemas.home_sections;
    expect(schema.safeParse({ key: "hero", isVisible: false }).success).toBe(
      true,
    );
    expect(schema.safeParse({ key: "hero" }).success).toBe(false);
    expect(schema.safeParse({ key: "footer", isVisible: false }).success).toBe(
      false,
    );
  });

  it("PATCH pages can't change a page's key", () => {
    const schema = contentUpdateBodySchemas.pages;
    expect(schema.safeParse({ id: ID, key: "terms" }).success).toBe(false);
  });

  it.each(CONTENT_TYPES)("GET %s has a row and refuses extras", (type) => {
    const route = ROUTES["GET /api/admin/content/:type"];
    const row =
      type === "home_sections"
        ? { key: "hero", updatedAt: NOW }
        : {
            id: ID,
            createdAt: NOW,
            updatedAt: NOW,
            ...(type === "partners" || type === "testimonials"
              ? { adminApproved: true }
              : {}),
          };
    const schema = route.responseFor(type);
    expect(schema.safeParse({ rows: [row] }).error).toBeUndefined();
    expect(
      schema.safeParse({ rows: [{ ...row, storageKey: "secret" }] }).success,
    ).toBe(false);
  });

  it("refuses an unknown :type", () => {
    const { params } = ROUTES["GET /api/admin/content/:type"];
    expect(params.safeParse({ type: "pages" }).success).toBe(true);
    expect(params.safeParse({ type: "site_settings" }).success).toBe(false);
  });

  it("rich text must be a Tiptap document, never HTML", () => {
    const schema = contentCreateBodySchemas.pages;
    const body = { status: "draft", key: "about", bodyAr: "<p>text</p>" };
    expect(schema.safeParse(body).success).toBe(false);
  });

  it("refuses a client-chosen path on testimonials and partners", () => {
    const { testimonials, partners } = contentCreateBodySchemas;
    expect(
      testimonials.safeParse({ status: "draft", letterPath: "x" }).success,
    ).toBe(false);
    expect(
      partners.safeParse({ status: "draft", logoPath: "x" }).success,
    ).toBe(false);
  });

  it("lets a resource row out without its storage key", () => {
    expect(Object.keys(contentRowSchemas.resources.shape)).not.toContain("key");
  });
});
