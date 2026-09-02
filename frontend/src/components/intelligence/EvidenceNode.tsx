'use client';

import React, { useState } from 'react';
import { EvidenceSource } from '../../lib/api';
import { Database, Calculator, FileText, BookOpen } from 'lucide-react';

export function EvidenceNode({ evidence }: { evidence: EvidenceSource }) {
  const [isExpanded, setIsExpanded] = useState(false);

  let Icon = Database;
  let typeLabel = 'DATA RECORD';
  if (evidence.source_type === 'calculation') {
    Icon = Calculator;
    typeLabel = 'BACKEND ARITHMETIC';
  } else if (evidence.source_type === 'document') {
    Icon = FileText;
    typeLabel = 'DOCUMENT NODE';
  } else if (evidence.source_type === 'domain_knowledge') {
    Icon = BookOpen;
    typeLabel = 'STATUTORY RULE';
  }

  return (
    <div
      onClick={() => setIsExpanded(!isExpanded)}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        background: 'var(--canvas-surface)',
        border: '1px solid var(--border-hairline)',
        padding: '6px 12px',
        cursor: 'pointer',
        transition: 'border-color 0.15s ease',
        borderColor: isExpanded ? 'var(--ink-primary)' : 'var(--border-hairline)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Icon size={12} style={{ color: 'var(--signal-amber)' }} />
        <span className="meta-tag" style={{ fontSize: '9px' }}>{typeLabel}</span>
        {evidence.source_id && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-tertiary)' }}>
            #{evidence.source_id.slice(0, 8)}
          </span>
        )}
      </div>

      <div style={{
        fontSize: '11.5px',
        color: 'var(--ink-primary)',
        marginTop: '3px',
        lineHeight: 1.3
      }}>
        {evidence.claim}
      </div>

      {isExpanded && (
        <div style={{
          marginTop: '8px',
          paddingTop: '6px',
          borderTop: '1px dashed var(--border-hairline)',
          fontSize: '10.5px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--ink-secondary)'
        }}>
          Verification: Traceable to user isolated record or deterministic backend aggregate.
        </div>
      )}
    </div>
  );
}
