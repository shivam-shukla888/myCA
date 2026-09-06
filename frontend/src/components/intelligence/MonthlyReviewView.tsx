'use client';

import React from 'react';
import Link from 'next/link';
import {
  StructuredMonthlyReview,
  FinancialMetricChange,
  ReviewMilestone,
} from '../../lib/api';
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
  Target,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  RefreshCw,
  Info,
  Check,
  Clock,
  Compass,
} from 'lucide-react';

interface MonthlyReviewViewProps {
  review: StructuredMonthlyReview | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `₹${amount.toLocaleString('en-IN')}`;
}

function MetricDeltaPill({ change, isPercentage = false }: { change: FinancialMetricChange; isPercentage?: boolean }) {
  if (change.delta === null || change.direction === 'BASELINE') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '11px',
          padding: '2px 8px',
          background: 'var(--canvas-surface)',
          border: '1px solid var(--border-hairline)',
          color: 'var(--ink-secondary)',
        }}
      >
        <Minus size={11} /> Baseline
      </span>
    );
  }

  const isPositive = change.delta > 0;
  const isImproved = change.direction === 'IMPROVED';
  const isDegraded = change.direction === 'DEGRADED';

  const color = isImproved
    ? 'var(--signal-forest)'
    : isDegraded
    ? 'var(--signal-terracotta)'
    : 'var(--ink-secondary)';

  const formattedDelta = isPercentage
    ? `${isPositive ? '+' : ''}${change.delta}% pts`
    : `${isPositive ? '+' : ''}₹${Math.abs(change.delta).toLocaleString('en-IN')}`;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
        fontWeight: 600,
        padding: '2px 8px',
        background: isImproved
          ? 'rgba(34, 197, 94, 0.08)'
          : isDegraded
          ? 'rgba(239, 68, 68, 0.08)'
          : 'var(--canvas-surface)',
        border: `1px solid ${isImproved ? 'rgba(34, 197, 94, 0.25)' : isDegraded ? 'rgba(239, 68, 68, 0.25)' : 'var(--border-hairline)'}`,
        color,
      }}
    >
      {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {formattedDelta}
    </span>
  );
}

export function MonthlyReviewView({
  review,
  loading,
  error,
  onRefresh,
}: MonthlyReviewViewProps) {
  if (loading && !review) {
    return (
      <div
        style={{
          padding: '48px 24px',
          background: 'var(--canvas-surface)',
          border: '1px solid var(--border-hairline)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            border: '2px solid var(--ink-primary)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <div style={{ textAlign: 'center' }}>
          <div className="meta-tag" style={{ color: 'var(--ink-primary)', marginBottom: '4px' }}>
            COMPILING MONTHLY FINANCIAL REVIEW
          </div>
          <div style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
            Calculating month-over-month variance, emergency fund trajectory, and ₹1 Crore milestones...
          </div>
        </div>
      </div>
    );
  }

  if (error && !review) {
    return (
      <div
        style={{
          padding: '32px',
          background: 'var(--canvas-surface)',
          border: '1px solid var(--signal-terracotta)',
          borderLeft: '4px solid var(--signal-terracotta)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div className="meta-tag" style={{ color: 'var(--signal-terracotta)' }}>
          REVIEW UNAVAILABLE • ERROR RECOVERY
        </div>
        <div style={{ fontSize: '14px', color: 'var(--ink-primary)', fontWeight: 600 }}>
          {error}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
          Ensure your financial profile and transaction ledger have active entries. All review metrics are derived from verified ledger data.
        </div>
        <div>
          <button onClick={onRefresh} className="instrument-btn" style={{ padding: '8px 16px', fontSize: '12px' }}>
            <RefreshCw size={13} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div
        style={{
          padding: '40px',
          background: 'var(--canvas-surface)',
          border: '1px solid var(--border-hairline)',
          textAlign: 'center',
        }}
      >
        <Calendar size={32} style={{ color: 'var(--ink-secondary)', marginBottom: '12px' }} />
        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>
          No Monthly Review Generated Yet
        </div>
        <div style={{ fontSize: '13px', color: 'var(--ink-secondary)', maxWidth: '480px', margin: '0 auto 20px' }}>
          Generate your monthly financial audit to answer what changed, what improved, what got worse, and your ONE next action.
        </div>
        <button onClick={onRefresh} className="instrument-btn" style={{ padding: '10px 20px', fontSize: '12px' }}>
          <Calendar size={14} /> Generate Monthly Review
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 0. Top Header Bar */}
      <div
        style={{
          padding: '20px 24px',
          background: 'var(--canvas-surface)',
          border: '1px solid var(--border-hairline)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span className="meta-tag" style={{ color: 'var(--ink-primary)', fontWeight: 700 }}>
              MONTHLY FINANCIAL REVIEW • {review.month}
            </span>
            {review.has_prior_month_data ? (
              <span className="badge-signal badge-forest" style={{ fontSize: '9.5px' }}>
                <CheckCircle2 size={10} /> MONTH-OVER-MONTH ACTIVE
              </span>
            ) : (
              <span className="badge-signal badge-amber" style={{ fontSize: '9.5px' }}>
                <Info size={10} /> BASELINE MONTH (NO PRIOR DATA)
              </span>
            )}
            <span className="badge-signal" style={{ fontSize: '9.5px', background: 'var(--canvas-inset)', color: 'var(--ink-secondary)' }}>
              ZERO DARK PATTERNS
            </span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
            Objective mathematical review answering the 9 essential questions regarding your income, expenses, surplus, and freedom roadmap.
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="instrument-btn"
          style={{
            fontSize: '11px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
          }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Re-auditing...' : 'Refresh Review'}
        </button>
      </div>

      {/* Prior Month Unavailable Notice (Anti-Fabrication Guarantee) */}
      {!review.has_prior_month_data && (
        <div
          style={{
            padding: '14px 18px',
            background: 'var(--canvas-surface)',
            borderLeft: '4px solid var(--signal-amber)',
            borderTop: '1px solid var(--border-hairline)',
            borderRight: '1px solid var(--border-hairline)',
            borderBottom: '1px solid var(--border-hairline)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <Info size={16} style={{ color: 'var(--signal-amber)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-primary)', marginBottom: '2px' }}>
              PRIOR MONTH DATA UNAVAILABLE
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
              {review.prior_month_note ||
                'This review establishes your verified baseline. Variance indicators and deltas are omitted rather than invented.'}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 9 ESSENTIAL QUESTIONS PRESENTATION                           */}
      {/* ============================================================ */}

      {/* Q1: WHAT CHANGED? */}
      <div
        style={{
          background: 'var(--canvas-surface)',
          border: '1px solid var(--border-hairline)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="meta-tag" style={{ color: 'var(--ink-primary)', fontWeight: 700 }}>
              1. WHAT CHANGED?
            </span>
            <div style={{ fontSize: '13px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
              Month-over-month shifts across your primary cashflow pillars.
            </div>
          </div>
          <span className="badge-signal badge-forest" style={{ fontSize: '9px' }}>
            VERIFIED VARIANCE
          </span>
        </div>

        {/* 4 Pillars Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
          }}
        >
          {/* Income */}
          <div
            style={{
              padding: '16px',
              background: 'var(--canvas-inset)',
              border: '1px solid var(--border-hairline)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="meta-tag">MONEY IN (INCOME)</span>
              <MetricDeltaPill change={review.what_changed.income} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {formatCurrency(review.what_changed.income.current)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-secondary)' }}>
              {review.what_changed.income.previous !== null
                ? `Prior: ${formatCurrency(review.what_changed.income.previous)}`
                : 'Baseline month'}
            </div>
          </div>

          {/* Expenses */}
          <div
            style={{
              padding: '16px',
              background: 'var(--canvas-inset)',
              border: '1px solid var(--border-hairline)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="meta-tag">MONEY OUT (EXPENSES)</span>
              <MetricDeltaPill change={review.what_changed.expenses} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {formatCurrency(review.what_changed.expenses.current)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-secondary)' }}>
              {review.what_changed.expenses.previous !== null
                ? `Prior: ${formatCurrency(review.what_changed.expenses.previous)}`
                : 'Baseline month'}
            </div>
          </div>

          {/* Surplus */}
          <div
            style={{
              padding: '16px',
              background: 'var(--canvas-inset)',
              border: '1px solid var(--border-hairline)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="meta-tag">MONTHLY SURPLUS</span>
              <MetricDeltaPill change={review.what_changed.surplus} />
            </div>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                color: (review.what_changed.surplus.current ?? 0) >= 0 ? 'var(--signal-forest)' : 'var(--signal-terracotta)',
              }}
            >
              {formatCurrency(review.what_changed.surplus.current)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-secondary)' }}>
              {review.what_changed.surplus.previous !== null
                ? `Prior: ${formatCurrency(review.what_changed.surplus.previous)}`
                : 'Baseline month'}
            </div>
          </div>

          {/* Savings Rate */}
          <div
            style={{
              padding: '16px',
              background: 'var(--canvas-inset)',
              border: '1px solid var(--border-hairline)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="meta-tag">SAVINGS RATE</span>
              <MetricDeltaPill change={review.what_changed.savings_rate} isPercentage />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {review.what_changed.savings_rate.current !== null ? `${review.what_changed.savings_rate.current}%` : '—'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-secondary)' }}>
              {review.what_changed.savings_rate.previous !== null
                ? `Prior: ${review.what_changed.savings_rate.previous}%`
                : 'Baseline month'}
            </div>
          </div>
        </div>

        {/* Narrative Summary */}
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--canvas-inset)',
            borderLeft: '3px solid var(--ink-primary)',
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--ink-primary)',
          }}
        >
          {review.what_changed.summary}
        </div>
      </div>

      {/* Q2: WHY DID IT CHANGE? */}
      <div
        style={{
          background: 'var(--canvas-surface)',
          border: '1px solid var(--border-hairline)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <span className="meta-tag" style={{ color: 'var(--ink-primary)', fontWeight: 700 }}>
          2. WHY DID IT CHANGE?
        </span>

        <div style={{ fontSize: '13.5px', lineHeight: 1.5, color: 'var(--ink-primary)' }}>
          {review.why_it_changed.summary}
        </div>

        {review.why_it_changed.top_category_drivers && review.why_it_changed.top_category_drivers.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span className="meta-tag" style={{ fontSize: '9.5px' }}>
              PRIMARY CATEGORY DRIVERS
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              {review.why_it_changed.top_category_drivers.map((driver, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 14px',
                    background: 'var(--canvas-inset)',
                    border: '1px solid var(--border-hairline)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{driver.category}</div>
                    <div style={{ fontSize: '11px', color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)' }}>
                      Current: {formatCurrency(driver.current_amount)}
                    </div>
                  </div>
                  {driver.delta !== null && (
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                        color: driver.delta > 0 ? 'var(--signal-amber)' : 'var(--signal-forest)',
                      }}
                    >
                      {driver.delta > 0 ? `+₹${driver.delta.toLocaleString('en-IN')}` : `-₹${Math.abs(driver.delta).toLocaleString('en-IN')}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Q3 & Q4: WHAT IMPROVED? & WHAT GOT WORSE? (Split Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Q3: WHAT IMPROVED? */}
        <div
          style={{
            background: 'var(--canvas-surface)',
            border: '1px solid var(--border-hairline)',
            borderLeft: '4px solid var(--signal-forest)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} style={{ color: 'var(--signal-forest)' }} />
            <span className="meta-tag" style={{ color: 'var(--signal-forest)', fontWeight: 700 }}>
              3. WHAT IMPROVED?
            </span>
          </div>

          <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--ink-secondary)' }}>
            {review.what_improved.summary}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            {review.what_improved.items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  fontSize: '13px',
                  color: 'var(--ink-primary)',
                  lineHeight: 1.4,
                }}
              >
                <Check size={14} style={{ color: 'var(--signal-forest)', flexShrink: 0, marginTop: '3px' }} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Q4: WHAT GOT WORSE? (Constructive, zero shame) */}
        <div
          style={{
            background: 'var(--canvas-surface)',
            border: '1px solid var(--border-hairline)',
            borderLeft: '4px solid var(--signal-amber)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} style={{ color: 'var(--signal-amber)' }} />
            <span className="meta-tag" style={{ color: 'var(--signal-amber)', fontWeight: 700 }}>
              4. WHAT GOT WORSE?
            </span>
          </div>

          <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--ink-secondary)' }}>
            {review.what_got_worse.summary}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            {review.what_got_worse.items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  fontSize: '13px',
                  color: 'var(--ink-primary)',
                  lineHeight: 1.4,
                }}
              >
                <Minus size={14} style={{ color: 'var(--signal-amber)', flexShrink: 0, marginTop: '3px' }} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Q5: WHAT IS MY CURRENT SURPLUS? */}
      <div
        style={{
          background: 'var(--canvas-surface)',
          border: '1px solid var(--border-hairline)',
          borderLeft: `4px solid ${review.current_surplus.is_deficit ? 'var(--signal-terracotta)' : 'var(--signal-forest)'}`,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <span className="meta-tag" style={{ color: 'var(--ink-primary)', fontWeight: 700 }}>
              5. WHAT IS MY CURRENT SURPLUS?
            </span>
            <div style={{ fontSize: '12.5px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
              Canonical formula breakdown strictly audited: Income − Total Expenses = Monthly Surplus.
            </div>
          </div>
          <span
            className={`badge-signal ${review.current_surplus.is_deficit ? 'badge-terracotta' : 'badge-forest'}`}
            style={{ fontSize: '10px' }}
          >
            {review.current_surplus.status_label}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: review.current_surplus.is_deficit ? 'var(--signal-terracotta)' : 'var(--signal-forest)',
            }}
          >
            {review.current_surplus.formatted}
          </div>
          <span style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
            available for emergency buffer, debt clearance, and compounding wealth
          </span>
        </div>

        {/* Explicit Formula Box */}
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--canvas-inset)',
            border: '1px solid var(--border-hairline)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12.5px',
            color: 'var(--ink-primary)',
          }}
        >
          <span style={{ color: 'var(--ink-secondary)', marginRight: '8px' }}>FORMULA:</span>
          {review.current_surplus.formula_breakdown}
        </div>
      </div>

      {/* Q6 & Q7: SAVINGS RATE TREND & EMERGENCY FUND PROGRESS (Split Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Q6: SAVINGS RATE CHANGING */}
        <div
          style={{
            background: 'var(--canvas-surface)',
            border: '1px solid var(--border-hairline)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <span className="meta-tag" style={{ color: 'var(--ink-primary)', fontWeight: 700 }}>
            6. HOW IS MY SAVINGS RATE CHANGING?
          </span>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <div style={{ fontSize: '32px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {review.savings_rate_trend.current_rate !== null ? `${review.savings_rate_trend.current_rate}%` : '—'}
            </div>
            {review.savings_rate_trend.delta_percentage_points !== null && (
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  color:
                    review.savings_rate_trend.delta_percentage_points > 0
                      ? 'var(--signal-forest)'
                      : review.savings_rate_trend.delta_percentage_points < 0
                      ? 'var(--signal-terracotta)'
                      : 'var(--ink-secondary)',
                }}
              >
                {review.savings_rate_trend.delta_percentage_points > 0
                  ? `+${review.savings_rate_trend.delta_percentage_points}% pts vs prior`
                  : `${review.savings_rate_trend.delta_percentage_points}% pts vs prior`}
              </span>
            )}
          </div>

          <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--ink-primary)' }}>
            {review.savings_rate_trend.trend_description}
          </div>
        </div>

        {/* Q7: EMERGENCY FUND PROGRESSING */}
        <div
          style={{
            background: 'var(--canvas-surface)',
            border: '1px solid var(--border-hairline)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="meta-tag" style={{ color: 'var(--ink-primary)', fontWeight: 700 }}>
              7. HOW IS MY EMERGENCY FUND PROGRESSING?
            </span>
            <span
              className={`badge-signal ${
                review.emergency_fund_progress.status === 'FULLY_FUNDED'
                  ? 'badge-forest'
                  : 'badge-amber'
              }`}
              style={{ fontSize: '9.5px' }}
            >
              {review.emergency_fund_progress.status.replace('_', ' ')}
            </span>
          </div>

          {/* Progress Bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600 }}>{review.emergency_fund_progress.progress_pct}% Funded</span>
              <span style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(review.emergency_fund_progress.current_amount)} / {formatCurrency(review.emergency_fund_progress.target_amount)}
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '8px',
                background: 'var(--canvas-inset)',
                border: '1px solid var(--border-hairline)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, review.emergency_fund_progress.progress_pct)}%`,
                  height: '100%',
                  background:
                    review.emergency_fund_progress.status === 'FULLY_FUNDED'
                      ? 'var(--signal-forest)'
                      : 'var(--signal-amber)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          <div style={{ fontSize: '12.5px', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
            {review.emergency_fund_progress.coverage_months} months of essential monthly expenses covered.
            {review.emergency_fund_progress.month_over_month_change && (
              <span style={{ display: 'block', marginTop: '4px', color: 'var(--ink-primary)', fontWeight: 500 }}>
                {review.emergency_fund_progress.month_over_month_change}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Q8: DID MY ₹1Cr PATH ACCELERATE OR SLOW DOWN? */}
      <div
        style={{
          background: 'var(--canvas-surface)',
          border: '1px solid var(--border-hairline)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <span className="meta-tag" style={{ color: 'var(--ink-primary)', fontWeight: 700 }}>
              8. DID MY ₹1Cr PATH ACCELERATE OR SLOW DOWN?
            </span>
            <div style={{ fontSize: '12.5px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
              Deterministic compounding trajectory toward your ₹1 Crore milestone.
            </div>
          </div>
          <span
            className={`badge-signal ${
              review.crore_path_trajectory.status === 'ACCELERATED'
                ? 'badge-forest'
                : review.crore_path_trajectory.status === 'SLOWED_DOWN'
                ? 'badge-terracotta'
                : 'badge-amber'
            }`}
            style={{ fontSize: '10px' }}
          >
            {review.crore_path_trajectory.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            padding: '16px',
            background: 'var(--canvas-inset)',
            border: '1px solid var(--border-hairline)',
          }}
        >
          <div>
            <div className="meta-tag">TARGET DATE</div>
            <div style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {review.crore_path_trajectory.current_target_date || 'Incalculable'}
            </div>
          </div>
          <div>
            <div className="meta-tag">TIME REMAINING</div>
            <div style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {review.crore_path_trajectory.current_months_to_target !== null
                ? `${review.crore_path_trajectory.current_months_to_target} months (${(review.crore_path_trajectory.current_months_to_target / 12).toFixed(1)} yrs)`
                : '—'}
            </div>
          </div>
          <div>
            <div className="meta-tag">TRAJECTORY SHIFT</div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                color:
                  (review.crore_path_trajectory.months_delta ?? 0) < 0
                    ? 'var(--signal-forest)'
                    : (review.crore_path_trajectory.months_delta ?? 0) > 0
                    ? 'var(--signal-terracotta)'
                    : 'var(--ink-primary)',
              }}
            >
              {review.crore_path_trajectory.months_delta !== null
                ? review.crore_path_trajectory.months_delta < 0
                  ? `${Math.abs(review.crore_path_trajectory.months_delta)} months faster`
                  : review.crore_path_trajectory.months_delta > 0
                  ? `${review.crore_path_trajectory.months_delta} months slower`
                  : 'Pace maintained'
                : 'Baseline established'}
            </div>
          </div>
        </div>

        <div style={{ fontSize: '13.5px', lineHeight: 1.5, color: 'var(--ink-primary)' }}>
          {review.crore_path_trajectory.summary}
        </div>
      </div>

      {/* Q9: WHAT ONE ACTION MATTERS NEXT? (Hero Action Card) */}
      <div
        style={{
          background: 'var(--canvas-surface)',
          border: '2px solid var(--ink-primary)',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={18} style={{ color: 'var(--ink-primary)' }} />
            <span className="meta-tag" style={{ color: 'var(--ink-primary)', fontWeight: 700 }}>
              9. WHAT ONE ACTION MATTERS NEXT?
            </span>
          </div>
          <span
            className="badge-signal"
            style={{
              background: 'var(--ink-primary)',
              color: 'var(--ink-inverted)',
              fontSize: '10px',
              fontWeight: 600,
            }}
          >
            PRIORITY: {review.one_action_matters_next.priority_area.replace(/_/g, ' ')}
          </span>
        </div>

        <div
          style={{
            fontSize: '18px',
            fontWeight: 600,
            lineHeight: 1.4,
            color: 'var(--ink-primary)',
          }}
        >
          {review.one_action_matters_next.action}
        </div>

        <div
          style={{
            fontSize: '13px',
            color: 'var(--ink-secondary)',
            lineHeight: 1.5,
            padding: '12px 14px',
            background: 'var(--canvas-inset)',
            borderLeft: '3px solid var(--ink-primary)',
          }}
        >
          <strong style={{ color: 'var(--ink-primary)' }}>Why this matters now: </strong>
          {review.one_action_matters_next.reason}
        </div>
      </div>

      {/* ============================================================ */}
      {/* MEANINGFUL FINANCIAL MILESTONES SECTION                      */}
      {/* ============================================================ */}
      <div
        style={{
          background: 'var(--canvas-surface)',
          border: '1px solid var(--border-hairline)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <span className="meta-tag" style={{ color: 'var(--ink-primary)', fontWeight: 700 }}>
              MEANINGFUL FINANCIAL MILESTONES
            </span>
            <div style={{ fontSize: '12.5px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
              Real wealth milestones achieved through discipline and math — never artificial engagement streaks.
            </div>
          </div>
          <span className="badge-signal badge-forest" style={{ fontSize: '9.5px' }}>
            <Award size={10} /> OUTCOME DRIVEN
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '14px',
          }}
        >
          {review.milestones.map((milestone) => {
            const isAchieved = milestone.status === 'ACHIEVED';
            const isInProgress = milestone.status === 'IN_PROGRESS';

            return (
              <div
                key={milestone.id}
                style={{
                  padding: '16px',
                  background: isAchieved ? 'rgba(34, 197, 94, 0.04)' : 'var(--canvas-inset)',
                  border: `1px solid ${isAchieved ? 'rgba(34, 197, 94, 0.3)' : 'var(--border-hairline)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink-primary)' }}>
                    {milestone.title}
                  </span>
                  <span
                    className={`badge-signal ${
                      isAchieved
                        ? 'badge-forest'
                        : isInProgress
                        ? 'badge-amber'
                        : ''
                    }`}
                    style={{
                      fontSize: '9px',
                      background: !isAchieved && !isInProgress ? 'var(--canvas-surface)' : undefined,
                      color: !isAchieved && !isInProgress ? 'var(--ink-secondary)' : undefined,
                    }}
                  >
                    {isAchieved ? '✓ ACHIEVED' : isInProgress ? 'IN PROGRESS' : 'LOCKED'}
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
                  {milestone.description}
                </div>

                {milestone.progress_pct !== undefined && !isAchieved && (
                  <div style={{ marginTop: '4px' }}>
                    <div
                      style={{
                        width: '100%',
                        height: '4px',
                        background: 'var(--canvas-surface)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${milestone.progress_pct}%`,
                          height: '100%',
                          background: 'var(--signal-amber)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* ANTI-DARK PATTERN TRANSPARENCY GUARANTEE                     */}
      {/* ============================================================ */}
      <div
        style={{
          padding: '18px 22px',
          background: 'var(--canvas-surface)',
          border: '1px solid var(--border-hairline)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={16} style={{ color: 'var(--signal-forest)' }} />
          <span className="meta-tag" style={{ color: 'var(--ink-primary)', fontWeight: 700 }}>
            RETENTION WITHOUT DARK PATTERNS • ETHICAL FINANCIAL ARCHITECTURE
          </span>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
          MyCA is engineered to cultivate calm, lifelong financial agency. We strictly reject manufactured gamification.
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span className="badge-signal badge-forest" style={{ fontSize: '9.5px' }}>
            ✓ NO STREAK ANXIETY
          </span>
          <span className="badge-signal badge-forest" style={{ fontSize: '9.5px' }}>
            ✓ NO SHAMING OR GUILT
          </span>
          <span className="badge-signal badge-forest" style={{ fontSize: '9.5px' }}>
            ✓ NO FEAR OR SCARING
          </span>
          <span className="badge-signal badge-forest" style={{ fontSize: '9.5px' }}>
            ✓ NO FOMO OR PEER PRESSURE
          </span>
          <span className="badge-signal badge-forest" style={{ fontSize: '9.5px' }}>
            ✓ NO FAKE URGENCY
          </span>
          <span className="badge-signal badge-forest" style={{ fontSize: '9.5px' }}>
            ✓ NO SPAM NOTIFICATIONS
          </span>
        </div>
      </div>
    </div>
  );
}
