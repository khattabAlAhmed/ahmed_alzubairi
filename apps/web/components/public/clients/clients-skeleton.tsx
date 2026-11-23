import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { cx } from "@/components/ui/cx";
import { CONTAINER } from "@/components/public/parts";

/**
 * `/clients` while its list loads (the ListStates board, in this page's
 * shapes): a testimonial in full beside two excerpts, then the organizations'
 * register as empty cells, so nothing jumps when they arrive. `label`
 * ("Loading") is a status outside the busy subtree, so it's announced at once.
 */
export function ClientsSkeleton({ label }: { label: string }) {
  return (
    <div className={cx(CONTAINER, "flex flex-col gap-section")}>
      <span className="sr-only" role="status">
        {label}
      </span>
      <div aria-busy="true" className="flex flex-col gap-section">
        <div aria-hidden="true" className="grid gap-x-gutter gap-y-10 border-t-2 border-rule pt-6 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-7">
            <Skeleton className="h-3 w-1/4" />
            <SkeletonText lines={3} className="[&>*]:h-5" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <div className="flex flex-col gap-8 lg:col-span-5">
            {[0, 1].map((index) => (
              <div key={index} className="flex flex-col gap-2.5 border-b border-line pb-6">
                <SkeletonText lines={2} />
                <Skeleton className="h-3 w-2/5" />
              </div>
            ))}
          </div>
        </div>
        <ul aria-hidden="true" className="grid grid-cols-2 border-s border-t border-line sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <li key={index} className="flex min-h-[132px] flex-col justify-between gap-3 border-e border-b border-line p-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
