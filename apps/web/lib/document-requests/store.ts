import "server-only";
import type { Database } from "@repo/db";
import {
  documentRequestStatusSchema,
  localeSchema,
  type LocalizedText,
  type Locale,
} from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DocumentRequestError, fromSqlError } from "./errors";
import type { DocumentRequestStore, Recipient } from "./handlers";

type Client = SupabaseClient<Database>;

const localeOf = (value: string): Locale => {
  const parsed = localeSchema.safeParse(value);
  return parsed.success ? parsed.data : "ar";
};

/**
 * A function's error: a known refusal becomes `DocumentRequestError` with the
 * user's text; anything else throws with its code only (never row data).
 */
function failure(
  label: string,
  error: { code?: string; message?: string },
  locale: Locale,
): Error {
  const answer = fromSqlError(error, locale);
  return answer ? new DocumentRequestError(answer) : new Error(`${label} failed: ${error.code}`);
}

/**
 * `user` carries the caller's token (RLS) for their own profile. `service`
 * runs the functions and the writes, and reads what the emails need, only
 * after the route checked identity and permission.
 */
export function createDocumentRequestStore(
  user: Client,
  service: Client,
  { userId, locale }: { userId: string; locale: Locale },
): DocumentRequestStore {
  return {
    async ownProfile() {
      const { data, error } = await user
        .from("profiles")
        .select("full_name")
        .eq("clerk_user_id", userId)
        .maybeSingle();
      if (error) throw new Error(`profile read failed: ${error.code}`);
      return data ? { fullName: data.full_name } : null;
    },

    async request(clientId, documentIds, purpose) {
      const { data, error } = await service.rpc("request_document", {
        client_id: clientId,
        document_ids: documentIds,
        purpose,
      });
      if (error) throw failure("request_document", error, locale);
      return data.map((row) => ({
        requestId: row.request_id,
        documentId: row.document_id,
        status: documentRequestStatusSchema.parse(row.status),
        merged: row.merged,
      }));
    },

    async documentTitles(ids) {
      const { data, error } = await service
        .from("documents")
        .select("id, title_ar, title_en")
        .in("id", ids);
      if (error) throw new Error(`documents read failed: ${error.code}`);
      return new Map(
        data.map((row): [string, LocalizedText] => [row.id, { ar: row.title_ar, en: row.title_en }]),
      );
    },

    async membersWith(permissions) {
      const roles = await service
        .from("role_permissions")
        .select("role_id")
        .in("permission", permissions);
      if (roles.error) throw new Error(`role_permissions read failed: ${roles.error.code}`);
      const roleIds = [...new Set(roles.data.map((row) => row.role_id))];
      if (roleIds.length === 0) return [];
      const members = await service
        .from("profiles")
        .select("clerk_user_id, email, locale")
        .eq("status", "active")
        .in("role_id", roleIds);
      if (members.error) throw new Error(`profiles read failed: ${members.error.code}`);
      return members.data.map(
        (row): Recipient => ({ userId: row.clerk_user_id, email: row.email, locale: localeOf(row.locale) }),
      );
    },

    async notify(userIds, type, requestId) {
      if (userIds.length === 0) return;
      const { error } = await service.from("notifications").insert(
        userIds.map((id) => ({
          user_id: id,
          type,
          entity: "document_requests",
          entity_id: requestId,
        })),
      );
      if (error) throw new Error(`notifications insert failed: ${error.code}`);
    },

    async requestInfo(id) {
      const { data, error } = await service
        .from("document_requests")
        .select(
          "id, status, document:documents!inner(title_ar, title_en), client:profiles!document_requests_client_id_fkey!inner(clerk_user_id, full_name, email, locale)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`document_requests read failed: ${error.code}`);
      if (!data) return null;
      return {
        id: data.id,
        status: documentRequestStatusSchema.parse(data.status),
        documentTitle: { ar: data.document.title_ar, en: data.document.title_en },
        client: {
          userId: data.client.clerk_user_id,
          fullName: data.client.full_name,
          email: data.client.email,
          locale: localeOf(data.client.locale),
        },
      };
    },

    async memberName(memberId) {
      const { data, error } = await service
        .from("profiles")
        .select("full_name")
        .eq("clerk_user_id", memberId)
        .single();
      if (error) throw new Error(`profile read failed: ${error.code}`);
      return data.full_name;
    },

    async addRecommendation(row) {
      const { error } = await service.from("document_recommendations").insert({
        request_id: row.requestId,
        member_id: row.memberId,
        recommendation: row.recommendation,
        note: row.note,
      });
      if (error) throw new Error(`document_recommendations insert failed: ${error.code}`);
    },

    async decide(requestId, decidedBy, decision, expiresAt) {
      const { data, error } = await service.rpc("decide_document_request", {
        request_id: requestId,
        decided_by: decidedBy,
        decision,
        ...(expiresAt ? { expires_at: expiresAt } : {}),
      });
      if (error) throw failure("decide_document_request", error, locale);
      return { consultationId: data.consultation_id };
    },

    async revoke(requestId, decidedBy) {
      const { error } = await service.rpc("revoke_document_request", {
        request_id: requestId,
        decided_by: decidedBy,
      });
      if (error) throw failure("revoke_document_request", error, locale);
    },
  };
}
