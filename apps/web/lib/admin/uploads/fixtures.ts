/** Small real files for the upload tests. No client data. */

/** A valid 1×1 grey PNG. */
export const PNG_BYTES = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

const text = (value: string) => new TextEncoder().encode(value);

/** A minimal one-page PDF. */
export const PDF_BYTES = text(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF\n",
);

/** The start of a Windows program: the bytes of an `.exe` renamed `.pdf`. */
export const EXE_BYTES = (() => {
  const bytes = new Uint8Array(512);
  bytes.set(text("MZ"), 0);
  return bytes;
})();

/** An SVG, which can carry script and is never allowed. */
export const SVG_BYTES = text(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
);

export function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}
