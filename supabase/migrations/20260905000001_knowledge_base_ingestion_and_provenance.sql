-- Migration: 20260905000001_knowledge_base_ingestion_and_provenance.sql
-- Description: Financial Knowledge Base Source Ingestion, Provenance, and Versioning

-- 1. Knowledge Sources Table
CREATE TABLE IF NOT EXISTS public.knowledge_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT UNIQUE NOT NULL, -- Permanent canonical slug (e.g., 'sebi_circular_ia_2024_01')
    version INTEGER DEFAULT 1 NOT NULL CHECK (version >= 1),
    title TEXT NOT NULL,
    author_or_organization TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN (
        'BOOK',
        'PODCAST',
        'DOCUMENTARY',
        'ACADEMIC_RESEARCH',
        'OFFICIAL_REGULATORY',
        'GOVERNMENT',
        'EDUCATIONAL_ARTICLE',
        'OTHER_TRUSTED_SOURCE'
    )),
    topic TEXT NOT NULL,
    country TEXT DEFAULT 'IN' NOT NULL,
    publication_date DATE,
    last_verified_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    authority_level INTEGER NOT NULL CHECK (authority_level BETWEEN 1 AND 6),
    license_status TEXT NOT NULL CHECK (license_status IN (
        'PUBLIC_DOMAIN',
        'OFFICIAL_GOVERNMENT_DOCUMENT',
        'PERMITTED_EXCERPT',
        'LICENSED_CONTENT',
        'INTERNAL_SUMMARY',
        'METADATA_ONLY'
    )),
    canonical_url TEXT,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'ACTIVE' NOT NULL CHECK (status IN (
        'ACTIVE',
        'PENDING_REVIEW',
        'ARCHIVED',
        'RETRACTED',
        'OUTDATED'
    )),
    content_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Knowledge Chunks Table with Full Provenance Traceability
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id TEXT UNIQUE NOT NULL, -- Canonical identifier: chk_{source_id}_v{version}_{index}
    source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
    source_slug TEXT NOT NULL,
    source_version INTEGER NOT NULL CHECK (source_version >= 1),
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    chunk_type TEXT NOT NULL CHECK (chunk_type IN (
        'ORIGINAL_TEXT',
        'PERMITTED_EXCERPT',
        'SUMMARY',
        'REGULATORY_PROVISION',
        'KEY_TAKEAWAY'
    )),
    headline TEXT NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    citation_page_or_section TEXT,
    is_summary BOOLEAN DEFAULT false NOT NULL,
    summary_attribution TEXT,
    prompt_injection_flagged BOOLEAN DEFAULT false NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(source_id, source_version, chunk_index)
);

-- 3. Trigger for updated_at
CREATE TRIGGER set_knowledge_sources_updated_at
    BEFORE UPDATE ON public.knowledge_sources
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_knowledge_chunks_updated_at
    BEFORE UPDATE ON public.knowledge_chunks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Indexes for expected retrieval and verification
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_source_id ON public.knowledge_sources(source_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_type ON public.knowledge_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_topic ON public.knowledge_sources(topic);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_authority ON public.knowledge_sources(authority_level);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_status ON public.knowledge_sources(status);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_chunk_id ON public.knowledge_chunks(chunk_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source_id ON public.knowledge_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_slug_version ON public.knowledge_chunks(source_slug, source_version);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_active ON public.knowledge_chunks(is_active);

-- 5. Row Level Security: Completely public-read for authenticated users, admin-only write
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Read policy: Authenticated users can read active knowledge
CREATE POLICY "knowledge_sources_read_authenticated" ON public.knowledge_sources
    FOR SELECT TO authenticated
    USING (status = 'ACTIVE');

CREATE POLICY "knowledge_chunks_read_authenticated" ON public.knowledge_chunks
    FOR SELECT TO authenticated
    USING (is_active = true);

-- Write policies: Admin only (or Service Role)
CREATE POLICY "knowledge_sources_insert_admin" ON public.knowledge_sources
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
        )
    );

CREATE POLICY "knowledge_sources_update_admin" ON public.knowledge_sources
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
        )
    );

CREATE POLICY "knowledge_sources_delete_admin" ON public.knowledge_sources
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
        )
    );

CREATE POLICY "knowledge_chunks_insert_admin" ON public.knowledge_chunks
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
        )
    );

CREATE POLICY "knowledge_chunks_update_admin" ON public.knowledge_chunks
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
        )
    );

CREATE POLICY "knowledge_chunks_delete_admin" ON public.knowledge_chunks
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'
        )
    );
