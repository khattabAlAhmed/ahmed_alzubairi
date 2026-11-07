import type { Transaction } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CONSULTATION_STATUSES,
  DOCUMENT_CATEGORIES,
  EMAIL_EVENTS,
  NEWSLETTER_SOURCES,
  PERMISSIONS,
  type Permission,
} from "../../shared/index";
import { createTestDb, type ApiRole, type TestDb } from "../supabase-pglite";
import { readSection7Columns } from "./section7";

const uuid = (n: number) =>
  `123e4567-e89b-42d3-a456-4266141740${String(n).padStart(2, "0")}`;
const A = uuid(1); // client_a's consultation, assigned to the assistant
const B = uuid(2); // client_b's consultation, unassigned
const DOC = uuid(3);
const REQ_A = uuid(4);
const REQ_B = uuid(5);
const COURSE = uuid(6);
const MSG_A = uuid(7);
const MSG_B = uuid(8);
const UNREQUESTED_DOC = uuid(14);
const NO_ACCESS = /permission denied/;
const ALL_PERMISSIONS = Object.values(PERMISSIONS);

/** The permissions that let a team member read every row, and the client's own rows. */
const TABLES: Record<string, { team: Permission[]; ownCount?: number }> = {
  consultations: { team: [PERMISSIONS.CONSULTATIONS_VIEW_ALL], ownCount: 1 },
  consultation_messages: {
    team: [PERMISSIONS.CONSULTATIONS_VIEW_ALL],
    ownCount: 1,
  },
  consultation_attachments: {
    team: [PERMISSIONS.CONSULTATIONS_VIEW_ALL],
    ownCount: 1,
  },
  meetings: { team: [PERMISSIONS.CONSULTATIONS_VIEW_ALL], ownCount: 1 },
  documents: {
    team: [PERMISSIONS.DOCUMENTS_VIEW, PERMISSIONS.DOCUMENTS_MANAGE],
    ownCount: 1,
  },
  document_requests: {
    team: [
      PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND,
      PERMISSIONS.DOCUMENT_REQUESTS_DECIDE,
    ],
    ownCount: 1,
  },
  document_recommendations: {
    team: [
      PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND,
      PERMISSIONS.DOCUMENT_REQUESTS_DECIDE,
    ],
  },
  document_access_log: { team: [PERMISSIONS.DOCUMENT_REQUESTS_DECIDE] },
  course_registrations: { team: [PERMISSIONS.TRAINING_MANAGE], ownCount: 1 },
  custom_training_requests: { team: [PERMISSIONS.TRAINING_MANAGE] },
  contact_messages: { team: [PERMISSIONS.MESSAGES_VIEW] },
  newsletter_subscribers: { team: [PERMISSIONS.CONTENT_MANAGE] },
  email_templates: { team: [PERMISSIONS.TEAM_MANAGE] },
  email_outbox: { team: [] },
};
const TABLE_NAMES = Object.keys(TABLES);

/** A column authenticated may select on each table. */
const ID_COLUMN = (table: string) =>
  table === "email_templates" ? "event" : "id";

const onlyRole = (permission: string) => `only_${permission.replace(".", "_")}`;
const onlyUser = (permission: string) => `user_${onlyRole(permission)}`;

let db: TestDb;

const exec = (sql: string) => (tx: Transaction) => tx.exec(sql);

const countSeenBy = (clerkUserId: string, table: string) =>
  db.runAs("authenticated", clerkUserId, async (tx) => {
    const { rows } = await tx.query<{ count: number }>(
      `select count(${ID_COLUMN(table)})::int as count from public.${table}`,
    );
    return rows[0]?.count ?? 0;
  });

const idsSeenBy = (clerkUserId: string, table: string) =>
  db.runAs("authenticated", clerkUserId, async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `select id from public.${table}`,
    );
    return rows.map((row) => row.id).toSorted();
  });

const profilesSeenBy = (clerkUserId: string) =>
  db.runAs("authenticated", clerkUserId, async (tx) => {
    const { rows } = await tx.query<{ clerk_user_id: string }>(
      "select clerk_user_id from public.profiles",
    );
    return rows.map((row) => row.clerk_user_id).toSorted();
  });

async function addProfile(
  clerkUserId: string,
  roleKey: string | null,
  status = "active",
) {
  await db.owner.query(
    `insert into public.profiles
       (clerk_user_id, full_name, email, phone, timezone, terms_accepted_at, status, role_id)
     values ($1, 'Test', $1 || '@example.com', '+966500000000', 'Asia/Riyadh', now(), $2,
       (select id from public.roles where key = $3))`,
    [clerkUserId, status, roleKey],
  );
}

beforeAll(async () => {
  db = await createTestDb();

  for (const client of ["client_a", "client_b", "client_c", "client_d"]) {
    await addProfile(client, null);
  }
  await addProfile("assistant", "assistant_consultant");
  await addProfile("other_assistant", "assistant_consultant");
  await addProfile("disabled_assistant", "assistant_consultant", "disabled");
  await addProfile("coordinator", "training_coordinator");
  await addProfile("disabled_coordinator", "training_coordinator", "disabled");
  await addProfile("disabled_admin", "admin", "disabled");
  await addProfile("admin", "admin");

  for (const permission of ALL_PERMISSIONS) {
    const key = onlyRole(permission);
    await db.owner.query(
      "insert into public.roles (key, name_ar, name_en) values ($1, $1, $1)",
      [key],
    );
    await db.owner.query(
      `insert into public.role_permissions (role_id, permission)
       select id, $2 from public.roles where key = $1`,
      [key, permission],
    );
    await addProfile(onlyUser(permission), key);
  }

  await db.owner.exec(`
    insert into public.consultations (id, client_id, title, description, assigned_to) values
      ('${A}', 'client_a', 'A', 'A', 'assistant'),
      ('${B}', 'client_b', 'B', 'B', null),
      ('${uuid(9)}', 'client_d', 'D', 'D', 'disabled_assistant');
    insert into public.consultation_messages (id, consultation_id, sender_id, body) values
      ('${MSG_A}', '${A}', 'client_a', 'secret A'),
      ('${MSG_B}', '${B}', 'client_b', 'secret B');
    insert into public.consultation_attachments
      (id, consultation_id, message_id, storage_key, file_name, mime, size_bytes, status, uploaded_by) values
      ('${uuid(10)}', '${A}', '${MSG_A}', 'attachments/a', 'a.pdf', 'application/pdf', 1, 'ready', 'client_a'),
      ('${uuid(11)}', '${B}', '${MSG_B}', 'attachments/b', 'b.pdf', 'application/pdf', 1, 'ready', 'client_b');
    insert into public.meetings (id, consultation_id, platform, url, starts_at, duration_minutes) values
      ('${uuid(12)}', '${A}', 'Zoom', 'https://example.com/a', now(), 30),
      ('${uuid(13)}', '${B}', 'Zoom', 'https://example.com/b', now(), 30);
    insert into public.documents (id, category, title_ar, title_en, storage_key, mime, access_mode) values
      ('${DOC}', 'thank_you_letter', 'ش', 'T', 'documents/original', 'application/pdf', 'view'),
      ('${UNREQUESTED_DOC}', 'thank_you_letter', 'ش', 'T', 'documents/other', 'application/pdf', 'view');
    insert into public.document_requests (id, client_id, document_id, purpose) values
      ('${REQ_A}', 'client_a', '${DOC}', 'A'),
      ('${REQ_B}', 'client_b', '${DOC}', 'B');
    insert into public.document_recommendations (request_id, member_id, recommendation)
      values ('${REQ_A}', 'assistant', 'approve');
    insert into public.document_access_log (request_id, document_id, client_id, action)
      values ('${REQ_A}', '${DOC}', 'client_a', 'view');
    insert into public.courses (id, slug, type) values ('${COURSE}', 'course', 'custom');
    insert into public.course_registrations (course_id, client_id) values
      ('${COURSE}', 'client_a'), ('${COURSE}', 'client_c');
    insert into public.custom_training_requests
      (client_id, org_name, trainee_count, topic, suggested_date, contact_email)
      values ('client_a', 'Org', 5, 'Topic', '2027-01-31', 'a@example.com');
    insert into public.contact_messages (name, email, org_type, subject, message)
      values ('N', 'a@example.com', 'company', 'S', 'M');
    insert into public.newsletter_subscribers (email, locale, source, confirm_token_hash)
      values ('a@example.com', 'ar', 'footer', 'hash');
    insert into public.email_templates (event, subject_ar, subject_en, body_ar, body_en)
      values ('meeting', 'ع', 'S', 'ن', 'B');
    insert into public.email_outbox (event, to_email, locale) values ('meeting', 'a@example.com', 'ar');
  `);
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe("tables", () => {
  const section7 = readSection7Columns("**Client work**", "**Storage buckets**");

  it("covers every table in §7 Client work", () => {
    expect(TABLE_NAMES.toSorted()).toEqual(Object.keys(section7).toSorted());
  });

  it.each(Object.entries(section7))(
    "%s has exactly its §7 columns",
    async (table, columns) => {
      const { rows } = await db.owner.query<{ column_name: string }>(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = $1`,
        [table],
      );
      expect(rows.map((row) => row.column_name).toSorted()).toEqual(
        columns.toSorted(),
      );
    },
  );

  it("lets an attachment exist before its message", async () => {
    await db.owner.exec("begin");
    try {
      await db.owner.exec(
        `insert into public.consultation_attachments
           (consultation_id, storage_key, file_name, mime, size_bytes, uploaded_by)
         values ('${A}', 'k', 'a.pdf', 'application/pdf', 1, 'client_a')`,
      );
    } finally {
      await db.owner.exec("rollback");
    }
  });
});

describe("shared keys match the constraints", () => {
  const inTx = async (sql: string) => {
    try {
      await db.owner.exec(`begin; ${sql};`);
    } finally {
      await db.owner.exec("rollback");
    }
  };

  it.each([
    [
      "documents.category",
      DOCUMENT_CATEGORIES,
      (v: string) =>
        `insert into public.documents (category, title_ar, title_en, storage_key, mime, access_mode) values ('${v}', 'a', 'b', 'k', 'm', 'view')`,
    ],
    [
      "consultations.status",
      CONSULTATION_STATUSES,
      (v: string) =>
        `insert into public.consultations (client_id, title, description, status) values ('client_a', 't', 'd', '${v}')`,
    ],
    [
      "newsletter source",
      NEWSLETTER_SOURCES,
      (v: string) =>
        `insert into public.newsletter_subscribers (email, locale, source) values ('n@example.com', 'ar', '${v}')`,
    ],
    [
      "email_templates.event",
      EMAIL_EVENTS.filter((event) => event !== "meeting"),
      (v: string) =>
        `insert into public.email_templates (event, subject_ar, subject_en, body_ar, body_en) values ('${v}', 'a', 'b', 'c', 'd')`,
    ],
  ] as const)("%s", async (_label, keys, sql) => {
    for (const key of keys) await inTx(sql(key));
    await expect(inTx(sql("nope"))).rejects.toThrow(/check constraint/);
  });
});

describe("document_requests", () => {
  const insertSql = (status: string) =>
    `insert into public.document_requests (client_id, document_id, purpose, status)
     values ('client_a', '${DOC}', 'again', '${status}')`;

  const attempt = async (sql: string) => {
    try {
      await db.owner.exec(`begin; ${sql};`);
    } finally {
      await db.owner.exec("rollback");
    }
  };

  it.each(["rejected", "reject", "denied"])("refuses status %s", async (status) => {
    await expect(attempt(insertSql(status))).rejects.toThrow(/check constraint/);
  });

  it.each(["pending_review", "in_contact", "granted"])(
    "refuses a duplicate while %s",
    async (status) => {
      await expect(attempt(insertSql(status))).rejects.toThrow(
        /document_requests_open_idx/,
      );
    },
  );

  it("refuses a duplicate of a granted request", async () => {
    await expect(
      attempt(
        `update public.document_requests set status = 'granted' where id = '${REQ_A}';
         ${insertSql("pending_review")}`,
      ),
    ).rejects.toThrow(/document_requests_open_idx/);
  });

  it.each(["expired", "revoked"])(
    "allows a new request after %s",
    async (status) => {
      await attempt(
        `update public.document_requests set status = '${status}' where id = '${REQ_A}';
         ${insertSql("pending_review")}`,
      );
    },
  );

  it("has no rejected value in its constraint", async () => {
    const { rows } = await db.owner.query<{ definition: string }>(
      `select pg_get_constraintdef(oid) as definition from pg_constraint
       where conrelid = 'public.document_requests'::regclass and contype = 'c'`,
    );
    expect(rows.map((row) => row.definition).join()).not.toMatch(/reject/i);
  });
});

describe("cross-client isolation", () => {
  it.each([
    ["consultations", [A]],
    ["consultation_messages", [MSG_A]],
    ["consultation_attachments", [uuid(10)]],
    ["meetings", [uuid(12)]],
    ["document_requests", [REQ_A]],
  ])("client_a reads only their own %s", async (table, expected) => {
    expect(await idsSeenBy("client_a", table)).toEqual(expected);
  });

  it("client_b doesn't get client_a's message by id", async () => {
    const rows = await db.runAs("authenticated", "client_b", async (tx) => {
      const result = await tx.query(
        `select body from public.consultation_messages where id = '${MSG_A}'`,
      );
      return result.rows;
    });
    expect(rows).toEqual([]);
  });

  it("a client doesn't read another client's profile", async () => {
    expect(await profilesSeenBy("client_a")).toEqual(["client_a"]);
  });
});

describe("visible_consultation_ids", () => {
  const consultationIds = (user: string) => idsSeenBy(user, "consultations");

  it("gives an assigned assistant only assigned rows", async () => {
    expect(await consultationIds("assistant")).toEqual([A]);
    expect(await idsSeenBy("assistant", "consultation_messages")).toEqual([
      MSG_A,
    ]);
    expect(await idsSeenBy("assistant", "consultation_attachments")).toEqual([
      uuid(10),
    ]);
    expect(await idsSeenBy("assistant", "meetings")).toEqual([uuid(12)]);
  });

  it("gives another assistant nothing", async () => {
    expect(await consultationIds("other_assistant")).toEqual([]);
  });

  it("gives a disabled assistant nothing", async () => {
    expect(await consultationIds("disabled_assistant")).toEqual([]);
  });

  it("gives consultations.view_all everything", async () => {
    const seen = await consultationIds(
      onlyUser(PERMISSIONS.CONSULTATIONS_VIEW_ALL),
    );
    expect(seen).toEqual([A, B, uuid(9)].toSorted());
  });

  it("gives a disabled admin nothing", async () => {
    expect(await consultationIds("disabled_admin")).toEqual([]);
  });

  it.each(ALL_PERMISSIONS.filter((key) => key !== "consultations.view_all"))(
    "refuses everyone else's rows with only %s",
    async (permission) => {
      expect(await consultationIds(onlyUser(permission))).toEqual([]);
    },
  );

  it.each<ApiRole>(["anon", "service_role"])("can't be called as %s", async (role) => {
    await expect(
      db.runAs(role, null, exec("select public.visible_consultation_ids()")),
    ).rejects.toThrow(NO_ACCESS);
  });
});

describe("§5 scoped client data", () => {
  it("an assistant reads an assigned client, not an unassigned one", async () => {
    const seen = await profilesSeenBy("assistant");
    expect(seen).toContain("client_a");
    expect(seen).not.toContain("client_b");
    expect(seen).not.toContain("client_c");
  });

  it("another assistant reads neither", async () => {
    expect(await profilesSeenBy("other_assistant")).toEqual(["other_assistant"]);
  });

  it("a coordinator reads a registered client, not an unregistered one", async () => {
    const seen = await profilesSeenBy("coordinator");
    expect(seen).toContain("client_a");
    expect(seen).toContain("client_c");
    expect(seen).not.toContain("client_b");
    expect(seen).not.toContain("client_d");
  });

  it("neither reads a client once disabled", async () => {
    expect(await profilesSeenBy("disabled_assistant")).toEqual([
      "disabled_assistant",
    ]);
    expect(await profilesSeenBy("disabled_coordinator")).toEqual([
      "disabled_coordinator",
    ]);
  });

  it("a member who was assigned loses the client when disabled", async () => {
    await db.owner.exec(
      "update public.profiles set status = 'disabled' where clerk_user_id = 'assistant'",
    );
    try {
      expect(await profilesSeenBy("assistant")).toEqual(["assistant"]);
    } finally {
      await db.owner.exec(
        "update public.profiles set status = 'active' where clerk_user_id = 'assistant'",
      );
    }
  });

  it("scoped access never shows the team", async () => {
    await db.owner.exec(
      `update public.consultations set client_id = 'coordinator' where id = '${A}'`,
    );
    try {
      expect(await profilesSeenBy("assistant")).toEqual(["assistant"]);
    } finally {
      await db.owner.exec(
        `update public.consultations set client_id = 'client_a' where id = '${A}'`,
      );
    }
  });

  it.each<ApiRole>(["anon", "service_role"])("the helper can't be called as %s", async (role) => {
    await expect(
      db.runAs(role, null, exec("select public.scoped_client_ids()")),
    ).rejects.toThrow(NO_ACCESS);
  });
});

describe.each(TABLE_NAMES)("%s", (table) => {
  const rule = TABLES[table] ?? { team: [] };

  it("has RLS on", async () => {
    const { rows } = await db.owner.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where oid = $1::regclass",
      [`public.${table}`],
    );
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it("has a row to protect", async () => {
    const { rows } = await db.owner.query(`select * from public.${table}`);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("can't be read by anon", async () => {
    await expect(
      db.runAs("anon", null, exec(`select ${ID_COLUMN(table)} from public.${table}`)),
    ).rejects.toThrow(NO_ACCESS);
  });

  it("can't be written by a client or an admin's token", async () => {
    for (const user of ["client_a", "admin"]) {
      await expect(
        db.runAs("authenticated", user, exec(`delete from public.${table}`)),
      ).rejects.toThrow(NO_ACCESS);
    }
  });

  it.each<ApiRole>(["anon", "authenticated", "service_role"])(
    "can't be truncated by %s",
    async (role) => {
      await expect(
        db.runAs(role, "admin", exec(`truncate public.${table} cascade`)),
      ).rejects.toThrow(NO_ACCESS);
    },
  );

  if (table === "email_outbox") {
    it("gives authenticated no read at all", async () => {
      await expect(
        db.runAs("authenticated", "admin", exec("select id from public.email_outbox")),
      ).rejects.toThrow(NO_ACCESS);
    });
    return;
  }

  it("shows a stranger only what they own", async () => {
    expect(await countSeenBy("client_c", table)).toBe(
      table === "course_registrations" ? 1 : 0,
    );
  });

  it("shows a client only their own rows", async () => {
    expect(await countSeenBy("client_a", table)).toBe(rule.ownCount ?? 0);
  });

  it("shows a disabled admin nothing", async () => {
    expect(await countSeenBy("disabled_admin", table)).toBe(0);
  });

  it.each(ALL_PERMISSIONS)("with only %s", async (permission) => {
    const seen = await countSeenBy(onlyUser(permission), table);
    if (rule.team.includes(permission)) {
      expect(seen).toBeGreaterThan(0);
    } else {
      expect(seen).toBe(0);
    }
  });
});

describe("server-only tables", () => {
  const LOG_INSERT = `insert into public.document_access_log
    (request_id, document_id, client_id, action)
    values ('${REQ_A}', '${DOC}', 'client_a', 'download')`;
  const OUTBOX_INSERT = `insert into public.email_outbox (event, to_email, locale)
    values ('meeting', 'a@example.com', 'ar')`;

  it.each<ApiRole>(["anon", "authenticated"])(
    "%s can't insert into document_access_log",
    async (role) => {
      await expect(
        db.runAs(role, "admin", exec(LOG_INSERT)),
      ).rejects.toThrow(NO_ACCESS);
    },
  );

  it.each<ApiRole>(["anon", "authenticated"])(
    "%s can't insert into email_outbox",
    async (role) => {
      await expect(
        db.runAs(role, "admin", exec(OUTBOX_INSERT)),
      ).rejects.toThrow(NO_ACCESS);
    },
  );

  it.each<ApiRole>(["anon", "authenticated"])(
    "%s can't update either table",
    async (role) => {
      for (const table of ["document_access_log", "email_outbox"]) {
        await expect(
          db.runAs(role, "admin", exec(`update public.${table} set id = id`)),
        ).rejects.toThrow(NO_ACCESS);
      }
    },
  );

  it("lets service_role add to the log and work the outbox", async () => {
    await db.runAs("service_role", null, async (tx) => {
      await tx.exec(LOG_INSERT);
      await tx.exec(OUTBOX_INSERT);
      await tx.exec("update public.email_outbox set status = 'sent'");
      await tx.rollback();
    });
  });

  it.each([
    ["update", "update public.document_access_log set action = 'view'"],
    ["delete", "delete from public.document_access_log"],
  ])("document_access_log refuses %s, even to service_role", async (_label, sql) => {
    await expect(db.runAs("service_role", null, exec(sql))).rejects.toThrow(
      NO_ACCESS,
    );
  });

  it("email_outbox refuses delete, even to service_role", async () => {
    await expect(
      db.runAs("service_role", null, exec("delete from public.email_outbox")),
    ).rejects.toThrow(NO_ACCESS);
  });
});

describe("a client's requested documents", () => {
  it("shows the metadata of a document they requested, and no other", async () => {
    expect(await idsSeenBy("client_a", "documents")).toEqual([DOC]);
  });

  it("shows nothing to a client with no request", async () => {
    expect(await idsSeenBy("client_c", "documents")).toEqual([]);
  });

  it.each(["pending_review", "in_contact", "granted", "expired", "revoked"])(
    "keeps the title while the request is %s, for the client's history",
    async (status) => {
      await db.owner.query(
        "update public.document_requests set status = $1 where id = $2",
        [status, REQ_A],
      );
      try {
        expect(await idsSeenBy("client_a", "documents")).toEqual([DOC]);
      } finally {
        await db.owner.query(
          "update public.document_requests set status = 'pending_review' where id = $1",
          [REQ_A],
        );
      }
    },
  );

  it("doesn't show another client's request by way of the document", async () => {
    expect(await idsSeenBy("client_a", "document_requests")).toEqual([REQ_A]);
  });

  it("still refuses storage_key, so opening needs the route's grant check", async () => {
    await expect(
      db.runAs(
        "authenticated",
        "client_a",
        exec(`select storage_key from public.documents where id = '${DOC}'`),
      ),
    ).rejects.toThrow(NO_ACCESS);
  });

  it("gives a requester no document_access_log row and no write", async () => {
    expect(await countSeenBy("client_a", "document_access_log")).toBe(0);
    await expect(
      db.runAs(
        "authenticated",
        "client_a",
        exec("update public.documents set status = 'published'"),
      ),
    ).rejects.toThrow(NO_ACCESS);
  });

  it("doesn't recurse through RLS", async () => {
    await expect(
      db.runAs("authenticated", "client_a", async (tx) => {
        const { rows } = await tx.query(
          `select d.id, r.status from public.documents d
           join public.document_requests r on r.document_id = d.id`,
        );
        return rows;
      }),
    ).resolves.toHaveLength(1);
  });
});

describe("columns kept from authenticated", () => {
  it.each([
    ["consultation_attachments", "storage_key"],
    ["documents", "storage_key"],
    ["newsletter_subscribers", "confirm_token_hash"],
  ])("%s.%s can't be read, even by an admin", async (table, column) => {
    await expect(
      db.runAs("authenticated", "admin", exec(`select ${column} from public.${table}`)),
    ).rejects.toThrow(NO_ACCESS);
  });
});

describe("deleting", () => {
  it("keeps the access log when a document goes", async () => {
    const { rows } = await db.runAs("service_role", null, async (tx) => {
      await tx.exec(`delete from public.documents where id = '${DOC}'`);
      const result = await tx.query(
        "select id from public.document_access_log",
      );
      await tx.rollback();
      return result;
    });
    expect(rows).toHaveLength(1);
    const { rows: documents } = await db.owner.query(
      `select id from public.documents where id = '${DOC}'`,
    );
    expect(documents).toHaveLength(1);
  });
});
