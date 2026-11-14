"use client";

import { useAuth } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Button, Checkbox } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { RETURN_PARAM } from "@/lib/auth/return-path";
import { DOCUMENTS_PATH, MAX_REQUEST_IDS, parseRequestIds, REQUEST_PARAM, requestPath } from "./paths";
import { RequestDialog, type DialogDocument } from "./request-dialog";

type RequestContext = {
  selected: ReadonlySet<string>;
  toggle: (id: string) => void;
  /** Opens the dialog for these documents, or sends a signed-out visitor to sign in first. */
  start: (ids: readonly string[]) => void;
};

const Context = createContext<RequestContext | null>(null);

function useRequest(): RequestContext {
  const value = useContext(Context);
  if (!value) throw new Error("DocumentRequestProvider is missing");
  return value;
}

/**
 * Reads `?request=<id>,<id>` once (the selection brought back from sign-in).
 * In its own Suspense boundary, so the list around it still renders first.
 */
function RequestParam({ onIds }: { onIds: (ids: string[]) => void }) {
  const params = useSearchParams();
  const value = params.get(REQUEST_PARAM);
  useEffect(() => {
    onIds(parseRequestIds(value));
  }, [value, onIds]);
  return null;
}

/**
 * The request flow on the public documents page (§6.12, §6.18 step 1). The
 * page stays cached, so the session is read here in the browser, never on the
 * server. Signed out, a request goes to sign-in with the selection in the
 * return path (`/documents?request=<ids>`); back here, those documents are
 * selected and the dialog opens.
 */
export function DocumentRequestProvider({
  documents,
  children,
}: {
  documents: DialogDocument[];
  children: ReactNode;
}) {
  const t = useTranslations("DocumentRequestDialog");
  const locale = useLocale();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [dialogIds, setDialogIds] = useState<string[] | null>(null);
  const [fromLink, setFromLink] = useState<string[]>([]);
  const known = useMemo(() => new Map(documents.map((document) => [document.id, document])), [documents]);

  const onIds = useCallback(
    (ids: string[]) => setFromLink(ids.filter((id) => known.has(id))),
    [known],
  );

  // The selection from the link, once Clerk knows who this is. Applied while
  // rendering (React's pattern for state that follows other state), not in an effect.
  if (isLoaded && fromLink.length > 0) {
    setSelected(new Set(fromLink));
    if (isSignedIn) setDialogIds(fromLink);
    setFromLink([]);
  }

  const start = useCallback(
    (ids: readonly string[]) => {
      // Before Clerk loads, a signed-in visitor would look signed out.
      if (ids.length === 0 || !isLoaded) return;
      if (!isSignedIn) {
        router.push({
          pathname: "/sign-in",
          query: { [RETURN_PARAM]: `/${locale}${requestPath(ids)}` },
        });
        return;
      }
      setDialogIds([...ids]);
    },
    [isLoaded, isSignedIn, locale, router],
  );

  const [atLimit, setAtLimit] = useState(false);
  const toggle = useCallback(
    (id: string) => {
      if (selected.has(id)) {
        const next = new Set(selected);
        next.delete(id);
        setSelected(next);
        setAtLimit(false);
        return;
      }
      // One request carries at most MAX_REQUEST_IDS documents: refused here, with a message.
      if (selected.size >= MAX_REQUEST_IDS) {
        setAtLimit(true);
        return;
      }
      setSelected(new Set(selected).add(id));
    },
    [selected],
  );

  function close() {
    setDialogIds(null);
    // The link's selection has done its job; a reload shouldn't reopen the dialog.
    router.replace(DOCUMENTS_PATH, { scroll: false });
  }

  const dialogDocuments = (dialogIds ?? []).flatMap((id) => known.get(id) ?? []);
  const value = useMemo(() => ({ selected, toggle, start }), [selected, toggle, start]);

  return (
    <Context.Provider value={value}>
      <Suspense fallback={null}>
        <RequestParam onIds={onIds} />
      </Suspense>
      {children}
      {selected.size > 0 && (
        <div
          role="region"
          aria-label={t("requestSelected")}
          className="sticky bottom-0 z-10 border-t border-text/15 bg-surface/95 px-4 py-3 shadow-lg backdrop-blur"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div aria-live="polite">
              <p className="text-sm font-semibold">{t("selected", { count: selected.size })}</p>
              {atLimit && (
                <p role="alert" className="text-sm font-semibold text-danger">
                  {t("limit", { max: MAX_REQUEST_IDS })}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="quiet"
                size="sm"
                onClick={() => {
                  setSelected(new Set());
                  setAtLimit(false);
                }}
              >
                {t("clearSelection")}
              </Button>
              <Button size="sm" onClick={() => start([...selected])}>
                {t("requestSelected")}
              </Button>
            </div>
          </div>
        </div>
      )}
      {dialogDocuments.length > 0 && (
        <RequestDialog
          documents={dialogDocuments}
          onClose={close}
          onSent={() => setSelected(new Set())}
        />
      )}
    </Context.Provider>
  );
}

/** "طلب الاطلاع" for one document. */
export function RequestButton({ id, title }: DialogDocument) {
  const t = useTranslations("DocumentRequestDialog");
  const { start } = useRequest();
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-label={t("requestLabel", { title })}
      data-document-request={id}
      onClick={() => start([id])}
      className="shrink-0"
    >
      {t("request")}
    </Button>
  );
}

/** The multi-select box for "طلب عدة وثائق". */
export function SelectBox({ id, title }: DialogDocument) {
  const t = useTranslations("DocumentRequestDialog");
  const { selected, toggle } = useRequest();
  return (
    <Checkbox
      label={<span className="sr-only">{t("select", { title })}</span>}
      checked={selected.has(id)}
      onChange={() => toggle(id)}
    />
  );
}
