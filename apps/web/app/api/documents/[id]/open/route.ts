import { handleOpenDocument } from "@/lib/documents-open/route";

// Runs on the Node.js runtime, the default for route handlers: the watermark
// needs native modules (@napi-rs/canvas, sharp). `runtime` itself can't be set
// with `cacheComponents` on.
// A 10 MB, 30-page PDF is stamped page by page; give it room.
export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  return handleOpenDocument(request, (await params).id);
}
