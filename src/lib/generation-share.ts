import { cache } from "react";
import { getFirstAppSecret } from "@/lib/app-secrets";
import {
  createGenerationShareToken,
  readGenerationShareToken,
} from "@/lib/generation-share-token";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type SharedGeneration = {
  id: string;
  model: string;
  result_url: string;
  created_at: string;
};

async function getGenerationShareSecret() {
  const secret = await getFirstAppSecret([
    "GENERATION_SHARE_SECRET",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);

  if (!secret) {
    throw new Error("GENERATION_SHARE_SECRET is not configured");
  }

  return secret;
}

export async function signGenerationShare(taskId: string) {
  return createGenerationShareToken(taskId, await getGenerationShareSecret());
}

export const getSharedGeneration = cache(
  async (token: string): Promise<SharedGeneration | null> => {
    const taskId = readGenerationShareToken(
      token,
      await getGenerationShareSecret(),
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
