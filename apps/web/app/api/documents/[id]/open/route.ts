import { handleOpenDocument } from "@/lib/documents-open/route";

// The watermark uses native modules (@napi-rs/canvas, sharp): Node.js only.
export const runtime = "nodejs";
// A 10 MB, 30-page PDF is stamped page by page; give it room.
export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  return handleOpenDocument(request, (await params).id);
}
