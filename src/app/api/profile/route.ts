import { NextResponse } from "next/server";
import { ensureAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const PROFILE_SELECT =
  "id,email,name,avatar_url,credits,created_at,updated_at";

export async function GET() {
  const user = await ensureAuth();
  if (user instanceof NextResponse) return user;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

export async function PATCH(request: Request) {
  const user = await ensureAuth();
  if (user instanceof NextResponse) return user;

  const body = (await request.json()) as { name?: unknown };
  if (typeof body.name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const name = body.name.trim();
  if (!name || name.length > 50) {
    return NextResponse.json(
      { error: "Name must be between 1 and 50 characters" },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ name })
    .eq("id", user.id)
    .select(PROFILE_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    {
      user_metadata: {
        ...user.user_metadata,
        name,
      },
    },
  );

  if (authError) {
    console.error("Failed to sync profile name to auth metadata:", authError);
  }

  return NextResponse.json({ profile: data });
}
