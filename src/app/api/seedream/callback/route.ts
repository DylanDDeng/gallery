import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Seedream callback endpoint
// This handles async notifications from Seedream when a task completes

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { task_id, status, result_url, error_message } = body;

    if (!task_id) {
      return NextResponse.json(
        { error: "Missing task_id" },
        { status: 400 }
      );
    }

    // Find the generation task by Seedream task ID
    const { data: task, error: findError } = await supabaseAdmin
      .from("generation_tasks")
      .select("*")
      .eq("seedream_task_id", task_id)
      .single();

    if (findError || !task) {
      console.error("Task not found for Seedream callback:", task_id);
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Update task based on Seedream status
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    switch (status) {
      case "completed":
        updates.status = "completed";
        updates.result_url = result_url;
        break;

      case "failed":
        updates.status = "failed";
        updates.error_message = error_message || "Generation failed";

        // Refund credits for failed tasks
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("credits")
          .eq("id", task.user_id)
          .single();

        const newBalance = (profile?.credits ?? 0) + task.credits_cost;

        await supabaseAdmin
          .from("profiles")
          .update({ credits: newBalance })
          .eq("id", task.user_id);

        await supabaseAdmin.from("credit_transactions").insert({
          user_id: task.user_id,
          type: "refund",
          amount: task.credits_cost,
          balance_after: newBalance,
          generation_task_id: task.id,
          description: `Refunded ${task.credits_cost} credits for failed task`,
        });
        break;

      case "processing":
        updates.status = "processing";
        break;

      default:
        console.log("Unknown Seedream status:", status);
    }

    const { error: updateError } = await supabaseAdmin
      .from("generation_tasks")
      .update(updates)
      .eq("id", task.id);

    if (updateError) {
      console.error("Error updating task:", updateError);
      return NextResponse.json(
        { error: "Failed to update task" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing Seedream callback:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
