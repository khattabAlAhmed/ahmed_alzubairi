import { handleFinalizeRequest } from "@/lib/attachments/route";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  return handleFinalizeRequest(request, (await params).id);
}
