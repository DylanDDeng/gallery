import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import {
  CosImageMetadataError,
  resolveCosImageDimensions,
} from "@/lib/cos-image-metadata";
import {
  createImageRecord,
  ImageWriteValidationError,
  type ImageWriteBody,
} from "@/lib/image-write-service";
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
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "24"), 1), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);
  const ids = idsParam
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const parsedAt = performance.now();

  let query = supabase
    .from("images")
    .select("id,url,author,model,category,width,height,created_at,tweet_url")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
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
  const hasMore = Boolean(data && data.length > limit);
  const images = (hasMore ? data.slice(0, limit) : (data || [])).map((image) => ({
    ...image,
    // Preserve the shared client shape without shipping full tag content.
    tags: [],
  }));
  const nextOffset = offset + images.length;
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

  return NextResponse.json({ data: images, hasMore, nextOffset });
}

export async function POST(request: Request) {
  const authError = await ensureAdmin();
  if (authError) return authError;

  const body = (await request.json()) as ImageWriteBody;

  try {
    const data = await createImageRecord(body, {
      resolveDimensions: resolveCosImageDimensions,
      insert: async (mutation) => {
        const { data, error } = await supabaseAdmin
          .from("images")
          .insert(mutation)
          .select()
          .single();

        if (error || !data) throw new Error("Image insert failed");
        return data;
      },
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof ImageWriteValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof CosImageMetadataError) {
      const status = error.code === "INVALID_URL" ? 400 : 422;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ error: "Unable to add image" }, { status: 500 });
  }
}
