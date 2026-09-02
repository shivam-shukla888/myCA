'use client';

import React, { useState } from 'react';
import { chatApi, ChatResponse } from '../../lib/api';
import { ConfidenceMeter } from '../../components/intelligence/ConfidenceMeter';
import { EvidenceNode } from '../../components/intelligence/EvidenceNode';
import { DisclaimerGate } from '../../components/intelligence/DisclaimerGate';
import { Cpu, Send, Sparkles, AlertTriangle, ShieldCheck, Database, FileText } from 'lucide-react';

export default function IntelligencePage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ChatResponse | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [inquiryHistory, setInquiryHistory] = useState<Array<{ query: string; response: ChatResponse }>>([]);

  const PRESET_QUERIES = [
    'What is my total health insurance deduction under Section 80D?',
    'Analyze my Section 80C allocation gap for FY 2025–26.',
    'What is the difference between equity and debt mutual funds?',
    'Should I buy Reliance shares or invest in Tata Motors stock?',
  ];

  async function handleExecute(inquiryText = query) {
    if (!inquiryText.trim() || loading) return;
    setLoading(true);

    try {
      const res = await chatApi.sendMessage(inquiryText, conversationId);
      setAnalysis(res);
      setConversationId(res.conversation_id);
      setInquiryHistory((prev) => [{ query: inquiryText, response: res }, ...prev]);
      setQuery('');
    } catch (err: any) {
      alert(`Intelligence query execution failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div>
        <div className="meta-tag" style={{ marginBottom: '8px' }}>
          Private Analytical Workspace • Grounded Intelligence
        </div>
        <h1 style={{ fontSize: '32px', lineHeight: 1.15 }}>
          Financial Intelligence & Decision Desk
        </h1>
        <p style={{ color: 'var(--ink-secondary)', marginTop: '6px', fontSize: '13px' }}>
          Formulate analytical inquiries evaluated strictly against verified ledger events, uploaded documents, and statutory Indian tax codes.
        </p>
      </div>

      <hr className="hairline-rule" style={{ margin: 0 }} />

      {/* Query Formulation Console */}
      <div style={{
        background: 'var(--canvas-surface)',
        border: '1px solid var(--ink-primary)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="meta-tag" style={{ color: 'var(--ink-primary)' }}>
            Inquiry Formulation Console
          </span>
          <span className="badge-signal badge-forest" style={{ fontSize: '9.5px' }}>
            <ShieldCheck size={10} /> ZERO REASONING WITHOUT EVIDENCE
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
            placeholder="Formulate a tax query, expense calculation, or deduction analysis..."
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
              color: 'var(--ink-primary)'
            }}
          />
          <button
            onClick={() => handleExecute()}
            disabled={loading || !query.trim()}
            className="instrument-btn"
            style={{ alignSelf: 'stretch', padding: '0 24px' }}
          >
            <Send size={14} />
            {loading ? 'Evaluating...' : 'Execute'}
          </button>
        </div>

        {/* Curated Regulatory Test Inquiries */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="meta-tag" style={{ fontSize: '9px' }}>Calibrated Inquiries:</span>
          {PRESET_QUERIES.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQuery(preset);
                handleExecute(preset);
              }}
              style={{
                background: 'var(--canvas-inset)',
                border: '1px solid var(--border-hairline)',
                padding: '4px 10px',
                fontSize: '11px',
                cursor: 'pointer',
                color: 'var(--ink-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Active Intelligence Analysis (Structured Evidence-Grounded Dossier) */}
      {analysis && (
        <div style={{
          background: 'var(--canvas-surface)',
          border: '1px solid var(--border-hairline)',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* Top Dossier Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--border-hairline)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="badge-signal badge-amber">
                INTENT: {analysis.intent}
              </span>
              <span className={`badge-signal ${analysis.risk_level === 'CRITICAL' || analysis.risk_level === 'HIGH' ? 'badge-terracotta' : 'badge-forest'}`}>
                RISK: {analysis.risk_level}
              </span>
            </div>

            <ConfidenceMeter score={analysis.confidence_score} />
          </div>

          {/* Primary Conclusion / Answer */}
          <div>
            <div className="meta-tag" style={{ marginBottom: '8px' }}>Analytical Finding & Synthesis</div>
            <div style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '20px',
              lineHeight: 1.5,
              color: 'var(--ink-primary)',
              maxWidth: '900px'
            }}>
              {analysis.answer}
            </div>
          </div>

          {/* Evidence Nodes Trail (First-class UI Object) */}
          {analysis.evidence && analysis.evidence.length > 0 && (
            <div>
              <div className="meta-tag" style={{ marginBottom: '10px' }}>
                Traceable Evidence Nodes ({analysis.evidence.length})
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {analysis.evidence.map((ev, idx) => (
                  <EvidenceNode key={idx} evidence={ev} />
                ))}
              </div>
            </div>
          )}

          {/* Missing Information / Evidentiary Gaps */}
          {analysis.missing_information && analysis.missing_information.length > 0 && (
            <div style={{
              padding: '12px 16px',
              background: 'var(--canvas-inset)',
              borderLeft: '3px solid var(--ink-tertiary)',
            }}>
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
                  alignItems: 'center'
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
