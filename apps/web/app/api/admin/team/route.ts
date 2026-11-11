import { handleTeamRequest } from "@/lib/admin/team/route";

export async function GET(request: Request) {
  return handleTeamRequest(request);
}

export async function POST(request: Request) {
  return handleTeamRequest(request);
}

export async function PATCH(request: Request) {
  return handleTeamRequest(request);
}
