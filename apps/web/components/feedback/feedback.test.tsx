// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { InlineNotice, NoticeLine } from "@/components/account/notice";
import { EmptyState } from "@/components/empty-state";
import { Dialog } from "./dialog";
import { ErrorState } from "./error-state";
import { ListSkeleton } from "./list-skeletons";

afterEach(cleanup);

// jsdom has no modal dialogs: record that showModal was used, and open the element.
const showModal = vi.fn(function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
});
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = showModal;
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

function Opener() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Close the consultation?"
        footer={
          <button type="button" onClick={() => setOpen(false)}>
            Back
          </button>
        }
      >
        <p>It can be reopened later.</p>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("opens as a native modal, so the page behind is inert and focus stays inside", () => {
    showModal.mockClear();
    render(<Opener />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog", { name: "Close the consultation?" });
    expect(showModal).toHaveBeenCalledOnce();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("closes on Escape and gives focus back to the opener", () => {
    render(<Opener />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    // Escape fires the dialog's cancel event.
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("focuses the data-autofocus control, and returns focus to the opener", () => {
    function AutoOpener() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Delete
          </button>
          <Dialog
            open={open}
            onClose={() => setOpen(false)}
            title="Delete?"
            footer={
              <>
                <button type="button" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="button" data-autofocus>
                  Continue
                </button>
              </>
            }
          >
            <p>Sure?</p>
          </Dialog>
        </>
      );
    }
    render(<AutoOpener />);
    const opener = screen.getByRole("button", { name: "Delete" });
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(opener);
  });

  it("ignores Escape while busy", () => {
    const onClose = vi.fn();
    render(
      <Dialog open busy onClose={onClose} title="Deleting" footer={null}>
        <p>…</p>
      </Dialog>,
    );
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("is an alertdialog with the danger rule when destructive", () => {
    render(
      <Dialog open tone="danger" onClose={vi.fn()} title="Delete for good" footer={null}>
        <p>{"This can't be undone."}</p>
      </Dialog>,
    );
    const dialog = screen.getByRole("alertdialog", { name: "Delete for good" });
    expect(dialog.className).toContain("border-danger");
  });

  it("renders nothing while closed", () => {
    render(
      <Dialog open={false} onClose={vi.fn()} title="t" footer={null}>
        <p>x</p>
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("ErrorState", () => {
  it("shows a glyph and words at every size, read out at once", () => {
    render(
      <>
        <ErrorState size="field" title="The number is short." />
        <ErrorState size="section" title="The articles didn't load" text="The rest of the page works." />
        <ErrorState size="page" level={1} title="Something went wrong on our side" reference="ref 7f3a" />
      </>,
    );
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(3);
    for (const alert of alerts) expect(alert.querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Something went wrong on our side" })).toBeTruthy();
    expect(screen.getByText("ref 7f3a").getAttribute("dir")).toBe("ltr");
  });
});

describe("Notice", () => {
  it("reads danger at once and the rest politely, each with its own glyph", () => {
    render(
      <>
        <InlineNotice tone="success" title="Saved" />
        <InlineNotice tone="danger" title="Not sent" />
      </>,
    );
    expect(screen.getByRole("status").textContent).toContain("Saved");
    expect(screen.getByRole("alert").textContent).toContain("Not sent");
    const paths = [...document.querySelectorAll("[data-tone] svg")].map((svg) => svg.innerHTML);
    expect(new Set(paths).size).toBe(2);
  });

  it("keeps NoticeLine's API, now with a glyph", () => {
    render(<NoticeLine notice={{ ok: false, text: "Not saved" }} />);
    const line = screen.getByRole("alert");
    expect(line.textContent).toBe("Not saved");
    expect(line.querySelector("svg")).not.toBeNull();
  });
});

describe("EmptyState", () => {
  it("is a heading at the given level with the reason and the next step", () => {
    render(<EmptyState level={2} title="No consultations yet" text="When you start one, it's here." action={<a href="#start">Start</a>} />);
    expect(screen.getByRole("heading", { level: 2, name: "No consultations yet" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Start" })).toBeTruthy();
  });

  it("keeps h1 by default, for the pages that use it as their only content", () => {
    render(<EmptyState title="Nothing here" text="Reason." />);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });
});

describe("ListSkeleton", () => {
  it("is busy and says so to screen readers, with its rows hidden", () => {
    const { container } = render(<ListSkeleton kind="documents" rows={2} label="Loading" />);
    expect(container.firstElementChild?.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Loading");
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(2);
  });
});
