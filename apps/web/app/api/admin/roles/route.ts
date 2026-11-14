import { handleRolesRequest } from "@/lib/admin/roles/route";

export async function GET(request: Request) {
  return handleRolesRequest(request);
}

export async function POST(request: Request) {
  return handleRolesRequest(request);
}

export async function PATCH(request: Request) {
  return handleRolesRequest(request);
}
