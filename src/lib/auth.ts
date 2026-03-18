import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";

/**
 * Ensures the user is authenticated.
 * Returns the user object if authenticated, otherwise returns a 401 response.
 */
export async function ensureAuth() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return user;
}

/**
 * Ensures the user is authenticated and returns the user or a response.
 * Use this for API routes that need user context.
 */
export async function requireAuth() {
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    return null; // Already returned the error response
  }
  return user;
}
