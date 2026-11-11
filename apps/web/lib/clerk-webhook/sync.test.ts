import { describe, expect, it } from "vitest";
import { planProfileSync } from "./sync";

function userUpdated(data: Record<string, unknown> = {}) {
  return {
    type: "user.updated",
    data: {
      id: "user_1",
      first_name: "Test",
      last_name: "Person",
      primary_email_address_id: "idn_2",
      email_addresses: [
        { id: "idn_1", email_address: "old@example.com" },
        { id: "idn_2", email_address: "primary@example.com" },
      ],
      ...data,
    },
  };
}

describe("planProfileSync", () => {
  it("takes the full name and the primary address, not the first one", () => {
    expect(planProfileSync(userUpdated())).toEqual({
      kind: "update",
      userId: "user_1",
      values: { full_name: "Test Person", email: "primary@example.com" },
    });
  });

  it("builds the name from whichever part exists", () => {
    const plan = planProfileSync(userUpdated({ first_name: "  Test ", last_name: null }));
    expect(plan).toMatchObject({ values: { full_name: "Test" } });
  });

  it("skips the name when both parts are empty", () => {
    const plan = planProfileSync(userUpdated({ first_name: null, last_name: "  " }));
    expect(plan).toEqual({
      kind: "update",
      userId: "user_1",
      values: { email: "primary@example.com" },
    });
  });

  it("skips the email when the user has no primary address", () => {
    for (const primary of [null, "idn_missing"]) {
      const plan = planProfileSync(userUpdated({ primary_email_address_id: primary }));
      expect(plan).toEqual({
        kind: "update",
        userId: "user_1",
        values: { full_name: "Test Person" },
      });
    }
  });

  it("ignores an event with neither a name nor a primary address", () => {
    const plan = planProfileSync(
      userUpdated({ first_name: null, last_name: null, primary_email_address_id: null }),
    );
    expect(plan).toEqual({ kind: "ignored" });
  });

  it.each(["user.created", "user.deleted", "session.created", "email.created", undefined])(
    "ignores %s",
    (type) => {
      expect(planProfileSync({ ...userUpdated(), type })).toEqual({ kind: "ignored" });
    },
  );

  it("calls a user.updated it can't read invalid", () => {
    expect(planProfileSync({ type: "user.updated", data: { id: "" } })).toEqual({ kind: "invalid" });
    expect(planProfileSync({ type: "user.updated" })).toEqual({ kind: "invalid" });
  });
});
