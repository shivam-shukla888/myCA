-- Migration: Add HMAC Signature column to ai_recommendations_log for tamper-evident auditing
-- Date: 2026-09-04

ALTER TABLE public.ai_recommendations_log
ADD COLUMN IF NOT EXISTS hmac_signature TEXT;

-- Create index on hmac_signature for rapid audit verification
CREATE INDEX IF NOT EXISTS idx_ai_log_hmac_signature ON public.ai_recommendations_log(hmac_signature);
