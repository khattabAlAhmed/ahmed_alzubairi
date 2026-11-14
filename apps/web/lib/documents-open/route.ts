import "server-only";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { writeAudit, type AuditEntry } from "@/lib/admin/audit";
import { baseError } from "@/lib/admin/permissions";
import { localeFromReferer } from "@/lib/auth/paths";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";
import { renderWatermarkTile } from "@/lib/watermark/render";
import { stampDocument } from "@/lib/watermark/stamp";
import { watermarkText } from "@/lib/watermark/text";
import { openDocument, type DocumentOpenDeps, type DocumentOpenStore } from "./handlers";
import { createDocumentOpenStore } from "./store";

export type DocumentOpenRouteDeps = {
  getUserId: () => Promise<string | null>;
  /** Called only after the session check. */
  createStore: (userId: string) => DocumentOpenStore;
  audit: (entry: AuditEntry) => Promise<void>;
} & Pick<DocumentOpenDeps, "watermark" | "markText" | "now">;

const defaultDeps: DocumentOpenRouteDeps = {
  getUserId: async () => (await auth()).userId,
  createStore: (userId) => createDocumentOpenStore(createUserClient(), createServiceClient(), userId),
  audit: (entry) => writeAudit(entry),
  watermark: (original, mime, text) => stampDocument(original, renderWatermarkTile(text), mime),
  markText: (viewer, at) => watermarkText(viewer.fullName, at, viewer.locale, viewer.timeZone),
  now: () => new Date(),
};

/** `GET /api/documents/:id/open`. */
export async function handleOpenDocument(
  request: Request,
  rawId: unknown,
  deps: DocumentOpenRouteDeps = defaultDeps,
): Promise<Response> {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const userId = await deps.getUserId();
    if (!userId) {
      const failure = baseError("unauthenticated", 401, locale);
      return NextResponse.json(failure.body, { status: failure.status });
    }
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const result = await openDocument(rawId, query, {
      locale,
      userId,
      store: deps.createStore(userId),
      audit: deps.audit,
      watermark: deps.watermark,
      markText: deps.markText,
      now: deps.now,
    });
    // A signed URL is a short-lived secret: never cached anywhere.
    return NextResponse.json(result.body, {
      status: result.status,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    // The message only: codes and step names, never row data or a key.
    console.error("GET /api/documents/:id/open", error instanceof Error ? error.message : "error");
    const failure = baseError("internal_error", 500, locale);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
