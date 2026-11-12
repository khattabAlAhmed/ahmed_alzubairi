import "server-only";
import { auth } from "@clerk/nextjs/server";
import {
  readNotificationsRequestSchema,
  type ErrorResponse,
  type Locale,
  type NotificationCounter,
} from "@repo/shared";
import { NextResponse } from "next/server";
import { localeFromReferer } from "@/lib/auth/paths";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";
import ar from "@/messages/ar/DashboardNotifications.json";
import en from "@/messages/en/DashboardNotifications.json";
import { countUnread, markRead } from "./store";

const MESSAGES = { ar, en };

const STATUS = {
  unauthenticated: 401,
  validation_failed: 400,
  internal_error: 500,
} as const;

export type ReadRouteDeps = {
  /** The signed-in Clerk user, or null. */
  getUserId: () => Promise<string | null>;
  /** Marks that user's notifications read. Called only with the session's id. */
  markRead: (userId: string, ids?: readonly string[]) => Promise<void>;
  /** That user's unread count, read through their own client. */
  countUnread: (userId: string) => Promise<number>;
};

const defaultDeps: ReadRouteDeps = {
  getUserId: async () => (await auth()).userId,
  markRead: (userId, ids) => markRead(createServiceClient(), userId, ids),
  countUnread: (userId) => countUnread(createUserClient(), userId),
};

function fail(code: keyof typeof STATUS, locale: Locale) {
  const body: ErrorResponse = {
    error: { code, message: MESSAGES[locale].errors[code] },
  };
  return NextResponse.json(body, { status: STATUS[code] });
}

/**
 * `POST /api/notifications/read`, for any signed-in user: `{ ids }` marks
 * those of the caller's notifications read, `{}` marks all of them. The user
 * id comes from the session, never from the body, and an id that isn't the
 * caller's is ignored. Answers with the caller's unread count.
 *
 * The count is read after the update. If that read fails the answer is 500
 * although the rows are marked; the page reads itself again after any answer,
 * so it still shows what was saved.
 */
export async function handleReadRequest(
  request: Request,
  deps: ReadRouteDeps = defaultDeps,
): Promise<Response> {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const userId = await deps.getUserId();
    if (!userId) return fail("unauthenticated", locale);

    const parsed = readNotificationsRequestSchema.safeParse(
      await request.json().catch(() => undefined),
    );
    if (!parsed.success) return fail("validation_failed", locale);

    await deps.markRead(userId, parsed.data.ids);
    const body: NotificationCounter = { unread: await deps.countUnread(userId) };
    return NextResponse.json(body);
  } catch (error) {
    // The error's code or message only: never the request body.
    console.error(
      "POST /api/notifications/read",
      error instanceof Error ? error.message : "error",
    );
    return fail("internal_error", locale);
  }
}
