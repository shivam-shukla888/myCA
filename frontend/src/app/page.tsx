'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { AuthRequiredState } from '../components/auth/AuthRequiredState';
import { transactionApi, allocationApi, Transaction, MonthlyAllocationPlan, MonthlyFinancialSummary } from '../lib/api';
import AdvancedToggle, { AdvancedDetailsData } from '../components/AdvancedToggle';
import QuickAdd from '../components/QuickAdd';
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Plus,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

export default function SurfacePage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allocationPlan, setAllocationPlan] = useState<MonthlyAllocationPlan | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<MonthlyFinancialSummary | null>(null);
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
      const [summaryRes, planRes, txRes] = await Promise.allSettled([
        transactionApi.getMonthlySummary(currentMonth),
        allocationApi.getPlanForMonth(currentMonth),
        transactionApi.list({ limit: 10 }),
      ]);

      if (summaryRes.status === 'fulfilled' && summaryRes.value) {
        setMonthlySummary(summaryRes.value);
      }

      if (planRes.status === 'fulfilled' && planRes.value) {
        setAllocationPlan(planRes.value);
      }

      if (txRes.status === 'fulfilled') {
        setTransactions(txRes.value.transactions || []);
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

  // Derived verified canonical metrics: Observed ledger takes precedence; stated profile plan is fallback
  const hasTransactions = Boolean(
    monthlySummary && (monthlySummary.total_income > 0 || monthlySummary.total_expenses > 0)
  );
  const income = hasTransactions ? (monthlySummary?.total_income ?? 0) : (allocationPlan?.monthly_income ?? 0);
  const expenses = hasTransactions ? (monthlySummary?.total_expenses ?? 0) : (allocationPlan?.monthly_expenses ?? 0);
  const surplus = hasTransactions ? (monthlySummary?.monthly_surplus ?? (income - expenses)) : (allocationPlan?.monthly_surplus ?? (income - expenses));
  const savingsRate = hasTransactions
    ? (monthlySummary?.savings_rate ?? (income > 0 ? Math.max(0, Math.round(((surplus > 0 ? surplus : 0) / income) * 100)) : 0))
    : (income > 0 ? Math.max(0, Math.round(((surplus > 0 ? surplus : 0) / income) * 100)) : 0);

  // Focus Engine: Identify ONE Primary Financial Priority
  let primaryFocusTitle = 'Establish Your Baseline';
  let primaryFocusMessage = 'Record your regular income and monthly expenses so MyCA can calculate your actual surplus.';
  let primaryActionLabel = 'Record First Entry';
  let primaryActionHref = '/ledger';

  if (income > 0) {
    if (surplus <= 0) {
      primaryFocusTitle = 'Control Outflow Pressure';
      primaryFocusMessage = 'Your spending currently equals or exceeds income this month. Pausing discretionary purchases will free up cash.';
      primaryActionLabel = 'Review Spending Categories';
      primaryActionHref = '/ledger';
    } else if (allocationPlan?.emergency_fund && !allocationPlan.emergency_fund.is_complete) {
      const gap = allocationPlan.emergency_fund.emergency_fund_gap;
      primaryFocusTitle = 'Build Your Safety Buffer';
      primaryFocusMessage = `You have ₹${surplus.toLocaleString('en-IN')} left this month. Allocating this toward your safety buffer brings you closer to your ₹${allocationPlan.emergency_fund.emergency_fund_target.toLocaleString('en-IN')} target (₹${gap.toLocaleString('en-IN')} remaining).`;
      primaryActionLabel = 'Allocate to Safety Fund';
      primaryActionHref = '/plan';
    } else {
      primaryFocusTitle = 'Accelerate Financial Freedom';
      primaryFocusMessage = `Your surplus is healthy at ₹${surplus.toLocaleString('en-IN')} (${savingsRate.toFixed(0)}% savings rate). Direct extra savings to your long-term wealth goals.`;
      primaryActionLabel = 'View Goals & Freedom Plan';
      primaryActionHref = '/plan';
    }
  }

  // Prepare progressive disclosure data for advanced users
  const advancedData: AdvancedDetailsData = {
    answer: `Monthly financial assessment for ${currentMonth}`,
    provider_used: 'Server-Side Deterministic Calculator',
    confidence_score: 1.0,
    risk_level: surplus < 0 ? 'MEDIUM' : 'LOW',
    deterministic_calculations: {
      total_income: income,
      total_expenses: expenses,
      monthly_surplus: surplus,
      savings_rate: `${savingsRate.toFixed(2)}%`,
      emergency_fund_target: allocationPlan?.emergency_fund?.emergency_fund_target ?? 'Needs essential expenses input',
      emergency_gap: allocationPlan?.emergency_fund?.emergency_fund_gap ?? 'N/A',
      coverage_months: allocationPlan?.emergency_fund?.coverage_months ?? 0,
    },
    reasoning_breakdown: {
      factual_statements_count: transactions.length,
      calculation_statements_count: 4,
      assumption_statements_count: 1,
      interpretation_statements_count: 2,
      guidance_statements_count: 1,
    },
    statements: [
      { type: 'FACT', text: `Recorded income for current cycle is ₹${income.toLocaleString('en-IN')}.`, basis: 'Ledger Aggregation' },
      { type: 'FACT', text: `Recorded expenses for current cycle are ₹${expenses.toLocaleString('en-IN')}.`, basis: 'Ledger Aggregation' },
      { type: 'CALCULATION', text: `Actual monthly surplus = ₹${income.toLocaleString('en-IN')} - ₹${expenses.toLocaleString('en-IN')} = ₹${surplus.toLocaleString('en-IN')}.`, basis: 'Deterministic Formula' },
      { type: 'ASSUMPTION', text: 'Emergency fund target calculated based on 3 to 6 months of essential monthly obligations.', basis: 'Framework Default' },
      { type: 'INTERPRETATION', text: surplus >= 0 ? 'Cash flow provides buffer for savings and goal allocation.' : 'Outflow exceeds monthly inflows.', basis: 'Surplus Analysis' },
      { type: 'GENERAL_GUIDANCE', text: 'Building a liquid safety buffer first shields against debt during unexpected shocks.', basis: 'Educational Framework' },
    ],
    evidence: [
      { source_type: 'ledger_summary', claim: `${transactions.length} verified transactions recorded in isolated ledger.` },
    ],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header: Human-Centered, Simple */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="meta-tag" style={{ marginBottom: '6px' }}>
            Personal CA • {currentMonth}
          </div>
          <h1 style={{ fontSize: '30px', lineHeight: 1.2, fontWeight: 500 }}>
            {surplus >= 0 ? "You're building surplus this month." : "Let's bring your expenses into balance."}
          </h1>
          <p style={{ color: 'var(--ink-secondary)', marginTop: '4px', fontSize: '13.5px' }}>
            A clear view of your money, what changed, and the single next step that matters most.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => loadData()}
            className="instrument-btn"
            title="Sync Latest Data"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>

          <button
            onClick={() => setShowQuickAdd(!showQuickAdd)}
            className="instrument-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} />
            <span>Quick Record</span>
          </button>

          <Link
            href="/intelligence"
            className="instrument-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--ink-primary)', color: 'var(--canvas-primary)' }}
          >
            <Sparkles size={14} />
            <span>Ask MyCA</span>
          </Link>

          {/* Progressive Disclosure for Advanced Technical Inspection */}
          <AdvancedToggle data={advancedData} label="⚙️ Details" />
        </div>
      </div>

      <hr className="hairline-rule" style={{ margin: 0 }} />

      {/* Auth Loading / Guest State */}
      {authLoading && (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
          Reconciling workspace state...
        </div>
      )}

      {!authLoading && !isAuthenticated && (
        <AuthRequiredState
          modeTag="PERSONAL CA • WELCOME"
          title="Sign in to your Personal Financial Coach"
          description="Understand your money, track your actual surplus, and take small steps to build financial freedom."
        />
      )}

      {/* Authenticated Dashboard */}
      {!authLoading && isAuthenticated && (
        <>
          {/* Optional Quick Add Drawer */}
          {showQuickAdd && (
            <div style={{ marginBottom: '12px' }}>
              <QuickAdd
                onSuccess={() => {
                  loadData();
                  setShowQuickAdd(false);
                }}
                onCancel={() => setShowQuickAdd(false)}
              />
            </div>
          )}

          {/* Error Banner with Retry */}
          {error && (
            <div style={{ padding: '16px 20px', background: 'var(--canvas-surface)', border: '1px solid var(--signal-alert)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={18} style={{ color: 'var(--signal-alert)' }} />
                <span style={{ fontSize: '13px' }}>{error}</span>
              </div>
              <button onClick={loadData} className="instrument-btn">Retry</button>
            </div>
          )}

          {/* SECTION 1: HOW AM I DOING? */}
          <div>
            <div className="meta-label" style={{ marginBottom: '12px' }}>
              1. How am I doing?
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                border: '1px solid var(--border-hairline)',
                background: 'var(--canvas-surface)',
              }}
            >
              {/* Income */}
              <div style={{ padding: '20px 24px', borderRight: '1px solid var(--border-hairline)' }}>
                <div className="meta-tag" style={{ marginBottom: '6px' }}>Money In</div>
                <div style={{ fontSize: '28px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-primary)' }}>
                  ₹{income.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--ink-tertiary)', marginTop: '4px' }}>
                  This month&apos;s recorded income
                </div>
              </div>

              {/* Expenses */}
              <div style={{ padding: '20px 24px', borderRight: '1px solid var(--border-hairline)' }}>
                <div className="meta-tag" style={{ marginBottom: '6px' }}>Money Out</div>
                <div style={{ fontSize: '28px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-primary)' }}>
                  ₹{expenses.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--ink-tertiary)', marginTop: '4px' }}>
                  Living expenses & bills
                </div>
              </div>

              {/* Surplus (Money Left) */}
              <div style={{ padding: '20px 24px', borderRight: '1px solid var(--border-hairline)' }}>
                <div className="meta-tag" style={{ marginBottom: '6px' }}>Money Left (Surplus)</div>
                <div
                  style={{
                    fontSize: '28px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: surplus >= 0 ? 'var(--signal-forest)' : 'var(--signal-terracotta)',
                  }}
                >
                  {surplus >= 0 ? '+' : '-'}₹{Math.abs(surplus).toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--ink-tertiary)', marginTop: '4px' }}>
                  {surplus >= 0 ? 'Available for savings & freedom' : 'Monthly deficit to balance'}
                </div>
              </div>

              {/* Savings Rate */}
              <div style={{ padding: '20px 24px' }}>
                <div className="meta-tag" style={{ marginBottom: '6px' }}>Savings Buffer</div>
                <div style={{ fontSize: '28px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: savingsRate > 20 ? 'var(--signal-forest)' : 'var(--ink-primary)' }}>
                  {savingsRate.toFixed(1)}%
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--ink-tertiary)', marginTop: '4px' }}>
                  Percentage of income retained
                </div>
              </div>
            </div>
          </div>

          {/* TWO COLUMN GRID: SECTIONS 2, 3, 4 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '28px' }}>
            
            {/* SECTION 2: WHAT CHANGED? */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div className="meta-label">2. What changed?</div>
                <Link href="/ledger" style={{ fontSize: '12px', color: 'var(--ink-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Full history <ChevronRight size={12} />
                </Link>
              </div>

              <div style={{ border: '1px solid var(--border-hairline)', background: 'var(--canvas-surface)' }}>
                {transactions.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-tertiary)' }}>
                    <p style={{ fontSize: '13px', marginBottom: '12px' }}>No entries recorded yet.</p>
                    <button onClick={() => setShowQuickAdd(true)} className="instrument-btn">
                      Add Your First Entry
                    </button>
                  </div>
                ) : (
                  transactions.slice(0, 5).map((t, idx) => (
                    <div
                      key={t.id}
                      style={{
                        padding: '14px 18px',
                        borderBottom: idx < 4 ? '1px solid var(--border-hairline)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '26px',
                            height: '26px',
                            background: t.type === 'credit' || t.type === 'income' ? 'var(--signal-forest-soft)' : 'var(--canvas-inset)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: t.type === 'credit' || t.type === 'income' ? 'var(--signal-forest)' : 'var(--ink-secondary)',
                          }}
                        >
                          {t.type === 'credit' || t.type === 'income' ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{t.description}</div>
                          <div style={{ fontSize: '11px', color: 'var(--ink-tertiary)', fontFamily: 'var(--font-mono)' }}>
                            {t.date} • {t.category || 'General'}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '13.5px',
                          fontWeight: 600,
                          color: t.type === 'credit' || t.type === 'income' ? 'var(--signal-forest)' : 'var(--ink-primary)',
                        }}
                      >
                        {t.type === 'credit' || t.type === 'income' ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* RIGHT SIDE: SECTIONS 3 & 4 (WHAT MATTERS & WHAT SHOULD I DO NEXT) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* SECTION 3: WHAT MATTERS? (Focus Engine) */}
              <div>
                <div className="meta-label" style={{ marginBottom: '12px' }}>3. What matters?</div>
                <div
                  style={{
                    padding: '20px 22px',
                    background: 'var(--canvas-surface)',
                    borderLeft: '4px solid var(--signal-forest)',
                    borderTop: '1px solid var(--border-hairline)',
                    borderRight: '1px solid var(--border-hairline)',
                    borderBottom: '1px solid var(--border-hairline)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <ShieldCheck size={16} style={{ color: 'var(--signal-forest)' }} />
                    <span className="meta-tag" style={{ color: 'var(--ink-primary)' }}>Focus This Month</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>
                    {primaryFocusTitle}
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
                    {primaryFocusMessage}
                  </p>
                </div>
              </div>

              {/* SECTION 4: WHAT SHOULD I DO NEXT? (Single Clear CTA) */}
              <div>
                <div className="meta-label" style={{ marginBottom: '12px' }}>4. What should I do next?</div>
                <div
                  style={{
                    padding: '20px 22px',
                    background: 'var(--canvas-elevated)',
                    border: '1px solid var(--border-strong)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink-primary)', marginBottom: '4px' }}>
                      One Next Action
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
                      Small consistent steps build long-term financial security without stress or guesswork.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <Link
                      href={primaryActionHref}
                      className="instrument-btn"
                      style={{
                        background: 'var(--ink-primary)',
                        color: 'var(--canvas-primary)',
                        padding: '10px 18px',
                        fontSize: '13px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        textDecoration: 'none',
                      }}
                    >
                      <span>{primaryActionLabel}</span>
                      <ChevronRight size={14} />
                    </Link>

                    <Link
                      href="/intelligence"
                      style={{
                        fontSize: '12.5px',
                        color: 'var(--ink-secondary)',
                        textDecoration: 'underline',
                        marginLeft: '8px',
                      }}
                    >
                      Or discuss with MyCA
                    </Link>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  );
}
