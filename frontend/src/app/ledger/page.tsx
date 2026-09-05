'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  transactionApi,
  Transaction,
  TransactionType,
  MonthlyFinancialSummary,
} from '../../lib/api';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Calendar,
  Edit2,
  Trash2,
  PieChart,
  AlertCircle,
  CheckCircle2,
  X,
  Wallet,
} from 'lucide-react';
import AuthGuard from '../../components/layout/AuthGuard';

const CATEGORY_PRESETS: Record<'income' | 'expense' | 'transfer', string[]> = {
  income: ['Salary', 'Freelance / Consulting', 'Business Revenue', 'Dividend / Interest', 'Rental Income', 'Other Income'],
  expense: [
    'Housing / Rent',
    'Groceries & Food',
    'Utilities & Bills',
    'Transportation / Fuel',
    'Health Insurance (80D)',
    'PPF / ELSS (80C)',
    'Dining & Entertainment',
    'Education & Fees',
    'Shopping',
    'Medical Expenditure',
    'General Expense',
  ],
  transfer: ['Savings Account Transfer', 'Credit Card Payment', 'Investment Inflow', 'Emergency Fund Transfer', 'Wallet Top-up'],
};

export default function LedgerPage() {
  // Current month state in YYYY-MM format
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  const [summary, setSummary] = useState<MonthlyFinancialSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [formType, setFormType] = useState<TransactionType>('expense');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('General Expense');
  const [formAccount, setFormAccount] = useState('Primary Bank');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formIsTaxRelevant, setFormIsTaxRelevant] = useState(false);

  // Month navigation helpers
  const monthDisplayLabel = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, 1));
    return dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }, [currentMonth]);

  function changeMonth(delta: number) {
    const [year, month] = currentMonth.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    const newY = d.getUTCFullYear();
    const newM = String(d.getUTCMonth() + 1).padStart(2, '0');
    setCurrentMonth(`${newY}-${newM}`);
  }

  async function loadMonthData(monthStr: string) {
    setLoading(true);
    setError(null);
    try {
      const [yearStr, monthNumStr] = monthStr.split('-');
      const year = parseInt(yearStr, 10);
      const monthNum = parseInt(monthNumStr, 10);
      const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
      const startDate = `${monthStr}-01`;
      const endDate = `${monthStr}-${String(lastDay).padStart(2, '0')}`;

      const [summaryRes, listRes] = await Promise.all([
        transactionApi.getMonthlySummary(monthStr),
        transactionApi.list({ start_date: startDate, end_date: endDate, limit: 100 }),
      ]);

      setSummary(summaryRes);
      setTransactions(listRes.transactions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load month data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMonthData(currentMonth);
  }, [currentMonth]);

  function handleOpenCreate(defaultType: TransactionType = 'expense') {
    setEditingTxId(null);
    setFormType(defaultType);
    setFormDescription('');
    setFormAmount('');
    setFormCategory(CATEGORY_PRESETS[defaultType === 'transfer' ? 'transfer' : defaultType === 'income' ? 'income' : 'expense'][0]);
    setFormAccount('Primary Bank');
    // Ensure formDate falls within the current selected month
    const today = new Date().toISOString().slice(0, 10);
    if (today.startsWith(currentMonth)) {
      setFormDate(today);
    } else {
      setFormDate(`${currentMonth}-01`);
    }
    setFormIsTaxRelevant(false);
    setIsModalOpen(true);
  }

  function handleOpenEdit(tx: Transaction) {
    setEditingTxId(tx.id);
    let normalizedType: TransactionType = tx.type;
    if (tx.type === 'credit') normalizedType = 'income';
    if (tx.type === 'debit') normalizedType = 'expense';

    setFormType(normalizedType);
    setFormDescription(tx.description);
    setFormAmount(String(tx.amount));
    setFormCategory(tx.category || 'General Expense');
    setFormAccount(tx.account || 'Primary Bank');
    setFormDate(tx.date);
    setFormIsTaxRelevant(Boolean(tx.is_tax_relevant));
    setIsModalOpen(true);
  }

  async function handleSaveTransaction(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(formAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid positive amount greater than 0.');
      return;
    }
    if (!formDescription.trim()) {
      alert('Description is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<Transaction> = {
        description: formDescription.trim(),
        amount: parsedAmount,
        currency: 'INR',
        type: formType,
        category: formCategory.trim(),
        account: formAccount.trim(),
        date: formDate,
        is_tax_relevant: formIsTaxRelevant,
      };

      if (editingTxId) {
        await transactionApi.update(editingTxId, payload);
      } else {
        await transactionApi.create(payload);
      }

      setIsModalOpen(false);
      // If the transaction date belongs to a different month, navigate to that month
      const txMonth = formDate.slice(0, 7);
      if (txMonth !== currentMonth) {
        setCurrentMonth(txMonth);
      } else {
        await loadMonthData(currentMonth);
      }
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteTransaction(id: string, desc: string) {
    if (!window.confirm(`Are you sure you want to delete "${desc}"?`)) {
      return;
    }
    try {
      await transactionApi.delete(id);
      await loadMonthData(currentMonth);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  }

  const isSurplusPositive = (summary?.monthly_surplus ?? 0) >= 0;

  return (<AuthGuard>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Top Banner & Month Navigation Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        padding: '20px 24px',
        background: 'var(--canvas-surface)',
        border: '1px solid var(--border-hairline)'
      }}>
        <div>
          <div className="meta-tag" style={{ marginBottom: '6px' }}>
            Personal AI CA • Monthly Money System
          </div>
          <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 600, letterSpacing: '-0.02em' }}>
            Monthly Financial Snapshot
          </h1>
          <p style={{ color: 'var(--ink-secondary)', margin: '4px 0 0 0', fontSize: '13px' }}>
            Deterministic cash accounting: Income → Expenses → Savings (Surplus). Transfers excluded.
          </p>
        </div>

        {/* Month Selector Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--canvas-inset)',
            border: '1px solid var(--border-hairline)',
            padding: '4px'
          }}>
            <button
              onClick={() => changeMonth(-1)}
              className="action-link"
              title="Previous Month"
              style={{ padding: '6px 8px', display: 'flex', alignItems: 'center' }}
            >
              <ChevronLeft size={16} />
            </button>

            <div style={{ padding: '0 12px', textAlign: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '14px', letterSpacing: '0.02em' }}>
                {monthDisplayLabel}
              </span>
            </div>

            <button
              onClick={() => changeMonth(1)}
              className="action-link"
              title="Next Month"
              style={{ padding: '6px 8px', display: 'flex', alignItems: 'center' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <input
            type="month"
            value={currentMonth}
            onChange={(e) => e.target.value && setCurrentMonth(e.target.value)}
            style={{
              padding: '8px 10px',
              background: 'var(--canvas-inset)',
              border: '1px solid var(--border-hairline)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--ink-primary)',
              cursor: 'pointer',
              outline: 'none'
            }}
          />

          <button
            onClick={() => handleOpenCreate('expense')}
            className="instrument-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px' }}
          >
            <Plus size={15} />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '20px 24px',
          background: 'var(--canvas-surface)',
          border: '1px solid var(--signal-alert)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={20} style={{ color: 'var(--signal-alert)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink-primary)' }}>
                Unable to load ledger records for {monthDisplayLabel}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
                {error}
              </div>
            </div>
          </div>
          <button onClick={() => loadMonthData(currentMonth)} className="instrument-btn" style={{ flexShrink: 0 }}>
            Retry
          </button>
        </div>
      )}

      {/* Primary KPI Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px'
      }}>
        {/* Card 1: Income */}
        <div style={{
          background: 'var(--canvas-surface)',
          border: '1px solid var(--border-hairline)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="meta-tag" style={{ color: 'var(--ink-tertiary)' }}>TOTAL INFLOW</span>
            <TrendingUp size={16} style={{ color: 'var(--signal-forest)' }} />
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            color: 'var(--signal-forest)',
            letterSpacing: '-0.02em'
          }}>
            ₹{(summary?.total_income ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--ink-secondary)' }}>
            {summary?.transaction_count.income ?? 0} income entries recorded
          </div>
        </div>

        {/* Card 2: Expenses */}
        <div style={{
          background: 'var(--canvas-surface)',
          border: '1px solid var(--border-hairline)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="meta-tag" style={{ color: 'var(--ink-tertiary)' }}>TOTAL OUTFLOW</span>
            <TrendingDown size={16} style={{ color: 'var(--signal-alert)' }} />
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            color: 'var(--ink-primary)',
            letterSpacing: '-0.02em'
          }}>
            ₹{(summary?.total_expenses ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--ink-secondary)' }}>
            {summary?.transaction_count.expenses ?? 0} expense entries recorded
          </div>
        </div>

        {/* Card 3: Monthly Surplus / Deficit */}
        <div style={{
          background: 'var(--canvas-surface)',
          border: isSurplusPositive ? '1px solid var(--border-hairline)' : '1px solid var(--signal-alert)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="meta-tag" style={{ color: isSurplusPositive ? 'var(--signal-forest)' : 'var(--signal-alert)' }}>
              {isSurplusPositive ? 'NET SAVED / SURPLUS' : 'MONTHLY DEFICIT'}
            </span>
            <Wallet size={16} style={{ color: isSurplusPositive ? 'var(--signal-forest)' : 'var(--signal-alert)' }} />
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            color: isSurplusPositive ? 'var(--signal-forest)' : 'var(--signal-alert)',
            letterSpacing: '-0.02em'
          }}>
            {isSurplusPositive ? '+' : '-'}₹{Math.abs(summary?.monthly_surplus ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--ink-secondary)' }}>
            {isSurplusPositive ? 'Unallocated liquidity ready for savings' : 'Spending exceeded total monthly inflow'}
          </div>
        </div>

        {/* Card 4: Savings Rate */}
        <div style={{
          background: 'var(--canvas-surface)',
          border: '1px solid var(--border-hairline)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="meta-tag" style={{ color: 'var(--ink-tertiary)' }}>SAVINGS RATE</span>
            <PieChart size={16} style={{ color: 'var(--ink-primary)' }} />
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            color: (summary?.savings_rate ?? 0) >= 20 ? 'var(--signal-forest)' : 'var(--ink-primary)',
            letterSpacing: '-0.02em'
          }}>
            {(summary?.savings_rate ?? 0).toFixed(2)}%
          </div>
          {/* Progress bar */}
          <div style={{ height: '4px', background: 'var(--canvas-inset)', width: '100%', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.max(0, Math.min(100, summary?.savings_rate ?? 0))}%`,
              background: (summary?.savings_rate ?? 0) >= 20 ? 'var(--signal-forest)' : 'var(--ink-secondary)',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--ink-secondary)' }}>
            {(summary?.total_income ?? 0) > 0
              ? `${summary?.savings_rate ?? 0}% of monthly income retained`
              : 'No income recorded this month'}
          </div>
        </div>
      </div>

      {/* Informational Banner for Account Transfers */}
      {(summary?.total_transfers ?? 0) > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 18px',
          background: 'var(--canvas-inset)',
          border: '1px dashed var(--border-hairline)',
          fontSize: '12.5px',
          color: 'var(--ink-secondary)'
        }}>
          <ArrowRightLeft size={16} style={{ color: 'var(--ink-primary)', flexShrink: 0 }} />
          <div>
            <strong style={{ color: 'var(--ink-primary)' }}>Account Transfers: </strong>
            ₹{summary?.total_transfers.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({summary?.transaction_count.transfers} transfers).
            Transfers are movements between your accounts and are strictly excluded from income and expenses.
          </div>
        </div>
      )}

      {/* Expense Category Breakdown & Largest Category Highlight */}
      {summary && summary.categories.length > 0 && (
        <div style={{
          background: 'var(--canvas-surface)',
          border: '1px solid var(--border-hairline)',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div className="meta-tag" style={{ marginBottom: '4px' }}>EXPENDITURE ANALYSIS</div>
              <h3 style={{ fontSize: '16px', margin: 0, fontWeight: 600 }}>Where Money Went</h3>
            </div>

            {summary.largest_expense_category && (
              <div style={{
                padding: '6px 12px',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ color: 'var(--ink-secondary)' }}>Largest Outflow:</span>
                <strong style={{ color: 'var(--ink-primary)' }}>
                  {summary.largest_expense_category.category}
                </strong>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  ₹{summary.largest_expense_category.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({summary.largest_expense_category.percentage}%)
                </span>
              </div>
            )}
          </div>

          {/* Breakdown bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
            {summary.categories.map((cat) => (
              <div key={cat.category} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                  <span style={{ fontWeight: 500 }}>{cat.category}</span>
                  <div style={{ display: 'flex', gap: '12px', fontFamily: 'var(--font-mono)' }}>
                    <span>₹{cat.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    <span style={{ color: 'var(--ink-tertiary)', width: '48px', textAlign: 'right' }}>{cat.percentage}%</span>
                  </div>
                </div>
                <div style={{ height: '6px', background: 'var(--canvas-inset)', width: '100%', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.max(0, Math.min(100, cat.percentage))}%`,
                    background: 'var(--ink-primary)',
                    opacity: 0.85
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ledger Table Section */}
      <div style={{
        background: 'var(--canvas-surface)',
        border: '1px solid var(--border-hairline)',
        overflow: 'hidden'
      }}>
        {/* Table Toolbar Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-hairline)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: '16px', margin: 0, fontWeight: 600 }}>
              Transactions in {monthDisplayLabel}
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--ink-secondary)' }}>
              {transactions.length} total entries recorded
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleOpenCreate('income')}
              className="instrument-btn"
              style={{ fontSize: '11px', padding: '6px 10px' }}
            >
              + Income
            </button>
            <button
              onClick={() => handleOpenCreate('expense')}
              className="instrument-btn"
              style={{ fontSize: '11px', padding: '6px 10px' }}
            >
              + Expense
            </button>
            <button
              onClick={() => handleOpenCreate('transfer')}
              className="instrument-btn"
              style={{ fontSize: '11px', padding: '6px 10px' }}
            >
              + Transfer
            </button>
          </div>
        </div>

        {/* Table Column Headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '110px 2fr 1.2fr 110px 100px 130px 90px',
          padding: '10px 20px',
          background: 'var(--canvas-inset)',
          borderBottom: '1px solid var(--border-hairline)',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.06em',
          color: 'var(--ink-tertiary)'
        }}>
          <div>DATE</div>
          <div>DESCRIPTION</div>
          <div>CATEGORY</div>
          <div>ACCOUNT</div>
          <div>TYPE</div>
          <div style={{ textAlign: 'right' }}>AMOUNT (INR)</div>
          <div style={{ textAlign: 'center' }}>ACTIONS</div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-tertiary)', fontSize: '13px' }}>
            Loading {monthDisplayLabel} ledger events...
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ color: 'var(--ink-tertiary)', fontSize: '14px' }}>
              No transactions recorded for {monthDisplayLabel}.
            </div>
            <p style={{ color: 'var(--ink-secondary)', fontSize: '12.5px', maxWidth: '440px', margin: 0 }}>
              Add your income, expenses, and account transfers above to generate your monthly financial snapshot and calculate your surplus.
            </p>
            <button
              onClick={() => handleOpenCreate('expense')}
              className="instrument-btn"
              style={{ marginTop: '8px' }}
            >
              <Plus size={14} /> Record First Entry
            </button>
          </div>
        ) : (
          transactions.map((tx, idx) => {
            const isIncome = tx.type === 'income' || tx.type === 'credit';
            const isTransfer = tx.type === 'transfer';
            const isExpense = tx.type === 'expense' || tx.type === 'debit';

            return (
              <div
                key={tx.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 2fr 1.2fr 110px 100px 130px 90px',
                  padding: '12px 20px',
                  borderBottom: idx < transactions.length - 1 ? '1px solid var(--border-hairline)' : 'none',
                  alignItems: 'center',
                  fontSize: '12.5px',
                  background: 'var(--canvas-surface)',
                  transition: 'background 0.12s ease'
                }}
              >
                {/* Date */}
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-secondary)' }}>
                  {tx.date}
                </div>

                {/* Description */}
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--ink-primary)' }}>
                    {tx.description}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9.5px', color: 'var(--ink-tertiary)' }}>
                    ID: #{tx.id.slice(0, 8)}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <span className="badge-signal" style={{
                    fontSize: '10px',
                    background: isIncome ? 'rgba(16, 185, 129, 0.08)' : isTransfer ? 'rgba(100, 116, 139, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                    color: isIncome ? 'var(--signal-forest)' : isTransfer ? 'var(--ink-secondary)' : 'var(--ink-primary)',
                    border: '1px solid var(--border-hairline)'
                  }}>
                    {tx.category || 'General'}
                  </span>
                  {tx.is_tax_relevant && (
                    <span className="badge-signal badge-forest" style={{ marginLeft: '4px', fontSize: '9px' }}>
                      80C/80D
                    </span>
                  )}
                </div>

                {/* Account */}
                <div style={{ fontSize: '11.5px', color: 'var(--ink-secondary)' }}>
                  {tx.account || '—'}
                </div>

                {/* Type Badge */}
                <div>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: isIncome ? 'var(--signal-forest)' : isTransfer ? 'var(--ink-secondary)' : 'var(--ink-primary)',
                    padding: '2px 6px',
                    background: 'var(--canvas-inset)',
                    border: '1px solid var(--border-hairline)'
                  }}>
                    {tx.type}
                  </span>
                </div>

                {/* Amount */}
                <div style={{
                  textAlign: 'right',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: isIncome ? 'var(--signal-forest)' : isTransfer ? 'var(--ink-secondary)' : 'var(--ink-primary)'
                }}>
                  {isIncome ? '+' : isTransfer ? '⇄ ' : '-'}₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                  <button
                    onClick={() => handleOpenEdit(tx)}
                    className="action-link"
                    title="Edit transaction"
                    style={{ padding: '4px', display: 'inline-flex' }}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDeleteTransaction(tx.id, tx.description)}
                    className="action-link"
                    title="Delete transaction"
                    style={{ padding: '4px', display: 'inline-flex', color: 'var(--signal-alert)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Transaction Add/Edit Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--canvas-surface)',
            border: '1px solid var(--ink-primary)',
            width: '100%',
            maxWidth: '560px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="meta-tag">
                  {editingTxId ? 'EDIT LEDGER RECORD' : 'NEW TRANSACTION ENTRY'}
                </div>
                <h2 style={{ fontSize: '20px', margin: '4px 0 0 0', fontWeight: 600 }}>
                  {editingTxId ? 'Update Transaction' : 'Record Money Movement'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="action-link"
                style={{ padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Type Switcher Segment Control */}
              <div>
                <label className="meta-tag" style={{ display: 'block', marginBottom: '8px' }}>
                  TRANSACTION CLASSIFICATION
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '8px',
                  background: 'var(--canvas-inset)',
                  padding: '4px',
                  border: '1px solid var(--border-hairline)'
                }}>
                  {(['income', 'expense', 'transfer'] as const).map((t) => {
                    const isSelected = formType === t;
                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => {
                          setFormType(t);
                          setFormCategory(CATEGORY_PRESETS[t][0]);
                        }}
                        style={{
                          padding: '8px 0',
                          border: isSelected ? '1px solid var(--ink-primary)' : '1px solid transparent',
                          background: isSelected ? 'var(--canvas-surface)' : 'transparent',
                          color: isSelected ? 'var(--ink-primary)' : 'var(--ink-tertiary)',
                          fontWeight: isSelected ? 600 : 500,
                          fontSize: '12px',
                          textTransform: 'uppercase',
                          fontFamily: 'var(--font-mono)',
                          cursor: 'pointer',
                          transition: 'all 0.1s ease'
                        }}
                      >
                        {t === 'income' ? 'Income (+)' : t === 'expense' ? 'Expense (-)' : 'Transfer (⇄)'}
                      </button>
                    );
                  })}
                </div>
                {formType === 'transfer' && (
                  <p style={{ fontSize: '11px', color: 'var(--ink-secondary)', margin: '6px 0 0 0' }}>
                    * Transfers move money between accounts and are strictly excluded from income and expense calculations.
                  </p>
                )}
              </div>

              {/* Amount and Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>
                    AMOUNT (INR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--canvas-inset)',
                      border: '1px solid var(--border-hairline)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '14px',
                      fontWeight: 600,
                      outline: 'none',
                      color: 'var(--ink-primary)'
                    }}
                  />
                </div>

                <div>
                  <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>
                    EFFECTIVE DATE *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--canvas-inset)',
                      border: '1px solid var(--border-hairline)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12.5px',
                      outline: 'none',
                      color: 'var(--ink-primary)'
                    }}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>
                  DESCRIPTION *
                </label>
                <input
                  type="text"
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={formType === 'income' ? 'e.g. Monthly Salary, Freelance retainer' : formType === 'transfer' ? 'e.g. Transfer to Emergency Fund' : 'e.g. Groceries, Rent, Electricity'}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--canvas-inset)',
                    border: '1px solid var(--border-hairline)',
                    fontSize: '13px',
                    outline: 'none',
                    color: 'var(--ink-primary)'
                  }}
                />
              </div>

              {/* Category and Account */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>
                    CATEGORY
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--canvas-inset)',
                      border: '1px solid var(--border-hairline)',
                      fontSize: '12.5px',
                      outline: 'none',
                      color: 'var(--ink-primary)'
                    }}
                  >
                    {(CATEGORY_PRESETS[formType === 'transfer' ? 'transfer' : formType === 'income' ? 'income' : 'expense'] || []).map((preset) => (
                      <option key={preset} value={preset}>{preset}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>
                    ACCOUNT / SOURCE
                  </label>
                  <input
                    type="text"
                    value={formAccount}
                    onChange={(e) => setFormAccount(e.target.value)}
                    placeholder="e.g. HDFC Salary, ICICI, Cash"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--canvas-inset)',
                      border: '1px solid var(--border-hairline)',
                      fontSize: '12.5px',
                      outline: 'none',
                      color: 'var(--ink-primary)'
                    }}
                  />
                </div>
              </div>

              {/* Tax relevant checkbox */}
              {formType === 'expense' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    checked={formIsTaxRelevant}
                    onChange={(e) => setFormIsTaxRelevant(e.target.checked)}
                  />
                  <span>Mark as Tax Deductible (Sec 80C / 80D / Chapter VI-A)</span>
                </label>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid var(--border-hairline)',
                    color: 'var(--ink-secondary)',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="instrument-btn"
                  style={{ padding: '8px 20px', opacity: isSubmitting ? 0.7 : 1 }}
                >
                  {isSubmitting ? 'Saving...' : editingTxId ? 'Update Record' : 'Commit Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  </AuthGuard> );
}
