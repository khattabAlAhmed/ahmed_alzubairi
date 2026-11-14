import type {
  AttachmentUploadUrlResponse,
  ConsultationDetailResponse,
  CreateConsultationRequest,
  IdResponse,
  SendMessageRequest,
  SignedUrlResponse,
} from "@repo/shared";

/** A failed call, with the server's localized message when it sent one. */
export class ApiError extends Error {
  constructor(readonly serverMessage: string | null) {
    super(serverMessage ?? "request failed");
  }
}

async function errorMessage(response: Response): Promise<string | null> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: unknown } } | null;
  return typeof body?.error?.message === "string" ? body.error.message : null;
}

async function call<T>(fetchImpl: typeof fetch, url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch {
    throw new ApiError(null);
  }
  if (!response.ok) throw new ApiError(await errorMessage(response));
  return (await response.json()) as T;
}

const postJson = <T>(fetchImpl: typeof fetch, url: string, body: unknown) =>
  call<T>(fetchImpl, url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

/** Sends the file to Storage's signed upload URL, reporting progress (0–100). */
export type PutFile = (url: string, file: File, onProgress: (percent: number) => void) => Promise<void>;

/** The form Storage's signed upload takes, as supabase-js sends it. XHR, for progress. */
export const putFile: PutFile = (url, file, onProgress) =>
  new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new ApiError(null)));
    xhr.onerror = () => reject(new ApiError(null));
    xhr.send(form);
  });

export type ConsultationApi = {
  create: (body: CreateConsultationRequest) => Promise<string>;
  /** upload-url → Storage → finalize. Returns the attachment id. */
  upload: (consultationId: string, file: File, onProgress: (percent: number) => void) => Promise<string>;
  sendMessage: (consultationId: string, body: SendMessageRequest) => Promise<string>;
  /** The ids of the files already linked to a message on the consultation. */
  linkedAttachmentIds: (consultationId: string) => Promise<Set<string>>;
  /** A 60-second signed download URL (`GET /api/attachments/:id`). */
  downloadUrl: (attachmentId: string) => Promise<string>;
};

export function consultationApi(fetchImpl: typeof fetch = fetch, put: PutFile = putFile): ConsultationApi {
  return {
    async create(body) {
      return (await postJson<IdResponse>(fetchImpl, "/api/consultations", body)).id;
    },
    async upload(consultationId, file, onProgress) {
      const base = `/api/consultations/${encodeURIComponent(consultationId)}/attachments`;
      const signed = await postJson<AttachmentUploadUrlResponse>(fetchImpl, `${base}/upload-url`, {
        fileName: file.name,
        mime: file.type,
        sizeBytes: file.size,
      });
      await put(signed.url, file, onProgress);
      await postJson(fetchImpl, `${base}/finalize`, { attachmentId: signed.attachmentId });
      return signed.attachmentId;
    },
    async sendMessage(consultationId, body) {
      const url = `/api/consultations/${encodeURIComponent(consultationId)}/messages`;
      return (await postJson<IdResponse>(fetchImpl, url, body)).id;
    },
    async linkedAttachmentIds(consultationId) {
      const url = `/api/consultations/${encodeURIComponent(consultationId)}`;
      const detail = await call<ConsultationDetailResponse>(fetchImpl, url);
      return new Set(detail.attachments.map((file) => file.id));
    },
    async downloadUrl(attachmentId) {
      const url = `/api/attachments/${encodeURIComponent(attachmentId)}`;
      return (await call<SignedUrlResponse>(fetchImpl, url)).url;
    },
  };
}
