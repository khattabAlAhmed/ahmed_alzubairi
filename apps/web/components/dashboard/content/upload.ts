import type { UploadTarget } from "@repo/shared";

/** An upload that failed, with the server's localized message when it sent one. */
export class UploadError extends Error {
  constructor(readonly serverMessage: string | null) {
    super(serverMessage ?? "upload failed");
  }
}

async function errorMessage(response: Response): Promise<string | null> {
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: unknown };
  } | null;
  return typeof body?.error?.message === "string" ? body.error.message : null;
}

async function postJson(
  fetchImpl: typeof fetch,
  url: string,
  body: unknown,
): Promise<unknown> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new UploadError(await errorMessage(response));
  return response.json();
}

/**
 * Uploads a file through the admin upload routes and returns the key the
 * content body stores: ask for a signed URL, send the file to Storage, then
 * let the server check its real type and size.
 */
export async function uploadFile(
  file: File,
  target: UploadTarget,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const signed = (await postJson(fetchImpl, "/api/admin/uploads/upload-url", {
    target,
    fileName: file.name,
    mime: file.type,
    sizeBytes: file.size,
  })) as { url: string; key: string };

  // The form Storage's signed upload takes, as supabase-js sends it.
  const form = new FormData();
  form.append("cacheControl", "3600");
  form.append("", file);
  const put = await fetchImpl(signed.url, { method: "PUT", body: form });
  if (!put.ok) throw new UploadError(null);

  const finalized = (await postJson(fetchImpl, "/api/admin/uploads/finalize", {
    target,
    key: signed.key,
  })) as { key: string };
  return finalized.key;
}

/** The file types a picker offers. Images only for image fields. */
export const IMAGE_ACCEPT = "image/jpeg,image/png";

export function acceptFor(target: UploadTarget, image: boolean): string {
  if (image) return IMAGE_ACCEPT;
  if (target === "resource") return ".pdf,.docx,.xlsx";
  return "application/pdf,image/jpeg,image/png";
}

/** The public URL of a `public-media` key, for previews. */
export function mediaUrl(base: string, key: string): string {
  return `${base}${key.split("/").map(encodeURIComponent).join("/")}`;
}
