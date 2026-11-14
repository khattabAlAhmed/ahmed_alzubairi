import { handleClientsRequest } from "@/lib/admin/clients/route";

export async function GET(request: Request) {
  return handleClientsRequest(request);
}

export async function PATCH(request: Request) {
  return handleClientsRequest(request);
}
