'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Activity, ShieldCheck, Database, Sliders } from 'lucide-react';

export function FinancialStatusStrip() {
  const pathname = usePathname();

  let modeName = 'SURFACE / FINANCIAL TERRAIN';
  if (pathname.includes('ledger')) modeName = 'LEDGER / TEMPORAL STREAM';
  else if (pathname.includes('vault')) modeName = 'VAULT / EVIDENCE ARCHIVE';
  else if (pathname.includes('intelligence')) modeName = 'INTELLIGENCE / DECISION DESK';
  else if (pathname.includes('statements')) modeName = 'STATEMENTS / FISCAL DOSSIER';
  else if (pathname.includes('audit')) modeName = 'ADMIN / REGULATORY AUDIT';

  return (
    <div style={{
      height: '36px',
      borderBottom: '1px solid var(--border-hairline)',
      background: 'var(--canvas-surface)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      fontSize: '11px',
      fontFamily: 'var(--font-mono)',
      color: 'var(--ink-secondary)',
      flexShrink: 0
    }}>
      {/* Active Mode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Sliders size={12} style={{ color: 'var(--ink-primary)' }} />
        <span style={{ fontWeight: 600, letterSpacing: '0.04em', color: 'var(--ink-primary)' }}>
          {modeName}
        </span>
      </div>

      {/* System Status Calibrations */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
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
    </div>
  );
}
