import "server-only";
import { auth } from "@clerk/nextjs/server";
import type { Database } from "@repo/db";
import { createClient } from "@supabase/supabase-js";
import { readEnv } from "./env";

/**
 * The user's client: every request carries their Clerk session token, so RLS
 * scopes what they read. Use it for every user read (§9).
 *
 * Signed out, there is no token, so requests go as `anon`, which reads nothing.
 * Check the session in the route before calling this.
 */
export function createUserClient() {
  return createClient<Database>(
    readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      accessToken: async () => (await auth()).getToken(),
    },
  );
}
