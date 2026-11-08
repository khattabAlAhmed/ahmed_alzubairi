import { describe, expect, it, vi } from "vitest";
import { buildChanges, saveSettings, toValues } from "./form";

const saved = {
  contact_email: "office@example.com",
  whatsapp_number: "+967712345678",
  social_links: [{ platform: "X", url: "https://x.com/example" }],
  cv_visible: false,
};

describe("buildChanges", () => {
  it("sends nothing when nothing changed", () => {
    expect(buildChanges(toValues(saved), saved)).toEqual({ changes: [], errors: {} });
  });

  it("sends one body per changed key, trimmed", () => {
    const values = { ...toValues(saved), contactEmail: "  hello@example.com ", linkedinUrl: "https://www.linkedin.com/in/example" };
    expect(buildChanges(values, saved)).toEqual({
      changes: [
        { key: "contact_email", value: "hello@example.com" },
        { key: "linkedin_url", value: "https://www.linkedin.com/in/example" },
      ],
      errors: {},
    });
  });

  it("refuses values the route would refuse", () => {
    const values = {
      ...toValues(saved),
      contactEmail: "not an email",
      whatsappNumber: "0712345678",
      linkedinUrl: "https://evil.example/linkedin.com",
    };
    const { changes, errors } = buildChanges(values, saved);
    expect(changes).toEqual([]);
    expect(errors).toEqual({ contactEmail: "invalid", whatsappNumber: "invalid", linkedinUrl: "invalid" });
  });

  it("won't empty a saved field, since the route can't", () => {
    const { changes, errors } = buildChanges({ ...toValues(saved), whatsappNumber: " " }, saved);
    expect(changes).toEqual([]);
    expect(errors).toEqual({ whatsappNumber: "cantClear" });
  });

  it("drops empty social rows, flags half-filled ones, and refuses javascript: links", () => {
    const base = toValues(saved);
    expect(
      buildChanges({ ...base, socialLinks: [...base.socialLinks, { platform: "", url: "" }] }, saved).changes,
    ).toEqual([]);
    expect(
      buildChanges({ ...base, socialLinks: [{ platform: "YouTube", url: "" }] }, saved).errors,
    ).toEqual({ "social.0.url": "required" });
    expect(
      buildChanges({ ...base, socialLinks: [{ platform: "Bad", url: "javascript:alert(1)" }] }, saved).errors,
    ).toEqual({ "social.0.url": "invalid" });
  });

  it("puts a schema error on the right row when an empty row comes first", () => {
    const values = {
      ...toValues(saved),
      socialLinks: [
        { platform: "", url: "" },
        { platform: "Bad", url: "javascript:alert(1)" },
      ],
    };
    expect(buildChanges(values, saved).errors).toEqual({ "social.1.url": "invalid" });
  });

  it("can remove every social link", () => {
    expect(buildChanges({ ...toValues(saved), socialLinks: [] }, saved).changes).toEqual([
      { key: "social_links", value: [] },
    ]);
  });

  it("saves a new CV file before turning its download on", () => {
    const values = { ...toValues(saved), cvFileKey: "media/cv.pdf", cvVisible: true };
    expect(buildChanges(values, saved).changes).toEqual([
      { key: "cv_file_key", value: "media/cv.pdf" },
      { key: "cv_visible", value: true },
    ]);
  });
});

describe("saveSettings", () => {
  it("sends each change in order", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true })));
    const changes = [
      { key: "cv_file_key", value: "media/cv.pdf" },
      { key: "cv_visible", value: true },
    ] as const;
    expect(await saveSettings(changes, fetchImpl)).toEqual({ ok: true });
    expect(fetchImpl.mock.calls.map(([url, init]) => [url, init?.method, init?.body])).toEqual([
      ["/api/admin/settings", "PATCH", JSON.stringify(changes[0])],
      ["/api/admin/settings", "PATCH", JSON.stringify(changes[1])],
    ]);
  });

  it("stops at the first refusal and returns the server's message", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ error: { code: "forbidden", message: "Not allowed." } }), {
          status: 403,
        }),
    );
    const result = await saveSettings(
      [
        { key: "contact_email", value: "a@example.com" },
        { key: "cv_visible", value: true },
      ],
      fetchImpl,
    );
    expect(result).toEqual({ ok: false, key: "contact_email", message: "Not allowed." });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
