import { useTranslations } from "next-intl";

export default function Loading() {
  const t = useTranslations("Common");

  return (
    <div role="status" className="flex flex-1 items-center justify-center p-6">
      <p className="text-text-secondary">{t("loading")}</p>
    </div>
  );
}
