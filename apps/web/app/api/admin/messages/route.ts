import { handleMessageRequest } from "@/lib/admin/messages/route";

export async function PATCH(request: Request) {
  return handleMessageRequest(request);
}
