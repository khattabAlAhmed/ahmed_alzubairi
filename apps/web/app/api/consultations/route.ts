import { handleConsultationsRequest } from "@/lib/consultations/route";

export async function GET(request: Request) {
  return handleConsultationsRequest(request);
}

export async function POST(request: Request) {
  return handleConsultationsRequest(request);
}
