import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "./audit";
import { DOCUMENTS_CACHE_TAG } from "./cache-tags";
import { CONTENT_TYPES } from "./content";
import {
  EMAIL_ADMIN_PERMISSION,
  EMAIL_PAYLOADS,
  EMAIL_PLACEHOLDER_PATTERN,
  EMAIL_PLACEHOLDERS,
  OPTIONAL_EMAIL_EVENTS,
  emailValues,
  fillTemplate,
  isOptionalEmailEvent,
  templatePlaceholders,
} from "./email";
import { EMAIL_EVENTS, type EmailEvent } from "./enums";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "./limits";
import {
  auditLogListParamsSchema,
  clientListParamsSchema,
  listParamsSchema,
  messageListParamsSchema,
  pageRange,
  teamListParamsSchema,
} from "./lists";
import {
  auditLogListSchema,
  contactMessageListSchema,
  emailTemplateListSchema,
} from "./routes-team";

const ID = "123e4567-e89b-42d3-a456-426614174000";
const NOW = "2026-11-11T10:00:00.000Z";

type Pair = { ok: unknown; bad: unknown };

function expectPair(schema: z.ZodType, pair: Pair) {
  expect(schema.safeParse(pair.ok).error).toBeUndefined();
  expect(schema.safeParse(pair.bad).success).toBe(false);
}

describe("list params", () => {
  it("default to the first page", () => {
    expect(listParamsSchema.parse({})).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      search: undefined,
    });
  });

  it("read numbers from query strings", () => {
    expect(listParamsSchema.parse({ page: "3", pageSize: "10" })).toMatchObject(
      { page: 3, pageSize: 10 },
    );
  });

  it("trim the search, and count an empty one as none", () => {
    expect(listParamsSchema.parse({ search: "  ali " }).search).toBe("ali");
    expect(listParamsSchema.parse({ search: "   " }).search).toBeUndefined();
  });

  it.each([
    { page: "0" },
    { page: "1.5" },
    { page: "abc" },
    { pageSize: "0" },
    { pageSize: String(MAX_PAGE_SIZE + 1) },
    { search: "x".repeat(201) },
    { sort: "name" },
  ])("refuse %o", (params) => {
    expect(listParamsSchema.safeParse(params).success).toBe(false);
  });

  it("take the largest page size", () => {
    expect(
      listParamsSchema.parse({ pageSize: String(MAX_PAGE_SIZE) }).pageSize,
    ).toBe(MAX_PAGE_SIZE);
  });

  it.each([
    ["team", teamListParamsSchema, { status: "disabled" }, { status: "x" }],
    ["clients", clientListParamsSchema, { status: "active" }, { read: "read" }],
    ["messages", messageListParamsSchema, { read: "unread" }, { read: "yes" }],
    [
      "audit log",
      auditLogListParamsSchema,
      { actor: "user_1", entity: "profiles", action: "team.invite" },
      { action: "team.delete" },
    ],
    ["audit log entity", auditLogListParamsSchema, {}, { entity: "secrets" }],
  ] as const)("%s filters", (_name, schema, ok, bad) => {
    expectPair(schema, { ok, bad });
  });

  it("turn a page into a row range", () => {
    expect(pageRange({ page: 1, pageSize: 20 })).toEqual({ from: 0, to: 19 });
    expect(pageRange({ page: 3, pageSize: 10 })).toEqual({ from: 20, to: 29 });
  });
});

describe("server-read rows", () => {
  const message = {
    id: ID,
    name: "Name",
    email: "a@example.com",
    orgType: "company",
    subject: "Subject",
    message: "Text",
    readAt: null,
    createdAt: NOW,
  };
  const template = {
    event: "contact_message",
    subjectAr: "ع",
    subjectEn: "S",
    bodyAr: "ن",
    bodyEn: "B",
  };
  const entry = {
    id: ID,
    actorId: "user_1",
    actorName: "Name",
    action: "team.invite",
    entity: "profiles",
    entityId: "user_2",
    metadata: { roleId: ID },
    createdAt: NOW,
  };

  it("contact message list", () => {
    expectPair(contactMessageListSchema, {
      ok: { messages: [message, { ...message, readAt: NOW }], total: 2 },
      bad: { messages: [{ ...message, orgType: "club" }], total: 1 },
    });
    expect(
      contactMessageListSchema.safeParse({ messages: [message] }).success,
    ).toBe(false);
  });

  it("email template list", () => {
    expectPair(emailTemplateListSchema, {
      ok: { templates: [template] },
      bad: { templates: [{ ...template, event: "party" }] },
    });
  });

  it("audit log list", () => {
    expectPair(auditLogListSchema, {
      ok: {
        entries: [
          entry,
          // An old or unknown action still lists: the log is permanent.
          { ...entry, actorId: null, actorName: null, action: "seed", entityId: null },
        ],
        total: 2,
      },
      bad: { entries: [{ ...entry, metadata: "text" }], total: 1 },
    });
  });
});

describe("audit keys", () => {
  it("keep the strings Phase 2 already wrote", () => {
    expect(AUDIT_ACTIONS).toEqual(
      expect.arrayContaining([
        "content.publish",
        "content.unpublish",
        "content.edit",
        "approval.grant",
        "approval.withdraw",
        "settings.update",
      ]),
    );
  });

  it("name what Phase 3 writes", () => {
    expect(AUDIT_ACTIONS).toEqual(
      expect.arrayContaining([
        "team.invite",
        "team.role_change",
        "team.disable",
        "team.enable",
        "role.create",
        "role.update",
        "client.disable",
        "client.enable",
        "account.disable",
        "email_template.update",
      ]),
    );
    expect(AUDIT_ACTIONS).toHaveLength(16);
  });

  it("have no duplicates", () => {
    expect(new Set(AUDIT_ACTIONS).size).toBe(AUDIT_ACTIONS.length);
    expect(new Set(AUDIT_ENTITIES).size).toBe(AUDIT_ENTITIES.length);
  });

  it("cover every content type and the Phase 3 tables", () => {
    expect(AUDIT_ENTITIES).toEqual([
      ...CONTENT_TYPES,
      "site_settings",
      "profiles",
      "roles",
      "email_templates",
    ]);
  });
});

describe("cache tags", () => {
  it("keeps the documents tag the public list already uses", () => {
    expect(DOCUMENTS_CACHE_TAG).toBe("content:documents");
  });
});

describe("email contract", () => {
  const consultation = { consultationId: ID, title: "Title" };
  const meeting = {
    ...consultation,
    platform: "Zoom",
    url: "https://example.com/meet",
    startsAt: NOW,
    timezone: "Asia/Riyadh",
  };
  const title = { ar: "شهادة", en: "Certificate" };

  const CASES: Record<EmailEvent, Pair> = {
    consultation_new: {
      ok: { ...consultation, clientName: "Name" },
      bad: consultation,
    },
    consultation_received: { ok: consultation, bad: { title: "Title" } },
    consultation_assigned: {
      ok: consultation,
      bad: { ...consultation, consultationId: "1" },
    },
    consultation_reply: {
      ok: consultation,
      // The message text never goes in an email payload.
      bad: { ...consultation, body: "Text" },
    },
    meeting: { ok: meeting, bad: { ...meeting, url: "http://example.com" } },
    meeting_reminder: { ok: meeting, bad: { ...meeting, startsAt: "tomorrow" } },
    document_request: {
      ok: { documentTitle: title, clientName: "Name" },
      bad: { documentTitle: "Certificate", clientName: "Name" },
    },
    document_recommendation: {
      ok: { documentTitle: title, memberName: "Name" },
      bad: { documentTitle: title },
    },
    document_granted: {
      ok: { documentTitle: title },
      bad: { documentTitle: { ar: "شهادة" } },
    },
    course_registration: {
      ok: { courseTitle: title, traineeName: "Name" },
      bad: { courseTitle: title, traineeName: "" },
    },
    custom_training_request: {
      ok: { orgName: "Org", topic: "Topic" },
      bad: { orgName: "Org" },
    },
    contact_message: {
      ok: { name: "Name", subject: "Subject" },
      bad: { name: "Name", subject: "Subject", message: "Text" },
    },
    account_new: { ok: { clientName: "Name" }, bad: {} },
  };

  it("has a payload schema for every email event, and no other", () => {
    expect(Object.keys(EMAIL_PAYLOADS)).toEqual([...EMAIL_EVENTS]);
  });

  it.each(Object.entries(CASES))("%s payload", (event, pair) => {
    expectPair(EMAIL_PAYLOADS[event as EmailEvent], pair);
  });

  it("lists each event's placeholders", () => {
    expect(EMAIL_PLACEHOLDERS.contact_message).toEqual(["name", "subject"]);
    expect(EMAIL_PLACEHOLDERS.account_new).toEqual(["clientName"]);
    for (const event of EMAIL_EVENTS) {
      expect(EMAIL_PLACEHOLDERS[event].length).toBeGreaterThan(0);
    }
  });

  it("turns off only the reminder and the course registration", () => {
    expect(OPTIONAL_EMAIL_EVENTS).toEqual([
      "meeting_reminder",
      "course_registration",
    ]);
    expect(isOptionalEmailEvent("meeting_reminder")).toBe(true);
    expect(isOptionalEmailEvent("meeting")).toBe(false);
    expect(isOptionalEmailEvent("consultation_reply")).toBe(false);
  });

  it("means team.manage by Admin", () => {
    expect(EMAIL_ADMIN_PERMISSION).toBe("team.manage");
  });
});

describe("emailValues", () => {
  it("picks the recipient's language", () => {
    const payload = {
      documentTitle: { ar: "شهادة", en: "Certificate" },
      clientName: "Name",
    };
    expect(emailValues(payload, "ar")).toEqual({
      documentTitle: "شهادة",
      clientName: "Name",
    });
    expect(emailValues(payload, "en").documentTitle).toBe("Certificate");
  });

  it("keeps strings and numbers, and drops the rest", () => {
    expect(emailValues({ a: "x", b: 2, c: null, d: { x: 1 }, e: true }, "en")).toEqual(
      { a: "x", b: "2" },
    );
  });
});

describe("fillTemplate", () => {
  it("fills known placeholders, with or without spaces", () => {
    expect(
      fillTemplate("[رسالة تواصل] {{subject}} من {{ name }}", {
        name: "أحمد",
        subject: "سؤال",
      }),
    ).toBe("[رسالة تواصل] سؤال من أحمد");
  });

  it("fills every use of a placeholder, and numbers", () => {
    expect(fillTemplate("{{n}} + {{n}}", { n: 2 })).toBe("2 + 2");
  });

  it("leaves an unknown placeholder empty", () => {
    expect(fillTemplate("Hello {{nobody}}!", { name: "N" })).toBe("Hello !");
    expect(fillTemplate("{{a}}{{b}}", {})).toBe("");
  });

  it.each(["constructor", "toString", "valueOf", "hasOwnProperty"])(
    "leaves {{%s}} empty",
    (name) => {
      expect(fillTemplate(`x{{${name}}}y`, {})).toBe("xy");
    },
  );

  it("leaves a value that isn't text empty", () => {
    expect(
      fillTemplate("{{a}}{{b}}{{c}}", { a: null, b: { ar: "ع", en: "E" }, c: [] }),
    ).toBe("");
  });

  it("keeps HTML-looking text as the text it is, and adds no markup", () => {
    const text = "<b>{{name}}</b> {{<script>}} {{ <img src=x> }}";
    expect(fillTemplate(text, { name: "<i>N</i>", "<script>": "bad" })).toBe(
      "<b><i>N</i></b> {{<script>}} {{ <img src=x> }}",
    );
  });

  it("doesn't read a value as a template", () => {
    expect(
      fillTemplate("{{name}}", { name: "{{subject}}", subject: "secret" }),
    ).toBe("{{subject}}");
  });

  it("leaves text with no placeholder unchanged", () => {
    const text = "No braces { here } or {single}\nsecond line";
    expect(fillTemplate(text, { here: "x", single: "y" })).toBe(text);
  });

  it("can be called twice with the same result", () => {
    const values = { name: "N" };
    expect(fillTemplate("{{name}} {{name}}", values)).toBe("N N");
    expect(fillTemplate("{{name}} {{name}}", values)).toBe("N N");
    expect(EMAIL_PLACEHOLDER_PATTERN.global).toBe(true);
  });
});

describe("templatePlaceholders", () => {
  it("lists each name once, in order", () => {
    expect(templatePlaceholders("{{b}} {{ a }} {{b}} {{1x}} {x}")).toEqual([
      "b",
      "a",
    ]);
  });
});
