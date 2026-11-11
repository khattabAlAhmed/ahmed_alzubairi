import { describe, expect, it, vi } from "vitest";
import { messagesPath, parseMessageParams } from "./data";
import { replyHref, sendRead } from "./send";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));

describe("parseMessageParams", () => {
  it("uses the defaults for an empty query", () => {
    expect(parseMessageParams({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("reads the page, the search and the read filter", () => {
    expect(
      parseMessageParams({ page: "3", search: "  budget ", read: "unread" }),
    ).toEqual({ page: 3, pageSize: 20, search: "budget", read: "unread" });
  });

  it("drops a value it can't use, keeps the rest, and ignores unknown keys", () => {
    expect(
      parseMessageParams({
        page: "abc",
        read: "maybe",
        search: ["first", "second"],
        other: "x",
      }),
    ).toEqual({ page: 1, pageSize: 20, search: "first" });
    expect(parseMessageParams({ read: "", search: "   " })).toEqual({
      page: 1,
      pageSize: 20,
    });
  });
});

describe("messagesPath", () => {
  it("leaves out the defaults and encodes the search", () => {
    expect(messagesPath({ page: 1, pageSize: 20 })).toBe("/dashboard/messages");
    expect(messagesPath({ page: 2, pageSize: 50 })).toBe(
      "/dashboard/messages?pageSize=50&page=2",
    );
    expect(messagesPath({ page: 2, search: "a&b", read: "unread" })).toBe(
      "/dashboard/messages?search=a%26b&read=unread&page=2",
    );
  });
});

describe("replyHref", () => {
  it("is a plain mailto to the sender, with nothing added", () => {
    expect(replyHref("visitor@example.com")).toBe("mailto:visitor@example.com");
    expect(replyHref("a?bcc=x@example.com")).toBe("mailto:a%3Fbcc%3Dx@example.com");
  });
});

describe("sendRead", () => {
  it("sends the id and the flag, and reads the server's error text", async () => {
    const ok = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true })));
    expect(await sendRead("id-1", true, ok)).toEqual({ ok: true });
    expect(ok).toHaveBeenCalledWith("/api/admin/messages", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "id-1", read: true }),
    });

    const refused = async () =>
      new Response(JSON.stringify({ error: { code: "forbidden", message: "No." } }), {
        status: 403,
      });
    expect(await sendRead("id-1", false, refused)).toEqual({ ok: false, message: "No." });
    const offline = async () => {
      throw new Error("offline");
    };
    expect(await sendRead("id-1", false, offline)).toEqual({ ok: false, message: null });
  });
});
