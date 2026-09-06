'use client';

import React, { useState } from 'react';
import Modal from './layout/Modal';
import { Layers, Database, Calculator, CheckCircle, FileText, ChevronRight, Info } from 'lucide-react';

export interface AdvancedDetailsData {
  answer?: string;
  intent?: string;
  risk_level?: string;
  confidence_score?: number;
  provider_used?: string;
  deterministic_calculations?: Record<string, any>;
  reasoning_breakdown?: {
    factual_statements_count?: number;
    calculation_statements_count?: number;
    assumption_statements_count?: number;
    interpretation_statements_count?: number;
    guidance_statements_count?: number;
  };
  statements?: Array<{
    type: 'FACT' | 'CALCULATION' | 'ASSUMPTION' | 'INTERPRETATION' | 'GENERAL_GUIDANCE';
    text: string;
    basis?: string;
  }>;
  evidence?: Array<{
    source_type?: string;
    source_id?: string;
    claim?: string;
    verified?: boolean;
  }>;
  verified_facts?: Array<{
    chunk_id?: string;
    source_title?: string;
    authority_level?: number;
    country?: string;
    content?: string;
  }>;
  missing_information?: string[];
  disclaimer?: string;
  [key: string]: any;
}

export default function AdvancedToggle({
  data,
  label = '⚙️ Details',
}: {
  data: AdvancedDetailsData | null | undefined;
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'audit' | 'calculations' | 'evidence' | 'statements' | 'raw'>('audit');

  if (!data) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="instrument-btn"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11.5px',
          padding: '4px 10px',
        }}
        aria-label="Inspect calculation methodology, sources, and statement audit"
        title="Inspect calculation methodology, sources, and statement audit"
      >
        <span>{label}</span>
      </button>

      {isOpen && (
        <Modal onClose={() => setIsOpen(false)} title="Audit Trail & Technical Breakdown">
          {/* Subheader */}
          <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-hairline)', paddingBottom: '12px' }}>
            <button
              onClick={() => setActiveTab('audit')}
              style={{
                padding: '6px 12px',
                background: activeTab === 'audit' ? 'var(--canvas-inset)' : 'transparent',
                border: 'none',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: activeTab === 'audit' ? 600 : 400,
                color: activeTab === 'audit' ? 'var(--ink-primary)' : 'var(--ink-secondary)',
              }}
            >
              Summary & Quality
            </button>
            <button
              onClick={() => setActiveTab('calculations')}
              style={{
                padding: '6px 12px',
                background: activeTab === 'calculations' ? 'var(--canvas-inset)' : 'transparent',
                border: 'none',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: activeTab === 'calculations' ? 600 : 400,
                color: activeTab === 'calculations' ? 'var(--ink-primary)' : 'var(--ink-secondary)',
              }}
            >
              Deterministic Math
            </button>
            <button
              onClick={() => setActiveTab('statements')}
              style={{
                padding: '6px 12px',
                background: activeTab === 'statements' ? 'var(--canvas-inset)' : 'transparent',
                border: 'none',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: activeTab === 'statements' ? 600 : 400,
                color: activeTab === 'statements' ? 'var(--ink-primary)' : 'var(--ink-secondary)',
              }}
            >
              Statement Classification
            </button>
            <button
              onClick={() => setActiveTab('evidence')}
              style={{
                padding: '6px 12px',
                background: activeTab === 'evidence' ? 'var(--canvas-inset)' : 'transparent',
                border: 'none',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: activeTab === 'evidence' ? 600 : 400,
                color: activeTab === 'evidence' ? 'var(--ink-primary)' : 'var(--ink-secondary)',
              }}
            >
              Sources & Evidence
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              style={{
                padding: '6px 12px',
                background: activeTab === 'raw' ? 'var(--canvas-inset)' : 'transparent',
                border: 'none',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: activeTab === 'raw' ? 600 : 400,
                color: activeTab === 'raw' ? 'var(--ink-primary)' : 'var(--ink-secondary)',
              }}
            >
              Raw Payload
            </button>
          </div>

          {/* TAB 1: AUDIT & QUALITY */}
          {activeTab === 'audit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: 'var(--canvas-elevated)', padding: '12px', border: '1px solid var(--border-hairline)' }}>
                  <div className="meta-tag">Confidence Score</div>
                  <div style={{ fontSize: '20px', fontFamily: 'var(--font-mono)', fontWeight: 600, marginTop: '4px' }}>
                    {typeof data.confidence_score === 'number' ? `${(data.confidence_score * 100).toFixed(1)}%` : 'N/A'}
                  </div>
                </div>
                <div style={{ background: 'var(--canvas-elevated)', padding: '12px', border: '1px solid var(--border-hairline)' }}>
                  <div className="meta-tag">Risk Level</div>
                  <div style={{ fontSize: '20px', fontFamily: 'var(--font-mono)', fontWeight: 600, marginTop: '4px', color: data.risk_level === 'CRITICAL' || data.risk_level === 'HIGH' ? 'var(--signal-terracotta)' : 'var(--signal-forest)' }}>
                    {data.risk_level || 'LOW'}
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--canvas-elevated)', padding: '12px', border: '1px solid var(--border-hairline)' }}>
                <div className="meta-tag">Provider & Pipeline</div>
                <div style={{ fontSize: '13px', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                  {data.provider_used || 'Hybrid Deterministic + Groq/OSS-120B'}
                </div>
              </div>

              {data.reasoning_breakdown && (
                <div style={{ background: 'var(--canvas-elevated)', padding: '12px', border: '1px solid var(--border-hairline)' }}>
                  <div className="meta-tag" style={{ marginBottom: '8px' }}>Statement Composition</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ padding: '2px 8px', background: 'var(--canvas-inset)', borderRadius: '2px' }}>
                      Facts: {data.reasoning_breakdown.factual_statements_count || 0}
                    </span>
                    <span style={{ padding: '2px 8px', background: 'var(--canvas-inset)', borderRadius: '2px' }}>
                      Calculations: {data.reasoning_breakdown.calculation_statements_count || 0}
                    </span>
                    <span style={{ padding: '2px 8px', background: 'var(--canvas-inset)', borderRadius: '2px' }}>
                      Assumptions: {data.reasoning_breakdown.assumption_statements_count || 0}
                    </span>
                    <span style={{ padding: '2px 8px', background: 'var(--canvas-inset)', borderRadius: '2px' }}>
                      Guidance: {data.reasoning_breakdown.guidance_statements_count || 0}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DETERMINISTIC CALCULATIONS */}
          {activeTab === 'calculations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--ink-secondary)', marginBottom: '4px' }}>
                Deterministic calculations are computed server-side with strict arithmetic. The language model never performs raw arithmetic.
              </div>
              {data.deterministic_calculations && Object.keys(data.deterministic_calculations).length > 0 ? (
                <div style={{ border: '1px solid var(--border-hairline)', background: 'var(--canvas-surface)' }}>
                  {Object.entries(data.deterministic_calculations).map(([key, val], idx) => (
                    <div
                      key={key}
                      style={{
                        padding: '10px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        borderBottom: idx < Object.keys(data.deterministic_calculations || {}).length - 1 ? '1px solid var(--border-hairline)' : 'none',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-secondary)' }}>
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600 }}>
                        {typeof val === 'number' ? `₹${val.toLocaleString('en-IN')}` : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '16px', background: 'var(--canvas-inset)', textAlign: 'center', fontSize: '12px', color: 'var(--ink-tertiary)' }}>
                  No standalone numerical calculations required for this inquiry.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STATEMENT CLASSIFICATION */}
          {activeTab === 'statements' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--ink-secondary)', marginBottom: '4px' }}>
                Every sentence is audited into Fact, Calculation, Assumption, Interpretation, or General Guidance:
              </div>
              {data.statements && data.statements.length > 0 ? (
                data.statements.map((st, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 14px',
                      background: 'var(--canvas-elevated)',
                      borderLeft: `3px solid ${
                        st.type === 'FACT' ? 'var(--signal-forest)' :
                        st.type === 'CALCULATION' ? 'var(--ink-primary)' :
                        st.type === 'ASSUMPTION' ? 'var(--signal-amber)' : 'var(--ink-tertiary)'
                      }`,
                      borderTop: '1px solid var(--border-hairline)',
                      borderRight: '1px solid var(--border-hairline)',
                      borderBottom: '1px solid var(--border-hairline)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span className="meta-tag">{st.type}</span>
                      {st.basis && <span style={{ fontSize: '10px', color: 'var(--ink-tertiary)', fontFamily: 'var(--font-mono)' }}>{st.basis}</span>}
                    </div>
                    <div style={{ fontSize: '12.5px', lineHeight: 1.4 }}>{st.text}</div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '16px', background: 'var(--canvas-inset)', textAlign: 'center', fontSize: '12px', color: 'var(--ink-tertiary)' }}>
                  Statement breakdown unavailable.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: EVIDENCE & SOURCES */}
          {activeTab === 'evidence' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="meta-tag">Authoritative Knowledge Base Chunks</div>
              {data.verified_facts && data.verified_facts.length > 0 ? (
                data.verified_facts.map((chunk, idx) => (
                  <div key={idx} style={{ padding: '12px', background: 'var(--canvas-elevated)', border: '1px solid var(--border-hairline)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '12.5px' }}>{chunk.source_title || 'Authoritative Source'}</span>
                      <span className="badge-signal badge-forest" style={{ fontSize: '9px' }}>
                        Tier {chunk.authority_level || 1} Authority
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
                      {chunk.content}
                    </p>
                  </div>
                ))
              ) : (
                <div style={{ padding: '16px', background: 'var(--canvas-inset)', textAlign: 'center', fontSize: '12px', color: 'var(--ink-tertiary)' }}>
                  No external knowledge base chunk cited.
                </div>
              )}

              {data.evidence && data.evidence.length > 0 && (
                <>
                  <div className="meta-tag" style={{ marginTop: '8px' }}>User Context Evidence</div>
                  {data.evidence.map((ev, i) => (
                    <div key={i} style={{ padding: '10px 12px', background: 'var(--canvas-elevated)', border: '1px solid var(--border-hairline)', fontSize: '12px' }}>
                      <div className="meta-tag" style={{ marginBottom: '4px' }}>{ev.source_type}</div>
                      <div>{ev.claim}</div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* TAB 5: RAW PAYLOAD */}
          {activeTab === 'raw' && (
            <pre style={{ maxHeight: '60vh', overflow: 'auto', background: 'var(--canvas-inset)', padding: '12px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </Modal>
      )}
    </>
  );
}
