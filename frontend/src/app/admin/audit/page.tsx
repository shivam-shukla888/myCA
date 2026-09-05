'use client';

import React, { useEffect, useState } from 'react';
import { adminApi, AdminAuditLogItem } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { Lock } from 'lucide-react';

export default function AdminAuditPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AdminAuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      return;
    }

    let ignore = false;
    adminApi.getAuditLogs()
      .then((data) => {
        if (!ignore) {
          setLogs(data || []);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Access to admin audit logs denied';
          setError(msg);
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [user?.role]);

  // RBAC Access Restriction Gate
  if (user?.role !== 'ADMIN') {
    return (
      <div style={{
        maxWidth: '600px',
        margin: '60px auto',
        padding: '40px',
        background: 'var(--canvas-surface)',
        border: '1px solid var(--signal-terracotta)',
        textAlign: 'center'
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          margin: '0 auto 16px',
          background: 'var(--signal-terracotta-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--signal-terracotta)'
        }}>
          <Lock size={20} />
        </div>

        <div className="meta-tag" style={{ color: 'var(--signal-terracotta)', marginBottom: '8px' }}>
          403 FORBIDDEN • RBAC ENFORCED
        </div>
        <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>
          Restricted Regulatory Interface
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
          Access to the administrative audit ledger requires verified ADMIN privileges. Your authenticated identity has role <strong>{user?.role || 'UNAUTHENTICATED'}</strong>.
        </p>
        <div style={{ marginTop: '20px', fontSize: '11px', color: 'var(--ink-tertiary)', fontFamily: 'var(--font-mono)' }}>
          Tip: You can switch roles using the demonstration toggle at the bottom of the navigation rail.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div>
        <div className="meta-tag" style={{ marginBottom: '8px', color: 'var(--signal-amber)' }}>
          Administrative Console • Role Verified
        </div>
        <h1 style={{ fontSize: '32px', lineHeight: 1.15 }}>
          AI Recommendations & Regulatory Audit Ledger
        </h1>
        <p style={{ color: 'var(--ink-secondary)', marginTop: '6px', fontSize: '13px' }}>
          Forensic immutable log of all model interactions, confidence calibrations, statutory disclaimers, and human review gates.
        </p>
      </div>

      <hr className="hairline-rule" style={{ margin: 0 }} />

      {/* Audit Log Table */}
      <div style={{ border: '1px solid var(--border-hairline)', background: 'var(--canvas-surface)' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '140px 1.5fr 2fr 100px 120px 100px',
          padding: '12px 20px',
          background: 'var(--canvas-inset)',
          borderBottom: '1px solid var(--border-hairline)',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          fontWeight: 600,
          color: 'var(--ink-tertiary)'
        }}>
          <div>TIMESTAMP</div>
          <div>INQUIRY QUERY</div>
          <div>MODEL ANSWER SNIPPET</div>
          <div>CONFIDENCE</div>
          <div>TOPIC / CAT</div>
          <div>HUMAN REVIEW</div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            LOADING AUDIT LEDGER...
          </div>
        ) : error ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--signal-alert)', fontSize: '12px' }}>
            {error}
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-tertiary)' }}>
            No administrative audit entries recorded yet.
          </div>
        ) : (
          logs.map((log, idx) => (
            <div
              key={log.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 1.5fr 2fr 100px 120px 100px',
                padding: '14px 20px',
                borderBottom: idx < logs.length - 1 ? '1px solid var(--border-hairline)' : 'none',
                alignItems: 'center',
                fontSize: '12px'
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--ink-tertiary)' }}>
                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>

              <div style={{ fontWeight: 600, color: 'var(--ink-primary)', paddingRight: '12px' }}>
                {log.query}
              </div>

              <div style={{ color: 'var(--ink-secondary)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '12px' }}>
                {log.response}
              </div>

              <div>
                <span className="badge-signal badge-forest" style={{ fontSize: '9px' }}>
                  {(log.confidence_score * 100).toFixed(0)}%
                </span>
              </div>

              <div>
                <span className="badge-signal badge-amber" style={{ fontSize: '9px' }}>
                  {log.topic_category}
                </span>
              </div>

              <div>
                <span className="badge-signal" style={{
                  fontSize: '9px',
                  background: log.reviewed_by_human ? 'var(--signal-forest-soft)' : 'var(--canvas-inset)',
                  color: log.reviewed_by_human ? 'var(--signal-forest)' : 'var(--ink-tertiary)'
                }}>
                  {log.reviewed_by_human ? 'REVIEWED' : 'PENDING'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
