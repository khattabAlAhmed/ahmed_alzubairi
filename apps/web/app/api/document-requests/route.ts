import { handleCreateDocumentRequests } from "@/lib/document-requests/route";

export async function POST(request: Request) {
  return handleCreateDocumentRequests(request);
}
