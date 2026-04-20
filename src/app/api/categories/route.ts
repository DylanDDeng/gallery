import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CATEGORIES } from "@/lib/constants";

function buildCutoff(time: string | null) {
  if (!time || time === "all") {
    return null;
  }

  const now = new Date();
  const cutoffs: Record<string, Date> = {
    today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    month: new Date(now.getFullYear(), now.getMonth(), 1),
  };

  return cutoffs[time] ?? null;
}

export async function GET(request: Request) {
  const startedAt = performance.now();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const model = searchParams.get("model");
  const time = searchParams.get("time");
  const idsParam = searchParams.get("ids");
  const ids = idsParam
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const cutoff = buildCutoff(time);
  const categorySlugs = CATEGORIES.filter((category) => category.slug !== "all").map(
    (category) => category.slug
  );
  const normalizedSearch = search?.replace(/[{},]/g, " ").trim() || null;
  const parsedAt = performance.now();

  const queryStartedAt = performance.now();
  const { data, error } = await supabase.rpc("get_image_category_counts", {
    p_search: normalizedSearch,
    p_model: model && model !== "all" ? model : null,
    p_cutoff: cutoff?.toISOString() || null,
    p_ids: ids && ids.length > 0 ? ids : null,
  });
  const queryFinishedAt = performance.now();

  if (error) {
    console.info("/api/categories", {
      search: normalizedSearch,
      model,
      time,
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
  const countsBySlug = new Map(
    Array.isArray(data)
      ? data.map((entry) => [
          entry.slug,
          typeof entry.count === "number" ? entry.count : Number(entry.count ?? 0),
        ])
      : []
  );

  const counts = categorySlugs
    .map((slug) => ({
      slug,
      count: countsBySlug.get(slug) ?? 0,
    }))
    .filter((category) => category.count > 0);
  const mapFinishedAt = performance.now();

  console.info("/api/categories", {
    search: normalizedSearch,
    model,
    time,
    idsCount: ids?.length ?? 0,
    ok: true,
    rows: counts.length,
    parseMs: Math.round(parsedAt - startedAt),
    queryMs: Math.round(queryFinishedAt - queryStartedAt),
    mapMs: Math.round(mapFinishedAt - mapStartedAt),
    durationMs: Math.round(performance.now() - startedAt),
  });

  return NextResponse.json({
    data: counts,
  });
}
