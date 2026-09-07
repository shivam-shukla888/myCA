'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { AuthRequiredState } from '../components/auth/AuthRequiredState';
import {
  canonicalFinanceApi,
  croreApi,
  transactionApi,
  changeDetectionApi,
  actionApi,
  CanonicalFinancialState,
  CroreStatusResponse,
  Transaction,
  ChangeDetectionResult,
  ActionPlan,
} from '../lib/api';
import AdvancedToggle, { AdvancedDetailsData } from '../components/AdvancedToggle';
import QuickAdd from '../components/QuickAdd';
import { WhatChangedCard } from '../components/dashboard/WhatChangedCard';
import { PublicLandingView } from '../components/public/PublicLandingView';
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Plus,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  RefreshCw,
  TrendingUp,
  HelpCircle,
  Clock,
} from 'lucide-react';

export default function SurfacePage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [canonicalState, setCanonicalState] = useState<CanonicalFinancialState | null>(null);
  const [croreStatus, setCroreStatus] = useState<CroreStatusResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [changeResult, setChangeResult] = useState<ChangeDetectionResult | null>(null);
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Current month string (YYYY-MM)
  const currentMonth = new Date().toISOString().slice(0, 7);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const [canonRes, croreRes, txRes, changeRes, planRes] = await Promise.allSettled([
        canonicalFinanceApi.getCanonicalState(currentMonth),
        croreApi.getStatus(currentMonth),
        transactionApi.list({ limit: 6 }),
        changeDetectionApi.getChanges(currentMonth),
        actionApi.getPlan(currentMonth),
      ]);

      if (canonRes.status === 'fulfilled' && canonRes.value) {
        setCanonicalState(canonRes.value);
      }

      if (croreRes.status === 'fulfilled' && croreRes.value) {
        setCroreStatus(croreRes.value);
      }

      if (txRes.status === 'fulfilled') {
        setTransactions(txRes.value.transactions || []);
      }

      if (changeRes.status === 'fulfilled' && changeRes.value) {
        setChangeResult(changeRes.value);
      }

      if (planRes.status === 'fulfilled' && planRes.value) {
        setActionPlan(planRes.value);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to financial workspace.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentMonth]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    loadData();
  }, [authLoading, isAuthenticated, loadData]);

  // Extract canonical values: UNKNOWN is strictly null (never coerced to zero)
  const income = canonicalState?.income.monthly_net_income ?? null;
  const incomeSource = canonicalState?.data_status.income_source || 'missing';

  const expenses = canonicalState?.expenses.total_monthly_expenses ?? null;
  const expenseSource = canonicalState?.data_status.expense_source || 'missing';

  const surplus = canonicalState?.cashflow.monthly_surplus ?? null;
  const savingsRate = canonicalState?.cashflow.savings_rate ?? null;
  const isDeficit = canonicalState?.cashflow.is_deficit ?? false;

  // Source badges
  const getSourceBadge = (source: 'observed_ledger' | 'profile_stated' | 'missing') => {
    if (source === 'observed_ledger') {
      return (
        <span className="badge-signal badge-forest" title="Verified from ledger records">
          Observed Ledger
        </span>
      );
    }
    if (source === 'profile_stated') {
      return (
        <span className="badge-signal badge-amber" title="Stated baseline from your profile">
          Stated Baseline
        </span>
      );
    }
    return (
      <span className="badge-signal" style={{ background: 'var(--canvas-inset)', color: 'var(--ink-tertiary)' }}>
        Unknown
      </span>
    );
  };

  // Focus Engine: ONE Primary Financial Priority from Action Engine
  const highestAction = actionPlan?.highest_priority_action;

  let primaryFocusTitle = 'Establish Your Financial Baseline';
  let primaryFocusWhy =
    'Record your regular income and essential expenses so MyCA can calculate your actual monthly surplus and start your wealth roadmap.';
  let primaryFocusEffect: string | null = null;
  let primaryActionLabel = 'Set Up Baseline Profile';
  let primaryActionHref = '/onboarding';
  let primaryActionPriority: string = 'ONBOARDING';
  let primaryActionSource: string | null = null;
  let primarySupportingData: Record<string, unknown> | null = null;

  if (highestAction) {
    primaryFocusTitle = highestAction.title;
    primaryFocusWhy = highestAction.why_it_matters;
    primaryFocusEffect = highestAction.expected_measurable_effect;
    primaryActionLabel = highestAction.cta.label;
    primaryActionHref = highestAction.cta.destination;
    primaryActionPriority = highestAction.priority_type;
    primaryActionSource = highestAction.confidence_source.data_source;
    primarySupportingData = highestAction.exact_data_supporting_it;
  } else if (income !== null && expenses !== null) {
    if (isDeficit || (surplus !== null && surplus <= 0)) {
      primaryFocusTitle = 'Eliminate Monthly Cashflow Deficit';
      primaryFocusWhy =
        'When monthly expenses exceed incoming income, liquid reserves are consumed each month and debt risk compounds.';
      primaryFocusEffect = `Your current deficit is ₹${Math.abs(surplus ?? 0).toLocaleString('en-IN')}. Reducing non-essential expenses will bring your monthly cashflow to break-even (₹0) and halt liquid reserve depletion.`;
      primaryActionLabel = 'Audit Spending & Cut Deficit';
      primaryActionHref = '/ledger';
      primaryActionPriority = 'P0_DEFICIT';
    } else if (
      canonicalState?.capital_and_savings &&
      !canonicalState.capital_and_savings.is_emergency_complete &&
      canonicalState.capital_and_savings.emergency_fund_target !== null
    ) {
      const gap = canonicalState.capital_and_savings.emergency_fund_gap;
      primaryFocusTitle = 'Fund Emergency Safety Reserve';
      primaryFocusWhy =
        'An incomplete emergency reserve leaves your household exposed to unexpected disruptions, risking reliance on high-interest borrowing.';
      primaryFocusEffect = `Your current surplus is ₹${(surplus ?? 0).toLocaleString('en-IN')}. Allocating surplus toward your emergency fund would close the remaining ₹${(gap ?? 0).toLocaleString('en-IN')} gap.`;
      primaryActionLabel = 'Allocate to Safety Reserve';
      primaryActionHref = '/plan';
      primaryActionPriority = 'P1_EMERGENCY_GAP';
    } else {
      primaryFocusTitle = 'Accelerate ₹1 Crore Wealth Path';
      primaryFocusWhy =
        'With emergency reserves secured and zero debt obligations, deploying surplus into systematic investments directly accelerates your ₹1 Crore timeline.';
      primaryFocusEffect = `Your current surplus is ₹${(surplus ?? 0).toLocaleString('en-IN')} (${(savingsRate ?? 0).toFixed(0)}% savings rate). Deploying surplus into disciplined compounding systematically advances your ₹1 Crore milestone.`;
      primaryActionLabel = 'Explore ₹1 Crore Levers';
      primaryActionHref = '/crore';
      primaryActionPriority = 'P5_WEALTH_ACCELERATION';
    }
  }

  // Progressive disclosure data for technical inspection
  const advancedData: AdvancedDetailsData = {
    answer: `Canonical Financial Assessment for ${currentMonth}`,
    provider_used: 'Canonical Financial State Engine (Deterministic)',
    confidence_score: canonicalState?.data_status.has_observed_transactions ? 1.0 : 0.85,
    risk_level: isDeficit ? 'HIGH' : surplus !== null && surplus > 0 ? 'LOW' : 'MEDIUM',
    deterministic_calculations: {
      monthly_net_income: income !== null ? `₹${income.toLocaleString('en-IN')}` : 'UNKNOWN',
      monthly_essential_expenses: canonicalState?.expenses.monthly_essential_expenses !== null && canonicalState?.expenses.monthly_essential_expenses !== undefined
        ? `₹${canonicalState.expenses.monthly_essential_expenses.toLocaleString('en-IN')}`
        : 'UNKNOWN',
      monthly_debt_obligations: canonicalState?.expenses.monthly_debt_obligations !== null && canonicalState?.expenses.monthly_debt_obligations !== undefined
        ? `₹${canonicalState.expenses.monthly_debt_obligations.toLocaleString('en-IN')}`
        : 'UNKNOWN',
      total_monthly_expenses: expenses !== null ? `₹${expenses.toLocaleString('en-IN')}` : 'UNKNOWN',
      monthly_surplus: surplus !== null ? `₹${surplus.toLocaleString('en-IN')}` : 'UNKNOWN',
      savings_rate: savingsRate !== null ? `${savingsRate.toFixed(2)}%` : 'UNKNOWN',
      income_source: incomeSource,
      expense_source: expenseSource,
      missing_fields: canonicalState?.missing_fields.join(', ') || 'None',
    },
    reasoning_breakdown: {
      factual_statements_count: transactions.length,
      calculation_statements_count: 3,
      assumption_statements_count: 1,
      interpretation_statements_count: 2,
      guidance_statements_count: 1,
    },
    statements: [
      {
        type: 'FACT',
        text: `Net income: ${income !== null ? `₹${income.toLocaleString('en-IN')}` : 'UNKNOWN'} (source: ${incomeSource}).`,
        basis: incomeSource === 'observed_ledger' ? 'Observed Ledger' : 'Stated Baseline',
      },
      {
        type: 'CALCULATION',
        text: `Total monthly expenses = Essential + Debt = ${expenses !== null ? `₹${expenses.toLocaleString('en-IN')}` : 'UNKNOWN'}.`,
        basis: 'Deterministic Formula',
      },
      {
        type: 'CALCULATION',
        text: `Monthly surplus = Income - Expenses = ${surplus !== null ? `₹${surplus.toLocaleString('en-IN')}` : 'UNKNOWN'}.`,
        basis: 'Deterministic Formula',
      },
      {
        type: 'GENERAL_GUIDANCE',
        text: isDeficit
          ? 'Expenses exceed income; reduce discretionary categories to restore positive monthly surplus.'
          : 'Maintain surplus to sustain emergency buffer and accelerate wealth compounding.',
        basis: 'Advisory Engine',
      },
    ],
    evidence: [
      {
        source_type: 'canonical_snapshot',
        claim: `Snapshot resolved via ${incomeSource} for income and ${expenseSource} for expenses.`,
      },
    ],
  };

  if (authLoading) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-secondary)' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>Verifying secure session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PublicLandingView />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Header: Human-Centered, Outcome-Oriented */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="meta-tag" style={{ marginBottom: '6px' }}>
            Personal CA • {currentMonth}
          </div>
          <h1
            style={{
              fontSize: 'clamp(22px, 4vw, 30px)',
              lineHeight: 1.2,
              fontWeight: 600,
              wordBreak: 'break-word',
            }}
          >
            {loading
              ? 'Evaluating Financial State...'
              : income === null || expenses === null
              ? 'Calibrate Your Workspace'
              : surplus !== null && surplus > 0
              ? "You're building surplus this month."
              : isDeficit
              ? 'Spending exceeds monthly inflow.'
              : 'Cash flow is currently balanced.'}
          </h1>
          <p style={{ color: 'var(--ink-secondary)', marginTop: '4px', fontSize: '13.5px' }}>
            {income === null || expenses === null
              ? 'Provide baseline figures or record transactions to unlock verified insights and your ₹1 Crore path.'
              : 'Deterministic money terrain, what changed, and the single next priority.'}
          </p>
        </div>

        {/* Action Controls - Accessible touch targets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => loadData()}
            className="instrument-btn instrument-btn-secondary"
            title="Sync Latest Data"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', minHeight: '44px' }}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="desktop-only">Sync</span>
          </button>

          <button
            type="button"
            onClick={() => setShowQuickAdd(!showQuickAdd)}
            className="instrument-btn instrument-btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', minHeight: '44px' }}
          >
            <Plus size={14} />
            <span>Record</span>
          </button>

          <Link
            href="/intelligence"
            className="instrument-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minHeight: '44px',
              textDecoration: 'none',
            }}
          >
            <Sparkles size={14} />
            <span>Ask MyCA</span>
          </Link>

          <AdvancedToggle data={advancedData} label="Details" />
        </div>
      </div>

      <hr className="hairline-rule" style={{ margin: 0 }} />

      {/* Quick Record Modal / Inset */}
          {showQuickAdd && (
            <div style={{ marginBottom: '16px' }}>
              <QuickAdd
                onSuccess={() => {
                  loadData();
                  setShowQuickAdd(false);
                }}
                onCancel={() => setShowQuickAdd(false)}
              />
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div
              style={{
                padding: '14px 16px',
                background: 'var(--canvas-surface)',
                border: '1px solid var(--signal-alert)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={18} style={{ color: 'var(--signal-alert)', flexShrink: 0 }} />
                <span style={{ fontSize: '13px' }}>{error}</span>
              </div>
              <button onClick={loadData} className="instrument-btn" style={{ minHeight: '44px' }}>
                Retry
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* HIERARCHY LEVEL 1: HOW AM I DOING? */}
          {/* ========================================================================= */}
          <section aria-labelledby="section-how-doing">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div id="section-how-doing" className="meta-label">
                1. How Am I Doing?
              </div>
              <span style={{ fontSize: '11px', color: 'var(--ink-tertiary)', fontFamily: 'var(--font-mono)' }}>
                {canonicalState?.month || currentMonth}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                border: '1px solid var(--border-hairline)',
                background: 'var(--canvas-surface)',
              }}
            >
              {/* 1A. Money In */}
              <div style={{ padding: '18px 20px', borderRight: '1px solid var(--border-hairline)', borderBottom: '1px solid var(--border-hairline)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span className="meta-tag">Money In</span>
                  {getSourceBadge(incomeSource)}
                </div>
                <div
                  style={{
                    fontSize: 'clamp(20px, 3.5vw, 26px)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: income === null ? 'var(--ink-tertiary)' : 'var(--ink-primary)',
                  }}
                >
                  {income !== null ? `₹${income.toLocaleString('en-IN')}` : 'UNKNOWN'}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--ink-tertiary)', marginTop: '4px' }}>
                  {incomeSource === 'observed_ledger' ? 'Verified from ledger' : incomeSource === 'profile_stated' ? 'Stated monthly baseline' : 'Awaiting baseline input'}
                </div>
              </div>

              {/* 1B. Money Out */}
              <div style={{ padding: '18px 20px', borderRight: '1px solid var(--border-hairline)', borderBottom: '1px solid var(--border-hairline)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span className="meta-tag">Money Out</span>
                  {getSourceBadge(expenseSource)}
                </div>
                <div
                  style={{
                    fontSize: 'clamp(20px, 3.5vw, 26px)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: expenses === null ? 'var(--ink-tertiary)' : 'var(--ink-primary)',
                  }}
                >
                  {expenses !== null ? `₹${expenses.toLocaleString('en-IN')}` : 'UNKNOWN'}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--ink-tertiary)', marginTop: '4px' }}>
                  {expenses !== null && canonicalState?.expenses.monthly_debt_obligations
                    ? `Essential: ₹${(canonicalState.expenses.monthly_essential_expenses ?? 0).toLocaleString('en-IN')} + Debt: ₹${canonicalState.expenses.monthly_debt_obligations.toLocaleString('en-IN')}`
                    : 'Living expenses & obligations'}
                </div>
              </div>

              {/* 1C. Money Left (Surplus) */}
              <div style={{ padding: '18px 20px', borderRight: '1px solid var(--border-hairline)', borderBottom: '1px solid var(--border-hairline)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span className="meta-tag">Money Left</span>
                  {surplus !== null && (
                    <span className={`badge-signal ${isDeficit ? 'badge-terracotta' : 'badge-forest'}`}>
                      {isDeficit ? 'DEFICIT' : 'SURPLUS'}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 'clamp(20px, 3.5vw, 26px)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: surplus === null
                      ? 'var(--ink-tertiary)'
                      : surplus > 0
                      ? 'var(--signal-forest)'
                      : surplus < 0
                      ? 'var(--signal-terracotta)'
                      : 'var(--ink-primary)',
                  }}
                >
                  {surplus === null
                    ? 'UNKNOWN'
                    : `${surplus < 0 ? '-' : '+'}₹${Math.abs(surplus).toLocaleString('en-IN')}`}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--ink-tertiary)', marginTop: '4px' }}>
                  {surplus === null
                    ? 'Requires income & expenses'
                    : surplus > 0
                    ? 'Available for buffer & ₹1 Cr'
                    : surplus < 0
                    ? `Outflow gap: ₹${Math.abs(surplus).toLocaleString('en-IN')}`
                    : 'Break-even'}
                </div>
              </div>

              {/* 1D. Savings Rate */}
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-hairline)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span className="meta-tag">Savings Rate</span>
                  {savingsRate !== null && savingsRate > 20 && (
                    <span className="badge-signal badge-forest">TARGET MET</span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 'clamp(20px, 3.5vw, 26px)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: savingsRate === null
                      ? 'var(--ink-tertiary)'
                      : savingsRate >= 20
                      ? 'var(--signal-forest)'
                      : savingsRate < 0
                      ? 'var(--signal-terracotta)'
                      : 'var(--ink-primary)',
                  }}
                >
                  {savingsRate !== null ? `${savingsRate.toFixed(1)}%` : 'UNKNOWN'}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--ink-tertiary)', marginTop: '4px' }}>
                  {savingsRate === null ? 'Unknown baseline' : 'Portion of net income saved'}
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* TWO-COLUMN OUTCOME GRID: WHAT CHANGED & WHAT SHOULD I DO NEXT */}
          {/* ========================================================================= */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
              gap: '24px',
            }}
          >
            {/* ========================================================================= */}
            {/* HIERARCHY LEVEL 2: 2. What Changed? (DETERMINISTIC CHANGE DETECTION ENGINE) */}
            {/* ========================================================================= */}
            <WhatChangedCard
              changeResult={changeResult}
              transactions={transactions}
              onRecordFirst={() => setShowQuickAdd(true)}
            />

            {/* ========================================================================= */}
            {/* HIERARCHY LEVEL 3: WHAT SHOULD I DO NEXT? */}
            {/* ========================================================================= */}
            <section aria-labelledby="section-what-next" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <div id="section-what-next" className="meta-label" style={{ marginBottom: '10px' }}>
                  3. What Should I Do Next?
                </div>

                <div
                  style={{
                    padding: '20px',
                    background: 'var(--canvas-surface)',
                    borderLeft: `4px solid ${
                      primaryActionPriority.startsWith('P0')
                        ? 'var(--signal-alert)'
                        : 'var(--signal-forest)'
                    }`,
                    borderTop: '1px solid var(--border-hairline)',
                    borderRight: '1px solid var(--border-hairline)',
                    borderBottom: '1px solid var(--border-hairline)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck
                        size={16}
                        style={{
                          color: primaryActionPriority.startsWith('P0')
                            ? 'var(--signal-alert)'
                            : 'var(--signal-forest)',
                        }}
                      />
                      <span className="meta-tag" style={{ color: 'var(--ink-primary)' }}>
                        Single Highest-Priority Action
                      </span>
                    </div>
                    {primaryActionSource && (
                      <span
                        className="badge-signal"
                        style={{
                          fontSize: '10px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--ink-tertiary)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {primaryActionSource}
                      </span>
                    )}
                  </div>

                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>
                    {primaryFocusTitle}
                  </div>

                  <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', lineHeight: 1.5, marginBottom: '14px' }}>
                    {primaryFocusWhy}
                  </p>

                  {primaryFocusEffect && (
                    <div
                      style={{
                        padding: '12px 14px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-hairline)',
                        borderLeft: '3px solid var(--signal-forest)',
                        fontSize: '12.5px',
                        lineHeight: 1.5,
                        color: 'var(--ink-primary)',
                        marginBottom: '16px',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <div style={{ fontSize: '10.5px', color: 'var(--signal-forest)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontWeight: 600 }}>
                        Expected Measurable Effect
                      </div>
                      {primaryFocusEffect}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Link
                      href={primaryActionHref}
                      className="instrument-btn"
                      style={{
                        padding: '10px 18px',
                        fontSize: '13px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        textDecoration: 'none',
                        minHeight: '44px',
                      }}
                    >
                      <span>{primaryActionLabel}</span>
                      <ChevronRight size={14} />
                    </Link>

                    <Link
                      href="/intelligence"
                      style={{
                        fontSize: '12px',
                        color: 'var(--ink-secondary)',
                        textDecoration: 'underline',
                        minHeight: '44px',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      Ask MyCA details
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* ========================================================================= */}
          {/* HIERARCHY LEVEL 4: HOW CLOSE AM I TO ₹1 CRORE? */}
          {/* ========================================================================= */}
          <section aria-labelledby="section-crore-progress">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div id="section-crore-progress" className="meta-label">
                4. How Close Am I to ₹1 Crore?
              </div>
              <Link
                href="/crore"
                style={{
                  fontSize: '12px',
                  color: 'var(--ink-secondary)',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  minHeight: '44px',
                }}
              >
                Detailed math <ChevronRight size={12} />
              </Link>
            </div>

            <div
              style={{
                background: 'var(--canvas-elevated)',
                border: '1px solid var(--border-hairline)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TrendingUp size={16} style={{ color: 'var(--ink-primary)' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>₹1 Crore Shortest Path</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
                    Deterministic compounding trajectory based on your actual monthly contribution.
                  </div>
                </div>

                <Link
                  href="/crore"
                  className="instrument-btn instrument-btn-secondary"
                  style={{ minHeight: '44px', textDecoration: 'none' }}
                >
                  Inspect Scenarios & Milestones
                </Link>
              </div>

              {/* Status Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
                  gap: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-hairline)',
                }}
              >
                <div>
                  <div className="meta-tag">Fastest Target Date</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    {croreStatus?.calculation?.shortest_modeled_path?.target_date ||
                      (income === null ? 'Awaiting Baseline' : 'Simulating...')}
                  </div>
                </div>

                <div>
                  <div className="meta-tag">Current Monthly SIP</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    {surplus !== null && surplus > 0
                      ? `₹${(canonicalState?.capital_and_savings.monthly_investment_capacity ?? surplus).toLocaleString('en-IN')}/mo`
                      : '₹0 / mo'}
                  </div>
                </div>

                <div>
                  <div className="meta-tag">Investable Capital</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    {canonicalState?.capital_and_savings.existing_investments !== null
                      ? `₹${(canonicalState?.capital_and_savings.existing_investments ?? 0).toLocaleString('en-IN')}`
                      : 'Unknown'}
                  </div>
                </div>
              </div>
            </div>
          </section>
    </div>
  );
}
