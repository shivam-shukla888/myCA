'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { chatApi, ChatResponse, MonthlyReviewResponse, ApiError } from '../../lib/api';
import { ConfidenceMeter } from '../../components/intelligence/ConfidenceMeter';
import { EvidenceNode } from '../../components/intelligence/EvidenceNode';
import { DisclaimerGate } from '../../components/intelligence/DisclaimerGate';
import {
  Send,
  Sparkles,
  ShieldCheck,
  Lock,
  Calendar,
} from 'lucide-react';

export default function IntelligencePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'coach' | 'review'>('coach');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<MonthlyReviewResponse | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [inquiryHistory, setInquiryHistory] = useState<Array<{ query: string; response: ChatResponse }>>([]);

  const QUICK_ACTIONS = [
    { label: 'Review my month', query: 'Review my month' },
    { label: 'Where did my money go?', query: 'Where did most of my money go this month?' },
    { label: 'Am I on track?', query: 'Am I on track for financial freedom?' },
    { label: 'What should I improve?', query: 'What should I improve next month?' },
    { label: 'Explain my allocation', query: 'Explain my current monthly savings allocation' },
    { label: 'Can I afford this?', query: 'Can I afford a ₹20,000 phone?' },
  ];

  const [error, setError] = useState<{ message: string; safeToRetry: boolean; isAuthError?: boolean } | null>(null);

  async function handleExecute(inquiryText = query) {
    if (!inquiryText.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      if (inquiryText.toLowerCase() === 'review my month' || inquiryText.toLowerCase().includes('monthly review')) {
        const res = await chatApi.getMonthlyReview(undefined, conversationId);
        setAnalysis(res);
        setConversationId(res.conversation_id);
        setInquiryHistory((prev) => [{ query: inquiryText, response: res }, ...prev]);
        setQuery('');
      } else {
        const res = await chatApi.sendMessage(inquiryText, conversationId);
        setAnalysis(res as MonthlyReviewResponse);
        setConversationId(res.conversation_id);
        setInquiryHistory((prev) => [{ query: inquiryText, response: res }, ...prev]);
        setQuery('');
      }
    } catch (err: unknown) {
      const isApiError = err instanceof ApiError;
      const status = isApiError ? err.status : 0;
      const code = isApiError ? err.code : '';
      const message = err instanceof Error ? err.message : 'The intelligence pipeline encountered an error during evaluation.';
      const isAuthError =
        status === 401 ||
        code.includes('UNAUTHORIZED') ||
        message.toLowerCase().includes('authentication') ||
        message.toLowerCase().includes('unauthorized');
      setError({
        message: isAuthError
          ? 'Authentication required. Your session is unauthenticated or has expired.'
          : message,
        safeToRetry: true,
        isAuthError,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleMonthlyReview() {
    setLoading(true);
    setError(null);
    try {
      const res = await chatApi.getMonthlyReview(undefined, conversationId);
      setAnalysis(res);
      setConversationId(res.conversation_id);
      setInquiryHistory((prev) => [{ query: 'Monthly Financial Review', response: res }, ...prev]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate monthly review.';
      setError({
        message,
        safeToRetry: true,
      });
    } finally {
      setLoading(false);
    }
  }

  interface ReviewPoints {
    whatWentWell?: string;
    mainPressure?: string;
    currentPriority?: string;
    nextAction?: string;
    explanation?: string;
  }

  // Parse structured review points if present in answer
  function parseReviewPoints(answerText: string): ReviewPoints {
    const whatWentWellMatch = answerText.match(/\*\*What Went Well:\*\*\s*([^\n*]+)/i);
    const pressureMatch = answerText.match(/\*\*Main Pressure Point:\*\*\s*([^\n*]+)/i);
    const priorityMatch = answerText.match(/\*\*Current Priority:\*\*\s*([^\n*]+)/i);
    const nextActionMatch = answerText.match(/\*\*Next Action:\*\*\s*([^\n*]+)/i);
    const explanationMatch = answerText.match(/\*\*Short Explanation:\*\*\s*([^\n*]+)/i);

    return {
      whatWentWell: whatWentWellMatch ? whatWentWellMatch[1].trim() : undefined,
      mainPressure: pressureMatch ? pressureMatch[1].trim() : undefined,
      currentPriority: priorityMatch ? priorityMatch[1].trim() : undefined,
      nextAction: nextActionMatch ? nextActionMatch[1].trim() : undefined,
      explanation: explanationMatch ? explanationMatch[1].trim() : undefined,
    };
  }

  const dtContext = analysis?.deterministic_context;
  const reviewPoints: ReviewPoints = analysis ? parseReviewPoints(analysis.answer) : {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="meta-tag" style={{ marginBottom: '8px' }}>
            Phase 5 • Monthly AI Financial Coach
          </div>
          <h1 style={{ fontSize: '32px', lineHeight: 1.15 }}>
            Financial Intelligence & Decision Desk
          </h1>
          <p style={{ color: 'var(--ink-secondary)', marginTop: '6px', fontSize: '13px' }}>
            Conversational explanation and guidance grounded strictly in your verified transactions, savings allocations, and financial freedom trajectory.
          </p>
        </div>

        {/* Tab / Mode Selector */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('coach')}
            className="instrument-btn"
            style={{
              background: activeTab === 'coach' ? 'var(--ink-primary)' : 'var(--canvas-surface)',
              color: activeTab === 'coach' ? 'var(--canvas-base)' : 'var(--ink-secondary)',
              border: '1px solid var(--border-hairline)',
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Sparkles size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            Interactive Coach
          </button>
          <button
            onClick={() => {
              setActiveTab('review');
              if (!dtContext) {
                handleMonthlyReview();
              }
            }}
            className="instrument-btn"
            style={{
              background: activeTab === 'review' ? 'var(--ink-primary)' : 'var(--canvas-surface)',
              color: activeTab === 'review' ? 'var(--canvas-base)' : 'var(--ink-secondary)',
              border: '1px solid var(--border-hairline)',
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Calendar size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            Monthly Financial Review
          </button>
        </div>
      </div>

      <hr className="hairline-rule" style={{ margin: 0 }} />

      {/* Guest Authentication Banner */}
      {!user && (
        <div
          style={{
            padding: '16px 20px',
            background: 'var(--canvas-surface)',
            borderLeft: '4px solid var(--signal-amber)',
            borderTop: '1px solid var(--border-hairline)',
            borderRight: '1px solid var(--border-hairline)',
            borderBottom: '1px solid var(--border-hairline)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div>
            <div className="meta-tag" style={{ color: 'var(--signal-amber)', marginBottom: '4px' }}>
              AUTHENTICATION REQUIRED
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--ink-secondary)' }}>
              Sign in to evaluate financial coach inquiries against your private ledger and personalized allocations.
            </div>
          </div>
          <Link
            href="/login"
            className="instrument-btn"
            style={{ padding: '8px 16px', fontSize: '11px', textDecoration: 'none', flexShrink: 0 }}
          >
            <Lock size={12} /> Sign In
          </Link>
        </div>
      )}

      {/* Inquiry Formulation Console */}
      <div
        style={{
          background: 'var(--canvas-surface)',
          border: '1px solid var(--ink-primary)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="meta-tag" style={{ color: 'var(--ink-primary)' }}>
            Financial Coach Inquiry Console
          </span>
          <span className="badge-signal badge-forest" style={{ fontSize: '9.5px' }}>
            <ShieldCheck size={10} /> ZERO CALCULATION FABRICATION • GROUNDED IN VERIFIED ENGINES
          </span>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleExecute();
              }
            }}
            placeholder="Ask your coach: 'How did I do this month?', 'Can I afford a ₹20,000 phone?', 'Why am I saving less?'..."
            rows={2}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'var(--canvas-inset)',
              border: '1px solid var(--border-hairline)',
              outline: 'none',
              resize: 'none',
              fontSize: '13px',
              lineHeight: 1.5,
              color: 'var(--ink-primary)',
            }}
          />
          <button
            onClick={() => handleExecute()}
            disabled={loading || !query.trim()}
            className="instrument-btn"
            style={{ alignSelf: 'stretch', padding: '0 24px' }}
          >
            <Send size={14} />
            {loading ? 'Evaluating...' : 'Ask Coach'}
          </button>
        </div>

        {/* Curated Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="meta-tag" style={{ fontSize: '9px' }}>Quick Inquiries:</span>
          {QUICK_ACTIONS.map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQuery(item.query);
                handleExecute(item.query);
              }}
              style={{
                background: 'var(--canvas-inset)',
                border: '1px solid var(--border-hairline)',
                padding: '4px 10px',
                fontSize: '11px',
                cursor: 'pointer',
                color: 'var(--ink-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Intentional Loading Experience */}
      {loading && (
        <div
          style={{
            padding: '24px',
            background: 'var(--canvas-surface)',
            border: '1px solid var(--signal-amber)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '18px',
              height: '18px',
              border: '2px solid var(--signal-amber)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <div>
            <div className="meta-tag" style={{ color: 'var(--signal-amber)', marginBottom: '2px' }}>
              CONSULTING DETERMINISTIC FINANCIAL ENGINES
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--ink-secondary)' }}>
              Reconciling monthly surplus, emergency targets, and freedom projections with strict anti-hallucination barriers...
            </div>
          </div>
        </div>
      )}

      {/* Structured Error Recovery */}
      {error && (
        <div
          style={{
            padding: '24px',
            background: 'var(--canvas-surface)',
            border: '1px solid var(--signal-terracotta)',
            borderLeft: '4px solid var(--signal-terracotta)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div className="meta-tag" style={{ color: 'var(--signal-terracotta)' }}>
            EVALUATION INTERRUPTED • STRUCTURED RECOVERY
          </div>
          <div style={{ fontSize: '13px', color: 'var(--ink-primary)', fontWeight: 600 }}>
            What happened: {error.message}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
            {error.isAuthError ? (
              <span>
                Your session is unauthenticated. Please{' '}
                <Link href="/login" style={{ color: 'var(--ink-primary)', fontWeight: 600, textDecoration: 'underline' }}>
                  sign in to your account
                </Link>{' '}
                to access verified records and submit queries.
              </span>
            ) : (
              'Verify that your backend API service is running on port 4000. All financial computations are deterministic.'
            )}
          </div>
        </div>
      )}

      {/* DEDICATED MONTHLY FINANCIAL REVIEW VIEW */}
      {activeTab === 'review' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Review Header */}
          <div
            style={{
              padding: '20px 24px',
              background: 'var(--canvas-surface)',
              border: '1px solid var(--border-hairline)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <div className="meta-tag" style={{ color: 'var(--ink-primary)', marginBottom: '4px' }}>
                MONTHLY FINANCIAL REVIEW {dtContext ? `• ${dtContext.month}` : ''}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
                Comprehensive evaluation of current cash flows, spending frictions, allocation health, and freedom roadmap.
              </div>
            </div>
            <button
              onClick={handleMonthlyReview}
              disabled={loading}
              className="instrument-btn"
              style={{
                fontSize: '11px',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Calendar size={13} />
              {loading ? 'Refreshing Review...' : 'Refresh Review'}
            </button>
          </div>

          {/* Section 1: THIS MONTH KPI Bar */}
          {dtContext && dtContext.has_monthly_data ? (
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
                <span className="meta-tag" style={{ fontWeight: 600, color: 'var(--ink-primary)' }}>
                  THIS MONTH
                </span>
                <span className="badge-signal badge-forest" style={{ fontSize: '9px' }}>
                  DETERMINISTIC DATA
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '16px',
                  padding: '16px',
                  background: 'var(--canvas-inset)',
                  border: '1px solid var(--border-hairline)',
                }}
              >
                <div>
                  <div className="meta-tag">INCOME</div>
                  <div style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    ₹{dtContext.current_month.income.toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="meta-tag">EXPENSES</div>
                  <div style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    ₹{dtContext.current_month.expenses.toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="meta-tag">SURPLUS</div>
                  <div
                    style={{
                      fontSize: '22px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      color: dtContext.current_month.surplus >= 0 ? 'var(--signal-forest)' : 'var(--signal-terracotta)',
                    }}
                  >
                    ₹{dtContext.current_month.surplus.toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="meta-tag">SAVINGS RATE</div>
                  <div style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {dtContext.current_month.savings_rate}%
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '20px',
                background: 'var(--canvas-surface)',
                border: '1px solid var(--border-hairline)',
                fontSize: '13px',
                color: 'var(--ink-secondary)',
              }}
            >
              No verified monthly transactions recorded yet for this month. Upload statements or add transactions in the Ledger.
            </div>
          )}

          {/* Section 2: WHAT'S WORKING & MAIN PRESSURE Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* WHAT'S WORKING */}
            <div
              style={{
                background: 'var(--canvas-surface)',
                border: '1px solid var(--border-hairline)',
                borderLeft: '4px solid var(--signal-forest)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div className="meta-tag" style={{ color: 'var(--signal-forest)' }}>
                WHAT&apos;S WORKING
              </div>
              <div style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--ink-primary)' }}>
                {reviewPoints.whatWentWell ||
                  (dtContext && dtContext.current_month.surplus > 0
                    ? `You generated a positive surplus of ₹${dtContext.current_month.surplus.toLocaleString('en-IN')} with a ${dtContext.current_month.savings_rate}% savings rate.`
                    : 'Your cash flows and transactions are strictly tracked and audited.')}
              </div>
            </div>

            {/* MAIN PRESSURE */}
            <div
              style={{
                background: 'var(--canvas-surface)',
                border: '1px solid var(--border-hairline)',
                borderLeft: '4px solid var(--signal-amber)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div className="meta-tag" style={{ color: 'var(--signal-amber)' }}>
                MAIN PRESSURE
              </div>
              <div style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--ink-primary)' }}>
                {reviewPoints.mainPressure ||
                  (dtContext && dtContext.current_month.top_expense_categories.length > 0
                    ? `Your highest expenditure category is ${dtContext.current_month.top_expense_categories[0].category} at ₹${dtContext.current_month.top_expense_categories[0].amount.toLocaleString('en-IN')} (${dtContext.current_month.top_expense_categories[0].percentage}% of total).`
                    : 'Review discretionary spending to minimize cash flow strain.')}
              </div>
            </div>
          </div>

          {/* Section 3: NEXT ACTION */}
          <div
            style={{
              background: 'var(--canvas-surface)',
              border: '1px solid var(--border-hairline)',
              borderLeft: '4px solid var(--ink-primary)',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div className="meta-tag" style={{ color: 'var(--ink-primary)' }}>
              NEXT ACTION
            </div>
            <div style={{ fontSize: '15px', fontWeight: 500, lineHeight: 1.5, color: 'var(--ink-primary)' }}>
              {reviewPoints.nextAction ||
                (dtContext?.allocation && dtContext.allocation.emergency_gap > 0
                  ? `Strengthen your liquid emergency reserve by directing ₹${dtContext.current_month.surplus > 0 ? dtContext.current_month.surplus.toLocaleString('en-IN') : '0'} to close your ₹${dtContext.allocation.emergency_gap.toLocaleString('en-IN')} target gap.`
                  : 'Maintain structured contributions according to your target allocation plan.')}
            </div>
            {reviewPoints.explanation && (
              <div style={{ fontSize: '12.5px', color: 'var(--ink-secondary)', marginTop: '4px' }}>
                {reviewPoints.explanation}
              </div>
            )}
          </div>

          {/* Section 4: FINANCIAL FREEDOM STATUS */}
          {dtContext?.financial_freedom ? (
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
                <span className="meta-tag" style={{ color: 'var(--ink-primary)' }}>
                  FINANCIAL FREEDOM STATUS
                </span>
                <span
                  className={`badge-signal ${
                    dtContext.financial_freedom.on_track ? 'badge-forest' : 'badge-amber'
                  }`}
                >
                  {dtContext.financial_freedom.on_track ? 'ON TRACK' : 'NEEDS ACCELERATION'}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  padding: '16px',
                  background: 'var(--canvas-inset)',
                  border: '1px solid var(--border-hairline)',
                }}
              >
                <div>
                  <div className="meta-tag">CURRENT WEALTH</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    ₹{dtContext.financial_freedom.current_wealth.toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="meta-tag">TARGET CORPUS</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    ₹{dtContext.financial_freedom.indicative_target_corpus.toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="meta-tag">PROJECTED AT AGE {dtContext.financial_freedom.target_age}</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    ₹{dtContext.financial_freedom.projected_wealth.toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="meta-tag">FUNDING GAP</div>
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      color: dtContext.financial_freedom.funding_gap > 0 ? 'var(--signal-amber)' : 'var(--signal-forest)',
                    }}
                  >
                    ₹{dtContext.financial_freedom.funding_gap.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '20px',
                background: 'var(--canvas-surface)',
                border: '1px solid var(--border-hairline)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div className="meta-tag" style={{ marginBottom: '4px' }}>FINANCIAL FREEDOM STATUS</div>
                <div style={{ fontSize: '12.5px', color: 'var(--ink-secondary)' }}>
                  Target corpus not calculated yet. Configure your age and target lifestyle in the Financial Freedom Planner.
                </div>
              </div>
              <Link href="/plan" className="instrument-btn" style={{ fontSize: '11px', textDecoration: 'none' }}>
                Go to Freedom Planner →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Active Intelligence Analysis (Structured Evidence-Grounded Dossier) */}
      {analysis && (
        <div
          style={{
            background: 'var(--canvas-surface)',
            border: '1px solid var(--border-hairline)',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {/* Top Dossier Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border-hairline)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="badge-signal badge-amber">
                INTENT: {analysis.intent}
              </span>
              <span
                className={`badge-signal ${
                  analysis.risk_level === 'CRITICAL' || analysis.risk_level === 'HIGH'
                    ? 'badge-terracotta'
                    : 'badge-forest'
                }`}
              >
                RISK: {analysis.risk_level}
              </span>
            </div>

            <ConfidenceMeter score={analysis.confidence_score} />
          </div>

          {/* Refusal / Limitation Warning if any */}
          {analysis.refusal_or_limitation && (
            <div
              style={{
                padding: '12px 16px',
                background: 'var(--canvas-inset)',
                borderLeft: '4px solid var(--signal-terracotta)',
                fontSize: '12px',
                color: 'var(--signal-terracotta)',
                fontWeight: 600,
              }}
            >
              REGULATORY LIMITATION: {analysis.refusal_or_limitation}
            </div>
          )}

          {/* Primary Conclusion / Answer */}
          <div>
            <div className="meta-tag" style={{ marginBottom: '8px' }}>
              AI Financial Coach Guidance
            </div>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '18px',
                lineHeight: 1.6,
                color: 'var(--ink-primary)',
                maxWidth: '900px',
                whiteSpace: 'pre-line',
              }}
            >
              {analysis.answer}
            </div>
          </div>

          {/* Traceable Evidence Nodes Trail */}
          {analysis.evidence && analysis.evidence.length > 0 && (
            <div>
              <div className="meta-tag" style={{ marginBottom: '10px' }}>
                Traceable Evidence Citations ({analysis.evidence.length})
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {analysis.evidence.map((ev, idx) => (
                  <EvidenceNode key={idx} evidence={ev} />
                ))}
              </div>
            </div>
          )}

          {/* Missing Information / Evidentiary Limitations */}
          {analysis.missing_information && analysis.missing_information.length > 0 && (
            <div
              style={{
                padding: '12px 16px',
                background: 'var(--canvas-inset)',
                borderLeft: '3px solid var(--ink-tertiary)',
              }}
            >
              <span className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>
                Evidentiary Limitations
              </span>
              <ul style={{ paddingLeft: '16px', fontSize: '11.5px', color: 'var(--ink-secondary)' }}>
                {analysis.missing_information.map((m, idx) => (
                  <li key={idx}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Statutory Disclaimer & Human Review Gate */}
          <DisclaimerGate
            disclaimer={analysis.disclaimer}
            humanReviewRequired={analysis.human_review_required}
          />
        </div>
      )}

      {/* Historical Inquiries Record */}
      {inquiryHistory.length > 1 && (
        <div>
          <div className="meta-tag" style={{ marginBottom: '16px' }}>
            Previous Session Inquiries ({inquiryHistory.length - 1})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {inquiryHistory.slice(1).map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '16px 20px',
                  background: 'var(--canvas-surface)',
                  border: '1px solid var(--border-hairline)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink-primary)' }}>
                    {item.query}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ink-tertiary)', marginTop: '2px' }}>
                    Intent: {item.response.intent} • Confidence: {(item.response.confidence_score * 100).toFixed(0)}%
                  </div>
                </div>

                <span className="badge-signal badge-forest" style={{ fontSize: '10px' }}>
                  GROUNDED
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
