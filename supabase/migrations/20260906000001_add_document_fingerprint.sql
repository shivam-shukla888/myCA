-- Migration: Add file_hash column and unique index to prevent duplicate document imports per user
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Create unique index to enforce that a user cannot upload duplicate identical documents
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_user_file_hash 
ON public.documents(user_id, file_hash) 
WHERE file_hash IS NOT NULL;
