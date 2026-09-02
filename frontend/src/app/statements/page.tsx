'use client';

import React, { useEffect, useState } from 'react';
import { reportApi } from '../../lib/api';
import { Printer, ShieldAlert, FileText, CheckCircle } from 'lucide-react';

export default function StatementsPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await reportApi.generate('tax_summary', '2025-26');
        setReport(res);
      } catch (err) {
        console.error('Failed to generate statement:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className="meta-tag" style={{ marginBottom: '8px' }}>
            Fiscal Dossier • Assessment Year 2026–27
          </div>
          <h1 style={{ fontSize: '32px', lineHeight: 1.15 }}>
            Statutory Fiscal Statement & Tax Summary
          </h1>
          <p style={{ color: 'var(--ink-secondary)', marginTop: '6px', fontSize: '13px' }}>
            Generated analytical summary under the provisions of the Indian Income Tax Act, 1961.
          </p>
        </div>

        <button onClick={() => window.print()} className="instrument-btn">
          <Printer size={14} />
          Print Fiscal Statement
        </button>
      </div>

      <hr className="hairline-rule" style={{ margin: 0 }} />

      {/* Editorial Fiscal Statement Canvas */}
      <div style={{
        background: 'var(--canvas-surface)',
        border: '1px solid var(--ink-primary)',
        padding: '48px',
        maxWidth: '900px',
        margin: '0 auto',
        width: '100%',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        {/* Document Letterhead */}
        <div style={{
          borderBottom: '2px solid var(--ink-primary)',
          paddingBottom: '20px',
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <div className="meta-tag" style={{ color: 'var(--ink-primary)', letterSpacing: '0.12em' }}>
              PERSONAL AI CA • PRIVATE INTELLIGENCE DESK
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, marginTop: '4px' }}>
              STATEMENT OF COMPUTATION OF INCOME
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
              Financial Year: 2025–26 • Assessment Year: 2026–27
            </div>
          </div>

          <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-tertiary)' }}>
            <div>DOSSIER REF: #CBDT-2026-001</div>
            <div>DATE: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div>STATUS: DETERMINISTIC ESTIMATE</div>
          </div>
        </div>

        {/* Computation Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '36px' }}>
          <div className="meta-tag" style={{ color: 'var(--ink-primary)' }}>
            Part A: Aggregate Ledger Movements
          </div>

          <div style={{ border: '1px solid var(--border-hairline)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-hairline)' }}>
              <span>Gross Total Inflows / Receipts (Salary / Business)</span>
              <span className="tabular-nums" style={{ fontWeight: 600 }}>
                ₹{(report?.summary?.total_income || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-hairline)', color: 'var(--ink-secondary)' }}>
              <span>Less: Total Deductions Claimed (Chapter VI-A)</span>
              <span className="tabular-nums" style={{ color: 'var(--signal-forest)' }}>
                -₹{(report?.summary?.total_tax_deductions_claimed || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--canvas-inset)', fontWeight: 700, fontSize: '15px' }}>
              <span>Estimated Taxable Base (Prior to Standard Slabs)</span>
              <span className="tabular-nums">
                ₹{(report?.summary?.estimated_taxable_income || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Chapter VI-A Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '36px' }}>
          <div className="meta-tag" style={{ color: 'var(--ink-primary)' }}>
            Part B: Chapter VI-A Deductions Schedule
          </div>

          <div style={{ border: '1px solid var(--border-hairline)' }}>
            {report?.deductions_breakdown && report.deductions_breakdown.length > 0 ? (
              report.deductions_breakdown.map((item: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid var(--border-hairline)', fontSize: '12px' }}>
                  <span>Section {item.category?.toUpperCase() || 'DEDUCTION'}</span>
                  <span className="tabular-nums" style={{ fontWeight: 600 }}>
                    ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--ink-tertiary)', fontSize: '12px' }}>
                Section 80C & 80D deductions will automatically populate as eligible entries are committed to the ledger.
              </div>
            )}
          </div>
        </div>

        {/* Forensic Regulatory Certification Boundary */}
        <div style={{
          padding: '16px',
          background: 'var(--canvas-inset)',
          border: '1px solid var(--border-hairline)',
          fontSize: '11px',
          lineHeight: 1.5,
          color: 'var(--ink-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--ink-primary)', marginBottom: '4px' }}>
            <ShieldAlert size={14} style={{ color: 'var(--signal-amber)' }} />
            CA CONSULTATION & VERIFICATION NOTICE
          </div>
          <div>
            This dossier is generated programmatically from verified user-supplied transactional and documentary records. Under Section 288 of the Income Tax Act 1961, formal representation and definitive statutory return submissions must be authenticated through an authorized Chartered Accountant or digital e-filing signature.
          </div>
        </div>
      </div>
    </div>
  );
}
