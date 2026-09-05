'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuthRequiredState } from '../../components/auth/AuthRequiredState';
import { documentApi, ocrApi, DocumentItem, ExtractionResult } from '../../lib/api';
import {
  Upload,
  FileText,
  ShieldCheck,
  Clock,
  AlertCircle,
  Eye,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react';

interface ReviewTransaction {
  date?: string;
  description?: string;
  type?: string;
  direction?: 'credit' | 'debit' | string;
  amount?: number;
  category?: string;
  duplicate_warning?: boolean;
  is_tax_relevant?: boolean;
}

interface DocumentReviewData {
  transactions?: ReviewTransaction[];
  employer?: string;
  salary_period?: string;
  net_income?: number;
  gross_income?: number;
  employer_name?: string;
  tax_deductions?: number;
  [key: string]: unknown;
}

export default function VaultPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  // Upload Form
  const [fileName, setFileName] = useState('');
  const [docType, setDocType] = useState('salary_slip');
  const [financialYear, setFinancialYear] = useState('2025-26');

  // OCR Review Drawer / Modal
  const [activeReviewDoc, setActiveReviewDoc] = useState<DocumentItem | null>(null);
  const [draftResult, setDraftResult] = useState<ExtractionResult | null>(null);
  const [reviewData, setReviewData] = useState<DocumentReviewData>({});
  const [extracting, setExtracting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadDocuments() {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await documentApi.list({ limit: 50 });
      setDocuments(res.documents || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to document vault.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    let ignore = false;
    setLoading(true);
    setError(null);

    documentApi.list({ limit: 50 })
      .then((res) => {
        if (!ignore) {
          setDocuments(res.documents || []);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Unable to connect to document vault.';
          setError(msg);
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [authLoading, isAuthenticated]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!fileName) return;

    try {
      await documentApi.create({
        file_name: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
        file_type: 'pdf',
        file_size_bytes: 256000,
        mime_type: 'application/pdf',
        document_type: docType,
        financial_year: financialYear,
      });

      setFileName('');
      setShowUpload(false);
      await loadDocuments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Document registration failed';
      alert(`Document registration failed: ${msg}`);
    }
  }

  async function handleOpenReview(doc: DocumentItem) {
    setActiveReviewDoc(doc);
    setReviewError(null);
    setReviewSuccess(null);
    setExtracting(true);

    try {
      // First try to fetch existing draft
      let draft: ExtractionResult;
      try {
        draft = await ocrApi.getDraft(doc.id);
      } catch {
        // If not extracted yet, run extraction
        draft = await ocrApi.extract(doc.id);
      }
      setDraftResult(draft);
      setReviewData(JSON.parse(JSON.stringify(draft.extracted_data || {})));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to extract document draft';
      setReviewError(msg);
    } finally {
      setExtracting(false);
    }
  }

  async function handleConfirmImport(target: 'transactions' | 'profile' | 'archive_only') {
    if (!activeReviewDoc || !draftResult) return;
    setConfirming(true);
    setReviewError(null);
    try {
      const result = await ocrApi.confirm({
        document_id: activeReviewDoc.id,
        reviewed_data: reviewData as Record<string, unknown>,
        import_target: target,
      });

      setReviewSuccess(
        `Successfully confirmed and imported! ${result.imported_count} financial record(s) linked.`
      );
      await loadDocuments();

      // Refresh draft view
      const updatedDraft = await ocrApi.getDraft(activeReviewDoc.id);
      setDraftResult(updatedDraft);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Confirmation failed';
      setReviewError(msg);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className="meta-tag" style={{ marginBottom: '8px' }}>
            Evidence Vault & Input Automation • FY 2025–26
          </div>
          <h1 style={{ fontSize: '32px', lineHeight: 1.15 }}>
            Document Evidence Archive & OCR
          </h1>
          <p style={{ color: 'var(--ink-secondary)', marginTop: '6px', fontSize: '13px' }}>
            Turn uploaded financial documents into verified structured drafts. Every transaction requires explicit user review and confirmation before ledger storage.
          </p>
        </div>

        {isAuthenticated && (
          <button onClick={() => setShowUpload(!showUpload)} className="instrument-btn">
            <Upload size={14} />
            {showUpload ? 'Close Upload Desk' : 'Deposit Evidence Node'}
          </button>
        )}
      </div>

      <hr className="hairline-rule" style={{ margin: 0 }} />

      {/* Authentication Initializing State */}
      {authLoading && (
        <div style={{
          border: '1px solid var(--border-hairline)',
          background: 'var(--canvas-surface)',
          padding: '32px',
          textAlign: 'center',
          color: 'var(--ink-secondary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px'
        }}>
          Reconciling workspace authentication state...
        </div>
      )}

      {/* Unauthenticated Guest State — Zero Protected API Requests */}
      {!authLoading && !isAuthenticated && (
        <AuthRequiredState
          modeTag="EVIDENCE VAULT • FY 2025–26"
          title="Sign In to Access Document Evidence Archive & OCR"
          description="Stored payslips, bank statements, and tax deduction certificates are private and encrypted. Sign in to your verified workspace to upload and review documents."
        />
      )}

      {/* Authenticated Vault Content */}
      {!authLoading && isAuthenticated && (
        <>

      {/* Upload Desk */}
      {showUpload && (
        <form onSubmit={handleUpload} style={{
          padding: '24px',
          background: 'var(--canvas-surface)',
          border: '1px solid var(--ink-primary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div className="meta-tag" style={{ color: 'var(--ink-primary)' }}>
            Deposit Evidence Node • Document Registration
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div>
              <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>Document Name</label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="e.g. Salary_Slip_August_2026.pdf"
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
              <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>Document Classification</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--canvas-inset)',
                  border: '1px solid var(--border-hairline)',
                  outline: 'none'
                }}
              >
                <option value="salary_slip">Salary Slip / Payslip</option>
                <option value="bank_statement">Bank Statement</option>
                <option value="form_16">Form 16 (Salary TDS Certificate)</option>
                <option value="invoice">Tax Invoice / GST B2B</option>
                <option value="other">Other Financial Document</option>
              </select>
            </div>

            <div>
              <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>Assessment Year</label>
              <input
                type="text"
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--canvas-inset)',
                  border: '1px solid var(--border-hairline)',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
            <button type="submit" className="instrument-btn">
              Register Node to Vault
            </button>
          </div>
        </form>
      )}

      {/* Vault Nodes Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {loading ? (
          <div style={{
            gridColumn: '1 / -1',
            padding: '48px',
            border: '1px solid var(--border-hairline)',
            background: 'var(--canvas-surface)',
            textAlign: 'center',
            color: 'var(--ink-secondary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px'
          }}>
            LOADING VAULT ARCHIVE...
          </div>
        ) : error ? (
          <div style={{
            gridColumn: '1 / -1',
            padding: '36px',
            border: '1px solid var(--signal-alert)',
            background: 'var(--canvas-surface)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertCircle size={20} style={{ color: 'var(--signal-alert)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink-primary)' }}>
                  Unable to load archived documents
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
                  {error}
                </div>
              </div>
            </div>
            <button onClick={() => loadDocuments()} className="instrument-btn" style={{ flexShrink: 0 }}>
              Retry Vault
            </button>
          </div>
        ) : documents.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            padding: '48px',
            border: '1px dashed var(--border-hairline)',
            background: 'var(--canvas-surface)',
            textAlign: 'center',
            color: 'var(--ink-tertiary)'
          }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--ink-primary)', marginBottom: '6px' }}>
              Your evidence vault is unpopulated
            </div>
            <div style={{ fontSize: '12px' }}>
              Upload Salary Slips, Bank Statements, or Form 16 to extract drafts and verify financial inputs.
            </div>
          </div>
        ) : (
          documents.map((doc) => {
            let supportsLabel = 'Supports: Salary Income & TDS Deduction';
            if (doc.document_type === 'bank_statement') supportsLabel = 'Supports: Cashflow & Account Reconciliation';
            else if (doc.document_type === 'invoice') supportsLabel = 'Supports: Business Expense Verification';
            else if (doc.document_type === 'other') supportsLabel = 'Supports: Verifiable Financial Audit Trail';

            const isConfirmed = doc.extraction_status === 'completed';

            return (
              <div
                key={doc.id}
                style={{
                  background: 'var(--canvas-surface)',
                  border: '1px solid var(--border-hairline)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '200px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={14} style={{ color: 'var(--ink-primary)' }} />
                      <span className="meta-tag">{doc.document_type.replace('_', ' ')}</span>
                    </div>

                    <span className={`badge-signal ${isConfirmed ? 'badge-forest' : 'badge-amber'}`}>
                      {isConfirmed ? <ShieldCheck size={10} /> : <Clock size={10} />}
                      {isConfirmed ? 'CONFIRMED' : doc.extraction_status.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink-primary)', wordBreak: 'break-all' }}>
                    {doc.file_name}
                  </div>

                  <div style={{
                    fontSize: '11px',
                    color: 'var(--ink-secondary)',
                    marginTop: '8px',
                    lineHeight: 1.4,
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border-hairline)'
                  }}>
                    {supportsLabel}
                  </div>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <button
                    onClick={() => handleOpenReview(doc)}
                    className="instrument-btn"
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      fontSize: '12px',
                      padding: '6px 12px',
                    }}
                  >
                    <Eye size={12} />
                    {isConfirmed ? 'View Verified Draft' : 'Review & Confirm OCR Draft'}
                  </button>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '12px',
                  paddingTop: '8px',
                  borderTop: '1px dashed var(--border-hairline)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--ink-tertiary)'
                }}>
                  <span>Node: #{doc.id.slice(0, 8)}</span>
                  <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Review & Confirmation Modal / Drawer */}
      {activeReviewDoc && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '24px'
        }}>
          <div style={{
            background: 'var(--canvas-surface)',
            border: '1px solid var(--ink-primary)',
            width: '100%',
            maxWidth: '750px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="meta-tag">Evidence Review & Verification Desk</div>
                <h2 style={{ fontSize: '20px', marginTop: '4px' }}>{activeReviewDoc.file_name}</h2>
                <div style={{ fontSize: '11px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
                  Document Node: #{activeReviewDoc.id}
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveReviewDoc(null);
                  setDraftResult(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Extraction Loader */}
            {extracting && (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-secondary)' }}>
                <Clock size={24} style={{ animation: 'spin 1.5s linear infinite', marginBottom: '8px' }} />
                <div>Extracting document text and building verification draft...</div>
              </div>
            )}

            {/* Error / Success Notifications */}
            {reviewError && (
              <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#dc2626', fontSize: '13px' }}>
                <AlertCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />
                {reviewError}
              </div>
            )}

            {reviewSuccess && (
              <div style={{ padding: '12px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e', color: '#16a34a', fontSize: '13px' }}>
                <CheckCircle2 size={14} style={{ display: 'inline', marginRight: '6px' }} />
                {reviewSuccess}
              </div>
            )}

            {/* Review Draft Content */}
            {!extracting && draftResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Status Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--canvas-inset)', border: '1px solid var(--border-hairline)' }}>
                  <div>
                    <span className="meta-tag">Document Type: </span>
                    <strong>{draftResult.document_type}</strong>
                  </div>
                  <div>
                    <span className="meta-tag">Confidence: </span>
                    <strong>{Math.round(draftResult.confidence_score * 100)}%</strong>
                  </div>
                  <div>
                    <span className={`badge-signal ${draftResult.extraction_status === 'confirmed' ? 'badge-forest' : 'badge-amber'}`}>
                      {draftResult.extraction_status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Warnings / Duplicate Alerts */}
                {draftResult.warnings && draftResult.warnings.length > 0 && (
                  <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', fontSize: '12px', color: '#b45309' }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={14} />
                      Review Alerts ({draftResult.warnings.length})
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                      {draftResult.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Notice: Input Automation Principle */}
                <div style={{ fontSize: '12px', color: 'var(--ink-secondary)', background: 'var(--canvas-inset)', padding: '10px 14px', borderLeft: '3px solid var(--ink-primary)' }}>
                  <strong>Strict Safety Policy:</strong> OCR extractions are uncommitted drafts. No changes have been made to your balances or ledger. Review values below and click confirm when ready.
                </div>

                {/* Editable Fields / Transactions Review */}
                {draftResult.document_type === 'BANK_STATEMENT' && reviewData.transactions && (
                  <div>
                    <div className="meta-tag" style={{ marginBottom: '8px' }}>Extracted Statement Transactions</div>
                    <div style={{ border: '1px solid var(--border-hairline)', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: 'var(--canvas-inset)', textAlign: 'left', borderBottom: '1px solid var(--border-hairline)' }}>
                            <th style={{ padding: '8px 12px' }}>Date</th>
                            <th style={{ padding: '8px 12px' }}>Description</th>
                            <th style={{ padding: '8px 12px' }}>Type</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount (₹)</th>
                            <th style={{ padding: '8px 12px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reviewData.transactions.map((tx: ReviewTransaction, idx: number) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                              <td style={{ padding: '8px 12px' }}>
                                <input
                                  type="text"
                                  value={tx.date}
                                  disabled={draftResult.extraction_status === 'confirmed'}
                                  onChange={(e) => {
                                    const updated = [...(reviewData.transactions || [])];
                                    updated[idx].date = e.target.value;
                                    setReviewData({ ...reviewData, transactions: updated });
                                  }}
                                  style={{ padding: '4px 6px', width: '90px', border: '1px solid var(--border-hairline)', background: 'transparent' }}
                                />
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <input
                                  type="text"
                                  value={tx.description}
                                  disabled={draftResult.extraction_status === 'confirmed'}
                                  onChange={(e) => {
                                    const updated = [...(reviewData.transactions || [])];
                                    updated[idx].description = e.target.value;
                                    setReviewData({ ...reviewData, transactions: updated });
                                  }}
                                  style={{ padding: '4px 6px', width: '100%', minWidth: '180px', border: '1px solid var(--border-hairline)', background: 'transparent' }}
                                />
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <span className={tx.direction === 'credit' ? 'badge-signal badge-forest' : 'badge-signal badge-amber'}>
                                  {(tx.direction || 'DEBIT').toUpperCase()}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                <input
                                  type="number"
                                  value={tx.amount}
                                  disabled={draftResult.extraction_status === 'confirmed'}
                                  onChange={(e) => {
                                    const updated = [...(reviewData.transactions || [])];
                                    updated[idx].amount = parseFloat(e.target.value) || 0;
                                    setReviewData({ ...reviewData, transactions: updated });
                                  }}
                                  style={{ padding: '4px 6px', width: '100px', textAlign: 'right', border: '1px solid var(--border-hairline)', background: 'transparent' }}
                                />
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                {tx.duplicate_warning ? (
                                  <span style={{ color: '#b45309', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertTriangle size={12} /> Duplicate?
                                  </span>
                                ) : (
                                  <span style={{ color: '#16a34a', fontSize: '11px' }}>Ready</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Salary Slip Review */}
                {draftResult.document_type === 'SALARY_SLIP' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Employer</label>
                      <input
                        type="text"
                        value={reviewData.employer || ''}
                        disabled={draftResult.extraction_status === 'confirmed'}
                        onChange={(e) => setReviewData({ ...reviewData, employer: e.target.value })}
                        style={{ width: '100%', padding: '8px', border: '1px solid var(--border-hairline)', background: 'transparent' }}
                      />
                    </div>
                    <div>
                      <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Period</label>
                      <input
                        type="text"
                        value={reviewData.salary_period || ''}
                        disabled={draftResult.extraction_status === 'confirmed'}
                        onChange={(e) => setReviewData({ ...reviewData, salary_period: e.target.value })}
                        style={{ width: '100%', padding: '8px', border: '1px solid var(--border-hairline)', background: 'transparent' }}
                      />
                    </div>
                    <div>
                      <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Gross Salary (₹)</label>
                      <input
                        type="number"
                        value={reviewData.gross_income || 0}
                        disabled={draftResult.extraction_status === 'confirmed'}
                        onChange={(e) => setReviewData({ ...reviewData, gross_income: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px', border: '1px solid var(--border-hairline)', background: 'transparent' }}
                      />
                    </div>
                    <div>
                      <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Net Pay (₹)</label>
                      <input
                        type="number"
                        value={reviewData.net_income || 0}
                        disabled={draftResult.extraction_status === 'confirmed'}
                        onChange={(e) => setReviewData({ ...reviewData, net_income: parseFloat(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '8px', border: '1px solid var(--border-hairline)', background: 'transparent' }}
                      />
                    </div>
                  </div>
                )}

                {/* Investment Statement Informational View */}
                {draftResult.document_type === 'INVESTMENT_STATEMENT' && (
                  <div style={{ padding: '12px', background: 'var(--canvas-inset)', border: '1px solid var(--border-hairline)', fontSize: '12px' }}>
                    <div style={{ fontStyle: 'italic', marginBottom: '8px', color: 'var(--ink-secondary)' }}>
                      {String((draftResult.extracted_data as Record<string, unknown>).disclaimer || '')}
                    </div>
                    <div>
                      <strong>Institution:</strong> {String((draftResult.extracted_data as Record<string, unknown>).institution || 'N/A')}
                    </div>
                    <div>
                      <strong>Portfolio Valuation:</strong> ₹{Number((draftResult.extracted_data as Record<string, unknown>).portfolio_total_value || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                )}

                {/* Confirmation Footer */}
                {draftResult.extraction_status !== 'confirmed' ? (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-hairline)' }}>
                    <button
                      type="button"
                      disabled={confirming}
                      onClick={() => handleConfirmImport('archive_only')}
                      className="instrument-btn"
                      style={{ background: 'transparent' }}
                    >
                      Archive Only
                    </button>

                    {draftResult.document_type === 'BANK_STATEMENT' && (
                      <button
                        type="button"
                        disabled={confirming}
                        onClick={() => handleConfirmImport('transactions')}
                        className="instrument-btn"
                        style={{ background: 'var(--ink-primary)', color: 'var(--canvas-surface)' }}
                      >
                        <CheckCircle2 size={14} />
                        {confirming ? 'Importing...' : 'Confirm & Import Transactions'}
                      </button>
                    )}

                    {draftResult.document_type === 'SALARY_SLIP' && (
                      <button
                        type="button"
                        disabled={confirming}
                        onClick={() => handleConfirmImport('profile')}
                        className="instrument-btn"
                        style={{ background: 'var(--ink-primary)', color: 'var(--canvas-surface)' }}
                      >
                        <CheckCircle2 size={14} />
                        {confirming ? 'Updating...' : 'Confirm & Record Salary'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '12px', background: 'var(--canvas-inset)', textAlign: 'center', fontSize: '12px', color: '#16a34a' }}>
                    <ShieldCheck size={16} style={{ display: 'inline', marginRight: '6px' }} />
                    This document draft was confirmed on {new Date(draftResult.confirmed_at || '').toLocaleString()} and its records are permanently locked to its document ID.
                  </div>
                )}
              </div>
          )}
        </div>
      </div>
      )}
      </>
      )}
    </div>
  );
}
