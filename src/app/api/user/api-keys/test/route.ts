import { NextResponse } from "next/server";
import { ensureAuth } from "@/lib/auth";
import { decryptApiKey } from "@/lib/api-key-crypto";
import { isSelfServiceApiKeysEnabled } from "@/lib/billing-feature";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { DoubaoClient } from "@/lib/doubao";

export async function POST(request: Request) {
  if (!isSelfServiceApiKeysEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    return user;
  }

  try {
    const body = await request.json();
    const { provider, apiKey } = body;

    if (!provider || typeof provider !== "string") {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      );
    }

    let keyToTest = apiKey;

    // If no API key provided in request, fetch from database
    if (!keyToTest) {
      const { data, error } = await supabaseAdmin
        .from("user_api_keys")
        .select("encrypted_key")
        .eq("user_id", user.id)
        .eq("provider", provider.toLowerCase())
        .eq("is_active", true)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { valid: false, error: "No API key found" },
          { status: 400 }
        );
      }

      keyToTest = decryptApiKey(data.encrypted_key);
    }

    // Test the API key based on provider
    if (provider.toLowerCase() === "doubao") {
      const client = new DoubaoClient();
      try {
        // Use a simple test prompt
        await client.generate({
          apiKey: keyToTest,
          prompt: "test",
          size: "2K",
          watermark: false,
        });
        return NextResponse.json({ valid: true });
      } catch (apiError) {
        const message = apiError instanceof Error ? apiError.message : "Invalid API key";
        return NextResponse.json({ valid: false, error: message });
      }
    }

    return NextResponse.json(
      { valid: false, error: "Unsupported provider" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error testing API key:", error);
    return NextResponse.json(
      { valid: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
