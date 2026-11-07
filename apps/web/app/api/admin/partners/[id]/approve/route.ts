import { handleApprovalRequest } from "@/lib/admin/approvals/route";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  return handleApprovalRequest("partners", request, (await params).id);
}
