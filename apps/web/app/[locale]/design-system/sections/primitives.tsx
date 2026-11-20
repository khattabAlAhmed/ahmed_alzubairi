import type { Locale } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { DsPending } from "../parts";

/**
 * components.md group: Button, Choice, Divider, FileInput, FilterChips, Link, Pagination, SearchField, Skeleton, StatusPill, Tabs, Tag, TextField.
 * Its Foundation task replaces the stub with one DsBlock per component, and
 * adds its text under `DesignSystem.primitives` in messages.
 */
export async function PrimitivesSection({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "DesignSystem" });
  return <DsPending id="primitives" title={t("primitives.title")} note={t("pending")} />;
}
