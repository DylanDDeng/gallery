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

  const counts = await Promise.all(
    categorySlugs.map(async (slug) => {
      let query = supabase
        .from("images")
        .select("*", { count: "exact", head: true })
        .eq("category", slug);

      if (ids && ids.length > 0) {
        query = query.in("id", ids);
      }

      if (model && model !== "all") {
        query = query.eq("model", model);
      }

      if (cutoff) {
        query = query.gte("created_at", cutoff.toISOString());
      }

      if (search) {
        const normalizedSearch = search.replace(/[{},]/g, " ").trim();
        if (normalizedSearch) {
          query = query.or(
            `prompt.ilike.%${normalizedSearch}%,author.ilike.%${normalizedSearch}%,model.ilike.%${normalizedSearch}%,tags.cs.{${normalizedSearch}}`
          );
        }
      }

      const { count, error } = await query;

      if (error) {
        throw error;
      }

      return {
        slug,
        count: count ?? 0,
      };
    })
  );

  return NextResponse.json({
    data: counts.filter((category) => category.count > 0),
  });
}
