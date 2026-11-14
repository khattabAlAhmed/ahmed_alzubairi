import { handleConsultationPatch } from "@/lib/admin/consultations/route";
import { handleDeleteRequest } from "@/lib/admin/delete/route";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  return handleConsultationPatch(request, (await params).id);
}

/**
 * `DELETE /api/admin/consultations/:id`. This static route takes the path
 * before `app/api/admin/[type]/[id]`, so it hands the delete to the same handler.
 */
export async function DELETE(request: Request, { params }: Context) {
  return handleDeleteRequest(request, "consultations", (await params).id);
}
