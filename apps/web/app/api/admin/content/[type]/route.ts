import { handleContentRequest } from "@/lib/admin/content/route";

type Context = { params: Promise<{ type: string }> };

export async function GET(request: Request, { params }: Context) {
  return handleContentRequest("GET", request, (await params).type);
}

export async function POST(request: Request, { params }: Context) {
  return handleContentRequest("POST", request, (await params).type);
}

export async function PATCH(request: Request, { params }: Context) {
  return handleContentRequest("PATCH", request, (await params).type);
}
