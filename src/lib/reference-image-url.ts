import { getServerEnv } from "./server-env";

const STORAGE_BUCKET = "generations";

export function getGenerationsStoragePublicPrefix() {
  const supabaseUrl = getServerEnv("NEXT_PUBLIC_SUPABASE_URL")?.replace(/\/$/, "");
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
