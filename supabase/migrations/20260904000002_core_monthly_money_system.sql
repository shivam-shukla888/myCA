-- Migration: Core Monthly Money System & Extended Transaction Types
-- Date: 2026-09-04

-- 1. Update check constraint on transactions.type to allow 'income', 'expense', 'transfer' while keeping backwards compatibility with 'credit', 'debit'
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check 
    CHECK (type IN ('credit', 'debit', 'income', 'expense', 'transfer'));

-- 2. Add account / provenance column for transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS account TEXT;

-- 3. Create index for temporal monthly queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON public.transactions(user_id, type);
