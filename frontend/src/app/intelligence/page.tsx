'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import {
  chatApi,
  ChatResponse,
  MonthlyReviewResponse,
  ApiError,
  behavioralApi,
  BehavioralAnalysisReport,
  monthlyReviewApi,
  StructuredMonthlyReview,
} from '../../lib/api';
import { ConfidenceMeter } from '../../components/intelligence/ConfidenceMeter';
import { EvidenceNode } from '../../components/intelligence/EvidenceNode';
import { DisclaimerGate } from '../../components/intelligence/DisclaimerGate';
import { MonthlyReviewView } from '../../components/intelligence/MonthlyReviewView';
import {
  Send,
  Sparkles,
  ShieldCheck,
  Lock,
  Calendar,
  TrendingUp,
  Brain,
  CheckCircle2,
  ShieldAlert,
  RotateCcw,
  Info,
} from 'lucide-react';

export default function IntelligencePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'coach' | 'review' | 'behavioral'>('coach');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<MonthlyReviewResponse | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [inquiryHistory, setInquiryHistory] = useState<Array<{ query: string; response: ChatResponse }>>([]);

  // Behavioral Finance Coach State
  const [behavioralReport, setBehavioralReport] = useState<BehavioralAnalysisReport | null>(null);
  const [behavioralLoading, setBehavioralLoading] = useState(false);

  // Structured Monthly Review State (9 Questions & Milestones)
  const [structuredReview, setStructuredReview] = useState<StructuredMonthlyReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function loadStructuredReview(month?: string) {
    setReviewLoading(true);
    setReviewError(null);
    try {
      const res = await monthlyReviewApi.getMonthlyReview(month);
      setStructuredReview(res);
    } catch (err: unknown) {
      console.error('Failed to load structured monthly review:', err);
      const msg = err instanceof Error ? err.message : 'Failed to generate monthly review.';
      setReviewError(msg);
    } finally {
      setReviewLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'review' && !structuredReview && !reviewLoading) {
      loadStructuredReview();
    }
  }, [activeTab]);

  async function loadBehavioralReport() {
    setBehavioralLoading(true);
    try {
      const res = await behavioralApi.getInsights();
      if (res) {
        setBehavioralReport(res);
      }
    } catch (err: unknown) {
      console.error('Failed to load behavioral insights:', err);
    } finally {
      setBehavioralLoading(false);
    }
  }

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
        loadStructuredReview();
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
              color: activeTab === 'coach' ? 'var(--ink-inverted)' : 'var(--ink-secondary)',
              border: '1px solid var(--border-hairline)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Sparkles size={14} />
            <span>AI Coach & QA</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('review');
              if (!structuredReview) loadStructuredReview();
            }}
            className="instrument-btn"
            style={{
              background: activeTab === 'review' ? 'var(--ink-primary)' : 'var(--canvas-surface)',
              color: activeTab === 'review' ? 'var(--ink-inverted)' : 'var(--ink-secondary)',
              border: '1px solid var(--border-hairline)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Calendar size={14} />
            <span>Monthly Financial Review</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('behavioral');
              if (!behavioralReport) loadBehavioralReport();
            }}
            className="instrument-btn"
            style={{
              background: activeTab === 'behavioral' ? 'var(--ink-primary)' : 'var(--canvas-surface)',
              color: activeTab === 'behavioral' ? 'var(--ink-inverted)' : 'var(--ink-secondary)',
              border: '1px solid var(--border-hairline)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <TrendingUp size={14} />
            <span>Behavioral Coach</span>
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
      {activeTab === 'coach' && (
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span className="meta-tag" style={{ color: 'var(--ink-primary)' }}>
              Financial Coach Inquiry Console
            </span>
            <span className="badge-signal badge-forest" style={{ fontSize: '9.5px' }}>
              <ShieldCheck size={10} /> GROUNDED IN VERIFIED ENGINES
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
                flex: '1 1 240px',
                padding: '12px 14px',
                background: 'var(--canvas-inset)',
                border: '1px solid var(--border-hairline)',
                outline: 'none',
                resize: 'none',
                fontSize: '13px',
                lineHeight: 1.5,
                color: 'var(--ink-primary)',
                minHeight: '52px',
              }}
            />
            <button
              onClick={() => handleExecute()}
              disabled={loading || !query.trim()}
              className="instrument-btn"
              style={{
                padding: '0 20px',
                minHeight: '44px',
                flex: '1 1 auto',
                justifyContent: 'center',
              }}
            >
              <Send size={14} />
              <span>{loading ? 'Evaluating...' : 'Ask Coach'}</span>
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
      )}

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
        <MonthlyReviewView
          review={structuredReview}
          loading={reviewLoading}
          error={reviewError}
          onRefresh={() => loadStructuredReview()}
        />
      )}

      {/* Active Intelligence Analysis (Structured Evidence-Grounded Dossier) */}
      {activeTab === 'coach' && analysis && (
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

      {/* DEDICATED BEHAVIORAL FINANCE COACH VIEW */}
      {activeTab === 'behavioral' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Header */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Brain size={18} color="#10b981" />
                <span className="meta-tag" style={{ color: 'var(--ink-primary)', fontSize: '12px', fontWeight: 700 }}>
                  BEHAVIORAL FINANCE COACH • GROUNDED HABIT ARCHITECTURE
                </span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--ink-secondary)', maxWidth: '680px' }}>
                Analytical behavioral insights grounded strictly in verified transactions and ledger patterns. Every insight separates Fact, Calculation, Interpretation, and Guidance.
              </div>
            </div>

            <button
              onClick={loadBehavioralReport}
              disabled={behavioralLoading}
              className="instrument-btn"
              style={{
                fontSize: '11px',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RotateCcw size={13} className={behavioralLoading ? 'animate-spin' : ''} />
              {behavioralLoading ? 'Analyzing...' : 'Refresh Insights'}
            </button>
          </div>

          {/* Ethical Guardrails Affirmation Strip */}
          <div
            style={{
              padding: '12px 18px',
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '11.5px',
              color: 'var(--ink-secondary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#10b981' }}>
              <ShieldCheck size={14} />
              <span>ETHICAL COACHING BOUNDARIES:</span>
            </div>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '11px' }}>
              <span>✓ No Mental Health Diagnosis</span>
              <span>✓ Zero Shaming</span>
              <span>✓ Zero Fear-Mongering</span>
              <span>✓ Zero Guilt</span>
              <span>✓ No Manufactured Urgency</span>
            </div>
          </div>

          {/* Loading State */}
          {behavioralLoading && !behavioralReport && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-muted)', fontSize: '13px' }}>
              Analyzing verified financial transactions and habit patterns across 8 behavioral dimensions...
            </div>
          )}

          {/* Empty / Initial State */}
          {!behavioralLoading && !behavioralReport && (
            <div
              style={{
                padding: '36px 24px',
                background: 'var(--canvas-surface)',
                border: '1px solid var(--border-hairline)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <Brain size={32} color="var(--ink-tertiary)" />
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink-primary)' }}>
                Behavioral Habit Analysis Ready
              </div>
              <p style={{ fontSize: '13px', color: 'var(--ink-muted)', maxWidth: '480px', margin: 0 }}>
                Evaluate spending changes, lifestyle inflation, impulse spending, decision fatigue, procrastination, social comparison, emotional spending, and goal fatigue.
              </p>
              <button
                onClick={loadBehavioralReport}
                className="instrument-btn"
                style={{ marginTop: '8px', padding: '10px 20px', fontSize: '12px', fontWeight: 600 }}
              >
                Run Behavioral Analysis
              </button>
            </div>
          )}

          {/* Behavioral Report Cards Grid */}
          {behavioralReport && (
            <>
              {/* Overall Status Banner */}
              <div
                style={{
                  padding: '12px 18px',
                  background: 'var(--canvas-surface)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="meta-tag">EVIDENTIARY STATUS:</span>
                  <span style={{
                    fontWeight: 700,
                    color: behavioralReport.overall_status === 'ANALYSIS_COMPLETE'
                      ? '#10b981'
                      : behavioralReport.overall_status === 'PARTIAL_DATA'
                      ? '#d97706'
                      : 'var(--ink-muted)'
                  }}>
                    {behavioralReport.overall_status.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                  {behavioralReport.sufficient_dimensions_count} of 8 Dimensions With Sufficient Evidence
                </div>
              </div>

              {/* 8 Dimension Cards Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                  gap: '20px',
                }}
              >
                {Object.values(behavioralReport.dimensions).map((item) => {
                  const hasData = item.status === 'SUFFICIENT_DATA';

                  return (
                    <div
                      key={item.dimension}
                      style={{
                        background: 'var(--canvas-surface)',
                        border: '1px solid var(--border-hairline)',
                        borderRadius: '10px',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '16px',
                      }}
                    >
                      <div>
                        {/* Card Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--ink-primary)' }}>
                            {item.title}
                          </h3>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: hasData ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                              color: hasData ? '#10b981' : '#d97706',
                              textTransform: 'uppercase',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {hasData ? 'Sufficient Data' : 'Insufficient Evidence'}
                          </span>
                        </div>

                        {/* Misleading Correlation Protection Callout */}
                        {item.flagged_misleading_correlation && (
                          <div
                            style={{
                              padding: '8px 10px',
                              background: 'rgba(59, 130, 246, 0.08)',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                              borderRadius: '6px',
                              fontSize: '11px',
                              color: '#2563eb',
                              marginBottom: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <Info size={13} style={{ flexShrink: 0 }} />
                            <span>{item.misleading_reason || 'Filtered non-recurring or essential shock from habit evaluation'}</span>
                          </div>
                        )}

                        {/* 4-Part Structure Contract */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px' }}>
                          {/* 1. FACT */}
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px', fontFamily: 'var(--font-mono)' }}>
                              FACT
                            </div>
                            <div style={{ color: 'var(--ink-primary)', lineHeight: 1.45 }}>
                              {item.fact}
                            </div>
                          </div>

                          {/* 2. CALCULATION */}
                          <div
                            style={{
                              padding: '8px 10px',
                              background: 'var(--canvas-inset)',
                              borderRadius: '6px',
                              border: '1px solid var(--border-hairline)',
                            }}
                          >
                            <div style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px', fontFamily: 'var(--font-mono)' }}>
                              CALCULATION
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>
                              {item.calculation}
                            </div>
                          </div>

                          {/* 3. INTERPRETATION */}
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px', fontFamily: 'var(--font-mono)' }}>
                              INTERPRETATION
                            </div>
                            <div style={{ color: 'var(--ink-secondary)', lineHeight: 1.45 }}>
                              {item.interpretation}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 4. GUIDANCE */}
                      <div
                        style={{
                          padding: '10px 12px',
                          background: 'rgba(16, 185, 129, 0.04)',
                          borderLeft: '3px solid #10b981',
                          borderRadius: '0 6px 6px 0',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px', fontFamily: 'var(--font-mono)' }}>
                          GUIDANCE
                        </div>
                        <div style={{ color: 'var(--ink-primary)', lineHeight: 1.4 }}>
                          {item.guidance}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Statutory Behavioral Coaching Notice */}
              <div
                style={{
                  padding: '14px 18px',
                  background: 'var(--canvas-inset)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: 'var(--ink-muted)',
                  lineHeight: 1.5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <Info size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>{behavioralReport.disclaimer}</div>
              </div>
            </>
          )}
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
