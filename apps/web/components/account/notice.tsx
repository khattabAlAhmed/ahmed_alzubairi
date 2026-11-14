import { cx } from "@/components/ui/cx";

export type Notice = { ok: boolean; text: string };

/** A status line under a form: read out politely on success, at once on failure. */
export function NoticeLine({ notice, className }: { notice: Notice | null; className?: string }) {
  if (!notice) return null;
  return (
    <p
      role={notice.ok ? "status" : "alert"}
      className={cx("text-sm font-semibold", notice.ok ? "text-text" : "text-danger", className)}
    >
      {notice.text}
    </p>
  );
}
