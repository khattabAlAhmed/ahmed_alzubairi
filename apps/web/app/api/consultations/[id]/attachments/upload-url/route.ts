import { handleUploadUrlRequest } from "@/lib/attachments/route";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  return handleUploadUrlRequest(request, (await params).id);
}
