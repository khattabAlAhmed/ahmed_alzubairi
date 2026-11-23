import { ListSkeleton } from "@/components/feedback/list-skeletons";
import { Skeleton, SkeletonImage, SkeletonListItem, SkeletonText } from "@/components/ui/skeleton";
import { HomeSectionShell } from "./section";

/** What a loading home section stands in for, so its placeholder has the content's shape. */
export type SectionSkeletonKind = "rows" | "chapters" | "projects" | "register" | "quotes" | "reading" | "media";

/**
 * A home section while its rows load (the Skeleton board): the real heading
 * and intro, which need no read, then placeholders in `surface` shaped like
 * the content. The breath stops under "reduce motion".
 */
export function SectionSkeleton({
  sectionKey,
  heading,
  intro,
  kind,
  label,
}: {
  sectionKey: string;
  heading: string;
  intro?: string;
  kind: SectionSkeletonKind;
  /** "Loading", for screen readers. */
  label: string;
}) {
  return (
    <HomeSectionShell sectionKey={sectionKey} heading={heading} intro={intro}>
      {kind === "projects" ? (
        <ListSkeleton kind="projects" label={label} rows={2} />
      ) : (
        <div>
          <span className="sr-only" role="status">
            {label}
          </span>
          <div aria-busy="true">{body(kind)}</div>
        </div>
      )}
    </HomeSectionShell>
  );
}

function body(kind: Exclude<SectionSkeletonKind, "projects">) {
  switch (kind) {
    case "rows":
      return (
        <div className="border-t-2 border-rule">
          {[0, 1, 2].map((index) => (
            <SkeletonListItem key={index} className="md:grid-cols-[var(--label-col)_1fr]" />
          ))}
        </div>
      );
    case "chapters":
      return (
        <div className="grid gap-gutter md:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex flex-col gap-3 border-t-2 border-rule pt-4">
              <Skeleton className="h-5 w-3/5" />
              <SkeletonText lines={3} />
            </div>
          ))}
        </div>
      );
    case "register":
      return (
        <div className="grid grid-cols-2 border-t border-s border-line md:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="flex h-28 flex-col justify-end gap-2 border-e border-b border-line p-4">
              <Skeleton className="h-3 w-3/5" />
            </div>
          ))}
        </div>
      );
    case "quotes":
      return (
        <div className="grid gap-gutter md:grid-cols-12">
          <div className="flex flex-col gap-3 md:col-span-7">
            <SkeletonText lines={3} />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <div className="flex flex-col gap-6 md:col-span-5">
            <SkeletonText lines={2} />
            <SkeletonText lines={2} />
          </div>
        </div>
      );
    case "reading":
      return (
        <div className="grid gap-x-gutter gap-y-10 lg:grid-cols-2">
          <SkeletonImage aspect="aspect-video" />
          <div className="border-t-2 border-rule">
            {[0, 1, 2].map((index) => (
              <SkeletonListItem key={index} />
            ))}
          </div>
        </div>
      );
    case "media":
      return <SkeletonImage aspect="aspect-video" className="md:max-w-[42rem]" />;
  }
}
