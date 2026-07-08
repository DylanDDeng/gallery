import { getGenerationsStoragePublicPrefix, isUserOwnedStorageUrl } from "@/lib/reference-image-url";
import { supabaseAdmin } from "@/lib/supabase-admin";

export { getGenerationsStoragePublicPrefix, isUserOwnedStorageUrl } from "@/lib/reference-image-url";

export const MAX_REFERENCE_IMAGE_BYTES = 15 * 1024 * 1024;

async function isUserGenerationResultUrl(url: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("generation_tasks")
    .select("id")
    .eq("user_id", userId)
    .eq("result_url", url)
    .eq("status", "completed")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error validating generation result URL:", error);
    return false;
  }

  return Boolean(data?.id);
}

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

  if (normalizedSourceImageId) {
    const imageUrl = await resolveUrlFromImageId(normalizedSourceImageId);
    if (!imageUrl) {
      return { url: null, error: "Source image not found" as const };
    }

    if (
      normalizedSourceImageUrl &&
      normalizedSourceImageUrl !== imageUrl &&
      !isUserOwnedStorageUrl(normalizedSourceImageUrl, userId)
    ) {
      return { url: null, error: "Source image URL does not match source image" as const };
    }

    return { url: imageUrl, error: null };
  }

  if (!normalizedSourceImageUrl) {
    return { url: null, error: null };
  }

  if (isUserOwnedStorageUrl(normalizedSourceImageUrl, userId)) {
    return { url: normalizedSourceImageUrl, error: null };
  }

  if (await isUserGenerationResultUrl(normalizedSourceImageUrl, userId)) {
    return { url: normalizedSourceImageUrl, error: null };
  }

  return { url: null, error: "Reference image must use your uploaded or generated images" as const };
}
