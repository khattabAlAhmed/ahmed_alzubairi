import { handleDocumentsRequest } from "@/lib/admin/documents/route";

export async function GET(request: Request) {
  return handleDocumentsRequest(request);
}

export async function POST(request: Request) {
  return handleDocumentsRequest(request);
}

export async function PATCH(request: Request) {
  return handleDocumentsRequest(request);
}
