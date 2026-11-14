import type {
  CreateRoleRequest,
  InviteTeamMemberRequest,
  UpdateRoleRequest,
  UpdateTeamMemberRequest,
} from "@repo/shared";

export type SendResult =
  | { ok: true }
  /** `message` is the server's localized text, when it sent one. */
  | { ok: false; message: string | null };

/** Sends one JSON request to an admin route. Each route checks `team.manage`. */
async function send(
  url: string,
  method: "POST" | "PATCH",
  body: unknown,
  fetchImpl: typeof fetch,
): Promise<SendResult> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: null };
  }
  if (response.ok) return { ok: true };
  const reply = (await response.json().catch(() => null)) as {
    error?: { message?: unknown };
  } | null;
  const message = reply?.error?.message;
  return { ok: false, message: typeof message === "string" ? message : null };
}

/** `POST /api/admin/team`: Clerk sends the invitation. */
export function inviteMember(body: InviteTeamMemberRequest, fetchImpl: typeof fetch = fetch) {
  return send("/api/admin/team", "POST", body, fetchImpl);
}

/** `PATCH /api/admin/team`: a member's role or status. */
export function updateMember(body: UpdateTeamMemberRequest, fetchImpl: typeof fetch = fetch) {
  return send("/api/admin/team", "PATCH", body, fetchImpl);
}

/** `POST /api/admin/roles` */
export function createRole(body: CreateRoleRequest, fetchImpl: typeof fetch = fetch) {
  return send("/api/admin/roles", "POST", body, fetchImpl);
}

/** `PATCH /api/admin/roles`: names and the whole permission set. */
export function updateRole(body: UpdateRoleRequest, fetchImpl: typeof fetch = fetch) {
  return send("/api/admin/roles", "PATCH", body, fetchImpl);
}
