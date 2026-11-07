import { handleSettingsRequest } from "@/lib/admin/settings/route";

export async function PATCH(request: Request) {
  return handleSettingsRequest(request);
}
