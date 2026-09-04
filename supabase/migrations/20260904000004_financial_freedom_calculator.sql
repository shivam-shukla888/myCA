-- Migration: 20260904000004_financial_freedom_calculator.sql
-- Description: Persistent assumptions and parameters for Financial Freedom Calculator

ALTER TABLE public.financial_profiles 
    ADD COLUMN IF NOT EXISTS planning_inflation_rate NUMERIC(5,2) DEFAULT 6.0 CHECK (planning_inflation_rate >= 0 AND planning_inflation_rate <= 30),
    ADD COLUMN IF NOT EXISTS planning_expected_return NUMERIC(5,2) DEFAULT 10.0 CHECK (planning_expected_return >= 0 AND planning_expected_return <= 40),
    ADD COLUMN IF NOT EXISTS planning_withdrawal_rate NUMERIC(5,2) DEFAULT 4.0 CHECK (planning_withdrawal_rate > 0 AND planning_withdrawal_rate <= 20),
    ADD COLUMN IF NOT EXISTS planning_scenario TEXT DEFAULT 'base' CHECK (planning_scenario IN ('conservative', 'base', 'optimistic'));
