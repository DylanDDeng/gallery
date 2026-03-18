import { NextResponse } from "next/server";
import { ensureAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { seedreamClient } from "@/lib/seedream";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    return user;
  }

  const { id } = await params;

  try {
    const { data: task, error } = await supabaseAdmin
      .from("generation_tasks")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If task is still processing, check Seedream status
    if (task.status === "processing" && task.seedream_task_id) {
      try {
        const seedreamStatus = await seedreamClient.getTaskStatus(
          task.seedream_task_id
        );

        if (seedreamStatus.status === "completed" && seedreamStatus.result_url) {
          // Update task with result
          await supabaseAdmin
            .from("generation_tasks")
            .update({
              status: "completed",
              result_url: seedreamStatus.result_url,
            })
            .eq("id", task.id);

          task.status = "completed";
          task.result_url = seedreamStatus.result_url;
        } else if (seedreamStatus.status === "failed") {
          await supabaseAdmin
            .from("generation_tasks")
            .update({
              status: "failed",
              error_message: seedreamStatus.error_message,
            })
            .eq("id", task.id);

          task.status = "failed";
          task.error_message = seedreamStatus.error_message;
        }
      } catch (apiError) {
        console.error("Error checking Seedream status:", apiError);
      }
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error("Error fetching generation task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    return user;
  }

  const { id } = await params;

  try {
    // Get task to check ownership and status
    const { data: task, error } = await supabaseAdmin
      .from("generation_tasks")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Can only cancel queued or processing tasks
    if (task.status !== "queued" && task.status !== "processing") {
      return NextResponse.json(
        { error: "Cannot cancel task in current status" },
        { status: 400 }
      );
    }

    // Cancel on Seedream if processing
    if (task.status === "processing" && task.seedream_task_id) {
      try {
        await seedreamClient.cancelTask(task.seedream_task_id);
      } catch (apiError) {
        console.error("Error cancelling Seedream task:", apiError);
      }
    }

    // Refund credits
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .single();

    const newBalance = (profile?.credits ?? 0) + task.credits_cost;

    await supabaseAdmin
      .from("profiles")
      .update({ credits: newBalance })
      .eq("id", user.id);

    // Create refund transaction
    await supabaseAdmin.from("credit_transactions").insert({
      user_id: user.id,
      type: "refund",
      amount: task.credits_cost,
      balance_after: newBalance,
      generation_task_id: task.id,
      description: `Refunded ${task.credits_cost} credits for cancelled task`,
    });

    // Update task status
    await supabaseAdmin
      .from("generation_tasks")
      .update({ status: "cancelled" })
      .eq("id", id);

    return NextResponse.json({ success: true, creditsRefunded: task.credits_cost });
  } catch (error) {
    console.error("Error cancelling generation task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
