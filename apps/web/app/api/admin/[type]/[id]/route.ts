import { handleDeleteRequest } from "@/lib/admin/delete/route";

type Context = { params: Promise<{ type: string; id: string }> };

/** `DELETE /api/admin/:type/:id` (§8). The handler checks `:type` against the shared list. */
export async function DELETE(request: Request, { params }: Context) {
  const { type, id } = await params;
  return handleDeleteRequest(request, type, id);
}
