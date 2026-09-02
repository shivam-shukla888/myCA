'use client';

import React from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

interface DisclaimerGateProps {
  disclaimer: string;
  humanReviewRequired?: boolean;
}

export function DisclaimerGate({ disclaimer, humanReviewRequired }: DisclaimerGateProps) {
  if (!disclaimer && !humanReviewRequired) return null;

  return (
    <div style={{
      marginTop: '16px',
      padding: '12px 16px',
      background: 'var(--canvas-inset)',
      borderLeft: '3px solid var(--signal-amber)',
      borderTop: '1px solid var(--border-hairline)',
      borderRight: '1px solid var(--border-hairline)',
      borderBottom: '1px solid var(--border-hairline)',
      fontSize: '11px',
      lineHeight: 1.5,
      color: 'var(--ink-secondary)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldAlert size={13} style={{ color: 'var(--signal-amber)' }} />
          <span className="meta-tag" style={{ color: 'var(--ink-primary)', fontSize: '9.5px' }}>
            STATUTORY COMPLIANCE & BOUNDARY NOTICE
          </span>
        </div>
        {humanReviewRequired && (
          <span className="badge-signal badge-amber" style={{ fontSize: '9.5px' }}>
            <AlertTriangle size={10} />
            CA PROFESSIONAL REVIEW REQUIRED
          </span>
        )}
      </div>

      <div style={{ fontStyle: 'italic', color: 'var(--ink-secondary)' }}>
        {disclaimer || 'This analytical output is generated for financial intelligence purposes and does not constitute a certified statutory audit or formal tax filing confirmation.'}
      </div>

      <div style={{
        marginTop: '6px',
        fontSize: '10px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--ink-tertiary)'
      }}>
        Jurisdiction: Republic of India • IT Act 1961 / CGST Act 2017 • Non-SEBI Registered Entity
      </div>
    </div>
  );
}
