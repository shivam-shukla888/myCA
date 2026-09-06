'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import {
  Compass,
  BookOpen,
  Target,
  FileText,
  FileCheck,
  ShieldAlert,
  LogOut,
  UserCheck,
  TrendingUp,
  Sparkles,
  MoreHorizontal,
  X,
  LucideIcon,
} from 'lucide-react';

export interface NavigationMode {
  id: string;
  label: string;
  href: string;
  hint: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export const MODES: NavigationMode[] = [
  { id: 'surface', label: 'HOME', href: '/', hint: 'Financial overview', icon: Compass },
  { id: 'ledger', label: 'MONEY', href: '/ledger', hint: 'Income & expenses', icon: BookOpen },
  { id: 'crore', label: '₹1 CRORE', href: '/crore', hint: 'Shortest path to ₹1 Cr', icon: TrendingUp },
  { id: 'myca', label: 'MYCA', href: '/intelligence', hint: 'Ask your AI coach', icon: Sparkles },
  { id: 'plan', label: 'GOALS', href: '/plan', hint: 'Goal planning', icon: Target },
  { id: 'vault', label: 'VAULT', href: '/vault', hint: 'Document archive', icon: FileText },
  { id: 'statements', label: 'STATEMENTS', href: '/statements', hint: 'Tax computation dossier', icon: FileCheck },
  { id: 'audit', label: 'AUDIT LOGS', href: '/admin/audit', hint: 'Regulatory security audit', icon: ShieldAlert, adminOnly: true },
];

export function CommandSpine() {
  const pathname = usePathname();
  const { user, logout, setUserDirectly } = useAuth();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const toggleAdminRole = () => {
    if (process.env.NODE_ENV !== 'development' || !user) return;
    const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    const newToken = `mock-test-token:${user.id}:${user.email}`;
    setUserDirectly({ ...user, role: newRole }, newToken);
  };

  // Primary mobile navigation items
  const mobilePrimary = [
    { label: 'HOME', href: '/', icon: Compass },
    { label: 'MONEY', href: '/ledger', icon: BookOpen },
    { label: '₹1 CRORE', href: '/crore', icon: TrendingUp },
    { label: 'MYCA', href: '/intelligence', icon: Sparkles },
  ];

  // Secondary contextual items for drawer
  const mobileSecondary = [
    { label: 'GOALS & ALLOCATION', href: '/plan', hint: 'Emergency buffer & financial milestones', icon: Target },
    { label: 'VAULT & OCR', href: '/vault', hint: 'Uploaded salary slips & bank statements', icon: FileText },
    { label: 'TAX STATEMENTS', href: '/statements', hint: 'Fiscal dossier and computations', icon: FileCheck },
    ...(user?.role === 'ADMIN'
      ? [{ label: 'AUDIT LOGS', href: '/admin/audit', hint: 'Security audit trail & RBAC logs', icon: ShieldAlert }]
      : []),
  ];

  return (
    <>
      {/* ========================================================================= */}
      {/* DESKTOP SIDEBAR (>= 900px) */}
      {/* ========================================================================= */}
      <aside
        className="desktop-only"
        style={{
          width: 'var(--spine-width)',
          background: 'var(--canvas-elevated)',
          borderRight: '1px solid var(--border-hairline)',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '28px 20px',
          minHeight: '100vh',
          flexShrink: 0,
        }}
      >
        <div>
          {/* Brand & Monogram */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div
                style={{
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
                  letterSpacing: '-0.02em',
                }}
              >
                CA
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '17px',
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                  }}
                >
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
                      transition: 'background 0.15s ease',
                      minHeight: '44px',
                      justifyContent: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icon size={14} style={{ color: isActive ? 'var(--ink-primary)' : 'var(--ink-tertiary)' }} />
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11.5px',
                          fontWeight: isActive ? 600 : 500,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {mode.label}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--ink-tertiary)',
                        marginTop: '2px',
                        paddingLeft: '22px',
                      }}
                    >
                      {mode.hint}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Instrumentation Footer */}
        <div
          style={{
            paddingTop: '20px',
            borderTop: '1px solid var(--border-hairline)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {!user ? (
            <Link
              href="/login"
              className="instrument-btn"
              style={{ width: '100%', justifyContent: 'center', fontSize: '11px', textDecoration: 'none', padding: '10px' }}
            >
              <UserCheck size={13} />
              Sign In to Workspace
            </Link>
          ) : (
            <>
              {/* User Identity Box */}
              <div
                style={{
                  background: 'var(--canvas-inset)',
                  padding: '10px 12px',
                  border: '1px solid var(--border-hairline)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span className="meta-tag" style={{ fontSize: '9px' }}>Entity</span>
                  <span className={`badge-signal ${user.role === 'ADMIN' ? 'badge-amber' : 'badge-forest'}`}>
                    {user.role}
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--ink-primary)' }}>
                  {user.full_name || 'Personal Account'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ink-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.email}
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
                  Switch to {user.role === 'ADMIN' ? 'Standard User' : 'Admin Role'}
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
            </>
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MOBILE BOTTOM NAVIGATION (< 900px) */}
      {/* Prioritizes: HOME, MONEY, ₹1 CRORE, MYCA, plus MORE drawer */}
      {/* ========================================================================= */}
      <nav
        className="mobile-only"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '60px',
          background: 'var(--canvas-elevated)',
          borderTop: '1px solid var(--border-hairline)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
        }}
        aria-label="Mobile Navigation"
      >
        {mobilePrimary.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                height: '100%',
                minHeight: '44px',
                minWidth: '44px',
                textDecoration: 'none',
                color: isActive ? 'var(--ink-primary)' : 'var(--ink-tertiary)',
                borderTop: isActive ? '2px solid var(--ink-primary)' : '2px solid transparent',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={18} style={{ color: isActive ? 'var(--ink-primary)' : 'var(--ink-tertiary)' }} />
              <span
                style={{
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: '0.02em',
                  marginTop: '2px',
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* MORE Contextual Button */}
        <button
          type="button"
          onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
          aria-expanded={mobileMoreOpen}
          aria-label="More navigation options"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            height: '100%',
            minHeight: '44px',
            minWidth: '44px',
            background: 'none',
            border: 'none',
            borderTop: mobileMoreOpen ? '2px solid var(--ink-primary)' : '2px solid transparent',
            color: mobileMoreOpen ? 'var(--ink-primary)' : 'var(--ink-tertiary)',
            cursor: 'pointer',
          }}
        >
          <MoreHorizontal size={18} />
          <span
            style={{
              fontSize: '9.5px',
              fontFamily: 'var(--font-mono)',
              fontWeight: mobileMoreOpen ? 700 : 500,
              letterSpacing: '0.02em',
              marginTop: '2px',
            }}
          >
            MORE
          </span>
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* MOBILE CONTEXTUAL "MORE" BOTTOM SHEET */}
      {/* ========================================================================= */}
      {mobileMoreOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setMobileMoreOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              zIndex: 1150,
            }}
          />

          {/* Drawer Sheet */}
          <div className="mobile-sheet">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-hairline)',
              }}
            >
              <div>
                <div className="meta-tag">Workspace Desks</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', fontWeight: 600 }}>
                  Secondary Navigation
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMoreOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  color: 'var(--ink-secondary)',
                  minHeight: '44px',
                  minWidth: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {mobileSecondary.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMobileMoreOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      background: isActive ? 'var(--canvas-inset)' : 'var(--canvas-surface)',
                      border: '1px solid var(--border-hairline)',
                      textDecoration: 'none',
                      color: 'var(--ink-primary)',
                      minHeight: '44px',
                    }}
                  >
                    <Icon size={16} style={{ color: 'var(--ink-primary)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
                        {item.hint}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* User Details & Logout in sheet */}
            {user ? (
              <div
                style={{
                  padding: '16px 20px',
                  borderTop: '1px solid var(--border-hairline)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-primary)' }}>
                    {user.full_name || 'Account'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ink-tertiary)' }}>{user.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMoreOpen(false);
                    logout();
                  }}
                  className="instrument-btn instrument-btn-secondary"
                  style={{ padding: '8px 14px', fontSize: '11px', minHeight: '44px' }}
                >
                  <LogOut size={13} />
                  Sign Out
                </button>
              </div>
            ) : (
              <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-hairline)' }}>
                <Link
                  href="/login"
                  onClick={() => setMobileMoreOpen(false)}
                  className="instrument-btn"
                  style={{ width: '100%', justifyContent: 'center', minHeight: '44px', textDecoration: 'none' }}
                >
                  <UserCheck size={14} />
                  Sign In
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
