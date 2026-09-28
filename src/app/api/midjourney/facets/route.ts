import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Sidebar data for the Midjourney filter: versions plus --p and --sref codes.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const version = searchParams.get("version");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50"), 1), 200);
  const p_version = version && version !== "all" ? version : null;

  const [versions, profiles, srefs] = await Promise.all([
    supabase.rpc("get_midjourney_versions"),
    supabase.rpc("get_midjourney_style_codes", { p_kind: "p", p_version, p_limit: limit }),
    supabase.rpc("get_midjourney_style_codes", { p_kind: "sref", p_version, p_limit: limit }),
  ]);

  const error = versions.error || profiles.error || srefs.error;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    versions: versions.data ?? [],
    profiles: profiles.data ?? [],
    srefs: srefs.data ?? [],
  });
}
