'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../lib/api';
import { ShieldCheck, Mail, Lock, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [mode, setMode] = useState<'password' | 'magic-link'>('password');
  const [email, setEmail] = useState('personal_ca_test_step4@gmail.com');
  const [password, setPassword] = useState('TestPassword123!');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === 'password') {
        await login(email, password);
        router.push('/');
      } else {
        const res = await authApi.magicLink({ email });
        setMessage(res.message || 'Magic link dispatched to your email address.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      maxWidth: '460px',
      margin: '60px auto',
      background: 'var(--canvas-surface)',
      border: '1px solid var(--ink-primary)',
      padding: '40px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
    }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            background: 'var(--ink-primary)',
            color: 'var(--ink-inverted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: 700
          }}>
            CA
          </div>
          <span className="meta-tag">Identity Verification Desk</span>
        </div>
        <h1 style={{ fontSize: '26px', lineHeight: 1.2 }}>
          Access Private Intelligence Desk
        </h1>
        <p style={{ fontSize: '12.5px', color: 'var(--ink-secondary)', marginTop: '4px' }}>
          Authenticating against verified Supabase Auth service with zero client secrets.
        </p>
      </div>

      {/* Mode Switcher */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-hairline)',
        marginBottom: '20px'
      }}>
        <button
          type="button"
          onClick={() => setMode('password')}
          style={{
            flex: 1,
            padding: '8px 0',
            background: 'none',
            border: 'none',
            borderBottom: mode === 'password' ? '2px solid var(--ink-primary)' : '2px solid transparent',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: mode === 'password' ? 600 : 500,
            cursor: 'pointer',
            color: mode === 'password' ? 'var(--ink-primary)' : 'var(--ink-tertiary)'
          }}
        >
          EMAIL & PASSWORD
        </button>

        <button
          type="button"
          onClick={() => setMode('magic-link')}
          style={{
            flex: 1,
            padding: '8px 0',
            background: 'none',
            border: 'none',
            borderBottom: mode === 'magic-link' ? '2px solid var(--ink-primary)' : '2px solid transparent',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: mode === 'magic-link' ? 600 : 500,
            cursor: 'pointer',
            color: mode === 'magic-link' ? 'var(--ink-primary)' : 'var(--ink-tertiary)'
          }}
        >
          PASSWORDLESS MAGIC LINK
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px',
          background: 'var(--signal-terracotta-soft)',
          borderLeft: '3px solid var(--signal-terracotta)',
          color: 'var(--signal-terracotta)',
          fontSize: '12px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      {message && (
        <div style={{
          padding: '10px 14px',
          background: 'var(--signal-forest-soft)',
          borderLeft: '3px solid var(--signal-forest)',
          color: 'var(--signal-forest)',
          fontSize: '12px',
          marginBottom: '16px'
        }}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>Registered Email</label>
          <div style={{ position: 'relative' }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                background: 'var(--canvas-inset)',
                border: '1px solid var(--border-hairline)',
                outline: 'none',
                fontSize: '13px'
              }}
            />
            <Mail size={14} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--ink-tertiary)' }} />
          </div>
        </div>

        {mode === 'password' && (
          <div>
            <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>Passphrase</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  background: 'var(--canvas-inset)',
                  border: '1px solid var(--border-hairline)',
                  outline: 'none',
                  fontSize: '13px'
                }}
              />
              <Lock size={14} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--ink-tertiary)' }} />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="instrument-btn"
          style={{ width: '100%', justifyContent: 'center', marginTop: '8px', padding: '12px' }}
        >
          {loading ? 'Authenticating Identity...' : mode === 'password' ? 'Verify & Enter Workspace' : 'Transmit Magic Link'}
          <ArrowRight size={14} />
        </button>
      </form>

      <div style={{
        marginTop: '24px',
        paddingTop: '16px',
        borderTop: '1px solid var(--border-hairline)',
        textAlign: 'center',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--ink-tertiary)'
      }}>
        Protected by Supabase Auth RLS & AES-256 Field Security
      </div>
    </div>
  );
}
