import { SITE_NAME } from "@repo/shared";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <h1 className="text-3xl">{SITE_NAME}</h1>
    </main>
  );
}
