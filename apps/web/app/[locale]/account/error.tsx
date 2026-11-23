"use client";

import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui";
import { accountList } from "./loading";

/**
 * One error state for the whole account, inside its shell: the nav still
 * works, so this names what didn't load (a list by name, any other page as
 * "this page") and offers a retry. The copy comes from the message files,
 * since the browser gets no page namespaces.
 */
export default function AccountError({ reset }: { reset: () => void }) {
  const list = accountList(usePathname() ?? "");
  const copy = (useLocale() === "ar" ? ar : en).Account.states.error;
  return (
    <ErrorState
      size="section"
      title={copy[list ?? "page"]}
      text={copy.text}
      action={
        <Button variant="secondary" size="sm" onClick={reset}>
          {copy.retry}
        </Button>
      }
    />
  );
}
