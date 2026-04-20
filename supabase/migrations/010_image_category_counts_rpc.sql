-- Aggregate category counts in a single query for gallery filters

CREATE OR REPLACE FUNCTION public.get_image_category_counts(
  p_search TEXT DEFAULT NULL,
  p_model TEXT DEFAULT NULL,
  p_cutoff TIMESTAMPTZ DEFAULT NULL,
  p_ids TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  slug TEXT,
  count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    images.category AS slug,
    COUNT(*)::BIGINT AS count
  FROM public.images
  WHERE images.category IS NOT NULL
    AND images.category <> 'all'
    AND (
      p_ids IS NULL
      OR array_length(p_ids, 1) IS NULL
      OR images.id::TEXT = ANY(p_ids)
    )
    AND (
      p_model IS NULL
      OR p_model = 'all'
      OR images.model = p_model
    )
    AND (
      p_cutoff IS NULL
      OR images.created_at >= p_cutoff
    )
    AND (
      p_search IS NULL
      OR p_search = ''
      OR COALESCE(images.prompt, '') ILIKE '%' || p_search || '%'
      OR COALESCE(images.author, '') ILIKE '%' || p_search || '%'
      OR COALESCE(images.model, '') ILIKE '%' || p_search || '%'
      OR COALESCE(images.tags, '{}'::TEXT[]) @> ARRAY[p_search]
    )
  GROUP BY images.category;
$$;

GRANT EXECUTE ON FUNCTION public.get_image_category_counts(TEXT, TEXT, TIMESTAMPTZ, TEXT[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_image_category_counts(TEXT, TEXT, TIMESTAMPTZ, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_image_category_counts(TEXT, TEXT, TIMESTAMPTZ, TEXT[]) TO service_role;
