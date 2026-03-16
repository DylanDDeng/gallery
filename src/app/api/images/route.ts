import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const model = searchParams.get("model");
  const time = searchParams.get("time");
  const idsParam = searchParams.get("ids");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20"), 1), 50);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);
  const ids = idsParam
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  let query = supabase
    .from("images")
    .select("*")
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

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const hasMore = data && data.length > limit;
  const images = hasMore ? data.slice(0, limit) : (data || []);

  return NextResponse.json({ data: images, hasMore });
}

export async function POST(request: Request) {
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
