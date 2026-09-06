'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Activity, ShieldCheck, Database, Sliders, Shield } from 'lucide-react';

export function FinancialStatusStrip() {
  const pathname = usePathname();

  let modeName = 'HOME / FINANCIAL TERRAIN';
  if (pathname.includes('calculators')) modeName = 'PUBLIC TOOLS / VERIFIED CALCULATORS';
  else if (pathname.includes('education')) modeName = 'PUBLIC KNOWLEDGE / INDIAN STATUTORY EDUCATION';
  else if (pathname.includes('ledger')) modeName = 'MONEY / TEMPORAL STREAM';
  else if (pathname.includes('crore')) modeName = '₹1 CRORE / SHORTEST PATH';
  else if (pathname.includes('plan')) modeName = 'GOALS / ACTION ENGINE';
  else if (pathname.includes('intelligence')) modeName = 'MYCA / AI FINANCIAL COACH';
  else if (pathname.includes('vault')) modeName = 'VAULT / EVIDENCE ARCHIVE';
  else if (pathname.includes('statements')) modeName = 'STATEMENTS / FISCAL DOSSIER';
  else if (pathname.includes('audit') || pathname.includes('admin')) modeName = 'ADMIN / REGULATORY AUDIT';
  else if (pathname.includes('onboarding')) modeName = 'ONBOARDING / FINANCIAL SETUP';

  return (
    <div
      style={{
        height: '36px',
        borderBottom: '1px solid var(--border-hairline)',
        background: 'var(--canvas-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--ink-secondary)',
        flexShrink: 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Active Mode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
        <Sliders size={12} style={{ color: 'var(--ink-primary)', flexShrink: 0 }} />
        <span
          style={{
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--ink-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {modeName}
        </span>
      </div>

      {/* System Status Calibrations - Responsive: Compact on mobile, detailed on desktop */}
      <div className="desktop-only" style={{ alignItems: 'center', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Activity size={12} style={{ color: 'var(--signal-forest)' }} />
          <span>API 4000: CONNECTED</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Database size={12} style={{ color: 'var(--signal-amber)' }} />
          <span>AI: GROQ FAILOVER ACTIVE</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={12} style={{ color: 'var(--ink-tertiary)' }} />
          <span>JURISDICTION: INDIA (CBDT/GST)</span>
        </div>
      </div>

      {/* Mobile Badge */}
      <div className="mobile-only" style={{ alignItems: 'center', gap: '4px' }}>
        <span className="badge-signal badge-forest" style={{ fontSize: '9px', padding: '1px 6px' }}>
          <Shield size={10} /> SECURE
        </span>
      </div>
    </div>
  );
}
