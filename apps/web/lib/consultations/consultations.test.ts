import { EMAIL_ADMIN_PERMISSION } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/ConsultationErrors.json";
import en from "@/messages/en/ConsultationErrors.json";
import {
  createConsultation,
  listConsultations,
  readConsultation,
  sendMessage,
} from "./handlers";
import { IDS, USERS, world } from "./world.test-helper";

const NEW = {
  serviceId: IDS.service,
  title: "Test strategy review",
  description: "Fake need for a test",
};

function deps(w: ReturnType<typeof world>, userId: string | null, locale: "ar" | "en" = "en") {
  return {
    locale,
    userId,
    store: w.storeFor(userId ?? "nobody"),
    mail: w.mail,
    audit: w.audit,
  };
}

describe("listConsultations", () => {
  it("refuses a signed-out caller", async () => {
    const w = world();
    expect((await listConsultations(deps(w, null))).status).toBe(401);
  });

  it("returns only what RLS shows: a client's own", async () => {
    const w = world();
    const result = await listConsultations(deps(w, USERS.clientB));
    expect(result.status).toBe(200);
    expect("consultations" in result.body && result.body.consultations.map((c) => c.id)).toEqual([
      IDS.consultationB,
    ]);
  });

  it("an assistant sees only the ones assigned to them", async () => {
    const w = world();
    const result = await listConsultations(deps(w, USERS.assistant));
    expect("consultations" in result.body && result.body.consultations.map((c) => c.id)).toEqual([
      IDS.consultationA,
      IDS.closed,
    ]);
  });
});

describe("readConsultation", () => {
  it("refuses a signed-out caller", async () => {
    const w = world();
    expect((await readConsultation(IDS.consultationA, deps(w, null))).status).toBe(401);
  });

  it("returns messages with sender names, linked ready attachments and meetings", async () => {
    const w = world();
    const result = await readConsultation(IDS.consultationA, deps(w, USERS.clientA));
    expect(result.status).toBe(200);
    if (!("consultation" in result.body)) throw new Error("expected a detail");
    expect(result.body.messages).toEqual([
      {
        id: IDS.oldMessage,
        senderId: USERS.clientA,
        senderName: "Test Client A",
        body: "Hello",
        createdAt: "2026-11-14T09:00:00.000Z",
      },
    ]);
    // Only the ready file linked to a message, never one still unlinked or uploading.
    expect(result.body.attachments.map((a) => a.id)).toEqual([IDS.fileLinked]);
    expect(JSON.stringify(result.body)).not.toContain("storage");
    expect(result.body.meetings).toHaveLength(1);
  });

  it("answers 404 to another client, in their language", async () => {
    const w = world();
    const result = await readConsultation(IDS.consultationA, deps(w, USERS.clientB, "ar"));
    expect(result).toEqual({
      status: 404,
      body: { error: { code: "not_found", message: ar.notFound } },
    });
  });

  it("answers 404 to a member without consultation access (the content editor)", async () => {
    const w = world();
    expect((await readConsultation(IDS.consultationA, deps(w, USERS.editor))).status).toBe(404);
  });

  it("answers 404 for an id that isn't a uuid, without reading", async () => {
    const w = world();
    const d = deps(w, USERS.clientA);
    expect((await readConsultation("not-a-uuid", d)).status).toBe(404);
    expect(d.store.get).not.toHaveBeenCalled();
  });

  it("reads sender names only after RLS showed the consultation", async () => {
    const w = world();
    const d = deps(w, USERS.clientB);
    await readConsultation(IDS.consultationA, d);
    expect(d.store.senderNames).not.toHaveBeenCalled();
  });
});

describe("createConsultation", () => {
  it("refuses a signed-out caller, and writes nothing", async () => {
    const w = world();
    expect((await createConsultation(NEW, deps(w, null))).status).toBe(401);
    expect(w.writes).toEqual([]);
  });

  it("refuses a body the shared schema refuses", async () => {
    const w = world();
    expect((await createConsultation({ ...NEW, title: "" }, deps(w, USERS.clientA))).status).toBe(400);
    expect(w.writes).toEqual([]);
  });

  it("refuses a user with no profile yet", async () => {
    const w = world();
    const result = await createConsultation(NEW, deps(w, USERS.newClient));
    expect(result).toEqual({
      status: 403,
      body: { error: { code: "profile_incomplete", message: en.profileRequired } },
    });
    expect(w.writes).toEqual([]);
  });

  it("refuses a team member", async () => {
    const w = world();
    const result = await createConsultation(NEW, deps(w, USERS.assistant));
    expect(result.status).toBe(403);
    expect(result.body).toEqual({ error: { code: "forbidden", message: en.clientsOnly } });
    expect(w.writes).toEqual([]);
  });

  it("refuses a disabled client", async () => {
    const w = world();
    expect((await createConsultation(NEW, deps(w, USERS.disabledClient))).status).toBe(403);
    expect(w.writes).toEqual([]);
  });

  it("refuses a service that isn't published", async () => {
    const w = world();
    const result = await createConsultation(
      { ...NEW, serviceId: IDS.draftService },
      deps(w, USERS.clientA),
    );
    expect(result).toEqual({
      status: 400,
      body: { error: { code: "validation_failed", message: en.serviceUnavailable } },
    });
    expect(w.writes).toEqual([]);
  });

  it("creates a new consultation and queues the admin's and the client's emails", async () => {
    const w = world();
    const result = await createConsultation(
      { ...NEW, organization: "Test Org" },
      deps(w, USERS.clientA),
    );
    expect(result.status).toBe(201);
    if (!("id" in result.body)) throw new Error("expected an id");
    const created = w.consultations.find((item) => item.id === (result.body as { id: string }).id)!;
    expect(created).toMatchObject({
      kind: "consultation",
      status: "new",
      clientId: USERS.clientA,
      serviceId: IDS.service,
      organization: "Test Org",
    });
    expect(w.permissionEmails).toEqual([
      {
        event: "consultation_new",
        permission: EMAIL_ADMIN_PERMISSION,
        payload: { consultationId: created.id, title: NEW.title, clientName: "Test Client A" },
        target: { entity: "consultations", entityId: created.id },
      },
    ]);
    expect(w.emails).toEqual([
      {
        event: "consultation_received",
        to: "a@example.invalid",
        locale: "en",
        payload: { consultationId: created.id, title: NEW.title },
      },
    ]);
  });
});

describe("sendMessage", () => {
  const send = (w: ReturnType<typeof world>, userId: string | null, body: unknown, id: string = IDS.consultationA) =>
    sendMessage(id, body, deps(w, userId));

  it("refuses a signed-out caller, and writes nothing", async () => {
    const w = world();
    expect((await send(w, null, { body: "Hi" })).status).toBe(401);
    expect(w.writes).toEqual([]);
  });

  it("refuses a message with neither text nor files", async () => {
    const w = world();
    expect((await send(w, USERS.clientA, {})).status).toBe(400);
    expect(w.writes).toEqual([]);
  });

  it("a client can't post to another client's consultation: 404, nothing written", async () => {
    const w = world();
    expect((await send(w, USERS.clientB, { body: "Hi" })).status).toBe(404);
    expect(w.writes).toEqual([]);
    expect(w.emails).toEqual([]);
  });

  it("an assistant can't post to a consultation not assigned to them", async () => {
    const w = world();
    expect((await send(w, USERS.assistant, { body: "Hi" }, IDS.consultationB)).status).toBe(404);
    expect(w.writes).toEqual([]);
  });

  it("refuses a member who sees it without consultations.reply or view_all", async () => {
    const w = world();
    // Assigned to the editor, who holds neither permission: RLS shows it, the route refuses.
    w.consultations[1]!.assignedTo = USERS.editor;
    const result = await send(w, USERS.editor, { body: "Hi" }, IDS.consultationB);
    expect(result).toEqual({
      status: 403,
      body: { error: { code: "forbidden", message: en.replyForbidden } },
    });
    expect(w.writes).toEqual([]);
  });

  it("refuses an assigned member who lost consultations.reply", async () => {
    const w = world();
    w.people[USERS.assistant]!.permissions = [];
    expect((await send(w, USERS.assistant, { body: "Hi" })).status).toBe(403);
    expect(w.writes).toEqual([]);
  });

  it("refuses a closed consultation with 409", async () => {
    const w = world();
    const result = await send(w, USERS.clientA, { body: "Hi" }, IDS.closed);
    expect(result).toEqual({
      status: 409,
      body: { error: { code: "conflict", message: en.closed } },
    });
    expect(w.writes).toEqual([]);
  });

  it.each([
    ["another user's file", IDS.fileOtherUser],
    ["a file already linked to a message", IDS.fileLinked],
    ["a file still uploading", IDS.fileUploading],
    ["a file on another consultation", IDS.fileOtherConsultation],
    ["a file that doesn't exist", "77777777-7777-4777-8777-777777777700"],
  ])("refuses %s, and writes nothing", async (_label, fileId) => {
    const w = world();
    const result = await send(w, USERS.clientA, { body: "See file", attachmentIds: [IDS.fileReady, fileId] });
    expect(result).toEqual({
      status: 400,
      body: { error: { code: "validation_failed", message: en.attachmentInvalid } },
    });
    expect(w.writes).toEqual([]);
  });

  it("a client's message links their files and emails the assigned member, with a notification", async () => {
    const w = world();
    const result = await send(w, USERS.clientA, {
      body: "Files attached",
      attachmentIds: [IDS.fileReady, IDS.fileReady2],
    });
    expect(result.status).toBe(201);
    if (!("id" in result.body)) throw new Error("expected an id");
    const messageId = result.body.id;
    expect(w.messages.find((item) => item.id === messageId)).toMatchObject({ senderId: USERS.clientA, body: "Files attached" });
    const linked = w.attachments.filter((item) => item.messageId === messageId);
    expect(linked.map((item) => item.id).sort()).toEqual([IDS.fileReady, IDS.fileReady2].sort());
    expect(w.emails).toEqual([
      {
        event: "consultation_reply",
        to: "assistant@example.invalid",
        locale: "en",
        payload: { consultationId: IDS.consultationA, title: "Test consultation" },
      },
    ]);
    expect(w.notifications).toEqual([
      { userId: USERS.assistant, type: "consultation_reply", consultationId: IDS.consultationA },
    ]);
    // A client's message is no team reply: no audit, no first reply.
    expect(w.audit).not.toHaveBeenCalled();
    expect(w.writes).not.toContain("first-reply");
  });

  it("a client's message on an unassigned consultation goes to the admin", async () => {
    const w = world();
    expect((await send(w, USERS.clientA, { body: "Anyone?" }, IDS.unassigned)).status).toBe(201);
    expect(w.emails).toEqual([]);
    expect(w.permissionEmails).toEqual([
      {
        event: "consultation_reply",
        permission: EMAIL_ADMIN_PERMISSION,
        payload: { consultationId: IDS.unassigned, title: "Unassigned" },
        target: { entity: "consultations", entityId: IDS.unassigned },
      },
    ]);
  });

  it("goes to the admin when the assigned member is disabled", async () => {
    const w = world();
    w.people[USERS.assistant]!.status = "disabled";
    expect((await send(w, USERS.clientA, { body: "Hello?" })).status).toBe(201);
    expect(w.emails).toEqual([]);
    expect(w.permissionEmails.map((item) => item.event)).toEqual(["consultation_reply"]);
    expect(w.notifications).toEqual([]);
  });

  it("the assigned assistant's first reply sets first_reply_at, audits without text, and emails the client", async () => {
    const w = world();
    const result = await send(w, USERS.assistant, { body: "Secret reply text" });
    expect(result.status).toBe(201);
    expect(w.consultations[0]!.firstReplyAt).not.toBeNull();
    expect(w.audit).toHaveBeenCalledOnce();
    const entry = (w.audit.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(entry).toMatchObject({
      actorId: USERS.assistant,
      action: "consultation.reply",
      entity: "consultations",
      entityId: IDS.consultationA,
    });
    expect(JSON.stringify(entry)).not.toContain("Secret");
    expect(w.emails).toEqual([
      {
        event: "consultation_reply",
        to: "a@example.invalid",
        locale: "en",
        payload: { consultationId: IDS.consultationA, title: "Test consultation" },
      },
    ]);
  });

  it("a later team reply leaves first_reply_at as it is", async () => {
    const w = world();
    w.consultations[0]!.firstReplyAt = "2026-11-13T08:00:00.000Z";
    await send(w, USERS.assistant, { body: "Again" });
    expect(w.consultations[0]!.firstReplyAt).toBe("2026-11-13T08:00:00.000Z");
    expect(w.writes).not.toContain("first-reply");
  });

  it("the admin (consultations.view_all) may reply to a consultation not assigned to them", async () => {
    const w = world();
    expect((await send(w, USERS.admin, { body: "On it" }, IDS.consultationB)).status).toBe(201);
    expect(w.emails.map((item) => item.to)).toEqual(["b@example.invalid"]);
  });

  it("puts the files back and drops the message when another message took a file meanwhile", async () => {
    const w = world();
    const d = deps(w, USERS.clientA);
    // The check sees both files free; by the link, one is taken.
    (d.store.linkAttachments as unknown as { mockImplementationOnce: (f: unknown) => void }).mockImplementationOnce(
      async ({ messageId }: { messageId: string }) => {
        w.attachments.find((item) => item.id === IDS.fileReady)!.messageId = messageId;
        return 1;
      },
    );
    const result = await sendMessage(IDS.consultationA, { body: "Files", attachmentIds: [IDS.fileReady, IDS.fileReady2] }, d);
    expect(result).toEqual({
      status: 409,
      body: { error: { code: "conflict", message: en.attachmentTaken } },
    });
    expect(w.attachments.find((item) => item.id === IDS.fileReady)!.messageId).toBeNull();
    expect(w.messages.map((item) => item.id)).toEqual([IDS.oldMessage]);
    expect(w.emails).toEqual([]);
  });

  it("drops the message and puts the files back when linking throws", async () => {
    const w = world();
    const d = deps(w, USERS.clientA);
    (d.store.linkAttachments as unknown as { mockImplementationOnce: (f: unknown) => void }).mockImplementationOnce(
      async ({ messageId }: { messageId: string }) => {
        w.attachments.find((item) => item.id === IDS.fileReady)!.messageId = messageId;
        throw new Error("link failed: 57014");
      },
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      sendMessage(IDS.consultationA, { attachmentIds: [IDS.fileReady, IDS.fileReady2] }, d),
    ).rejects.toThrow("57014");
    spy.mockRestore();
    expect(w.attachments.find((item) => item.id === IDS.fileReady)!.messageId).toBeNull();
    expect(w.messages.map((item) => item.id)).toEqual([IDS.oldMessage]);
    expect(w.emails).toEqual([]);
  });

  it("a failed first-reply update doesn't fail the sent reply", async () => {
    const w = world();
    const d = deps(w, USERS.assistant);
    (d.store.markFirstReply as unknown as { mockRejectedValueOnce: (e: unknown) => void }).mockRejectedValueOnce(
      new Error("first reply failed: 57014"),
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await sendMessage(IDS.consultationA, { body: "Reply" }, d)).status).toBe(201);
    spy.mockRestore();
    expect(w.audit).toHaveBeenCalledOnce();
    expect(w.emails.map((item) => item.event)).toEqual(["consultation_reply"]);
  });

  it("a failed email doesn't fail the message", async () => {
    const w = world();
    (w.mail.queueEmail as unknown as { mockRejectedValueOnce: (e: unknown) => void }).mockRejectedValueOnce(
      new Error("queue down"),
    );
    expect((await send(w, USERS.assistant, { body: "Reply" })).status).toBe(201);
  });
});
