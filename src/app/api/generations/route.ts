import { NextResponse } from "next/server";
import { ensureAuth } from "@/lib/auth";
import { decryptApiKey } from "@/lib/api-key-crypto";
import { isBillingEnabled } from "@/lib/billing-feature";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { DoubaoClient } from "@/lib/doubao";

const GENERATION_COST = 1;

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
    const { prompt, model = "doubao-seedream-5-0-260128", size = "2K" } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Get user's API key
    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin
      .from("user_api_keys")
      .select("encrypted_key")
      .eq("user_id", user.id)
      .eq("provider", "doubao")
      .eq("is_active", true)
      .single();

    if (apiKeyError || !apiKeyData) {
      return NextResponse.json(
        { error: "Please configure your Doubao API key in Settings first" },
        { status: 400 }
      );
    }

    const apiKey = decryptApiKey(apiKeyData.encrypted_key);

    // Create generation task
    const { data: task, error: taskError } = await supabaseAdmin
      .from("generation_tasks")
      .insert({
        user_id: user.id,
        prompt: prompt.trim(),
        model,
        status: "processing",
        credits_cost: billingEnabled ? GENERATION_COST : 0,
      })
      .select()
      .single();

    if (taskError) {
      return NextResponse.json(
        { error: taskError.message },
        { status: 500 }
      );
    }

    if (billingEnabled) {
      const { data: deductResult, error: deductError } = await supabaseAdmin.rpc(
        "deduct_credits",
        {
          p_user_id: user.id,
          p_amount: GENERATION_COST,
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
    }

    // Call Doubao API
    const doubaoClient = new DoubaoClient();
    let doubaoResponse;
    try {
      doubaoResponse = await doubaoClient.generate({
        apiKey,
        prompt: prompt.trim(),
        model,
        size,
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
            credits_cost: billingEnabled ? GENERATION_COST : 0,
          },
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
          credits_cost: billingEnabled ? GENERATION_COST : 0,
        },
        downloadUrl: finalUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating generation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
