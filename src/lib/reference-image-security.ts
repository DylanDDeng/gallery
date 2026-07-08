import {
  getGenerationsStoragePublicPrefix,
  isUserOwnedStorageUrl,
  pickTrustedReferenceUrl,
} from "@/lib/reference-image-url";
import { supabaseAdmin } from "@/lib/supabase-admin";

export {
  getGenerationsStoragePublicPrefix,
  isUserOwnedStorageUrl,
  pickTrustedReferenceUrl,
} from "@/lib/reference-image-url";

export const MAX_REFERENCE_IMAGE_BYTES = 15 * 1024 * 1024;

async function resolveUrlFromImageId(sourceImageId: string) {
  const { data, error } = await supabaseAdmin
    .from("images")
    .select("url")
    .eq("id", sourceImageId)
    .single();

  if (error || !data?.url) {
    return null;
  }

  return data.url.trim();
}

export async function resolveTrustedReferenceImageUrl(
  userId: string,
  options: {
    sourceImageId?: string | null;
    sourceImageUrl?: string | null;
  }
) {
  const normalizedSourceImageId =
    typeof options.sourceImageId === "string" && options.sourceImageId.trim().length > 0
      ? options.sourceImageId.trim()
      : null;
  const normalizedSourceImageUrl =
    typeof options.sourceImageUrl === "string" && options.sourceImageUrl.trim().length > 0
      ? options.sourceImageUrl.trim()
      : null;

  const catalogUrl = normalizedSourceImageId
    ? await resolveUrlFromImageId(normalizedSourceImageId)
    : null;

  if (normalizedSourceImageId && !catalogUrl) {
    return { url: null, error: "Source image not found" as const };
  }

  return pickTrustedReferenceUrl(userId, normalizedSourceImageUrl, catalogUrl);
}
