'use client';

import React, { useEffect, useState } from 'react';
import { transactionApi, Transaction } from '../../lib/api';
import { Plus, ArrowDownRight, ArrowUpRight, Filter } from 'lucide-react';

export default function LedgerPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'debit' | 'credit'>('debit');
  const [category, setCategory] = useState('ppf');
  const [date, setDate] = useState('2026-03-01');
  const [isTaxRelevant, setIsTaxRelevant] = useState(true);

  async function loadTransactions() {
    setLoading(true);
    try {
      const res = await transactionApi.list({ limit: 50 });
      setTransactions(res.transactions || []);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description || !amount) return;

    try {
      await transactionApi.create({
        description,
        amount: parseFloat(amount),
        currency: 'INR',
        type,
        category,
        date,
        is_tax_relevant: isTaxRelevant,
      });

      setDescription('');
      setAmount('');
      setShowAddForm(false);
      await loadTransactions();
    } catch (err: any) {
      alert(`Transaction creation failed: ${err.message}`);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className="meta-tag" style={{ marginBottom: '8px' }}>
            Continuous Temporal Stream • FY 2025–26
          </div>
          <h1 style={{ fontSize: '32px', lineHeight: 1.15 }}>
            Financial Ledger & Event Stream
          </h1>
          <p style={{ color: 'var(--ink-secondary)', marginTop: '6px', fontSize: '13px' }}>
            All incoming liquidity flows, business debits, and Chapter VI-A deductions recorded with forensic provenance.
          </p>
        </div>

        <button onClick={() => setShowAddForm(!showAddForm)} className="instrument-btn">
          <Plus size={14} />
          {showAddForm ? 'Close Entry Desk' : 'Record Transaction'}
        </button>
      </div>

      <hr className="hairline-rule" style={{ margin: 0 }} />

      {/* Inline Entry Desk */}
      {showAddForm && (
        <form onSubmit={handleSubmit} style={{
          padding: '24px',
          background: 'var(--canvas-surface)',
          border: '1px solid var(--ink-primary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div className="meta-tag" style={{ color: 'var(--ink-primary)' }}>
            Instrument Entry Desk • New Ledger Event
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. PPF Deposit, Health Insurance"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--canvas-inset)',
                  border: '1px solid var(--border-hairline)',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>Amount (INR)</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="₹ 0.00"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--canvas-inset)',
                  border: '1px solid var(--border-hairline)',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>Direction</label>
              <select
                value={type}
                onChange={(e: any) => setType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--canvas-inset)',
                  border: '1px solid var(--border-hairline)',
                  outline: 'none'
                }}
              >
                <option value="debit">Debit (Expense / Investment)</option>
                <option value="credit">Credit (Inflow / Income)</option>
              </select>
            </div>

            <div>
              <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--canvas-inset)',
                  border: '1px solid var(--border-hairline)',
                  outline: 'none'
                }}
              >
                <option value="ppf">Public Provident Fund (80C)</option>
                <option value="elss">ELSS Mutual Fund (80C)</option>
                <option value="health_insurance">Health Insurance (80D)</option>
                <option value="salary">Salary Inflow</option>
                <option value="freelance">Professional Fees (44ADA)</option>
                <option value="rent">House Rent (HRA)</option>
                <option value="general">General Operating Expense</option>
              </select>
            </div>

            <div>
              <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>Effective Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--canvas-inset)',
                  border: '1px solid var(--border-hairline)',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={isTaxRelevant}
                onChange={(e) => setIsTaxRelevant(e.target.checked)}
              />
              <span style={{ fontWeight: 500 }}>Classify as Tax Deductible (Income Tax Act 1961)</span>
            </label>

            <button type="submit" className="instrument-btn">
              Commit to Ledger
            </button>
          </div>
        </form>
      )}

      {/* Ledger Table */}
      <div style={{ border: '1px solid var(--border-hairline)', background: 'var(--canvas-surface)' }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '120px 2fr 1.2fr 100px 140px',
          padding: '12px 20px',
          background: 'var(--canvas-inset)',
          borderBottom: '1px solid var(--border-hairline)',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.06em',
          color: 'var(--ink-tertiary)'
        }}>
          <div>EVENT DATE</div>
          <div>DESCRIPTION / RECORD</div>
          <div>CATEGORY / SECTION</div>
          <div>TYPE</div>
          <div style={{ textAlign: 'right' }}>AMOUNT (INR)</div>
        </div>

        {/* Rows */}
        {transactions.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-tertiary)' }}>
            No recorded transactions found. Click "Record Transaction" above to add an entry.
          </div>
        ) : (
          transactions.map((t, idx) => (
            <div
              key={t.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 2fr 1.2fr 100px 140px',
                padding: '14px 20px',
                borderBottom: idx < transactions.length - 1 ? '1px solid var(--border-hairline)' : 'none',
                alignItems: 'center',
                fontSize: '12.5px',
                transition: 'background 0.1s ease',
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-tertiary)' }}>
                {t.date}
              </div>

              <div>
                <div style={{ fontWeight: 600, color: 'var(--ink-primary)' }}>
                  {t.description}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-tertiary)' }}>
                  ID: #{t.id.slice(0, 8)}
                </div>
              </div>

              <div>
                <span className="badge-signal badge-amber" style={{ fontSize: '10px' }}>
                  {t.category || 'general'}
                </span>
                {t.is_tax_relevant && (
                  <span className="badge-signal badge-forest" style={{ marginLeft: '6px', fontSize: '9px' }}>
                    Sec 80C/80D
                  </span>
                )}
              </div>

              <div>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: t.type === 'credit' ? 'var(--signal-forest)' : 'var(--ink-secondary)',
                  textTransform: 'uppercase'
                }}>
                  {t.type}
                </span>
              </div>

              <div style={{
                textAlign: 'right',
                fontFamily: 'var(--font-mono)',
                fontSize: '13.5px',
                fontWeight: 600,
                color: t.type === 'credit' ? 'var(--signal-forest)' : 'var(--ink-primary)'
              }}>
                {t.type === 'credit' ? '+' : '-'}₹{t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
