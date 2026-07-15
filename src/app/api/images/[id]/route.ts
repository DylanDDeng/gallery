import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import {
  CosImageMetadataError,
  resolveCosImageDimensions,
} from "@/lib/cos-image-metadata";
import {
  ImageWriteConflictError,
  ImageWriteNotFoundError,
  ImageWriteValidationError,
  updateImageRecord,
  type ImageWriteBody,
} from "@/lib/image-write-service";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClient as createServerClient } from "@/lib/supabase-server";

async function ensureAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("images")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    const status = error.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await ensureAdmin();
  if (authError) return authError;

  const { id } = await params;

  const { error } = await supabaseAdmin.from("images").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await ensureAdmin();
  if (authError) return authError;

  const { id } = await params;
  const body = (await request.json()) as ImageWriteBody;

  try {
    const data = await updateImageRecord(id, body, {
      resolveDimensions: resolveCosImageDimensions,
      findById: async (imageId) => {
        const { data, error } = await supabaseAdmin
          .from("images")
          .select("id,url,width,height")
          .eq("id", imageId)
          .maybeSingle();

        if (error) throw new Error("Image lookup failed");
        return data;
      },
      updateIfCurrentUrl: async (imageId, originalUrl, mutation) => {
        const { data, error } = await supabaseAdmin
          .from("images")
          .update(mutation)
          .eq("id", imageId)
          .eq("url", originalUrl)
          .select()
          .maybeSingle();

        if (error) throw new Error("Image update failed");
        return data;
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ImageWriteValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ImageWriteNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ImageWriteConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof CosImageMetadataError) {
      const status = error.code === "INVALID_URL" ? 400 : 422;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json(
      { error: "Unable to update image" },
      { status: 500 }
    );
  }
}
