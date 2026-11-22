"use client";

import { useRouter } from "next/navigation";
import { Component, useTransition, type ReactNode } from "react";
import { ErrorState } from "@/components/feedback/error-state";
import { CONTAINER } from "@/components/public/parts";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";

export type SectionErrorLabels = {
  /** The section's own heading, so the visitor knows which part failed. */
  heading: string;
  title: string;
  text: string;
  retry: string;
};

/**
 * One home section that failed to load (the ErrorState board, section size):
 * its heading, what went wrong, and a retry that reloads the page's data. The
 * rest of the page is untouched. Words come from the server as props: public
 * pages have no client message provider.
 */
function SectionError({ labels, onReset }: { labels: SectionErrorLabels; onReset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <section aria-label={labels.heading} className={cx(CONTAINER, "mt-section")}>
      <ErrorState
        size="section"
        title={labels.title}
        text={labels.text}
        action={
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={() =>
              startTransition(() => {
                router.refresh();
                onReset();
              })
            }
          >
            {labels.retry}
          </Button>
        }
      />
    </section>
  );
}

/**
 * Catches a failed read in one home section, so the page still renders
 * around it (§6.2: every section stands alone).
 */
export class SectionBoundary extends Component<
  { labels: SectionErrorLabels; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error("A home section failed to load", error);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return <SectionError labels={this.props.labels} onReset={() => this.setState({ failed: false })} />;
  }
}
