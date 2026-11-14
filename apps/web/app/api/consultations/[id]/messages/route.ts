import { handleMessageRequest } from "@/lib/consultations/route";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  return handleMessageRequest(request, (await params).id);
}
