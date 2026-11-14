import { handleReadRequest } from "@/lib/notifications/route";

export async function POST(request: Request) {
  return handleReadRequest(request);
}
