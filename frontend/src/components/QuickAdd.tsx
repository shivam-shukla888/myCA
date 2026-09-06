'use client';

import React, { useState } from 'react';
import { Plus, Check, AlertCircle, ArrowUpRight, ArrowDownRight, RefreshCw, X } from 'lucide-react';
import { transactionApi, Transaction } from '../lib/api';

interface QuickAddProps {
  onSuccess?: (transaction: Transaction) => void;
  onCancel?: () => void;
}

interface ParsedDraft {
  amount: number;
  type: 'income' | 'expense';
  description: string;
  category: string;
  date: string;
}

export default function QuickAdd({ onSuccess, onCancel }: QuickAddProps) {
  const [inputMode, setInputMode] = useState<'nlp' | 'manual'>('nlp');
  const [nlpText, setNlpText] = useState('');
  
  // Staging / Extraction state
  const [draft, setDraft] = useState<ParsedDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Manual fallback fields
  const [manualAmount, setManualAmount] = useState('');
  const [manualType, setManualType] = useState<'income' | 'expense'>('expense');
  const [manualDesc, setManualDesc] = useState('');
  const [manualCategory, setManualCategory] = useState('General');

  // Input parsing: EXTRACT step
  const handleExtractFromText = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const text = nlpText.trim();
    if (!text) {
      setError('Please enter a description (e.g., "₹450 grocery at Blinkit" or "Salary ₹60,000")');
      return;
    }

    // Extract amount: numbers with optional commas or ₹ symbol
    const amountMatch = text.match(/(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    let amount = 0;
    if (amountMatch && amountMatch[1]) {
      amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }

    if (isNaN(amount) || amount <= 0) {
      setError('Could not detect a valid amount. Try format like "₹500 for books".');
      return;
    }

    // Determine type: income vs expense
    const isIncome = /\b(salary|received|credit|deposit|freelance|dividend|earned|refund)\b/i.test(text);
    const type: 'income' | 'expense' = isIncome ? 'income' : 'expense';

    // Extract category guess
    let category = 'General';
    if (/\b(grocery|groceries|supermarket|blinkit|zepto|instamart|milk|vegetables)\b/i.test(text)) category = 'Groceries';
    else if (/\b(dinner|lunch|cafe|coffee|starbucks|restaurant|swiggy|zomato|food)\b/i.test(text)) category = 'Dining';
    else if (/\b(fuel|petrol|diesel|uber|ola|cab|auto|metro|flight|train)\b/i.test(text)) category = 'Transport';
    else if (/\b(rent|electricity|wifi|water|maintenance|bill|utility)\b/i.test(text)) category = 'Utilities';
    else if (/\b(salary|client|bonus|dividend|freelance)\b/i.test(text)) category = 'Income';
    else if (/\b(hospital|doctor|medicine|pharmacy|clinic|dental)\b/i.test(text)) category = 'Healthcare';

    // Clean description
    let cleanDesc = text
      .replace(/(?:₹|rs\.?|inr)?\s*[\d,]+(?:\.\d{1,2})?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanDesc) cleanDesc = `${category} transaction`;

    const today = new Date().toISOString().split('T')[0];

    // STAGE FOR USER CONFIRMATION (Rule: EXTRACT -> SHOW USER -> USER CONFIRMS -> STORE)
    setDraft({
      amount,
      type,
      description: cleanDesc,
      category,
      date: today,
    });
  };

  const handleManualStage = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsedAmount = parseFloat(manualAmount.replace(/,/g, ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }
    if (!manualDesc.trim()) {
      setError('Please enter a short description.');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    setDraft({
      amount: parsedAmount,
      type: manualType,
      description: manualDesc.trim(),
      category: manualCategory,
      date: today,
    });
  };

  // FINAL USER CONFIRMATION & STORE STEP
  const handleConfirmAndSave = async () => {
    if (!draft) return;
    setIsSaving(true);
    setError(null);

    try {
      const res = await transactionApi.create({
        amount: draft.amount,
        type: draft.type === 'income' ? 'credit' : 'debit',
        description: draft.description,
        category: draft.category,
        date: draft.date,
        currency: 'INR',
        is_tax_relevant: draft.category === 'Healthcare' || draft.type === 'income',
        gst_applicable: false,
      });

      setSuccessMsg(`Recorded: ${draft.description} (₹${draft.amount.toLocaleString('en-IN')})`);
      setDraft(null);
      setNlpText('');
      setManualAmount('');
      setManualDesc('');

      if (onSuccess) {
        onSuccess(res);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save transaction';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        background: 'var(--canvas-surface)',
        border: '1px solid var(--border-strong)',
        padding: '20px',
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="meta-tag">Quick Record • Input Automation</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, marginTop: '2px' }}>
            Record an Entry
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => { setInputMode('nlp'); setDraft(null); }}
            style={{
              padding: '4px 8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              border: '1px solid var(--border-hairline)',
              background: inputMode === 'nlp' ? 'var(--canvas-inset)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            Natural Text
          </button>
          <button
            type="button"
            onClick={() => { setInputMode('manual'); setDraft(null); }}
            style={{
              padding: '4px 8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              border: '1px solid var(--border-hairline)',
              background: inputMode === 'manual' ? 'var(--canvas-inset)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            Standard Form
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: 'var(--signal-terracotta-soft)', border: '1px solid var(--signal-terracotta)', fontSize: '12px', color: 'var(--signal-terracotta)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ padding: '8px 12px', background: 'var(--signal-forest-soft)', border: '1px solid var(--signal-forest)', fontSize: '12px', color: 'var(--signal-forest)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={14} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Input Mode 1: Natural Text Extraction */}
      {!draft && inputMode === 'nlp' && (
        <form onSubmit={handleExtractFromText} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={nlpText}
              onChange={(e) => setNlpText(e.target.value)}
              placeholder="e.g. ₹550 organic milk at Blinkit or Freelance ₹35,000"
              style={{
                flex: 1,
                padding: '10px 14px',
                border: '1px solid var(--border-hairline)',
                background: 'var(--canvas-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                color: 'var(--ink-primary)',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              className="instrument-btn"
              style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              Parse & Preview
            </button>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--ink-tertiary)' }}>
            Strict Rule: Extracted entries are never silently committed without your explicit confirmation.
          </div>
        </form>
      )}

      {/* Input Mode 2: Standard Form */}
      {!draft && inputMode === 'manual' && (
        <form onSubmit={handleManualStage} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          <div>
            <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Type</label>
            <select
              value={manualType}
              onChange={(e) => setManualType(e.target.value as any)}
              style={{ width: '100%', padding: '8px', background: 'var(--canvas-primary)', border: '1px solid var(--border-hairline)' }}
            >
              <option value="expense">Expense (Outflow)</option>
              <option value="income">Income (Inflow)</option>
            </select>
          </div>
          <div>
            <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Amount (₹)</label>
            <input
              type="number"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              placeholder="e.g. 1500"
              style={{ width: '100%', padding: '8px', background: 'var(--canvas-primary)', border: '1px solid var(--border-hairline)', fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div>
            <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Description</label>
            <input
              type="text"
              value={manualDesc}
              onChange={(e) => setManualDesc(e.target.value)}
              placeholder="e.g. Electricity Bill"
              style={{ width: '100%', padding: '8px', background: 'var(--canvas-primary)', border: '1px solid var(--border-hairline)' }}
            />
          </div>
          <div>
            <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Category</label>
            <select
              value={manualCategory}
              onChange={(e) => setManualCategory(e.target.value)}
              style={{ width: '100%', padding: '8px', background: 'var(--canvas-primary)', border: '1px solid var(--border-hairline)' }}
            >
              <option value="General">General</option>
              <option value="Groceries">Groceries</option>
              <option value="Dining">Dining</option>
              <option value="Transport">Transport</option>
              <option value="Utilities">Utilities</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Income">Income</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button type="submit" className="instrument-btn">
              Stage for Review
            </button>
          </div>
        </form>
      )}

      {/* CONFIRMATION / PREVIEW STAGE (No silent modification) */}
      {draft && (
        <div
          style={{
            background: 'var(--canvas-elevated)',
            border: '1px solid var(--border-strong)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="meta-tag" style={{ color: 'var(--signal-amber)' }}>
              Step 2 of 2: Confirm Staged Entry
            </span>
            <button
              onClick={() => setDraft(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-tertiary)' }}
              title="Discard staging"
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: draft.type === 'income' ? 'var(--signal-forest-soft)' : 'var(--signal-terracotta-soft)',
                  color: draft.type === 'income' ? 'var(--signal-forest)' : 'var(--signal-terracotta)',
                }}
              >
                {draft.type === 'income' ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13.5px' }}>{draft.description}</div>
                <div style={{ fontSize: '11px', color: 'var(--ink-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  {draft.date} • {draft.category} • {draft.type.toUpperCase()}
                </div>
              </div>
            </div>

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 600, color: draft.type === 'income' ? 'var(--signal-forest)' : 'var(--ink-primary)' }}>
              {draft.type === 'income' ? '+' : '-'}₹{draft.amount.toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setDraft(null)}
              style={{
                padding: '6px 14px',
                background: 'transparent',
                border: '1px solid var(--border-hairline)',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Adjust / Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleConfirmAndSave}
              className="instrument-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isSaving ? <RefreshCw size={13} className="spin" /> : <Check size={13} />}
              <span>{isSaving ? 'Recording...' : 'Confirm & Save to Ledger'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
