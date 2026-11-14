import { handleEmailTemplatesRequest } from "@/lib/admin/email-templates/route";

export async function GET(request: Request) {
  return handleEmailTemplatesRequest(request);
}

export async function PATCH(request: Request) {
  return handleEmailTemplatesRequest(request);
}

/** "Reset to default": deletes the event's saved template. */
export async function DELETE(request: Request) {
  return handleEmailTemplatesRequest(request);
}
