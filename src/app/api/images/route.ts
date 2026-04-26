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

export async function GET(request: Request) {
  const startedAt = performance.now();
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const model = searchParams.get("model");
  const time = searchParams.get("time");
  const idsParam = searchParams.get("ids");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20"), 1), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);
  const ids = idsParam
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const parsedAt = performance.now();

  let query = supabase
    .from("images")
    .select("id,url,prompt,prompt_zh,prompt_ja,author,model,category,tags,width,height,created_at,tweet_url")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);

  if (ids && ids.length > 0) {
    query = query.in("id", ids);
  }

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  if (model && model !== "all") {
    query = query.eq("model", model);
  }

  if (time && time !== "all") {
    const now = new Date();
    const cutoffs: Record<string, Date> = {
      today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      month: new Date(now.getFullYear(), now.getMonth(), 1),
    };
    const cutoff = cutoffs[time];
    if (cutoff) {
      query = query.gte("created_at", cutoff.toISOString());
    }
  }

  if (search) {
    const normalizedSearch = search.replace(/[{},]/g, " ").trim();
    if (normalizedSearch) {
      query = query.or(
        `prompt.ilike.%${normalizedSearch}%,author.ilike.%${normalizedSearch}%,model.ilike.%${normalizedSearch}%,tags.cs.{${normalizedSearch}}`
      );
    }
  }

  const queryStartedAt = performance.now();
  const { data, error } = await query;
  const queryFinishedAt = performance.now();

  if (error) {
    console.info("/api/images", {
      category,
      search,
      model,
      time,
      limit,
      offset,
      idsCount: ids?.length ?? 0,
      ok: false,
      parseMs: Math.round(parsedAt - startedAt),
      queryMs: Math.round(queryFinishedAt - queryStartedAt),
      durationMs: Math.round(performance.now() - startedAt),
      error: error.message,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const mapStartedAt = performance.now();
  const hasMore = data && data.length > limit;
  const images = (hasMore ? data.slice(0, limit) : (data || [])).map((image) => ({
    ...image,
    has_prompt_zh: Boolean(image.prompt_zh),
    has_prompt_ja: Boolean(image.prompt_ja),
    prompt_zh: null,
    prompt_ja: null,
  }));
  const mapFinishedAt = performance.now();

  console.info("/api/images", {
    category,
    search,
    model,
    time,
    limit,
    offset,
    idsCount: ids?.length ?? 0,
    ok: true,
    rows: images.length,
    hasMore,
    parseMs: Math.round(parsedAt - startedAt),
    queryMs: Math.round(queryFinishedAt - queryStartedAt),
    mapMs: Math.round(mapFinishedAt - mapStartedAt),
    durationMs: Math.round(performance.now() - startedAt),
  });

  return NextResponse.json({ data: images, hasMore });
}

export async function POST(request: Request) {
  const authError = await ensureAdmin();
  if (authError) return authError;

  const body = await request.json();

  const { data, error } = await supabaseAdmin
    .from("images")
    .insert({
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
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
