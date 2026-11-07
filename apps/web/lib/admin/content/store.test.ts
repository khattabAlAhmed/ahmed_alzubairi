import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createContentStore } from "./store";

const PROJECT = "3f8a7c1e-2b4d-4e6f-8a9b-0c1d2e3f4a5b";
type Result = { data?: unknown; error: { code: string } | null };

/** A supabase-js stand-in: records each call, answers `select`, `insert`, `delete`. */
function fakeClient(answers: { insert: Result }) {
  const calls: string[] = [];
  const client = {
    from(table: string) {
      return {
        select: () => ({
          eq: async () => {
            calls.push(`${table}.select`);
            return { data: [{ id: "old-1" }], error: null };
          },
        }),
        insert: async () => {
          calls.push(`${table}.insert`);
          return answers.insert;
        },
        delete: () => ({
          in: async () => {
            calls.push(`${table}.delete`);
            return { error: null };
          },
        }),
      };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const image = { project_id: PROJECT, path: "media/a.jpg", position: 0 };

describe("replaceProjectImages", () => {
  it("adds the new images before removing the old ones", async () => {
    const { client, calls } = fakeClient({ insert: { error: null } });
    await createContentStore(client, client).replaceProjectImages(PROJECT, [image]);
    expect(calls).toEqual([
      "project_images.select",
      "project_images.insert",
      "project_images.delete",
    ]);
  });

  it("keeps the old images when the insert fails", async () => {
    const { client, calls } = fakeClient({ insert: { error: { code: "XX000" } } });
    await expect(
      createContentStore(client, client).replaceProjectImages(PROJECT, [image]),
    ).rejects.toThrow("project_images insert failed");
    expect(calls).not.toContain("project_images.delete");
  });
});
