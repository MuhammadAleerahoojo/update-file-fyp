/**
 * Single entry point for the FastAPI captioning backend.
 *
 * The endpoint used to be hardcoded as `http://127.0.0.1:8000/caption` in two
 * components, which meant a deployed build always tried to reach the reviewer's
 * own laptop. It is now configurable via `VITE_AI_API_URL` and falls back to the
 * local dev server so nothing changes for local work.
 */

const AI_BASE_URL = (
  (import.meta.env.VITE_AI_API_URL as string | undefined) || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

import { supabase } from "@/lib/supabase";

/** Model download on a cold server can be slow; beyond this the request is dead. */
const REQUEST_TIMEOUT_MS = 120_000;

export type Modality = "xray" | "ct";

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/** The backend inspected the image and refused to analyse it (wrong type, corrupt, too small…). */
export class InvalidImageError extends Error {
  code: string;
  constructor(message: string, code = "INVALID_IMAGE") {
    super(message);
    this.name = "InvalidImageError";
    this.code = code;
  }
}

/** Error codes that mean "this file is the problem", as opposed to the service. */
const IMAGE_ERROR_CODES = new Set([
  "INVALID_IMAGE",
  "UNSUPPORTED_BODY_REGION",
  "UNSUPPORTED_FORMAT",
  "CORRUPT_IMAGE",
  "IMAGE_TOO_SMALL",
  "FILE_TOO_LARGE",
  "IMAGE_TOO_LARGE",
  "EMPTY_FILE",
]);

/**
 * POST an image to the caption endpoint and return the generated findings.
 *
 * The backend validates that the image really is the selected modality *before*
 * analysing it. Throws:
 *  - `InvalidImageError` when the image was rejected (do not store it),
 *  - `AiUnavailableError` when the service can't be reached or isn't ready,
 *  - a plain `Error` for anything else.
 */
export async function generateCaption(
  file: File,
  modality: Modality,
  signal?: AbortSignal
): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  body.append("modality", modality);

  // The backend can require a Supabase access token (SUPABASE_JWT_SECRET) so
  // anonymous callers can't spend its model/API budget.
  const headers: Record<string, string> = {};
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.access_token) {
    headers.Authorization = `Bearer ${sessionData.session.access_token}`;
  }

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
  const onCallerAbort = () => timeout.abort();
  signal?.addEventListener("abort", onCallerAbort);

  let response: Response;
  try {
    response = await fetch(`${AI_BASE_URL}/caption`, {
      method: "POST",
      body,
      headers,
      signal: timeout.signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    if ((err as Error)?.name === "AbortError") {
      throw new AiUnavailableError("The AI analysis service took too long to respond. Please try again.");
    }
    throw new AiUnavailableError(
      `Could not reach the AI analysis service at ${AI_BASE_URL}. Make sure it is running, or set VITE_AI_API_URL.`
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const code = typeof payload?.code === "string" ? payload.code : "";
    const message =
      typeof payload?.message === "string" && payload.message
        ? payload.message
        : `AI analysis failed (${response.status})`;
    if (IMAGE_ERROR_CODES.has(code)) throw new InvalidImageError(message, code);
    if (response.status === 401) {
      throw new AiUnavailableError("Your session has expired. Sign in again to analyse scans.");
    }
    if (response.status === 503) throw new AiUnavailableError(message);
    throw new Error(message);
  }

  const data = await response.json().catch(() => ({}));
  const caption = typeof data?.caption === "string" ? data.caption.trim() : "";
  if (!caption) throw new Error("The AI service returned an empty result.");
  return caption;
}
