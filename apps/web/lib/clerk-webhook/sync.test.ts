import { describe, expect, it } from "vitest";
import { profileValues, userFromEvent } from "./sync";

const EVENT = {
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
  },
};

describe("userFromEvent", () => {
  it("takes only the user id from a user.updated event", () => {
    expect(userFromEvent(EVENT)).toEqual({ kind: "user", userId: "user_1" });
  });

  it.each(["user.created", "user.deleted", "session.created", "email.created", undefined])(
    "ignores %s",
    (type) => {
      expect(userFromEvent({ ...EVENT, type })).toEqual({ kind: "ignored" });
    },
  );

  it("calls a user.updated it can't read invalid", () => {
    expect(userFromEvent({ type: "user.updated", data: { id: "" } })).toEqual({ kind: "invalid" });
    expect(userFromEvent({ type: "user.updated" })).toEqual({ kind: "invalid" });
  });
});

describe("profileValues", () => {
  const USER = {
    firstName: "Test",
    lastName: "Person",
    primaryEmailAddress: { emailAddress: "primary@example.com" },
  };

  it("takes the full name and the primary address", () => {
    expect(profileValues(USER)).toEqual({
      full_name: "Test Person",
      email: "primary@example.com",
    });
  });

  it("builds the name from whichever part exists", () => {
    expect(profileValues({ ...USER, firstName: "  Test ", lastName: null })).toMatchObject({
      full_name: "Test",
    });
  });

  it("skips the name when both parts are empty", () => {
    expect(profileValues({ ...USER, firstName: null, lastName: "  " })).toEqual({
      email: "primary@example.com",
    });
  });

  it("skips the email when the user has no primary address", () => {
    expect(profileValues({ ...USER, primaryEmailAddress: null })).toEqual({
      full_name: "Test Person",
    });
  });

  it("gives nothing to write with neither a name nor a primary address", () => {
    expect(profileValues({ firstName: null, lastName: "", primaryEmailAddress: null })).toBeNull();
  });
});
