import { SITE_NAME } from "@repo/shared";
import { MAIN_CONTENT_ID } from "@/components/skip-link";

export default function Home() {
  return (
    <main
      id={MAIN_CONTENT_ID}
      className="flex flex-1 items-center justify-center p-6"
    >
      <h1 className="text-3xl">{SITE_NAME}</h1>
    </main>
  );
}
