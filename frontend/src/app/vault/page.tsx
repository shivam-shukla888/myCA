'use client';

import React, { useEffect, useState } from 'react';
import { documentApi, DocumentItem } from '../../lib/api';
import { Upload, FileText, Download, ShieldCheck, Clock, AlertCircle } from 'lucide-react';

export default function VaultPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  // Upload Form
  const [fileName, setFileName] = useState('');
  const [docType, setDocType] = useState('form_16');
  const [financialYear, setFinancialYear] = useState('2025-26');

  async function loadDocuments() {
    setLoading(true);
    try {
      const res = await documentApi.list({ limit: 50 });
      setDocuments(res.documents || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

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
    } catch (err: any) {
      alert(`Document registration failed: ${err.message}`);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className="meta-tag" style={{ marginBottom: '8px' }}>
            Evidence Vault & Archive • FY 2025–26
          </div>
          <h1 style={{ fontSize: '32px', lineHeight: 1.15 }}>
            Document Evidence Archive
          </h1>
          <p style={{ color: 'var(--ink-secondary)', marginTop: '6px', fontSize: '13px' }}>
            Primary statutory documentation supporting deductions, TDS claims, and tax liability calculations.
          </p>
        </div>

        <button onClick={() => setShowUpload(!showUpload)} className="instrument-btn">
          <Upload size={14} />
          {showUpload ? 'Close Upload Desk' : 'Deposit Evidence Node'}
        </button>
      </div>

      <hr className="hairline-rule" style={{ margin: 0 }} />

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
                placeholder="e.g. Form_16_FY2025_26.pdf"
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
                <option value="form_16">Form 16 (Salary TDS Certificate)</option>
                <option value="bank_statement">Annual Bank Statement</option>
                <option value="invoice">Tax Invoice / GST B2B</option>
                <option value="rent_receipt">Rent Receipt (Section 10(13A))</option>
                <option value="investment_proof">Investment Receipt (80C / 80D)</option>
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
        {documents.length === 0 ? (
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
              Upload Form 16, insurance receipts, or invoices to establish verifiable evidentiary grounding.
            </div>
          </div>
        ) : (
          documents.map((doc) => {
            let supportsLabel = 'Supports: Salary Income & TDS Deduction';
            if (doc.document_type === 'bank_statement') supportsLabel = 'Supports: Cashflow & Account Reconciliation';
            else if (doc.document_type === 'invoice') supportsLabel = 'Supports: Input Tax Credit (ITC) & Business Expense';
            else if (doc.document_type === 'rent_receipt') supportsLabel = 'Supports: Section 10(13A) HRA Exemption';

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
                  minHeight: '180px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={14} style={{ color: 'var(--ink-primary)' }} />
                      <span className="meta-tag">{doc.document_type.replace('_', ' ')}</span>
                    </div>

                    <span className={`badge-signal ${doc.extraction_status === 'completed' ? 'badge-forest' : 'badge-amber'}`}>
                      {doc.extraction_status === 'completed' ? <ShieldCheck size={10} /> : <Clock size={10} />}
                      {doc.extraction_status.toUpperCase()}
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

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '16px',
                  paddingTop: '10px',
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
    </div>
  );
}
