import { handleMeetingsRequest } from "@/lib/admin/consultations/route";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  return handleMeetingsRequest(request, (await params).id);
}

export async function PATCH(request: Request, { params }: Context) {
  return handleMeetingsRequest(request, (await params).id);
}
