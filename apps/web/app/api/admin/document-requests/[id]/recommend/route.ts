import { handleRecommend } from "@/lib/document-requests/route";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  return handleRecommend(request, (await params).id);
}
