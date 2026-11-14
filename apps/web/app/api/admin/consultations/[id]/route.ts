import { handleConsultationPatch } from "@/lib/admin/consultations/route";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  return handleConsultationPatch(request, (await params).id);
}
