ALTER TABLE public.generation_tasks
ADD COLUMN IF NOT EXISTS source_image_id UUID;

CREATE INDEX IF NOT EXISTS idx_generation_tasks_user_source_image_created_at
ON public.generation_tasks(user_id, source_image_id, created_at DESC);
