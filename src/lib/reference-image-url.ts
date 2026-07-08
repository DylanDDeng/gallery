const STORAGE_BUCKET = "generations";

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function getGenerationsStoragePublicPrefix() {
  const supabaseUrl = getSupabaseUrl()?.replace(/\/$/, "");
  if (!supabaseUrl) {
    return null;
  }

  return `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/`;
}

export function isUserOwnedStorageUrl(url: string, userId: string) {
  const prefix = getGenerationsStoragePublicPrefix();
  if (!prefix) {
    return false;
  }

  if (!url.startsWith(prefix)) {
    return false;
  }

  const objectPath = url.slice(prefix.length);
  return objectPath.startsWith(`${userId}/`);
}

export function pickTrustedReferenceUrl(
  userId: string,
  sourceImageUrl: string | null,
  catalogUrl: string | null
) {
  if (sourceImageUrl && isUserOwnedStorageUrl(sourceImageUrl, userId)) {
    return { url: sourceImageUrl, error: null as string | null };
  }

  if (catalogUrl) {
    if (!sourceImageUrl || sourceImageUrl === catalogUrl) {
      return { url: catalogUrl, error: null };
    }

    return {
      url: null,
      error: "Reference image must use your uploaded or generated images",
    };
  }

  if (!sourceImageUrl) {
    return { url: null, error: null };
  }

  return {
    url: null,
    error: "Reference image must use your uploaded or generated images",
  };
}
