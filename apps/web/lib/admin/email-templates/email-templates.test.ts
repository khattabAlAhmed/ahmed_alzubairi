import type { Tables as DbTables } from "@repo/db";
import {
  EMAIL_EVENTS,
  EMAIL_PLACEHOLDERS,
  PERMISSIONS,
  type EmailTemplate,
  type Permission,
} from "@repo/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMAIL_DEFAULTS } from "@/emails/defaults";
import { fakeService, outboxRow, type Tables } from "@/lib/email/fake-db";
import { renderOutboxRow } from "@/lib/email/render";
import { createServiceClient } from "@/lib/supabase/service";
import arMessages from "@/messages/ar/DashboardEmailTemplates.json";
import enMessages from "@/messages/en/DashboardEmailTemplates.json";
import type { AuditEntry } from "../audit";
import type { PermissionDeps } from "../permissions";
import {
  listEmailTemplates,
  resetEmailTemplate,
  updateEmailTemplate,
  type EmailTemplateStore,
} from "./handlers";
import {
  handleEmailTemplatesRequest,
  type EmailTemplatesRouteDeps,
} from "./route";
import {
  defaultTemplate,
  templateEntries,
  unknownByField,
  unknownPlaceholders,
} from "./templates";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

const ADMIN = "user_admin";

/** Texts no log row may hold. */
const SECRET_SUBJECT = "[Contact] private subject {{subject}}";
const SECRET_BODY = "A private body from {{name}}.";

const edited: EmailTemplate = {
  event: "contact_message",
  subjectAr: "[رسالة] {{subject}}",
  subjectEn: SECRET_SUBJECT,
  bodyAr: "نص معدّل من {{name}}.",
  bodyEn: SECRET_BODY,
};

let tables: Tables;

/** A store over the same in-memory table the sender's `render` reads. */
function memoryStore(): EmailTemplateStore {
  const rows = () => (tables.email_templates ??= []);
  return {
    list: async () =>
      rows().map((row) => ({
        event: row.event as EmailTemplate["event"],
        subjectAr: String(row.subject_ar),
        subjectEn: String(row.subject_en),
        bodyAr: String(row.body_ar),
        bodyEn: String(row.body_en),
      })),
    upsert: vi.fn(async (template: EmailTemplate) => {
      tables.email_templates = [
        ...rows().filter((row) => row.event !== template.event),
        {
          event: template.event,
          subject_ar: template.subjectAr,
          subject_en: template.subjectEn,
          body_ar: template.bodyAr,
          body_en: template.bodyEn,
        },
      ];
    }),
    remove: vi.fn(async (event) => {
      tables.email_templates = rows().filter((row) => row.event !== event);
    }),
  };
}

function deps(store = memoryStore()) {
  return {
    locale: "en" as const,
    userId: ADMIN,
    store,
    audit: vi.fn<(entry: AuditEntry) => Promise<void>>(async () => {}),
  };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  tables = { email_templates: [] };
  vi.mocked(createServiceClient).mockImplementation(
    () => fakeService(tables) as unknown as ReturnType<typeof createServiceClient>,
  );
});

afterEach(() => {
  vi.mocked(createServiceClient).mockReset();
  vi.unstubAllEnvs();
});

describe("templateEntries", () => {
  it("lists all 13 events in order, each with its default copy", () => {
    const entries = templateEntries([]);
    expect(entries.map((entry) => entry.event)).toEqual([...EMAIL_EVENTS]);
    expect(entries).toHaveLength(13);
    for (const entry of entries) {
      expect(entry).toEqual({ ...defaultTemplate(entry.event), edited: false });
      expect(entry.subjectAr).toBe(EMAIL_DEFAULTS[entry.event].ar.subject);
      expect(entry.bodyEn).toBe(EMAIL_DEFAULTS[entry.event].en.body);
    }
  });

  it("marks a saved row as edited and leaves the others default", () => {
    const entries = templateEntries([edited]);
    const saved = entries.find((entry) => entry.event === "contact_message");
    expect(saved).toEqual({ ...edited, edited: true });
    expect(entries.filter((entry) => entry.edited)).toHaveLength(1);
  });

  it("leaves out a saved row for an event this build doesn't know", () => {
    const stray = { ...edited, event: "party" } as unknown as EmailTemplate;
    const entries = templateEntries([stray]);
    expect(entries).toHaveLength(13);
    expect(entries.some((entry) => entry.edited)).toBe(false);
  });
});

describe("unknownPlaceholders", () => {
  it("accepts every placeholder of the event's payload", () => {
    for (const event of EMAIL_EVENTS) {
      const text = EMAIL_PLACEHOLDERS[event].map((name) => `{{${name}}}`).join(" ");
      expect(unknownPlaceholders(event, text)).toEqual([]);
    }
  });

  it("names a placeholder the event doesn't have, once, in order", () => {
    expect(
      unknownPlaceholders(
        "contact_message",
        "{{name}} {{ clientName }} {{title}} {{clientName}}",
      ),
    ).toEqual(["clientName", "title"]);
  });

  it("accepts the default copy of every event", () => {
    for (const event of EMAIL_EVENTS) {
      expect(unknownByField(event, defaultTemplate(event))).toEqual({});
    }
  });

  it("reports the field each unknown placeholder is in", () => {
    expect(
      unknownByField("account_new", {
        subjectAr: "{{clientName}}",
        subjectEn: "{{email}}",
        bodyAr: "نص",
        bodyEn: "{{clientName}} {{phone}}",
      }),
    ).toEqual({ subjectEn: ["email"], bodyEn: ["phone"] });
  });
});

describe("listEmailTemplates", () => {
  it("answers the saved row as edited and the rest as default", async () => {
    const store = memoryStore();
    await store.upsert(edited);
    const result = await listEmailTemplates({ store });
    expect(result.status).toBe(200);
    expect(result.body.templates).toHaveLength(13);
    expect(
      result.body.templates.find((entry) => entry.event === "contact_message"),
    ).toEqual({ ...edited, edited: true });
    expect(
      result.body.templates.find((entry) => entry.event === "meeting"),
    ).toEqual({ ...defaultTemplate("meeting"), edited: false });
  });
});

describe("updateEmailTemplate", () => {
  it("saves the template, and the audit row has the event but no template text", async () => {
    const d = deps();
    const result = await updateEmailTemplate(edited, d);
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(d.store.upsert).toHaveBeenCalledWith(edited);
    expect(d.audit).toHaveBeenCalledTimes(1);
    const entry = d.audit.mock.calls[0]?.[0];
    expect(entry).toEqual({
      actorId: ADMIN,
      action: "email_template.update",
      entity: "email_templates",
      entityId: "contact_message",
      metadata: { event: "contact_message", reset: false },
    });
    const logged = JSON.stringify(entry);
    for (const text of Object.values(edited).filter((v) => v !== edited.event)) {
      expect(logged).not.toContain(text);
    }
    expect(logged).not.toContain("private");
  });

  it.each([
    ["the Arabic subject", { subjectAr: "[رسالة] {{title}}" }, "{{title}}"],
    ["the English subject", { subjectEn: "Hi {{clientName}}" }, "{{clientName}}"],
    ["the Arabic body", { bodyAr: "{{name}} {{url}}" }, "{{url}}"],
    ["the English body", { bodyEn: "{{ password }}" }, "{{password}}"],
  ])("refuses an unknown placeholder in %s, naming it, and writes nothing", async (_label, change, token) => {
    const d = deps();
    const result = await updateEmailTemplate({ ...edited, ...change }, d);
    expect(result).toMatchObject({
      status: 400,
      body: { error: { code: "validation_failed" } },
    });
    expect("error" in result.body && result.body.error.message).toContain(token);
    expect(d.store.upsert).not.toHaveBeenCalled();
    expect(d.audit).not.toHaveBeenCalled();
    expect(tables.email_templates).toEqual([]);
  });

  it("names every unknown placeholder, in the user's language", async () => {
    const d = { ...deps(), locale: "ar" as const };
    const result = await updateEmailTemplate(
      { ...edited, subjectEn: "{{title}}", bodyEn: "{{url}} {{title}}" },
      d,
    );
    const message = "error" in result.body ? result.body.error.message : "";
    expect(message).toBe(
      arMessages.errors.unknownPlaceholder.replace("{names}", "{{title}}، {{url}}"),
    );
  });

  it.each([
    ["an unknown event", { ...edited, event: "party" }],
    ["an empty subject", { ...edited, subjectAr: "   " }],
    ["an empty body", { ...edited, bodyEn: "" }],
    ["a subject over the limit", { ...edited, subjectEn: "s".repeat(201) }],
    ["a body over the limit", { ...edited, bodyAr: "ن".repeat(5001) }],
    ["a missing language", { event: "meeting", subjectAr: "ع", bodyAr: "ن" }],
    ["an extra field", { ...edited, html: "<b>x</b>" }],
    ["no body", undefined],
  ])("refuses %s and writes nothing", async (_label, body) => {
    const d = deps();
    const result = await updateEmailTemplate(body, d);
    expect(result).toMatchObject({
      status: 400,
      body: { error: { code: "validation_failed" } },
    });
    expect(d.store.upsert).not.toHaveBeenCalled();
    expect(d.audit).not.toHaveBeenCalled();
  });
});

describe("a saved template and the sender", () => {
  const row = (locale: "ar" | "en") =>
    outboxRow({
      locale,
      payload: { name: "Sender Name", subject: "A question" },
    }) as DbTables<"email_outbox">;

  it("render uses the saved template in place of the default, and reset brings the default back", async () => {
    const d = deps();

    const before = await renderOutboxRow(row("en"));
    expect(before.subject).toBe("[Contact message] A question");

    await updateEmailTemplate(edited, d);
    const saved = await renderOutboxRow(row("en"));
    expect(saved.subject).toBe("[Contact] private subject A question");
    expect(saved.text).toContain("A private body from Sender Name.");
    expect(saved.text).not.toContain(
      EMAIL_DEFAULTS.contact_message.en.body.split("\n")[0],
    );
    const savedAr = await renderOutboxRow(row("ar"));
    expect(savedAr.subject).toBe("[رسالة] A question");
    expect(savedAr.html).toContain("نص معدّل من Sender Name.");

    const reset = await resetEmailTemplate({ event: "contact_message" }, d);
    expect(reset).toEqual({ status: 200, body: { ok: true } });
    expect(tables.email_templates).toEqual([]);
    const after = await renderOutboxRow(row("en"));
    expect(after.subject).toBe(before.subject);
    expect(after.text).toBe(before.text);
    expect(after.html).toBe(before.html);
  });

  it("a saved body with markup reaches the email as visible text", async () => {
    const d = deps();
    await updateEmailTemplate(
      {
        ...edited,
        bodyEn: "<b>bold</b> <script>alert(1)</script> from {{name}}",
      },
      d,
    );
    const email = await renderOutboxRow(row("en"));
    expect(email.html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(email.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(email.html).not.toContain("<b>bold</b>");
    expect(email.html).not.toContain("<script>alert(1)");
  });
});

describe("resetEmailTemplate", () => {
  it("deletes the event's row and audits the event only", async () => {
    const d = deps();
    await d.store.upsert(edited);
    const result = await resetEmailTemplate({ event: "contact_message" }, d);
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(d.store.remove).toHaveBeenCalledWith("contact_message");
    expect(d.audit).toHaveBeenCalledWith({
      actorId: ADMIN,
      action: "email_template.update",
      entity: "email_templates",
      entityId: "contact_message",
      metadata: { event: "contact_message", reset: true },
    });
  });

  it("resetting an event with no saved row is not an error", async () => {
    const result = await resetEmailTemplate({ event: "meeting" }, deps());
    expect(result.status).toBe(200);
  });

  it.each([
    ["an unknown event", { event: "party" }],
    ["an extra field", { event: "meeting", subjectAr: "ع" }],
    ["no body", undefined],
  ])("refuses %s and deletes nothing", async (_label, body) => {
    const d = deps();
    const result = await resetEmailTemplate(body, d);
    expect(result).toMatchObject({ status: 400 });
    expect(d.store.remove).not.toHaveBeenCalled();
    expect(d.audit).not.toHaveBeenCalled();
  });
});

function routeDeps(userId: string | null, granted: Permission[]) {
  const permission: PermissionDeps = {
    getUserId: async () => userId,
    hasPermission: async (key) => granted.includes(key),
  };
  const created = memoryStore();
  return {
    permission,
    createStore: vi.fn(() => created),
    audit: vi.fn(async () => {}),
    created,
  } satisfies EmailTemplatesRouteDeps & { created: EmailTemplateStore };
}

const request = (method: "GET" | "PATCH" | "DELETE", body?: unknown) =>
  new Request("http://localhost/api/admin/email-templates", {
    method,
    headers: { referer: "http://localhost/en/dashboard/settings/email-templates" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });

describe("/api/admin/email-templates", () => {
  const calls = [
    ["GET", undefined],
    ["PATCH", edited],
    ["DELETE", { event: "contact_message" }],
  ] as const;

  it.each(calls)("%s signed out is 401, and no database client is created", async (method, body) => {
    const d = routeDeps(null, []);
    const response = await handleEmailTemplatesRequest(request(method, body), d);
    expect(response.status).toBe(401);
    expect(d.createStore).not.toHaveBeenCalled();
    expect(d.audit).not.toHaveBeenCalled();
  });

  it.each(calls)("%s without team.manage is 403, even with every other permission", async (method, body) => {
    const others = Object.values(PERMISSIONS).filter(
      (key) => key !== PERMISSIONS.TEAM_MANAGE,
    );
    const d = routeDeps("user_editor", others);
    const response = await handleEmailTemplatesRequest(request(method, body), d);
    expect(response.status).toBe(403);
    expect(d.createStore).not.toHaveBeenCalled();
    expect(d.audit).not.toHaveBeenCalled();
    expect(tables.email_templates).toEqual([]);
  });

  it("with team.manage: PATCH saves, GET shows it as edited, DELETE resets it", async () => {
    const d = routeDeps(ADMIN, [PERMISSIONS.TEAM_MANAGE]);

    const patched = await handleEmailTemplatesRequest(request("PATCH", edited), d);
    expect(patched.status).toBe(200);
    expect(await patched.json()).toEqual({ ok: true });

    const listed = await handleEmailTemplatesRequest(request("GET"), d);
    expect(listed.status).toBe(200);
    const { templates } = (await listed.json()) as {
      templates: { event: string; edited: boolean }[];
    };
    expect(templates).toHaveLength(13);
    expect(templates.filter((entry) => entry.edited).map((entry) => entry.event)).toEqual([
      "contact_message",
    ]);

    const deleted = await handleEmailTemplatesRequest(
      request("DELETE", { event: "contact_message" }),
      d,
    );
    expect(deleted.status).toBe(200);
    expect(tables.email_templates).toEqual([]);
    expect(d.audit).toHaveBeenCalledTimes(2);
  });

  it("an unknown placeholder is a 400 that names it", async () => {
    const d = routeDeps(ADMIN, [PERMISSIONS.TEAM_MANAGE]);
    const response = await handleEmailTemplatesRequest(
      request("PATCH", { ...edited, bodyEn: "Hello {{clientName}}" }),
      d,
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.message).toContain("{{clientName}}");
    expect(d.audit).not.toHaveBeenCalled();
  });

  it("a database failure is a 500 with no detail", async () => {
    const d = routeDeps(ADMIN, [PERMISSIONS.TEAM_MANAGE]);
    d.created.upsert = vi.fn(async () => {
      throw new Error("db down: secret detail");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await handleEmailTemplatesRequest(request("PATCH", edited), d);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret detail");
    expect(d.audit).not.toHaveBeenCalled();
  });
});

describe("DashboardEmailTemplates messages", () => {
  const keyPaths = (value: object, prefix = ""): string[] =>
    Object.entries(value).flatMap(([key, child]) =>
      typeof child === "object" && child !== null
        ? keyPaths(child, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    );

  it("has the same keys in Arabic and English", () => {
    expect(keyPaths(arMessages).sort()).toEqual(keyPaths(enMessages).sort());
  });

  it("names every event and describes every placeholder", () => {
    const names = [...new Set(Object.values(EMAIL_PLACEHOLDERS).flat())].sort();
    for (const messages of [arMessages, enMessages]) {
      expect(Object.keys(messages.events).sort()).toEqual([...EMAIL_EVENTS].sort());
      expect(Object.keys(messages.placeholders).sort()).toEqual(names);
    }
  });
});
