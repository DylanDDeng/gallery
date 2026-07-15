import { cache } from "react";
import { getAppSecret } from "@/lib/app-secrets";
import {
  createGenerationShareToken,
  readGenerationShareTokenWithSecrets,
} from "@/lib/generation-share-token";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type SharedGeneration = {
  id: string;
  model: string;
  result_url: string;
  created_at: string;
};

async function getGenerationShareSecrets() {
  const secrets = [
    await getAppSecret("GENERATION_SHARE_SECRET"),
    await getAppSecret("SUPABASE_SERVICE_ROLE_KEY"),
  ].filter((secret): secret is string => Boolean(secret));

  if (secrets.length === 0) {
    throw new Error("GENERATION_SHARE_SECRET is not configured");
  }

  return [...new Set(secrets)];
}

export async function signGenerationShare(taskId: string) {
  const [secret] = await getGenerationShareSecrets();
  return createGenerationShareToken(taskId, secret);
}

export const getSharedGeneration = cache(
  async (token: string): Promise<SharedGeneration | null> => {
    const taskId = readGenerationShareTokenWithSecrets(
      token,
      await getGenerationShareSecrets(),
    );

    if (!taskId) {
      return null;
    }

    const { data, error } = await supabaseAdmin
      .from("generation_tasks")
      .select("id, model, result_url, created_at")
      .eq("id", taskId)
      .eq("status", "completed")
      .not("result_url", "is", null)
      .single();

    if (error || !data?.result_url) {
      return null;
    }

    return data as SharedGeneration;
  },
);
