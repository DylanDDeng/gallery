import { NextResponse } from "next/server";
import { ensureAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

    // Can only delete completed or failed tasks
    if (task.status !== "completed" && task.status !== "failed") {
      return NextResponse.json(
        { error: "Cannot delete task in current status" },
        { status: 400 }
      );
    }

    // Delete from storage if it's a completed task with our storage URL
    if (task.status === "completed" && task.result_url && task.result_url.includes("supabase")) {
      try {
        const url = new URL(task.result_url);
        const pathParts = url.pathname.split("/");
        const bucketIndex = pathParts.indexOf("generations");
        if (bucketIndex !== -1) {
          const fileName = pathParts.slice(bucketIndex + 1).join("/");
          await supabaseAdmin.storage.from("generations").remove([fileName]);
        }
      } catch (storageError) {
        console.error("Error deleting from storage:", storageError);
      }
    }

    // Delete the task record
    await supabaseAdmin
      .from("generation_tasks")
      .delete()
      .eq("id", id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting generation task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
