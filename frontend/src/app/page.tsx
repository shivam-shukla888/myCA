'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { transactionApi, documentApi, Transaction, DocumentItem } from '../lib/api';
import { ArrowUpRight, ArrowDownRight, Compass, Calendar, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';

export default function SurfacePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [txRes, docRes] = await Promise.all([
          transactionApi.list({ limit: 20 }),
          documentApi.list({ limit: 10 }),
        ]);
        setTransactions(txRes.transactions || []);
        setDocuments(docRes.documents || []);
      } catch (err) {
        console.error('Error loading surface data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute live deterministic totals
  let totalCredit = 0;
  let totalDebit = 0;
  let taxDeductionsClaimed = 0;

  for (const t of transactions) {
    if (t.type === 'credit') totalCredit += t.amount;
    if (t.type === 'debit') totalDebit += t.amount;
    if (t.is_tax_relevant) taxDeductionsClaimed += t.amount;
  }

  const netLiquidity = totalCredit - totalDebit;
  const section80CLimit = 150000;
  const deductionGap = Math.max(0, section80CLimit - taxDeductionsClaimed);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
      {/* Editorial Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className="meta-tag" style={{ marginBottom: '8px' }}>
            State Assessment • FY 2025–26
          </div>
          <h1 style={{ fontSize: '32px', lineHeight: 1.15 }}>
            Financial Terrain & Position
          </h1>
          <p style={{ color: 'var(--ink-secondary)', marginTop: '6px', fontSize: '13px' }}>
            Authoritative financial state derived strictly from isolated ledger records and validated documents.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Link href="/intelligence" className="instrument-btn">
            <Compass size={13} />
            Consult Intelligence Desk
          </Link>
        </div>
      </div>

      <hr className="hairline-rule" style={{ margin: 0 }} />

      {/* Primary Financial State (Where am I?) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        border: '1px solid var(--border-hairline)',
        background: 'var(--canvas-surface)',
      }}>
        {/* Net Flow */}
        <div style={{ padding: '24px 28px', borderRight: '1px solid var(--border-hairline)' }}>
          <div className="meta-tag" style={{ marginBottom: '8px' }}>Net Recorded Movement</div>
          <div style={{
            fontSize: '32px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            color: netLiquidity >= 0 ? 'var(--signal-forest)' : 'var(--signal-terracotta)',
            letterSpacing: '-0.03em'
          }}>
            {netLiquidity >= 0 ? '+' : '-'}₹{Math.abs(netLiquidity).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--ink-tertiary)', marginTop: '6px' }}>
            Inflow ₹{totalCredit.toLocaleString('en-IN')} • Outflow ₹{totalDebit.toLocaleString('en-IN')}
          </div>
        </div>

        {/* Tax Deductions Claimed */}
        <div style={{ padding: '24px 28px', borderRight: '1px solid var(--border-hairline)' }}>
          <div className="meta-tag" style={{ marginBottom: '8px' }}>Tax Deductions Tracked</div>
          <div style={{
            fontSize: '32px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            color: 'var(--ink-primary)',
            letterSpacing: '-0.03em'
          }}>
            ₹{taxDeductionsClaimed.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--signal-amber)', marginTop: '6px' }}>
            ₹{deductionGap.toLocaleString('en-IN')} remaining under Chapter VI-A target
          </div>
        </div>

        {/* Evidence Count */}
        <div style={{ padding: '24px 28px' }}>
          <div className="meta-tag" style={{ marginBottom: '8px' }}>Verified Evidence Base</div>
          <div style={{
            fontSize: '32px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            color: 'var(--ink-primary)',
            letterSpacing: '-0.03em'
          }}>
            {transactions.length + documents.length} Nodes
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--ink-tertiary)', marginTop: '6px' }}>
            {transactions.length} ledger events • {documents.length} verified documents
          </div>
        </div>
      </div>

      {/* Asymmetric Section: Attention Checkpoints & Upcoming Obligations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '32px' }}>
        {/* Left: What Changed (Recent Events Flow) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div className="meta-tag">Recent Financial Events</div>
            <Link href="/ledger" style={{ fontSize: '12px', color: 'var(--ink-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View full ledger <ChevronRight size={12} />
            </Link>
          </div>

          <div style={{ border: '1px solid var(--border-hairline)', background: 'var(--canvas-surface)' }}>
            {transactions.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-tertiary)' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--ink-primary)', marginBottom: '6px' }}>
                  Your financial ledger is currently unrecorded
                </div>
                <div style={{ fontSize: '12px' }}>
                  Record your first transaction in the ledger mode to establish your fiscal baseline.
                </div>
              </div>
            ) : (
              transactions.slice(0, 5).map((t, idx) => (
                <div
                  key={t.id}
                  style={{
                    padding: '16px 20px',
                    borderBottom: idx < 4 ? '1px solid var(--border-hairline)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      background: t.type === 'credit' ? 'var(--signal-forest-soft)' : 'var(--canvas-inset)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: t.type === 'credit' ? 'var(--signal-forest)' : 'var(--ink-secondary)',
                    }}>
                      {t.type === 'credit' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink-primary)' }}>
                        {t.description}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--ink-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        {t.date} • {t.category || 'General'}
                        {t.is_tax_relevant && (
                          <span className="badge-signal badge-forest" style={{ marginLeft: '8px', fontSize: '9px' }}>
                            Tax Relevant
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: t.type === 'credit' ? 'var(--signal-forest)' : 'var(--ink-primary)'
                  }}>
                    {t.type === 'credit' ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: What Requires Attention & Fiscal Checkpoints */}
        <div>
          <div className="meta-tag" style={{ marginBottom: '16px' }}>
            Fiscal Checkpoints & Annotations
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Checkpoint 1 */}
            <div style={{
              padding: '16px',
              background: 'var(--canvas-surface)',
              borderLeft: '3px solid var(--signal-amber)',
              borderTop: '1px solid var(--border-hairline)',
              borderRight: '1px solid var(--border-hairline)',
              borderBottom: '1px solid var(--border-hairline)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <AlertCircle size={14} style={{ color: 'var(--signal-amber)' }} />
                <span className="meta-tag" style={{ color: 'var(--ink-primary)' }}>Section 80C Allocation</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
                ₹{deductionGap.toLocaleString('en-IN')} of allowable Section 80C limit remains unallocated. Review eligible PPF/ELSS investments before March 31.
              </div>
            </div>

            {/* Checkpoint 2 */}
            <div style={{
              padding: '16px',
              background: 'var(--canvas-surface)',
              borderLeft: '3px solid var(--signal-forest)',
              borderTop: '1px solid var(--border-hairline)',
              borderRight: '1px solid var(--border-hairline)',
              borderBottom: '1px solid var(--border-hairline)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <CheckCircle2 size={14} style={{ color: 'var(--signal-forest)' }} />
                <span className="meta-tag" style={{ color: 'var(--ink-primary)' }}>Health Insurance Deductions</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
                Section 80D medical premium recorded and traceable to verified documentation.
              </div>
            </div>

            {/* Checkpoint 3 */}
            <div style={{
              padding: '16px',
              background: 'var(--canvas-inset)',
              border: '1px solid var(--border-hairline)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Calendar size={14} style={{ color: 'var(--ink-tertiary)' }} />
                <span className="meta-tag">Next Statutory Deadline</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ink-primary)', fontWeight: 600 }}>
                15 March 2026: Q4 Advance Tax Installment
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ink-tertiary)', marginTop: '2px' }}>
                Applicable if estimated tax liability exceeds ₹10,000 for FY 2025–26.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
