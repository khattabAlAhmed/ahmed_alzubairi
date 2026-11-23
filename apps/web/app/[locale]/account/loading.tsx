"use client";

import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import { ListSkeleton, type ListSkeletonKind } from "@/components/feedback/list-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** The account's lists and the skeleton of each (the ListStates board). */
const LISTS = {
  consultations: "articles",
  documents: "documents",
  courses: "courses",
} as const satisfies Record<string, ListSkeletonKind>;

type List = keyof typeof LISTS;

/** `/ar/account/documents` → "documents"; any other account page → null. */
export function accountList(pathname: string): List | null {
  const match = /\/account\/(consultations|documents|courses)\/?$/.exec(pathname);
  return match ? (match[1] as List) : null;
}

/**
 * One loading state for the whole account, inside its shell (the nav stays).
 * A list page gets the header and its list's skeleton; any other page (the
 * overview, the profile, a consultation) only the header's. The status text
 * names what is loading, in the user's language: the browser gets no page
 * namespaces, so the copy comes from the message files themselves.
 */
export default function AccountLoading() {
  const list = accountList(usePathname() ?? "");
  const copy = (useLocale() === "ar" ? ar : en).Account.states.loading;
  return (
    <div className="space-y-6">
      <div aria-hidden="true" className="border-t-2 border-rule pt-5 pb-6">
        <Skeleton className="h-7 w-1/3" />
        <Skeleton className="mt-3 h-3 w-1/2" />
      </div>
      {list ? (
        <ListSkeleton kind={LISTS[list]} label={copy[list]} />
      ) : (
        <span className="sr-only" role="status">
          {copy.page}
        </span>
      )}
    </div>
  );
}
