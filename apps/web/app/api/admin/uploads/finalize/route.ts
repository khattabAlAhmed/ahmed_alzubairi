import { handleUploadRequest } from "@/lib/admin/uploads/route";

export async function POST(request: Request) {
  return handleUploadRequest("finalize", request);
}
