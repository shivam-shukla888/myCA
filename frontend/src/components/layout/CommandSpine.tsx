'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Compass, BookOpen, FileText, Cpu, FileCheck, ShieldAlert, LogOut, UserCheck } from 'lucide-react';

export const MODES = [
  { id: 'surface', label: 'SURFACE', href: '/', hint: 'Financial terrain & positions', icon: Compass },
  { id: 'ledger', label: 'LEDGER', href: '/ledger', hint: 'Temporal event stream', icon: BookOpen },
  { id: 'vault', label: 'VAULT', href: '/vault', hint: 'Evidence & documents archive', icon: FileText },
  { id: 'intelligence', label: 'INTELLIGENCE', href: '/intelligence', hint: 'Analytical decision desk', icon: Cpu },
  { id: 'statements', label: 'STATEMENTS', href: '/statements', hint: 'Fiscal reports & filings', icon: FileCheck },
  { id: 'audit', label: 'AUDIT', href: '/admin/audit', hint: 'Regulatory compliance ledger', icon: ShieldAlert, adminOnly: true },
];

export function CommandSpine() {
  const pathname = usePathname();
  const { user, logout, setUserDirectly, token } = useAuth();

  const toggleAdminRole = () => {
    if (process.env.NODE_ENV !== 'development' || !user) return;
    const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    const newToken = `mock-test-token:${user.id}:${user.email}`;
    setUserDirectly({ ...user, role: newRole }, newToken);
  };

  return (
    <aside style={{
      width: 'var(--spine-width)',
      background: 'var(--canvas-elevated)',
      borderRight: '1px solid var(--border-hairline)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '28px 20px',
      minHeight: '100vh',
      flexShrink: 0
    }}>
      <div>
        {/* Brand & Monogram */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              background: 'var(--ink-primary)',
              color: 'var(--ink-inverted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '-0.02em'
            }}>
              CA
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '17px',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                lineHeight: 1.1
              }}>
                Personal CA
              </div>
              <div className="meta-tag" style={{ fontSize: '9px', marginTop: '2px' }}>
                Financial Instrument
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Modes */}
        <div style={{ marginBottom: '24px' }}>
          <div className="meta-label" style={{ marginBottom: '14px', paddingLeft: '8px' }}>
            Operational Modes
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {MODES.map((mode) => {
              if (mode.adminOnly && user?.role !== 'ADMIN') return null;
              const isActive = pathname === mode.href;
              const Icon = mode.icon;

              return (
                <Link
                  key={mode.id}
                  href={mode.href}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '10px 12px',
                    background: isActive ? 'var(--canvas-inset)' : 'transparent',
                    borderLeft: isActive ? '2px solid var(--ink-primary)' : '2px solid transparent',
                    textDecoration: 'none',
                    color: isActive ? 'var(--ink-primary)' : 'var(--ink-secondary)',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon size={14} style={{ color: isActive ? 'var(--ink-primary)' : 'var(--ink-tertiary)' }} />
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11.5px',
                      fontWeight: isActive ? 600 : 500,
                      letterSpacing: '0.04em'
                    }}>
                      {mode.label}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    color: 'var(--ink-tertiary)',
                    marginTop: '2px',
                    paddingLeft: '22px'
                  }}>
                    {mode.hint}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Instrumentation Footer */}
      <div style={{
        paddingTop: '20px',
        borderTop: '1px solid var(--border-hairline)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* User Identity Box */}
        <div style={{
          background: 'var(--canvas-inset)',
          padding: '10px 12px',
          border: '1px solid var(--border-hairline)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span className="meta-tag" style={{ fontSize: '9px' }}>Entity</span>
            <span className={`badge-signal ${user?.role === 'ADMIN' ? 'badge-amber' : 'badge-forest'}`}>
              {user?.role || 'USER'}
            </span>
          </div>
          <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--ink-primary)' }}>
            {user?.full_name || 'Personal Account'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--ink-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.email}
          </div>
        </div>

        {/* Role Switcher for Testing (RBAC Demonstration - Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <button
            onClick={toggleAdminRole}
            className="instrument-btn instrument-btn-secondary"
            style={{ width: '100%', justifyContent: 'center', fontSize: '11px' }}
          >
            <UserCheck size={13} />
            Switch to {user?.role === 'ADMIN' ? 'Standard User' : 'Admin Role'}
          </button>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="meta-tag" style={{ fontSize: '9.5px' }}>FY 2025–26 (AY 2026–27)</span>
          <button
            onClick={logout}
            title="Sign out"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-tertiary)' }}
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
