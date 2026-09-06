'use client';

import React from 'react';
import Link from 'next/link';
import { ChangeDetectionResult, DetectedChange, Transaction } from '../../lib/api';
import {
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Info,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

interface WhatChangedCardProps {
  changeResult: ChangeDetectionResult | null;
  transactions: Transaction[];
  onRecordFirst: () => void;
}

export function WhatChangedCard({
  changeResult,
  transactions,
  onRecordFirst,
}: WhatChangedCardProps) {
  const hasHistory = changeResult?.has_sufficient_history ?? false;
  const topChanges = changeResult?.top_changes || [];

  return (
    <section aria-labelledby="section-what-changed">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div id="section-what-changed" className="meta-label">
          2. What Changed?
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            href="/intelligence"
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
            Monthly review <ChevronRight size={12} />
          </Link>
          <Link
            href="/ledger"
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
            Ledger view <ChevronRight size={12} />
          </Link>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border-hairline)', background: 'var(--canvas-surface)' }}>
        {/* CASE 1: Sufficient history with detected material changes (Top 3 Maximum) */}
        {hasHistory && topChanges.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {topChanges.map((change, idx) => {
              const isPositive = change.direction === 'POSITIVE';
              const isCritical = change.materiality_level === 'CRITICAL';
              const isSignificant = change.materiality_level === 'SIGNIFICANT';

              return (
                <div
                  key={change.id}
                  style={{
                    padding: '16px 20px',
                    borderBottom: idx < topChanges.length - 1 ? '1px solid var(--border-hairline)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          background: 'var(--ink-primary)',
                          color: 'var(--ink-inverted)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        #{change.rank}
                      </span>
                      <span
                        className={`badge-signal ${
                          isCritical
                            ? 'badge-terracotta'
                            : isSignificant
                            ? 'badge-amber'
                            : ''
                        }`}
                        style={{
                          fontSize: '9px',
                          background: !isCritical && !isSignificant ? 'var(--canvas-inset)' : undefined,
                          color: !isCritical && !isSignificant ? 'var(--ink-secondary)' : undefined,
                        }}
                      >
                        {change.materiality_level}
                      </span>
                      <span className="meta-tag" style={{ fontSize: '10px' }}>
                        {change.title}
                      </span>
                    </div>

                    {/* Formatted Delta */}
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: isPositive ? 'var(--signal-forest)' : 'var(--signal-terracotta)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                      {change.formatted_delta}
                    </div>
                  </div>

                  {/* Headline */}
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink-primary)', lineHeight: 1.4 }}>
                    {change.headline}
                  </div>

                  {/* Deterministic Explanation */}
                  <div style={{ fontSize: '12px', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
                    {change.deterministic_explanation}
                  </div>

                  {/* Strict Source Data Badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '2px',
                      fontSize: '10.5px',
                      color: 'var(--ink-tertiary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <ShieldCheck size={11} style={{ color: 'var(--signal-forest)' }} />
                    <span>Source: {change.source_data.data_source.replace('_', ' ')} ({change.source_data.current_period} vs {change.source_data.previous_period})</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : hasHistory && topChanges.length === 0 ? (
          /* CASE 2: Sufficient history but no material shifts (Stable baseline) */
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-secondary)' }}>
            <Minus size={20} style={{ margin: '0 auto 8px', color: 'var(--ink-tertiary)' }} />
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-primary)', marginBottom: '4px' }}>
              No Material Changes Detected
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-secondary)', maxWidth: '360px', margin: '0 auto' }}>
              Income, spending, emergency reserves, and ₹1 Crore trajectory remained within stability bounds compared to the prior period.
            </div>
          </div>
        ) : (
          /* CASE 3: Insufficient History State */
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                padding: '16px 20px',
                background: 'var(--canvas-inset)',
                borderBottom: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <Info size={16} style={{ color: 'var(--signal-amber)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-primary)', marginBottom: '2px' }}>
                  INSUFFICIENT HISTORY FOR DETERMINISTIC CHANGE DETECTION
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
                  At least two valid consecutive financial periods are required to calculate material variance. Showing recent ledger entries for baseline context.
                </div>
              </div>
            </div>

            {/* Fallback Recent Entries */}
            {transactions.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-tertiary)' }}>
                <p style={{ fontSize: '13px', marginBottom: '12px' }}>
                  No ledger transactions recorded for this cycle yet.
                </p>
                <button
                  type="button"
                  onClick={onRecordFirst}
                  className="instrument-btn"
                  style={{ minHeight: '44px' }}
                >
                  Record First Entry
                </button>
              </div>
            ) : (
              transactions.slice(0, 3).map((t, idx) => (
                <div
                  key={t.id}
                  style={{
                    padding: '12px 16px',
                    borderBottom: idx < Math.min(transactions.length, 3) - 1 ? '1px solid var(--border-hairline)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        flexShrink: 0,
                        background:
                          t.type === 'credit' || t.type === 'income' ? 'var(--signal-forest-soft)' : 'var(--canvas-inset)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color:
                          t.type === 'credit' || t.type === 'income' ? 'var(--signal-forest)' : 'var(--ink-secondary)',
                      }}
                    >
                      {t.type === 'credit' || t.type === 'income' ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.description}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--ink-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        {t.date} • {t.category || 'General'}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      flexShrink: 0,
                      color:
                        t.type === 'credit' || t.type === 'income' ? 'var(--signal-forest)' : 'var(--ink-primary)',
                    }}
                  >
                    {t.type === 'credit' || t.type === 'income' ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}
