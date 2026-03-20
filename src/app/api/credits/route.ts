import { NextResponse } from "next/server";
import { ensureAuth } from "@/lib/auth";
import { isBillingEnabled } from "@/lib/billing-feature";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  if (!isBillingEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    return user;
  }

  try {
    // Get user's credits balance
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .single();

    if (profileError) {
      // If profile doesn't exist, create it
      if (profileError.code === "PGRST116") {
        const { data: newProfile, error: createError } = await supabaseAdmin
          .from("profiles")
          .upsert({
            id: user.id,
            email: user.email,
            credits: 0,
          })
          .select("credits")
          .single();

        if (createError) {
          return NextResponse.json({ error: createError.message }, { status: 500 });
        }

        return NextResponse.json({
          credits: newProfile?.credits ?? 0,
        });
      }
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({
      credits: profile?.credits ?? 0,
    });
  } catch (error) {
    console.error("Error fetching credits:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
