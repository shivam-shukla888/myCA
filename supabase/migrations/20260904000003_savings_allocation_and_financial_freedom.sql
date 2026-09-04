-- Migration: 20260904000003_savings_allocation_and_financial_freedom.sql
-- Description: Financial Profile, Emergency Fund, Surplus Allocation Plans, and Financial Freedom Foundation

-- 1. Financial Profiles table (stores user financial parameters for planning and allocation)
CREATE TABLE IF NOT EXISTS public.financial_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    age INTEGER CHECK (age >= 18 AND age <= 120),
    monthly_income NUMERIC(15,2) DEFAULT 0 CHECK (monthly_income >= 0),
    existing_liquid_savings NUMERIC(15,2) DEFAULT 0 CHECK (existing_liquid_savings >= 0),
    existing_investments NUMERIC(15,2) DEFAULT 0 CHECK (existing_investments >= 0),
    monthly_essential_expenses NUMERIC(15,2) DEFAULT 0 CHECK (monthly_essential_expenses >= 0),
    monthly_debt_obligations NUMERIC(15,2) DEFAULT 0 CHECK (monthly_debt_obligations >= 0),
    dependents INTEGER DEFAULT 0 CHECK (dependents >= 0),
    has_health_insurance BOOLEAN DEFAULT false,
    has_life_insurance BOOLEAN DEFAULT false,
    emergency_fund_target_months INTEGER DEFAULT 6 CHECK (emergency_fund_target_months >= 1 AND emergency_fund_target_months <= 36),
    target_retirement_age INTEGER CHECK (target_retirement_age IS NULL OR target_retirement_age >= 18),
    desired_monthly_lifestyle_income NUMERIC(15,2) DEFAULT 0 CHECK (desired_monthly_lifestyle_income >= 0),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.financial_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_profiles_select_own" ON public.financial_profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "financial_profiles_insert_own" ON public.financial_profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "financial_profiles_update_own" ON public.financial_profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "financial_profiles_delete_own" ON public.financial_profiles
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE TRIGGER set_financial_profiles_updated_at
    BEFORE UPDATE ON public.financial_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Monthly Allocation Plans table (stores reproducible monthly financial planning snapshots)
CREATE TABLE IF NOT EXISTS public.monthly_allocation_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    month TEXT NOT NULL CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
    monthly_income NUMERIC(15,2) NOT NULL,
    monthly_expenses NUMERIC(15,2) NOT NULL,
    monthly_surplus NUMERIC(15,2) NOT NULL,
    emergency_fund_target NUMERIC(15,2) NOT NULL,
    emergency_fund_current NUMERIC(15,2) NOT NULL,
    emergency_fund_gap NUMERIC(15,2) NOT NULL,
    emergency_fund_allocation NUMERIC(15,2) NOT NULL,
    goals_allocation NUMERIC(15,2) NOT NULL,
    long_term_wealth_allocation NUMERIC(15,2) NOT NULL,
    flexible_buffer_allocation NUMERIC(15,2) NOT NULL,
    is_deficit BOOLEAN DEFAULT false NOT NULL,
    explanation TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(user_id, month)
);

ALTER TABLE public.monthly_allocation_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_allocation_plans_select_own" ON public.monthly_allocation_plans
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "monthly_allocation_plans_insert_own" ON public.monthly_allocation_plans
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "monthly_allocation_plans_update_own" ON public.monthly_allocation_plans
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "monthly_allocation_plans_delete_own" ON public.monthly_allocation_plans
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_monthly_allocation_plans_user_month ON public.monthly_allocation_plans(user_id, month DESC);

CREATE TRIGGER set_monthly_allocation_plans_updated_at
    BEFORE UPDATE ON public.monthly_allocation_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
