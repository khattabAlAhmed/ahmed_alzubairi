import { handleDownloadRequest } from "@/lib/attachments/route";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  return handleDownloadRequest(request, (await params).id);
}
