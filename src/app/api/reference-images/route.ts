import { NextResponse } from "next/server";
import { ensureAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const STORAGE_BUCKET = "generations";
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export async function POST(request: Request) {
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    return user;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Reference image file is required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Please upload a PNG, JPEG, WEBP, or GIF image." },
        { status: 400 }
      );
    }

    const extension = file.name.includes(".")
      ? file.name.split(".").pop()?.toLowerCase() || "png"
      : "png";
    const filePath = `${user.id}/reference-images/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Reference image upload error:", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Failed to upload reference image" },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    return NextResponse.json({
      url: publicUrlData.publicUrl,
      path: filePath,
    });
  } catch (error) {
    console.error("Reference image upload exception:", error);
    return NextResponse.json(
      { error: "Failed to upload reference image" },
      { status: 500 }
    );
  }
}
