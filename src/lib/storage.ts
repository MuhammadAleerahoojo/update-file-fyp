import { supabase } from "@/lib/supabase";
import { randomId } from "@/lib/utils";

const BUCKET = "xrays";

export const MAX_SCAN_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_SCAN_TYPES = ["image/jpeg", "image/png", "image/webp"];

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Returns a user-facing error for a file we won't accept, or null if it is fine. */
export function validateScanFile(file: File): string | null {
  if (!ACCEPTED_SCAN_TYPES.includes(file.type)) return "Upload a JPG, PNG or WebP image.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_SCAN_BYTES) return "That file is larger than 10 MB.";
  return null;
}

export type UploadedScan = {
  url: string | null;
  /** Remove the object again, e.g. when saving the report row fails. Never throws. */
  discard: () => Promise<void>;
};

/**
 * Upload a scan under `folder/` in the xrays bucket.
 *
 * The extension comes from the (already validated) MIME type rather than the
 * file name, which can be missing or arbitrary. Callers get a `discard`
 * handle so a failed follow-up insert doesn't leave an orphaned image behind.
 */
export async function uploadScan(file: File, folder: string): Promise<UploadedScan> {
  const extension = EXTENSION_BY_TYPE[file.type] ?? "png";
  const path = `${folder}/${Date.now()}-${randomId()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  return {
    url: supabase.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl ?? null,
    discard: async () => {
      try {
        await supabase.storage.from(BUCKET).remove([path]);
      } catch {
        /* best effort */
      }
    },
  };
}
