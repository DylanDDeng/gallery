import { NextResponse } from "next/server";
import { ensureAuth } from "@/lib/auth";
import { encryptApiKey } from "@/lib/api-key-crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    return user;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("user_api_keys")
      .select("id, provider, name, is_active, created_at")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error fetching API keys:", error);
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
    const { provider, apiKey, name } = body;

    if (!provider || typeof provider !== "string") {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      );
    }

    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    const encryptedKey = encryptApiKey(apiKey.trim());

    // Upsert - update if exists, insert if not
    const { data, error } = await supabaseAdmin
      .from("user_api_keys")
      .upsert(
        {
          user_id: user.id,
          provider: provider.toLowerCase(),
          encrypted_key: encryptedKey,
          name: name || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,provider",
        }
      )
      .select("id, provider, name, is_active, created_at")
      .single();

    if (error) {
      console.error("Error saving API key:", error);
      return NextResponse.json(
        { error: "Failed to save API key" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Error saving API key:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    return user;
  }

  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");

    if (!provider) {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("user_api_keys")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider.toLowerCase());

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete API key" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting API key:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
