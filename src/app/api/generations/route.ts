import { NextResponse } from "next/server";
import { ensureAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { seedreamClient } from "@/lib/seedream";

// Default credits cost per generation
const GENERATION_COST = 1;

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
    const body = await request.json();
    const { prompt, model = "seedream" } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Check user credits
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: "Failed to check credits" },
        { status: 500 }
      );
    }

    const currentCredits = profile?.credits ?? 0;

    if (currentCredits < GENERATION_COST) {
      return NextResponse.json(
        { error: "Insufficient credits", credits: currentCredits },
        { status: 402 }
      );
    }

    // Create generation task
    const { data: task, error: taskError } = await supabaseAdmin
      .from("generation_tasks")
      .insert({
        user_id: user.id,
        prompt: prompt.trim(),
        model,
        status: "queued",
        credits_cost: GENERATION_COST,
      })
      .select()
      .single();

    if (taskError) {
      return NextResponse.json(
        { error: taskError.message },
        { status: 500 }
      );
    }

    // Deduct credits atomically
    const { error: deductError } = await supabaseAdmin.rpc("deduct_credits", {
      p_user_id: user.id,
      p_amount: GENERATION_COST,
      p_task_id: task.id,
    });

    // If RPC fails, mark task as failed and delete
    if (deductError) {
      console.error("Error deducting credits:", deductError);
      await supabaseAdmin
        .from("generation_tasks")
        .update({ status: "failed", error_message: "Failed to deduct credits" })
        .eq("id", task.id);

      return NextResponse.json(
        { error: "Failed to deduct credits" },
        { status: 500 }
      );
    }

    // Submit to Seedream API (fire and forget)
    try {
      const seedreamResponse = await seedreamClient.generate({
        prompt: prompt.trim(),
        model,
      });

      // Update task with Seedream task ID
      await supabaseAdmin
        .from("generation_tasks")
        .update({
          seedream_task_id: seedreamResponse.task_id,
          status: "processing",
        })
        .eq("id", task.id);
    } catch (apiError) {
      console.error("Seedream API error:", apiError);
      // Don't fail the task - we can retry or handle manually
      // The task remains in "queued" status for potential retry
    }

    return NextResponse.json(
      { task, creditsRemaining: currentCredits - GENERATION_COST },
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
