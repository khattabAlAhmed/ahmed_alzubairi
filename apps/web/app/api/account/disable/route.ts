import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/admin/audit";
import { createClerkBan } from "@/lib/admin/clients/clerk-ban";
import { createClientStore } from "@/lib/admin/clients/store";
import { localeFromReferer } from "@/lib/auth/paths";
import { disableAccount } from "@/lib/profile/disable";
import { baseFail } from "@/lib/profile/update";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";

/**
 * `POST /api/account/disable`: the signed-in client disables their own
 * account. The id comes from the session. The profile read uses their own
 * client; the writes use the service client after that check (§9).
 */
export async function POST(request: Request) {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const { userId } = await auth();
    const result = await disableAccount({
      userId,
      locale,
      readBody: () => request.json(),
      store: createClientStore(createUserClient(), createServiceClient()),
      clerk: createClerkBan(),
      audit: (entry) => writeAudit(entry),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("POST /api/account/disable", error);
    const result = baseFail("internal_error", 500, locale);
    return NextResponse.json(result.body, { status: result.status });
  }
}
