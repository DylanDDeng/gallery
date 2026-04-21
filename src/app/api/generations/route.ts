import { NextResponse } from "next/server";
import { ensureAuth } from "@/lib/auth";
import { getAppSecret } from "@/lib/app-secrets";
import { isBillingEnabled } from "@/lib/billing-feature";
import type { OutputResolution } from "@/lib/generation-size-options";
import {
  DEFAULT_MODEL_ID,
  getGenerationCreditsCost,
  isSupportedModelId,
} from "@/lib/model-pricing";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { DoubaoClient } from "@/lib/doubao";
const CREDITS_DEBUG_PREFIX = "[credits-debug]";

// Storage bucket name
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
      size = "2K",
      resolution,
      sourceImageId,
      sourceImageUrl,
    } = body;
    const normalizedModel =
      typeof model === "string" && isSupportedModelId(model) ? model : DEFAULT_MODEL_ID;
    const normalizedResolution: OutputResolution =
      resolution === "3K" ? "3K" : "2K";
    const generationCost = billingEnabled
      ? getGenerationCreditsCost(normalizedModel, normalizedResolution)
      : 0;

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
    let resolvedSourceImageUrl =
      typeof sourceImageUrl === "string" && sourceImageUrl.trim().length > 0
        ? sourceImageUrl.trim()
        : null;

    if (normalizedSourceImageId && !resolvedSourceImageUrl) {
      const { data: sourceImage, error: sourceImageError } = await supabaseAdmin
        .from("images")
        .select("url")
        .eq("id", normalizedSourceImageId)
        .single();

      if (sourceImageError || !sourceImage?.url) {
        return NextResponse.json(
          { error: "Source image not found" },
          { status: 400 }
        );
      }

      resolvedSourceImageUrl = sourceImage.url;
    }

    const configuredApiKey = await getAppSecret("DOUBAO_API_KEY");

    if (!configuredApiKey) {
      return NextResponse.json(
        { error: "Generation service is not configured" },
        { status: 500 }
      );
    }

    const apiKey = configuredApiKey;

    // Create generation task
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

    // Call Doubao API
    const doubaoClient = new DoubaoClient();
    let doubaoResponse;
    try {
      doubaoResponse = await doubaoClient.generate({
        apiKey,
        prompt: prompt.trim(),
        model: normalizedModel,
        size,
        image: resolvedSourceImageUrl || undefined,
        outputFormat: "png",
        watermark: false,
      });
    } catch (apiError) {
      console.error("Doubao API error:", apiError);
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

    // Download image from Doubao response
    const imageUrl = doubaoResponse.data[0]?.url;
    if (!imageUrl) {
      if (billingEnabled) {
        await refundFailedGeneration(user.id, task.id, "No image URL in response");
      } else {
        await markTaskFailed(task.id, "No image URL in response");
      }

      return NextResponse.json(
        { error: "No image URL in Doubao response" },
        { status: 500 }
      );
    }

    // Download the image
    let imageBuffer: ArrayBuffer;
    try {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.status}`);
      }
      imageBuffer = await imageResponse.arrayBuffer();
    } catch (downloadError) {
      console.error("Image download error:", downloadError);
      if (billingEnabled) {
        await refundFailedGeneration(
          user.id,
          task.id,
          "Failed to download generated image"
        );
      } else {
        await markTaskFailed(task.id, "Failed to download generated image");
      }

      return NextResponse.json(
        { error: "Failed to download generated image" },
        { status: 500 }
      );
    }

    // Upload to Supabase Storage
    const fileName = `${user.id}/${task.id}-${Date.now()}.png`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, imageBuffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      // Fall back to using the original Doubao URL
      await supabaseAdmin
        .from("generation_tasks")
        .update({
          status: "completed",
          result_url: imageUrl,
        })
        .eq("id", task.id);

      return NextResponse.json(
        {
          task: {
            ...task,
            status: "completed",
            result_url: imageUrl,
            credits_cost: generationCost,
          },
          remainingCredits,
        },
        { status: 201 }
      );
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    const finalUrl = urlData.publicUrl;

    // Update task with result
    await supabaseAdmin
      .from("generation_tasks")
      .update({
        status: "completed",
        result_url: finalUrl,
      })
      .eq("id", task.id);

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
