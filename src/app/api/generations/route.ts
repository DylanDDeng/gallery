import { NextResponse } from "next/server";
import { ensureAuth } from "@/lib/auth";
import { getAppSecret } from "@/lib/app-secrets";
import { isBillingEnabled } from "@/lib/billing-feature";
import { DoubaoClient } from "@/lib/doubao";
import {
  getOutputSize,
  type AspectRatio,
  type OutputResolution,
} from "@/lib/generation-size-options";
import {
  DEFAULT_MODEL_ID,
  getDefaultTierId,
  getGenerationCreditsCost,
  getSeedreamResolutionFromTier,
  isSupportedModelId,
  resolveModelTier,
} from "@/lib/model-pricing";
import { resolveTrustedReferenceImageUrl } from "@/lib/reference-image-security";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ZenMuxClient, type ZenMuxQuality } from "@/lib/zenmux";

export const maxDuration = 300;

const CREDITS_DEBUG_PREFIX = "[credits-debug]";
const STORAGE_BUCKET = "generations";

async function markTaskFailed(taskId: string, errorMessage: string) {
  await supabaseAdmin
    .from("generation_tasks")
    .update({
      status: "failed",
      error_message: errorMessage,
    })
    .eq("id", taskId);
}

async function refundFailedGeneration(
  userId: string,
  taskId: string,
  errorMessage: string
) {
  const { error } = await supabaseAdmin.rpc("fail_generation_task_and_refund", {
    p_user_id: userId,
    p_task_id: taskId,
    p_error_message: errorMessage,
  });

  if (error) {
    console.error("Error refunding failed generation:", error);
    await markTaskFailed(taskId, errorMessage);
  }
}

async function uploadGeneratedImage(
  userId: string,
  taskId: string,
  imageBuffer: ArrayBuffer
) {
  const fileName = `${userId}/${taskId}-${Date.now()}.png`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, imageBuffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload generated image: ${uploadError.message}`);
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

async function completeGenerationTask(
  taskId: string,
  finalUrl: string,
  generationCost: number
) {
  await supabaseAdmin
    .from("generation_tasks")
    .update({
      status: "completed",
      result_url: finalUrl,
    })
    .eq("id", taskId);

  return finalUrl;
}

function normalizeAspectRatio(value: unknown): AspectRatio {
  const allowed: AspectRatio[] = [
    "1:1",
    "3:4",
    "4:3",
    "16:9",
    "9:16",
    "3:2",
    "2:3",
    "21:9",
  ];

  if (typeof value === "string" && allowed.includes(value as AspectRatio)) {
    return value as AspectRatio;
  }

  return "1:1";
}

function resolveTierFromRequest(
  modelId: string,
  tierId: unknown,
  resolution: unknown
) {
  const normalizedTierId =
    typeof tierId === "string" && tierId.trim().length > 0
      ? tierId.trim()
      : typeof resolution === "string" && resolution.trim().length > 0
        ? resolution.trim()
        : getDefaultTierId(modelId);

  const tier = resolveModelTier(modelId, normalizedTierId);
  if (!tier) {
    return null;
  }

  return { tier, tierId: normalizedTierId };
}

export async function GET(request: Request) {
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    return user;
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const sourceImageId = searchParams.get("sourceImageId");
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20"), 1), 50);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

    let query = supabaseAdmin
      .from("generation_tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (sourceImageId) {
      query = query.eq("source_image_id", sourceImageId);
    }

    const { data: tasks, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const hasMore = tasks && tasks.length > limit;
    const results = hasMore ? tasks.slice(0, limit) : (tasks || []);

    return NextResponse.json({ data: results, hasMore });
  } catch (error) {
    console.error("Error fetching generations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    return user;
  }

  try {
    const billingEnabled = isBillingEnabled();
    const body = await request.json();
    const {
      prompt,
      model = DEFAULT_MODEL_ID,
      tierId,
      resolution,
      aspectRatio,
      sourceImageId,
      sourceImageUrl,
    } = body;

    const normalizedModel =
      typeof model === "string" && isSupportedModelId(model) ? model : DEFAULT_MODEL_ID;
    const resolvedTier = resolveTierFromRequest(normalizedModel, tierId, resolution);

    if (!resolvedTier) {
      return NextResponse.json(
        { error: "Invalid generation tier for the selected model" },
        { status: 400 }
      );
    }

    const generationCost = billingEnabled
      ? getGenerationCreditsCost(normalizedModel, resolvedTier.tierId) ?? 0
      : 0;

    if (billingEnabled && generationCost <= 0) {
      return NextResponse.json(
        { error: "Invalid generation tier for the selected model" },
        { status: 400 }
      );
    }

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const normalizedSourceImageId =
      typeof sourceImageId === "string" && sourceImageId.trim().length > 0
        ? sourceImageId.trim()
        : null;
    const requestedSourceImageUrl =
      typeof sourceImageUrl === "string" && sourceImageUrl.trim().length > 0
        ? sourceImageUrl.trim()
        : null;

    const trustedReference = await resolveTrustedReferenceImageUrl(user.id, {
      sourceImageId: normalizedSourceImageId,
      sourceImageUrl: requestedSourceImageUrl,
    });

    if (trustedReference.error) {
      return NextResponse.json({ error: trustedReference.error }, { status: 400 });
    }

    const resolvedSourceImageUrl = trustedReference.url;

    const providerParams = resolvedTier.tier.providerParams;

    const provider = normalizedModel === "openai/gpt-image-2" ? "zenmux" : "doubao";
    const providerApiKey = await getAppSecret(
      provider === "zenmux" ? "ZENMUX_API_KEY" : "DOUBAO_API_KEY"
    );

    if (!providerApiKey) {
      return NextResponse.json(
        { error: "Generation service is not configured" },
        { status: 500 }
      );
    }

    const { data: task, error: taskError } = await supabaseAdmin
      .from("generation_tasks")
      .insert({
        user_id: user.id,
        prompt: prompt.trim(),
        model: normalizedModel,
        source_image_id: normalizedSourceImageId,
        status: "processing",
        credits_cost: generationCost,
      })
      .select()
      .single();

    if (taskError) {
      return NextResponse.json(
        { error: taskError.message },
        { status: 500 }
      );
    }

    let remainingCredits: number | null = null;

    if (billingEnabled) {
      const { data: deductResult, error: deductError } = await supabaseAdmin.rpc(
        "deduct_credits",
        {
          p_user_id: user.id,
          p_amount: generationCost,
          p_task_id: task.id,
        }
      );

      if (deductError) {
        console.error("Error deducting credits:", deductError);
        await markTaskFailed(task.id, "Failed to deduct credits");

        return NextResponse.json(
          { error: "Failed to deduct credits" },
          { status: 500 }
        );
      }

      if (!deductResult) {
        await supabaseAdmin.from("generation_tasks").delete().eq("id", task.id);

        return NextResponse.json(
          { error: "Insufficient credits" },
          { status: 402 }
        );
      }

      const { data: profileAfterDeduction, error: profileAfterDeductionError } =
        await supabaseAdmin
          .from("profiles")
          .select("credits")
          .eq("id", user.id)
          .single();

      if (profileAfterDeductionError) {
        console.warn(
          "Error fetching credits after deduction:",
          profileAfterDeductionError
        );
      } else {
        remainingCredits = profileAfterDeduction?.credits ?? null;
      }

      console.info(CREDITS_DEBUG_PREFIX, "api/generations:deducted", {
        userId: user.id,
        taskId: task.id,
        remainingCredits,
      });
    }

    let imageBuffer: ArrayBuffer;

    try {
      if (provider === "zenmux") {
        const quality = providerParams.quality as ZenMuxQuality;
        const size = providerParams.size;
        const zenMuxClient = new ZenMuxClient();
        const zenMuxResult = resolvedSourceImageUrl
          ? await zenMuxClient.edit({
              apiKey: providerApiKey,
              prompt: prompt.trim(),
              size,
              quality,
              imageUrls: [resolvedSourceImageUrl],
            })
          : await zenMuxClient.generate({
              apiKey: providerApiKey,
              prompt: prompt.trim(),
              size,
              quality,
            });

        imageBuffer = zenMuxResult.buffer;
      } else {
        const seedreamResolution = getSeedreamResolutionFromTier(
          resolvedTier.tierId
        ) as OutputResolution;
        const normalizedAspectRatio = normalizeAspectRatio(aspectRatio);
        const outputSize = getOutputSize(seedreamResolution, normalizedAspectRatio);
        const doubaoClient = new DoubaoClient();
        const doubaoResponse = await doubaoClient.generate({
          apiKey: providerApiKey,
          prompt: prompt.trim(),
          model: normalizedModel,
          size: outputSize.size,
          image: resolvedSourceImageUrl || undefined,
          outputFormat: "png",
          watermark: false,
        });

        const imageUrl = doubaoResponse.data[0]?.url;
        if (!imageUrl) {
          throw new Error("No image URL in response");
        }

        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download image: ${imageResponse.status}`);
        }

        imageBuffer = await imageResponse.arrayBuffer();
      }
    } catch (apiError) {
      console.error("Generation API error:", apiError);
      const errorMessage =
        apiError instanceof Error ? apiError.message : "API call failed";
      if (billingEnabled) {
        await refundFailedGeneration(user.id, task.id, errorMessage);
      } else {
        await markTaskFailed(task.id, errorMessage);
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    let finalUrl: string;
    try {
      finalUrl = await uploadGeneratedImage(user.id, task.id, imageBuffer);
    } catch (uploadError) {
      console.error("Storage upload error:", uploadError);
      const errorMessage =
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to upload generated image";
      if (billingEnabled) {
        await refundFailedGeneration(user.id, task.id, errorMessage);
      } else {
        await markTaskFailed(task.id, errorMessage);
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    await completeGenerationTask(task.id, finalUrl, generationCost);

    return NextResponse.json(
      {
        task: {
          ...task,
          status: "completed",
          result_url: finalUrl,
          credits_cost: generationCost,
        },
        downloadUrl: finalUrl,
        remainingCredits,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(CREDITS_DEBUG_PREFIX, "api/generations:exception", error);
    console.error("Error creating generation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
