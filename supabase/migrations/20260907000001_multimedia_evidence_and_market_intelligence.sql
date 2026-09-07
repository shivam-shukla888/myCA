-- Migration: Multi-Media Evidence and Market Intelligence Support
-- 1. Extend documents table for multi-media evidence tracking (PDF, images, video)
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'DOCUMENT' CHECK (source_type IN ('DOCUMENT', 'IMAGE', 'VIDEO'));
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'completed' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS ocr_status TEXT DEFAULT 'not_applicable' CHECK (ocr_status IN ('not_applicable', 'pending', 'processing', 'completed', 'failed'));
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'draft_ready', 'user_confirmed', 'rejected'));
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_source_type ON public.documents(source_type);
CREATE INDEX IF NOT EXISTS idx_documents_verification_status ON public.documents(verification_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_user_file_hash ON public.documents(user_id, file_hash) WHERE file_hash IS NOT NULL;

-- 2. User-Specific Stock and Index Watchlist
CREATE TABLE IF NOT EXISTS public.market_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    exchange TEXT DEFAULT 'NSE' NOT NULL,
    asset_type TEXT DEFAULT 'EQUITY' NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_market_watchlist_user_symbol UNIQUE(user_id, symbol)
);

ALTER TABLE public.market_watchlist ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'market_watchlist' AND policyname = 'market_watchlist_select_own'
    ) THEN
        CREATE POLICY "market_watchlist_select_own" ON public.market_watchlist
            FOR SELECT TO authenticated
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'market_watchlist' AND policyname = 'market_watchlist_insert_own'
    ) THEN
        CREATE POLICY "market_watchlist_insert_own" ON public.market_watchlist
            FOR INSERT TO authenticated
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'market_watchlist' AND policyname = 'market_watchlist_delete_own'
    ) THEN
        CREATE POLICY "market_watchlist_delete_own" ON public.market_watchlist
            FOR DELETE TO authenticated
            USING (auth.uid() = user_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_market_watchlist_user_id ON public.market_watchlist(user_id);

-- 3. Global Market Data Cache (Shared reference rates: Inflation, Gold, FX, Indices)
CREATE TABLE IF NOT EXISTS public.market_data_cache (
    metric_key TEXT PRIMARY KEY,
    metric_type TEXT NOT NULL, -- 'INFLATION' | 'GOLD' | 'FX' | 'INDEX' | 'STOCK'
    symbol TEXT,
    value NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    unit TEXT NOT NULL,
    change NUMERIC,
    percentage_change NUMERIC,
    market_status TEXT DEFAULT 'MARKET STATUS UNKNOWN',
    source TEXT NOT NULL,
    source_url TEXT,
    observed_period TEXT,
    published_at TIMESTAMPTZ,
    observed_at TIMESTAMPTZ NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    freshness_type TEXT NOT NULL, -- 'REAL_TIME' | 'NEAR_REAL_TIME' | 'DAILY' | 'MONTHLY' | 'CACHED' | 'STALE'
    metadata JSONB,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.market_data_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'market_data_cache' AND policyname = 'market_data_cache_select'
    ) THEN
        CREATE POLICY "market_data_cache_select" ON public.market_data_cache
            FOR SELECT TO authenticated
            USING (true);
    END IF;
END $$;

