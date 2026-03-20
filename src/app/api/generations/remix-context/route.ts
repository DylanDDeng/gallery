import { NextResponse } from "next/server";
import { ensureAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    return user;
  }

  try {
    const { searchParams } = new URL(request.url);
    const sourceImageId = searchParams.get("sourceImageId");

    if (!sourceImageId) {
      return NextResponse.json(
        { error: "sourceImageId is required" },
        { status: 400 }
      );
    }

    const [imageResult, tasksResult] = await Promise.all([
      supabaseAdmin
        .from("images")
        .select("*")
        .eq("id", sourceImageId)
        .single(),
      supabaseAdmin
        .from("generation_tasks")
        .select("*")
        .eq("user_id", user.id)
        .eq("source_image_id", sourceImageId)
        .eq("status", "completed")
        .order("created_at", { ascending: true })
        .limit(20),
    ]);

    if (imageResult.error) {
      const status = imageResult.error.code === "PGRST116" ? 404 : 500;
      return NextResponse.json(
        { error: imageResult.error.message },
        { status }
      );
    }

    if (tasksResult.error) {
      return NextResponse.json(
        { error: tasksResult.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sourceImage: imageResult.data,
      tasks: tasksResult.data || [],
    });
  } catch (error) {
    console.error("Error loading remix context:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
