'use client';

import React from 'react';
import Link from 'next/link';
import { Lock, ArrowRight, ShieldCheck } from 'lucide-react';

interface AuthRequiredStateProps {
  title?: string;
  description?: string;
  modeTag?: string;
  hint?: string;
}

export function AuthRequiredState({
  title = 'Identity Verification Required',
  description = 'This workspace area accesses isolated financial records and requires verified authentication.',
  modeTag = 'SECURE OPERATIONAL MODE',
  hint = 'Protected by Supabase Auth RLS and AES-256 field security. Zero client secrets.',
}: AuthRequiredStateProps) {
  return (
    <div
      style={{
        padding: '48px 36px',
        background: 'var(--canvas-surface)',
        border: '1px solid var(--border-hairline)',
        maxWidth: '680px',
        margin: '40px auto',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          background: 'var(--canvas-inset)',
          border: '1px solid var(--border-hairline)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ink-primary)',
        }}
      >
        <Lock size={20} />
      </div>

      <div>
        <div className="meta-tag" style={{ marginBottom: '8px', color: 'var(--ink-secondary)' }}>
          {modeTag}
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--ink-primary)', lineHeight: 1.25 }}>
          {title}
        </h2>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--ink-secondary)',
            marginTop: '8px',
            maxWidth: '480px',
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <Link
          href="/login"
          className="instrument-btn"
          style={{
            padding: '12px 24px',
            fontSize: '12px',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          Sign In to Workspace
          <ArrowRight size={14} />
        </Link>
      </div>

      <div
        style={{
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--ink-tertiary)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginTop: '8px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-hairline)',
          width: '100%',
          justifyContent: 'center',
        }}
      >
        <ShieldCheck size={13} style={{ color: 'var(--signal-forest)' }} />
        <span>{hint}</span>
      </div>
    </div>
  );
}
