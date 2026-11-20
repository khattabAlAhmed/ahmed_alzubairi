"use client";

import { Button, type ButtonVariant } from "@/components/ui/button";
import { FileChip, type FileChipData } from "@/components/workspace/file-chip";

// No-op handlers, so the design-system page can show the remove and retry
// buttons a FileChip draws only when it gets them.
const noop = () => {};

/** A FileChip with its buttons, for the design-system page only. */
export function DemoFileChip({ file, retryLabel }: { file: FileChipData; retryLabel?: string }) {
  return (
    <FileChip
      file={file}
      onRemove={file.state === "refused" ? undefined : noop}
      onRetry={retryLabel ? noop : undefined}
      retryLabel={retryLabel}
    />
  );
}

/** A button in its loading state. Loading blocks clicks with a handler, so it renders on the client. */
export function DemoLoadingButton({ variant, label }: { variant: ButtonVariant; label: string }) {
  return (
    <Button variant={variant} loading loadingLabel={label}>
      {label}
    </Button>
  );
}
