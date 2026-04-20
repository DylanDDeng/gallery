-- Speed up gallery filters and search on the images table

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Feed sorting and filter combinations
CREATE INDEX IF NOT EXISTS idx_images_created_at_desc
  ON public.images (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_images_model_created_at_desc
  ON public.images (model, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_images_category_created_at_desc
  ON public.images (category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_images_model_category_created_at_desc
  ON public.images (model, category, created_at DESC);

-- Search helpers for prompt/author/model text filtering
CREATE INDEX IF NOT EXISTS idx_images_prompt_trgm
  ON public.images
  USING gin (prompt gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_images_author_trgm
  ON public.images
  USING gin (author gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_images_model_trgm
  ON public.images
  USING gin (model gin_trgm_ops);

-- Search helper for tag containment lookups
CREATE INDEX IF NOT EXISTS idx_images_tags_gin
  ON public.images
  USING gin (tags);
