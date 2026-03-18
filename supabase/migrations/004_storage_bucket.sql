-- Supabase Storage Bucket for Generated Images
-- Creates a storage bucket for user-generated images

-- Create the generations bucket (if using RLS, we need to set up policies)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generations',
  'generations',
  true, -- public bucket so users can access images directly
  NULL, -- no file size limit
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'] -- allowed mime types
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can upload their own images
CREATE POLICY "Users can upload their own images"
ON storage.objects
FOR INSERT
WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Users can view images in the generations bucket if they own them
CREATE POLICY "Users can view their own images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'generations'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own images
CREATE POLICY "Users can delete their own images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'generations'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Anyone can view images in the generations bucket (public)
CREATE POLICY "Public can view generations images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'generations');
