import { supabaseAdmin } from "@/lib/supabase-admin";
import { getServerEnv } from "@/lib/server-env";

const cache = new Map<string, { value: string | undefined; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

export async function getAppSecret(name: string) {
  const envValue = getServerEnv(name);
  if (envValue) {
    return envValue;
  }

  const now = Date.now();
  const cached = cache.get(name);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const { data, error } = await supabaseAdmin
    .from("app_secrets")
    .select("value")
    .eq("key", name)
    .single();

  if (error || !data) {
    cache.set(name, { value: undefined, expiresAt: now + CACHE_TTL_MS });
    return undefined;
  }

  cache.set(name, { value: data.value, expiresAt: now + CACHE_TTL_MS });
  return data.value;
}

export async function getFirstAppSecret(names: string[]) {
  for (const name of names) {
    const value = await getAppSecret(name);
    if (value) {
      return value;
    }
  }

  return undefined;
}

export async function listAppSecretKeys() {
  const { data } = await supabaseAdmin
    .from("app_secrets")
    .select("key")
    .order("key", { ascending: true });

  return (data ?? []).map((row) => row.key);
}
