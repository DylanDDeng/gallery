import { NextResponse } from "next/server";
import { ensureAuth } from "@/lib/auth";
import { signGenerationShare } from "@/lib/generation-share";
import { routing, type Locale } from "@/i18n/routing";
import { supabaseAdmin } from "@/lib/supabase-admin";

function normalizeLocale(value: unknown): Locale {
  return typeof value === "string" && routing.locales.includes(value as Locale)
    ? (value as Locale)
    : routing.defaultLocale;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await ensureAuth();
  if (user instanceof NextResponse) {
    return user;
  }

  const { id } = await params;

  try {
    const { data: task, error } = await supabaseAdmin
      .from("generation_tasks")
      .select("id, status, result_url")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.status !== "completed" || !task.result_url) {
      return NextResponse.json(
        { error: "Only completed generations can be shared" },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const locale = normalizeLocale(body.locale);
    const token = await signGenerationShare(task.id);
    const baseUrl = new URL(request.url).origin;
    const localePrefix = locale === routing.defaultLocale ? "" : `/${locale}`;
    const shareUrl = new URL(
      `${localePrefix}/share/${encodeURIComponent(token)}`,
      baseUrl,
    ).toString();

    return NextResponse.json(
      { shareUrl },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Error creating generation share link:", error);
    return NextResponse.json(
      { error: "Failed to create share link" },
      { status: 500 },
    );
  }
}
