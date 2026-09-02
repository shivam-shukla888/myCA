-- Migration: 20260902000001_init_schema.sql
-- Description: Initialize Personal AI CA core database schema, RLS policies, triggers, and storage bucket

-- 1. Helper trigger function: update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    pan_number_encrypted TEXT,
    gstin_encrypted TEXT,
    business_type TEXT CHECK (business_type IN ('individual', 'business', 'freelancer')),
    preferred_language TEXT DEFAULT 'en',
    financial_year_start INTEGER DEFAULT 4 CHECK (financial_year_start BETWEEN 1 AND 12),
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-create profile on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Documents table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size_bytes BIGINT,
    storage_path TEXT NOT NULL,
    mime_type TEXT,
    document_type TEXT CHECK (document_type IN ('bank_statement', 'tax_form_itr', 'invoice', 'receipt', 'gst_return', 'salary_slip', 'form_16', 'form_26as', 'other')),
    extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
    extraction_confidence REAL CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
    extracted_data JSONB,
    financial_year TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_own" ON public.documents
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "documents_insert_own" ON public.documents
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "documents_update_own" ON public.documents
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "documents_delete_own" ON public.documents
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON public.documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_financial_year ON public.documents(financial_year);

CREATE TRIGGER set_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    description TEXT,
    amount NUMERIC(15,2) NOT NULL,
    currency TEXT DEFAULT 'INR' NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    category TEXT,
    subcategory TEXT,
    merchant_name TEXT,
    account_identifier_hash TEXT,
    is_tax_relevant BOOLEAN DEFAULT false NOT NULL,
    gst_applicable BOOLEAN DEFAULT false NOT NULL,
    gst_amount NUMERIC(15,2),
    confidence_score REAL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    user_verified BOOLEAN DEFAULT false NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select_own" ON public.transactions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "transactions_insert_own" ON public.transactions
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_update_own" ON public.transactions
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_delete_own" ON public.transactions
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_is_tax_relevant ON public.transactions(is_tax_relevant) WHERE is_tax_relevant = true;
CREATE INDEX IF NOT EXISTS idx_transactions_document_id ON public.transactions(document_id);

CREATE TRIGGER set_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Goals table
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    goal_type TEXT CHECK (goal_type IN ('savings', 'investment', 'tax_planning', 'debt_reduction', 'emergency_fund', 'retirement', 'custom')),
    target_amount NUMERIC(15,2),
    current_amount NUMERIC(15,2) DEFAULT 0 NOT NULL,
    currency TEXT DEFAULT 'INR' NOT NULL,
    target_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_select_own" ON public.goals
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "goals_insert_own" ON public.goals
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals_update_own" ON public.goals
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals_delete_own" ON public.goals
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON public.goals(status);

CREATE TRIGGER set_goals_updated_at
    BEFORE UPDATE ON public.goals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT,
    context_type TEXT DEFAULT 'general' CHECK (context_type IN ('transaction_analysis', 'tax_query', 'financial_planning', 'document_review', 'gst_query', 'general')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    message_count INTEGER DEFAULT 0 NOT NULL,
    last_message_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_select_own" ON public.conversations
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "conversations_insert_own" ON public.conversations
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversations_update_own" ON public.conversations
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversations_delete_own" ON public.conversations
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations(last_message_at DESC);

CREATE TRIGGER set_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Conversation Messages table
CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_own" ON public.conversation_messages
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "messages_insert_own" ON public.conversation_messages
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.conversation_messages(user_id);

-- Trigger to increment conversation message_count and set last_message_at
CREATE OR REPLACE FUNCTION public.handle_new_conversation_message()
RETURNS trigger AS $$
BEGIN
    UPDATE public.conversations
    SET message_count = message_count + 1,
        last_message_at = NEW.created_at,
        updated_at = now()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_conversation_message_inserted
    AFTER INSERT ON public.conversation_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_conversation_message();

-- 8. AI Recommendations Log table (APPEND-ONLY audit log)
CREATE TABLE IF NOT EXISTS public.ai_recommendations_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    query TEXT NOT NULL,
    response TEXT NOT NULL,
    model_used TEXT,
    model_version TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    confidence_score REAL NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    confidence_level TEXT CHECK (confidence_level IN ('high', 'medium', 'low', 'very_low')),
    topic_category TEXT CHECK (topic_category IN ('tax', 'gst', 'investment', 'savings', 'compliance', 'general')),
    contains_financial_advice BOOLEAN DEFAULT false NOT NULL,
    contains_tax_advice BOOLEAN DEFAULT false NOT NULL,
    disclaimer_shown BOOLEAN DEFAULT true NOT NULL,
    disclaimer_text TEXT,
    reviewed_by_human BOOLEAN DEFAULT false NOT NULL,
    reviewer_notes TEXT,
    escalated BOOLEAN DEFAULT false NOT NULL,
    escalation_reason TEXT,
    source_document_ids UUID[],
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.ai_recommendations_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_log_select_own" ON public.ai_recommendations_log
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "ai_log_insert_own" ON public.ai_recommendations_log
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_log_user_id ON public.ai_recommendations_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_log_confidence_score ON public.ai_recommendations_log(confidence_score);
CREATE INDEX IF NOT EXISTS idx_ai_log_reviewed ON public.ai_recommendations_log(reviewed_by_human) WHERE reviewed_by_human = false;
CREATE INDEX IF NOT EXISTS idx_ai_log_created_at ON public.ai_recommendations_log(created_at DESC);

-- 9. Storage Bucket: user-documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'user-documents',
    'user-documents',
    false,
    10485760, -- 10MB
    ARRAY['application/pdf', 'text/csv', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for user-documents
CREATE POLICY "user_documents_select_own" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'user-documents' AND (auth.uid()::text = (storage.foldername(name))[1]));

CREATE POLICY "user_documents_insert_own" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'user-documents' AND (auth.uid()::text = (storage.foldername(name))[1]));

CREATE POLICY "user_documents_update_own" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'user-documents' AND (auth.uid()::text = (storage.foldername(name))[1]))
    WITH CHECK (bucket_id = 'user-documents' AND (auth.uid()::text = (storage.foldername(name))[1]));

CREATE POLICY "user_documents_delete_own" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'user-documents' AND (auth.uid()::text = (storage.foldername(name))[1]));
