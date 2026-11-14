import { handleDecide } from "@/lib/document-requests/route";

type Context = { params: Promise<{ id: string }> };

/** grant, contact_first or withdraw. There is no reject (§6.18). */
export async function POST(request: Request, { params }: Context) {
  return handleDecide(request, (await params).id);
}
