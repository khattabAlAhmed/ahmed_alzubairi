import "server-only";
import {
  PERMISSIONS,
  updateMessageRequestSchema,
  type ErrorResponse,
  type OkResponse,
} from "@repo/shared";
import { NextResponse } from "next/server";
import { localeFromReferer } from "@/lib/auth/paths";
import { createServiceClient } from "@/lib/supabase/service";
import ar from "@/messages/ar/DashboardMessages.json";
import en from "@/messages/en/DashboardMessages.json";
import {
  baseError,
  requirePermission,
  type PermissionDeps,
} from "../permissions";
import { setMessageRead } from "./store";

const MESSAGES = { ar, en };

export type MessageRouteDeps = {
  permission?: PermissionDeps;
  /** Called only after the permission check passed. False: no such message. */
  setRead: (id: string, read: boolean) => Promise<boolean>;
};

const defaultDeps: MessageRouteDeps = {
  setRead: (id, read) => setMessageRead(createServiceClient(), id, read),
};

/**
 * `PATCH /api/admin/messages`, with `messages.view`: `{ id, read }` marks one
 * contact message read or unread. Nothing about the message is logged.
 */
export async function handleMessageRequest(
  request: Request,
  deps: MessageRouteDeps = defaultDeps,
): Promise<Response> {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const check = await requirePermission(PERMISSIONS.MESSAGES_VIEW, {
      locale,
      deps: deps.permission,
    });
    if (!check.ok) {
      return NextResponse.json(check.body, { status: check.status });
    }

    const parsed = updateMessageRequestSchema.safeParse(
      await request.json().catch(() => undefined),
    );
    if (!parsed.success) {
      const failure = baseError("validation_failed", 400, locale);
      return NextResponse.json(failure.body, { status: failure.status });
    }

    if (!(await deps.setRead(parsed.data.id, parsed.data.read))) {
      const body: ErrorResponse = {
        error: { code: "not_found", message: MESSAGES[locale].errors.notFound },
      };
      return NextResponse.json(body, { status: 404 });
    }
    const body: OkResponse = { ok: true };
    return NextResponse.json(body);
  } catch (error) {
    // The error's code or message only: never the request body.
    console.error(
      "PATCH /api/admin/messages",
      error instanceof Error ? error.message : "error",
    );
    const failure = baseError("internal_error", 500, locale);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
