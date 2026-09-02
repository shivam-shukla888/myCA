'use client';

import React from 'react';

interface ConfidenceMeterProps {
  score: number;
  className?: string;
}

export function ConfidenceMeter({ score }: ConfidenceMeterProps) {
  const normalized = Math.max(0, Math.min(1, score));
  const blocksTotal = 10;
  const filledBlocks = Math.round(normalized * blocksTotal);
  
  let label = 'HIGH EVIDENCE';
  let badgeClass = 'badge-forest';
  if (normalized < 0.5) {
    label = 'LIMITED EVIDENCE';
    badgeClass = 'badge-terracotta';
  } else if (normalized < 0.75) {
    label = 'MODERATE EVIDENCE';
    badgeClass = 'badge-amber';
  }

  // Graphical representation: ████████░░
  const visualBar = '█'.repeat(filledBlocks) + '░'.repeat(blocksTotal - filledBlocks);

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      background: 'var(--canvas-inset)',
      border: '1px solid var(--border-hairline)',
      padding: '4px 10px',
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
    }}>
      <span className="meta-tag" style={{ fontSize: '9px' }}>Grounding Density</span>
      <span style={{ color: 'var(--ink-primary)', letterSpacing: '0.06em' }}>
        {visualBar}
      </span>
      <span style={{ fontWeight: 600, color: 'var(--ink-primary)' }}>
        {(normalized * 100).toFixed(0)}%
      </span>
      <span className={`badge-signal ${badgeClass}`} style={{ fontSize: '9.5px' }}>
        {label}
      </span>
    </div>
  );
}
