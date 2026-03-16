import { NextResponse } from "next/server";
import { getAdminDebugInfo } from "@/lib/admin";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Extra diagnostics
  const adminEnvKeys = Object.keys(process.env).filter((k) =>
    k.toLowerCase().includes("admin")
  );

  return NextResponse.json({
    ...getAdminDebugInfo(user.email),
    adminRelatedEnvKeys: adminEnvKeys,
    hasEnvVar: "ADMIN_EMAILS" in process.env,
    envVarType: typeof process.env.ADMIN_EMAILS,
    allEnvKeyCount: Object.keys(process.env).length,
  });
}
