import "server-only";
import type { Database } from "@repo/db";
import { createClient } from "@supabase/supabase-js";
import { readEnv } from "./env";

/** The only place the app reads the secret key (§9 Secrets). */
export const SERVICE_KEY_ENV = "SUPABASE_SECRET_KEY";

/**
 * The service client skips RLS. Use it only on the server, only after the
 * route has checked identity and permission, and never with a manual user
 * filter in place of RLS (§9).
 */
export function createServiceClient() {
  return createClient<Database>(
    readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    readEnv(SERVICE_KEY_ENV),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
