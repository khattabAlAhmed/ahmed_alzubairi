// @vitest-environment jsdom
import type { AdminRole, AdminTeamMember } from "@repo/shared";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/DashboardTeam.json";
import en from "@/messages/en/DashboardTeam.json";
import { InviteForm } from "./invite-form";
import { MemberList } from "./member-list";
import { RoleEditor } from "./role-editor";

const refresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh }) }));

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ok: true })));
  refresh.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ADMIN_ROLE: AdminRole = {
  id: "22222222-2222-4222-8222-222222222222",
  key: "admin",
  nameAr: "المدير",
  nameEn: "Admin",
  isSystem: true,
  permissions: ["content.manage", "team.manage"],
};
const EDITOR_ROLE: AdminRole = {
  id: "11111111-1111-4111-8111-111111111111",
  key: "content_editor",
  nameAr: "محرر محتوى",
  nameEn: "Content Editor",
  isSystem: true,
  permissions: ["content.manage"],
};
const TRAINER_ROLE: AdminRole = {
  id: "44444444-4444-4444-8444-444444444444",
  key: "training_coordinator",
  nameAr: "منسق تدريب",
  nameEn: "Training Coordinator",
  isSystem: true,
  permissions: ["training.manage"],
};
const ROLES = [ADMIN_ROLE, EDITOR_ROLE, TRAINER_ROLE];

const member = (id: string, fullName: string, roleId: string): AdminTeamMember => ({
  id,
  fullName,
  email: `${id}@example.com`,
  roleId,
  status: "active",
  createdAt: "2026-11-07T10:00:00.000Z",
});
const SELF = member("user_self", "Self Admin", ADMIN_ROLE.id);
const OTHER_ADMIN = member("user_other_admin", "Other Admin", ADMIN_ROLE.id);
const EDITOR = member("user_editor", "Test Editor", EDITOR_ROLE.id);

function wrap(node: React.ReactNode, locale: "ar" | "en" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={{ DashboardTeam: locale === "ar" ? ar : en }}>
      {node}
    </NextIntlClientProvider>,
  );
}

function lastBody() {
  const init = fetchMock.mock.calls.at(-1)?.[1];
  return JSON.parse(String(init?.body));
}

describe("InviteForm", () => {
  it("never offers the admin role", () => {
    wrap(<InviteForm roles={ROLES} />);
    const options = within(screen.getByLabelText("Role")).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Choose a role",
      "Content Editor",
      "Training Coordinator",
    ]);
  });

  it("names the roles in Arabic on an Arabic page", () => {
    wrap(<InviteForm roles={ROLES} />, "ar");
    const options = within(screen.getByLabelText("الدور")).getAllByRole("option");
    expect(options.map((option) => option.textContent)).not.toContain("المدير");
    expect(options.map((option) => option.textContent)).toContain("محرر محتوى");
  });

  it("checks the email and the role before sending", async () => {
    wrap(<InviteForm roles={ROLES} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send invitation" })));
    expect(screen.getByText(en.invite.emailRequired)).toBeTruthy();
    expect(screen.getByText(en.invite.roleRequired)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the email and the role, then refreshes", async () => {
    wrap(<InviteForm roles={ROLES} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " new@example.com " } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: TRAINER_ROLE.id } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send invitation" })));
    expect(lastBody()).toEqual({ email: "new@example.com", roleId: TRAINER_ROLE.id });
    expect(screen.getByRole("status").textContent).toBe(en.invite.sent);
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the server's error text", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "conflict", message: "Already invited." } }), {
        status: 409,
      }),
    );
    wrap(<InviteForm roles={ROLES} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@example.com" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: EDITOR_ROLE.id } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send invitation" })));
    expect(screen.getByRole("alert").textContent).toBe("Already invited.");
  });
});

describe("MemberList", () => {
  function rowOf(name: string) {
    return screen.getByText(name).closest("li") as HTMLElement;
  }

  it("hides every control on your own row and on an admin's row", () => {
    wrap(<MemberList members={[SELF, OTHER_ADMIN, EDITOR]} roles={ROLES} selfId={SELF.id} />);
    for (const [name, note] of [
      [SELF.fullName, en.members.selfNote],
      [OTHER_ADMIN.fullName, en.members.adminNote],
    ]) {
      const row = rowOf(name);
      expect(within(row).queryAllByRole("button")).toEqual([]);
      expect(within(row).queryByRole("combobox")).toBeNull();
      expect(within(row).getByText(note)).toBeTruthy();
    }
    expect(within(rowOf(SELF.fullName)).getByText(en.members.you)).toBeTruthy();
    expect(within(rowOf(EDITOR.fullName)).getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("never offers the admin role as a new role", () => {
    wrap(<MemberList members={[EDITOR]} roles={ROLES} selfId={SELF.id} />);
    const options = within(screen.getByRole("combobox")).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Content Editor",
      "Training Coordinator",
    ]);
  });

  it("changes a role", async () => {
    wrap(<MemberList members={[EDITOR]} roles={ROLES} selfId={SELF.id} />);
    const save = screen.getByRole("button", { name: en.members.saveRole }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: TRAINER_ROLE.id } });
    await act(async () => fireEvent.click(save));
    expect(lastBody()).toEqual({ id: EDITOR.id, roleId: TRAINER_ROLE.id });
    expect(refresh).toHaveBeenCalled();
  });

  it("asks before it disables, and sends nothing on cancel", async () => {
    wrap(<MemberList members={[EDITOR]} roles={ROLES} selfId={SELF.id} />);
    fireEvent.click(screen.getByRole("button", { name: en.members.disable }));
    expect(screen.getByText(/Disable Test Editor\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.members.cancel }));
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: en.members.disable }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: en.members.confirm })));
    expect(lastBody()).toEqual({ id: EDITOR.id, status: "disabled" });
    expect(screen.getByRole("status").textContent).toBe(en.members.disabledDone);
  });

  it("offers Enable on a disabled member", () => {
    wrap(
      <MemberList members={[{ ...EDITOR, status: "disabled" }]} roles={ROLES} selfId={SELF.id} />,
    );
    expect(screen.getByRole("button", { name: en.members.enable })).toBeTruthy();
  });

  it("renders a name as text, never as HTML", () => {
    const { container } = wrap(
      <MemberList
        members={[{ ...EDITOR, fullName: "<img src=x onerror=alert(1)>" }]}
        roles={ROLES}
        selfId={SELF.id}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("RoleEditor", () => {
  function cardOf(name: string) {
    return screen.getByRole("heading", { name }).closest("li") as HTMLElement;
  }

  it("shows the admin role read-only, every box disabled", () => {
    wrap(<RoleEditor roles={[ADMIN_ROLE, EDITOR_ROLE]} />);
    const card = cardOf("Admin");
    const boxes = within(card).getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes).toHaveLength(14);
    expect(boxes.every((box) => box.disabled)).toBe(true);
    expect(within(card).queryByRole("button")).toBeNull();
    expect(within(card).getByText(en.roles.adminLocked)).toBeTruthy();
  });

  it("labels the 14 boxes with what each permission allows", () => {
    wrap(<RoleEditor roles={[EDITOR_ROLE]} />);
    const card = cardOf("Content Editor");
    const box = within(card).getByLabelText(en.permissions.content.manage) as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(
      (within(card).getByLabelText(en.permissions.team.manage) as HTMLInputElement).checked,
    ).toBe(false);
  });

  it("unticks a permission and sends the whole new set", async () => {
    wrap(<RoleEditor roles={[EDITOR_ROLE]} />);
    const card = cardOf("Content Editor");
    const save = within(card).getByRole("button", { name: en.roles.save }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(within(card).getByLabelText(en.permissions.content.manage));
    fireEvent.click(within(card).getByLabelText(en.permissions.messages.view));
    await act(async () => fireEvent.click(save));
    expect(lastBody()).toEqual({
      id: EDITOR_ROLE.id,
      nameAr: EDITOR_ROLE.nameAr,
      nameEn: EDITOR_ROLE.nameEn,
      permissions: ["messages.view"],
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("adds a role with its key, names and permissions", async () => {
    wrap(<RoleEditor roles={[]} />);
    const form = screen.getByRole("region", { name: en.roles.add.title });
    fireEvent.change(within(form).getByLabelText(en.roles.add.key), {
      target: { value: "media_officer" },
    });
    fireEvent.change(within(form).getByLabelText(en.roles.nameAr), { target: { value: "مسؤول إعلام" } });
    fireEvent.change(within(form).getByLabelText(en.roles.nameEn), { target: { value: "Media Officer" } });
    fireEvent.click(within(form).getByLabelText(en.permissions.content.manage));
    await act(async () =>
      fireEvent.click(within(form).getByRole("button", { name: en.roles.add.submit })),
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/roles", expect.objectContaining({ method: "POST" }));
    expect(lastBody()).toEqual({
      key: "media_officer",
      nameAr: "مسؤول إعلام",
      nameEn: "Media Officer",
      permissions: ["content.manage"],
    });
  });

  it("refuses a key the schema doesn't allow, before sending", async () => {
    wrap(<RoleEditor roles={[]} />);
    const form = screen.getByRole("region", { name: en.roles.add.title });
    fireEvent.change(within(form).getByLabelText(en.roles.add.key), { target: { value: "Media Officer" } });
    await act(async () =>
      fireEvent.click(within(form).getByRole("button", { name: en.roles.add.submit })),
    );
    expect(within(form).getByText(en.roles.add.keyInvalid)).toBeTruthy();
    expect(within(form).getByText(en.roles.nameRequired)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
