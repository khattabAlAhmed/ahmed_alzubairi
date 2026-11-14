// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import enAccount from "@/messages/en/AccountDocuments.json";
import { PdfPages, type loadPdfJs } from "./pdf-pages";

afterEach(cleanup);

/** A stand-in pdf.js whose pages resolve in the order and timing a test picks. */
function fakePdfJs(pages: number, delay: (page: number) => number = () => 0) {
  const rendered: number[] = [];
  const getDocument = vi.fn(() => ({
    destroy: vi.fn(),
    promise: Promise.resolve({
      numPages: pages,
      getPage: (number: number) =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
                render: () => ({
                  cancel: vi.fn(),
                  promise: Promise.resolve().then(() => void rendered.push(number)),
                }),
              }),
            delay(number),
          ),
        ),
    }),
  }));
  const load = (async () => ({ getDocument })) as unknown as typeof loadPdfJs;
  return { load, getDocument, rendered };
}

function show(load: typeof loadPdfJs, onError = vi.fn()) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ AccountDocuments: enAccount }}>
      <PdfPages data={new ArrayBuffer(8)} title="Doc" onError={onError} load={load} />
    </NextIntlClientProvider>,
  );
}

const wait = (ms: number) => act(async () => void (await new Promise((resolve) => setTimeout(resolve, ms))));
/** Lets the load, the commit of the page canvases, and their draws all finish. */
const settle = async (ms = 0) => {
  for (let round = 0; round < 3; round += 1) await wait(ms);
};

describe("PdfPages", () => {
  it("draws every page of a 30-page PDF, each on its own canvas", async () => {
    const pdf = fakePdfJs(30);
    const { container } = show(pdf.load);
    await settle(20);
    expect(container.querySelectorAll("canvas")).toHaveLength(30);
    expect([...pdf.rendered].sort((a, b) => a - b)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(container.querySelector('canvas[data-page="30"]')?.getAttribute("aria-label")).toBe("Doc · Page 30 of 30");
  });

  it("draws a page even when pdf.js answers before React commits, in any order", async () => {
    // Page 1 answers last: no page is skipped for a canvas that wasn't there yet.
    const pdf = fakePdfJs(3, (page) => (page === 1 ? 15 : 0));
    show(pdf.load);
    await settle(30);
    expect([...pdf.rendered].sort()).toEqual([1, 2, 3]);
  });

  it("starts no pdf.js task when unmounted while pdf.js loads", async () => {
    let finish: () => void = () => {};
    const getDocument = vi.fn();
    const load = (() =>
      new Promise((resolve) => {
        finish = () => resolve({ getDocument });
      })) as unknown as typeof loadPdfJs;
    const { unmount } = show(load);
    unmount();
    await act(async () => finish());
    expect(getDocument).not.toHaveBeenCalled();
  });

  it("reports a file pdf.js can't read", async () => {
    const onError = vi.fn();
    const load = (async () => ({
      getDocument: () => ({ destroy: vi.fn(), promise: Promise.reject(new Error("bad pdf")) }),
    })) as unknown as typeof loadPdfJs;
    show(load, onError);
    await settle();
    expect(onError).toHaveBeenCalled();
  });
});
