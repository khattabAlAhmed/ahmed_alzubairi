import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui";

export default function Loading() {
  const t = useTranslations("Common");

  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-5 w-72 max-w-full" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    </div>
  );
}
