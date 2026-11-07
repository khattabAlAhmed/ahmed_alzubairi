import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ADMIN_DELETE_TYPES,
  CONTENT_TYPES,
  UNDELETABLE_CONTENT_TYPES,
  contentCreateBodySchemas,
  contentRowSchemas,
  contentUpdateBodySchemas,
  isDeleteConfirmed,
} from "./content";
import { hasAnyField } from "./fields";
import { ROUTES, type RouteContract, type RouteName } from "./routes";
import { DOCUMENT_DECISIONS, decideDocumentRequestSchema } from "./routes-team";
import { fileNameMatchesMime, UPLOAD_TARGET_RULES } from "./uploads";

const ID = "123e4567-e89b-42d3-a456-426614174000";
const OTHER_ID = "123e4567-e89b-42d3-a456-426614174001";

/** The schema as JSON text, so a test can look for a field name at any depth. */
const shapeOf = (schema: z.ZodType) =>
  JSON.stringify(z.toJSONSchema(schema, { unrepresentable: "any", io: "input" }));

const routeEntries = Object.entries(ROUTES) as [RouteName, RouteContract][];

const responses = routeEntries.flatMap(([name, route]) => [
  ...(route.response ? [[name, route.response] as const] : []),
  ...(route.responseFor
    ? CONTENT_TYPES.map(
        (type) => [`${name} ${type}`, route.responseFor?.(type)] as const,
      )
    : []),
]) as [string, z.ZodType][];

const PUBLIC_ROUTES: RouteName[] = [
  "POST /api/contact",
  "POST /api/newsletter/subscribe",
  "POST /api/resources/:id/download",
  "POST /api/training/custom-requests",
];

describe("document decisions", () => {
  it("are grant, contact first and withdraw: there is no rejection", () => {
    expect(DOCUMENT_DECISIONS).toEqual(["grant", "contact_first", "withdraw"]);
    expect(shapeOf(decideDocumentRequestSchema)).not.toMatch(/reject/i);
  });

  it.each(["reject", "rejected", "deny"])("refuse %s", (decision) => {
    expect(decideDocumentRequestSchema.safeParse({ decision }).success).toBe(
      false,
    );
  });

  it("take an expiry only on a grant, and only in the future", () => {
    const parse = (body: object) =>
      decideDocumentRequestSchema.safeParse(body).success;
    expect(parse({ decision: "grant" })).toBe(true);
    expect(parse({ decision: "grant", expiresAt: "2999-01-01T00:00:00Z" })).toBe(
      true,
    );
    expect(parse({ decision: "grant", expiresAt: "2000-01-01T00:00:00Z" })).toBe(
      false,
    );
    expect(
      parse({ decision: "withdraw", expiresAt: "2999-01-01T00:00:00Z" }),
    ).toBe(false);
  });
});

describe("responses", () => {
  it.each(PUBLIC_ROUTES)("%s has no letter or hidden org name", (name) => {
    const { response } = ROUTES[name] as RouteContract;
    expect(shapeOf(response as z.ZodType)).not.toMatch(
      /letter|orgName|org_name/i,
    );
  });

  it.each(responses)("%s has no storage key", (_name, schema) => {
    expect(shapeOf(schema)).not.toMatch(/storage_?key/i);
  });

  it("keep upload keys to the team rows that show the file", () => {
    const withUploadKeys = Object.entries(contentRowSchemas)
      .filter(([, schema]) =>
        /"(logoKey|letterKey|coverKey|imageKey|key)"/.test(shapeOf(schema)),
      )
      .map(([type]) => type)
      .toSorted();
    expect(withUploadKeys).toEqual([
      "home_sections",
      "media_items",
      "pages",
      "partners",
      "posts",
      "projects",
      "testimonials",
    ]);
  });
});

describe("content bodies", () => {
  it.each(["admin_approved", "adminApproved", "approved_by", "approvedBy"])(
    "refuse %s",
    (field) => {
      for (const type of ["partners", "testimonials"] as const) {
        const create = contentCreateBodySchemas[type];
        const update = contentUpdateBodySchemas[type];
        expect(
          create.safeParse({ status: "draft", [field]: true }).success,
        ).toBe(false);
        expect(
          update.safeParse({ id: ID, status: "draft", [field]: true }).success,
        ).toBe(false);
      }
    },
  );

  it("never name an approval field, at any depth", () => {
    for (const schema of [
      ...Object.values(contentCreateBodySchemas),
      ...Object.values(contentUpdateBodySchemas),
    ]) {
      expect(shapeOf(schema)).not.toMatch(/approved/i);
    }
  });

  it("show approval on team rows, read only", () => {
    expect(shapeOf(contentRowSchemas.partners)).toContain("adminApproved");
  });
});

describe("content types", () => {
  it.each(["site_settings", "courses", "project_images", "project_services"])(
    "exclude %s",
    (table) => {
      expect(CONTENT_TYPES).not.toContain(table);
    },
  );
});

describe("the delete :type list", () => {
  it.each([
    "audit_log",
    "document_access_log",
    "profiles",
    "email_outbox",
    "roles",
    "role_permissions",
    "notifications",
    ...UNDELETABLE_CONTENT_TYPES,
  ])("excludes %s", (table) => {
    expect(ADMIN_DELETE_TYPES).not.toContain(table);
    const { params } = ROUTES["DELETE /api/admin/:type/:id"];
    expect(params.safeParse({ type: table, id: ID }).success).toBe(false);
  });

  it("is 11 content types plus documents, courses and consultations", () => {
    const contentTypes = CONTENT_TYPES.filter(
      (type) => !(UNDELETABLE_CONTENT_TYPES as readonly string[]).includes(type),
    );
    expect(contentTypes).toHaveLength(11);
    expect([...ADMIN_DELETE_TYPES].toSorted()).toEqual(
      [...contentTypes, "documents", "courses", "consultations"].toSorted(),
    );
  });
});

describe("isDeleteConfirmed", () => {
  const params = { type: "posts", id: ID } as const;

  it("accepts the row in the path", () => {
    expect(isDeleteConfirmed(params, { confirm: ID })).toBe(true);
  });

  it("refuses another row", () => {
    expect(isDeleteConfirmed(params, { confirm: OTHER_ID })).toBe(false);
  });
});

describe("hasAnyField", () => {
  it("counts set fields, null included", () => {
    expect(hasAnyField({ a: 1 })).toBe(true);
    expect(hasAnyField({ a: null })).toBe(true);
  });

  it("skips undefined and ignored fields", () => {
    expect(hasAnyField({ a: undefined })).toBe(false);
    expect(hasAnyField({ id: 1 }, ["id"])).toBe(false);
  });
});

describe("fileNameMatchesMime", () => {
  it.each([
    ["a.pdf", "application/pdf"],
    ["A.PDF", "application/pdf"],
    ["photo.jpeg", "image/jpeg"],
    ["photo.jpg", "image/jpeg"],
  ] as const)("accepts %s as %s", (name, mime) => {
    expect(fileNameMatchesMime(name, mime)).toBe(true);
  });

  it.each([
    ["a.docm", "application/pdf"],
    ["pdf", "application/pdf"],
    ["a.pdf.exe", "application/pdf"],
    ["a.png", "image/jpeg"],
  ] as const)("refuses %s as %s", (name, mime) => {
    expect(fileNameMatchesMime(name, mime)).toBe(false);
  });
});

describe("upload targets", () => {
  it("map to the §8 buckets", () => {
    expect(
      Object.fromEntries(
        Object.entries(UPLOAD_TARGET_RULES).map(([target, rule]) => [
          target,
          rule.bucket,
        ]),
      ),
    ).toEqual({
      document: "documents",
      resource: "resources",
      media: "public-media",
      letter: "internal",
    });
  });

  it("never allow SVG", () => {
    for (const rule of Object.values(UPLOAD_TARGET_RULES)) {
      expect(rule.mimes.join()).not.toMatch(/svg/i);
    }
  });

  it("refuse a file over the target's limit", () => {
    const { body } = ROUTES["POST /api/admin/uploads/upload-url"];
    const file = { target: "media", fileName: "a.png", mime: "image/png" };
    const limit = UPLOAD_TARGET_RULES.media.maxBytes;
    expect(body.safeParse({ ...file, sizeBytes: limit }).success).toBe(true);
    expect(body.safeParse({ ...file, sizeBytes: limit + 1 }).success).toBe(
      false,
    );
  });
});
