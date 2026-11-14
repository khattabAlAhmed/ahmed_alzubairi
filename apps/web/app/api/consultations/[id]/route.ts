import { handleConsultationRequest } from "@/lib/consultations/route";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  return handleConsultationRequest(request, (await params).id);
}
