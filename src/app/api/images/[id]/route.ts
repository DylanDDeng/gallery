import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
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
  const body = await request.json();

  const { data, error } = await supabaseAdmin
    .from("images")
    .update({
      url: body.url,
      prompt: body.prompt,
      author: body.author,
      model: body.model,
      category: body.category,
      tags: body.tags,
      width: body.width || null,
      height: body.height || null,
      tweet_url: body.tweet_url || null,
      prompt_zh: body.prompt_zh || null,
      prompt_ja: body.prompt_ja || null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
