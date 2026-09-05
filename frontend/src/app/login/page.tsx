'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../lib/api';
import { Mail, Lock, User, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

type AuthMode = 'signin' | 'signup' | 'magic-link';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get('mode') as AuthMode) || 'signin';
  const { login, signup } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode === 'signup' ? 'signup' : initialMode === 'magic-link' ? 'magic-link' : 'signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);

  function resetFeedback() {
    setError(null);
    setMessage(null);
  }

  function handleModeChange(newMode: AuthMode) {
    setMode(newMode);
    resetFeedback();
    setEmailVerificationSent(false);
  }

  function validateSignup(): string | null {
    if (!fullName.trim()) {
      return 'Full Name is required.';
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Please enter a valid email address.';
    }
    if (!password || password.length < 8) {
      return 'Password must be at least 8 characters long.';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match.';
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();

    if (mode === 'signup') {
      const valError = validateSignup();
      if (valError) {
        setError(valError);
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'signin') {
        await login(email.trim(), password);
        router.push('/');
      } else if (mode === 'signup') {
        const result = await signup(email.trim(), password, fullName.trim());
        if (result.requiresEmailVerification) {
          setEmailVerificationSent(true);
          setMessage(result.message || 'Check your email to verify your account.');
        } else {
          // Direct session returned — route to financial onboarding
          router.push('/onboarding');
        }
      } else if (mode === 'magic-link') {
        const res = await authApi.magicLink({ email: email.trim() });
        setMessage(res.message || 'Magic link dispatched to your email address.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      maxWidth: '480px',
      margin: '50px auto',
      background: 'var(--canvas-surface)',
      border: '1px solid var(--ink-primary)',
      padding: '36px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
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
        <h1 style={{ fontSize: '24px', lineHeight: 1.25, fontWeight: 600 }}>
          {mode === 'signup'
            ? 'Create Verified Account'
            : mode === 'magic-link'
            ? 'Passwordless Access'
            : 'Access Private Intelligence Desk'}
        </h1>
        <p style={{ fontSize: '12.5px', color: 'var(--ink-secondary)', marginTop: '4px' }}>
          {mode === 'signup'
            ? 'Join MyCA. Identity verified via Supabase Auth with zero-exposure client credentials.'
            : 'Authenticating against verified Supabase Auth service with zero client secrets.'}
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-hairline)',
        marginBottom: '20px',
        gap: '4px'
      }}>
        <button
          type="button"
          onClick={() => handleModeChange('signin')}
          style={{
            flex: 1,
            padding: '10px 4px',
            background: 'none',
            border: 'none',
            borderBottom: mode === 'signin' ? '2px solid var(--ink-primary)' : '2px solid transparent',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: mode === 'signin' ? 600 : 500,
            cursor: 'pointer',
            color: mode === 'signin' ? 'var(--ink-primary)' : 'var(--ink-tertiary)',
            textAlign: 'center',
            transition: 'color 0.15s ease'
          }}
        >
          SIGN IN
        </button>

        <button
          type="button"
          onClick={() => handleModeChange('signup')}
          style={{
            flex: 1,
            padding: '10px 4px',
            background: 'none',
            border: 'none',
            borderBottom: mode === 'signup' ? '2px solid var(--ink-primary)' : '2px solid transparent',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: mode === 'signup' ? 600 : 500,
            cursor: 'pointer',
            color: mode === 'signup' ? 'var(--ink-primary)' : 'var(--ink-tertiary)',
            textAlign: 'center',
            transition: 'color 0.15s ease'
          }}
        >
          CREATE ACCOUNT
        </button>

        <button
          type="button"
          onClick={() => handleModeChange('magic-link')}
          style={{
            flex: 1,
            padding: '10px 4px',
            background: 'none',
            border: 'none',
            borderBottom: mode === 'magic-link' ? '2px solid var(--ink-primary)' : '2px solid transparent',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: mode === 'magic-link' ? 600 : 500,
            cursor: 'pointer',
            color: mode === 'magic-link' ? 'var(--ink-primary)' : 'var(--ink-tertiary)',
            textAlign: 'center',
            transition: 'color 0.15s ease'
          }}
        >
          MAGIC LINK
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px',
          background: 'var(--signal-terracotta-soft)',
          borderLeft: '3px solid var(--signal-terracotta)',
          color: 'var(--signal-terracotta)',
          fontSize: '12px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div style={{
          padding: '12px 14px',
          background: 'var(--signal-forest-soft)',
          borderLeft: '3px solid var(--signal-forest)',
          color: 'var(--signal-forest)',
          fontSize: '12.5px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 600 }}>Action Required</div>
            <div>{message}</div>
          </div>
        </div>
      )}

      {emailVerificationSent ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--signal-forest-soft)',
            color: 'var(--signal-forest)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto'
          }}>
            <Mail size={24} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Check Your Email</h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
            We have sent a verification link to <strong>{email}</strong>. Please check your inbox and confirm your address to complete registration.
          </p>
          <button
            type="button"
            onClick={() => handleModeChange('signin')}
            className="instrument-btn"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Return to Sign In
            <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {mode === 'signup' && (
            <div>
              <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>Full Name *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Shivam Shukla"
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
                <User size={14} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--ink-tertiary)' }} />
              </div>
            </div>
          )}

          <div>
            <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>
              {mode === 'signup' ? 'Email Address *' : 'Registered Email'}
            </label>
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

          {mode !== 'magic-link' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="meta-tag">
                  {mode === 'signup' ? 'Create Password * (min. 8 characters)' : 'Passphrase'}
                </label>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••••••'}
                  required
                  minLength={mode === 'signup' ? 8 : undefined}
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

          {mode === 'signup' && (
            <div>
              <label className="meta-tag" style={{ display: 'block', marginBottom: '6px' }}>Confirm Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  minLength={8}
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
              {confirmPassword && password !== confirmPassword && (
                <div style={{ color: 'var(--signal-terracotta)', fontSize: '11px', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                  Passwords do not match
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="instrument-btn"
            style={{ width: '100%', justifyContent: 'center', marginTop: '8px', padding: '12px' }}
          >
            {loading
              ? 'Processing Identity...'
              : mode === 'signup'
              ? 'Create Verified Account'
              : mode === 'signin'
              ? 'Verify & Enter Workspace'
              : 'Transmit Magic Link'}
            <ArrowRight size={14} />
          </button>
        </form>
      )}

      {/* Mode navigation footers */}
      <div style={{
        marginTop: '20px',
        textAlign: 'center',
        fontSize: '12px',
        color: 'var(--ink-secondary)'
      }}>
        {mode === 'signin' && (
          <div>
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => handleModeChange('signup')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ink-primary)',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Create Account
            </button>
          </div>
        )}
        {mode === 'signup' && (
          <div>
            Already registered?{' '}
            <button
              type="button"
              onClick={() => handleModeChange('signin')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ink-primary)',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Sign In
            </button>
          </div>
        )}
        {mode === 'magic-link' && (
          <div>
            Prefer password login?{' '}
            <button
              type="button"
              onClick={() => handleModeChange('signin')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ink-primary)',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>

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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: '480px', margin: '60px auto', padding: '40px', textAlign: 'center' }}>
        <span className="meta-tag">Loading Verification Desk...</span>
      </div>
    }>
      <LoginFormContent />
    </Suspense>
  );
}

