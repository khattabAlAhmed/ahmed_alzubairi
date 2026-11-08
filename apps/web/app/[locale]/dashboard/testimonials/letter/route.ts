import { LOCALES } from "@repo/shared";
import { openLetter } from "@/components/dashboard/testimonials/letter";

type Context = { params: Promise<{ locale: string }> };

/** `GET /<locale>/dashboard/testimonials/letter?id=<testimonial id>`: a 60-second redirect to the letter. */
export async function GET(request: Request, { params }: Context) {
  const { locale: raw } = await params;
  const locale = LOCALES.find((item) => item === raw) ?? "ar";
  return openLetter(new URL(request.url).searchParams.get("id"), locale);
}
