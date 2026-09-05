'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { allocationApi, authApi } from '../../lib/api';
import {
  User,
  IndianRupee,
  Wallet,
  TrendingUp,
  Target,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface OnboardingData {
  fullName: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  existingSavings: number;
  existingInvestments: number;
  desiredLifestyleIncome: number;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, refreshProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<OnboardingData>({
    fullName: '',
    monthlyIncome: 100000,
    monthlyExpenses: 40000,
    existingSavings: 200000,
    existingInvestments: 500000,
    desiredLifestyleIncome: 80000,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
    if (user?.full_name && !data.fullName) {
      setData((prev) => ({ ...prev, fullName: user.full_name || '' }));
    }
  }, [isLoading, isAuthenticated, user, router, data.fullName]);

  const steps = [
    { num: 1, title: 'Identity', label: 'Your Profile Name' },
    { num: 2, title: 'Cashflow', label: 'Monthly Income' },
    { num: 3, title: 'Outflow', label: 'Essential Expenses' },
    { num: 4, title: 'Safety Net', label: 'Liquid Savings' },
    { num: 5, title: 'Capital', label: 'Investments' },
    { num: 6, title: 'Ambition', label: 'Lifestyle Goal' },
  ];

  function handleNext() {
    setError(null);
    if (step === 1 && !data.fullName.trim()) {
      setError('Please provide your name to personalize your workspace.');
      return;
    }
    if (step < 6) {
      setStep((s) => s + 1);
    } else {
      handleFinalize();
    }
  }

  function handleBack() {
    setError(null);
    if (step > 1) {
      setStep((s) => s - 1);
    }
  }

  async function handleFinalize() {
    setSubmitting(true);
    setError(null);
    try {
      // 1. Persist financial metrics to public.financial_profiles
      await allocationApi.saveProfile({
        monthly_income: Number(data.monthlyIncome) || 0,
        monthly_essential_expenses: Number(data.monthlyExpenses) || 0,
        existing_liquid_savings: Number(data.existingSavings) || 0,
        existing_investments: Number(data.existingInvestments) || 0,
        desired_monthly_lifestyle_income: Number(data.desiredLifestyleIncome) || 0,
      });

      // 2. Persist profile updates to public.profiles
      await authApi.updateMe({
        full_name: data.fullName.trim() || undefined,
        onboarding_completed: true,
      });

      // 3. Refresh user state in AuthContext
      await refreshProfile();

      // 4. Redirect to dashboard
      router.push('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save onboarding profile';
      setError(msg);
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    setSubmitting(true);
    try {
      await authApi.updateMe({
        onboarding_completed: true,
      });
      await refreshProfile();
    } catch {
      // Non-blocking skip — route anyway
    } finally {
      router.push('/');
    }
  }

  if (isLoading) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
        <span className="meta-tag">Initializing Workspace Identity...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 16px' }}>
      {/* Header bar */}
      <div style={{
        background: 'var(--canvas-surface)',
        border: '1px solid var(--ink-primary)',
        padding: '24px 32px 20px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            <span className="meta-tag">Financial Architecture Desk</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-secondary)' }}>
            STEP {step} OF 6
          </span>
        </div>

        <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '4px 0 8px 0' }}>
          Calibrate Your Advisory Model
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', margin: 0, lineHeight: 1.4 }}>
          Provide baseline figures for high-precision cashflow forecasting, tax optimization, and wealth trajectory.
        </p>

        {/* Progress tracker bar */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '20px' }}>
          {steps.map((s) => (
            <div
              key={s.num}
              style={{
                flex: 1,
                height: '4px',
                background: s.num <= step ? 'var(--ink-primary)' : 'var(--border-hairline)',
                transition: 'background 0.2s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* Main card */}
      <div style={{
        background: 'var(--canvas-surface)',
        border: '1px solid var(--border-hairline)',
        padding: '32px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
      }}>
        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'var(--signal-terracotta-soft)',
            borderLeft: '3px solid var(--signal-terracotta)',
            color: 'var(--signal-terracotta)',
            fontSize: '12.5px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        {/* STEP 1: Full Name */}
        {step === 1 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                background: 'var(--canvas-inset)',
                border: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ink-primary)'
              }}>
                <User size={16} />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Confirm Your Name</h2>
                <div style={{ fontSize: '12px', color: 'var(--ink-secondary)' }}>Used for statements, tax reports, and audit certificates</div>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <label className="meta-tag" style={{ display: 'block', marginBottom: '8px' }}>
                Full Legal Name / Entity Name
              </label>
              <input
                type="text"
                value={data.fullName}
                onChange={(e) => setData({ ...data, fullName: e.target.value })}
                placeholder="e.g. Shivam Shukla"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'var(--canvas-inset)',
                  border: '1px solid var(--border-hairline)',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>
          </div>
        )}

        {/* STEP 2: Monthly Income */}
        {step === 2 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                background: 'var(--canvas-inset)',
                border: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--signal-forest)'
              }}>
                <IndianRupee size={16} />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Monthly Net Inflow</h2>
                <div style={{ fontSize: '12px', color: 'var(--ink-secondary)' }}>Combined take-home income from salary, business, and retainers</div>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <label className="meta-tag" style={{ display: 'block', marginBottom: '8px' }}>
                Monthly Inflow (₹ INR)
              </label>
              <input
                type="number"
                min="0"
                step="5000"
                value={data.monthlyIncome || ''}
                onChange={(e) => setData({ ...data, monthlyIncome: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'var(--canvas-inset)',
                  border: '1px solid var(--border-hairline)',
                  fontSize: '18px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                {[50000, 100000, 200000, 350000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setData({ ...data, monthlyIncome: amt })}
                    style={{
                      padding: '6px 12px',
                      background: data.monthlyIncome === amt ? 'var(--ink-primary)' : 'var(--canvas-inset)',
                      color: data.monthlyIncome === amt ? 'var(--ink-inverted)' : 'var(--ink-secondary)',
                      border: '1px solid var(--border-hairline)',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer'
                    }}
                  >
                    ₹{(amt / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Essential Monthly Expenses */}
        {step === 3 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                background: 'var(--canvas-inset)',
                border: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--signal-terracotta)'
              }}>
                <Wallet size={16} />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Typical Monthly Outflows</h2>
                <div style={{ fontSize: '12px', color: 'var(--ink-secondary)' }}>Rent, utilities, groceries, EMIs, and necessary living costs</div>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <label className="meta-tag" style={{ display: 'block', marginBottom: '8px' }}>
                Essential Monthly Expenses (₹ INR)
              </label>
              <input
                type="number"
                min="0"
                step="2000"
                value={data.monthlyExpenses || ''}
                onChange={(e) => setData({ ...data, monthlyExpenses: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'var(--canvas-inset)',
                  border: '1px solid var(--border-hairline)',
                  fontSize: '18px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                {[25000, 40000, 75000, 120000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setData({ ...data, monthlyExpenses: amt })}
                    style={{
                      padding: '6px 12px',
                      background: data.monthlyExpenses === amt ? 'var(--ink-primary)' : 'var(--canvas-inset)',
                      color: data.monthlyExpenses === amt ? 'var(--ink-inverted)' : 'var(--ink-secondary)',
                      border: '1px solid var(--border-hairline)',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer'
                    }}
                  >
                    ₹{(amt / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Existing Liquid Savings */}
        {step === 4 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                background: 'var(--canvas-inset)',
                border: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--signal-forest)'
              }}>
                <ShieldCheck size={16} />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Existing Liquid Savings</h2>
                <div style={{ fontSize: '12px', color: 'var(--ink-secondary)' }}>Savings accounts, emergency reserves, and instant-access fixed deposits</div>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <label className="meta-tag" style={{ display: 'block', marginBottom: '8px' }}>
                Current Liquid Balance (₹ INR)
              </label>
              <input
                type="number"
                min="0"
                step="10000"
                value={data.existingSavings || ''}
                onChange={(e) => setData({ ...data, existingSavings: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'var(--canvas-inset)',
                  border: '1px solid var(--border-hairline)',
                  fontSize: '18px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                {[100000, 200000, 500000, 1000000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setData({ ...data, existingSavings: amt })}
                    style={{
                      padding: '6px 12px',
                      background: data.existingSavings === amt ? 'var(--ink-primary)' : 'var(--canvas-inset)',
                      color: data.existingSavings === amt ? 'var(--ink-inverted)' : 'var(--ink-secondary)',
                      border: '1px solid var(--border-hairline)',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer'
                    }}
                  >
                    ₹{(amt / 100000).toFixed(1)}L
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Existing Investments */}
        {step === 5 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                background: 'var(--canvas-inset)',
                border: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ink-primary)'
              }}>
                <TrendingUp size={16} />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Invested Portfolio Value</h2>
                <div style={{ fontSize: '12px', color: 'var(--ink-secondary)' }}>Mutual funds, direct equities, PPF, NPS, and real estate allocations</div>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <label className="meta-tag" style={{ display: 'block', marginBottom: '8px' }}>
                Total Portfolio Asset Value (₹ INR)
              </label>
              <input
                type="number"
                min="0"
                step="50000"
                value={data.existingInvestments || ''}
                onChange={(e) => setData({ ...data, existingInvestments: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'var(--canvas-inset)',
                  border: '1px solid var(--border-hairline)',
                  fontSize: '18px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                {[200000, 500000, 1500000, 5000000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setData({ ...data, existingInvestments: amt })}
                    style={{
                      padding: '6px 12px',
                      background: data.existingInvestments === amt ? 'var(--ink-primary)' : 'var(--canvas-inset)',
                      color: data.existingInvestments === amt ? 'var(--ink-inverted)' : 'var(--ink-secondary)',
                      border: '1px solid var(--border-hairline)',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer'
                    }}
                  >
                    ₹{(amt / 100000).toFixed(amt >= 10000000 ? 2 : 1)}L
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: Primary Financial Goal / Lifestyle Income */}
        {step === 6 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                background: 'var(--canvas-inset)',
                border: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ink-primary)'
              }}>
                <Target size={16} />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Desired Financial Freedom Goal</h2>
                <div style={{ fontSize: '12px', color: 'var(--ink-secondary)' }}>Target monthly lifestyle expenditure to be generated by passive returns</div>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <label className="meta-tag" style={{ display: 'block', marginBottom: '8px' }}>
                Desired Monthly Passive Income (₹ INR)
              </label>
              <input
                type="number"
                min="0"
                step="5000"
                value={data.desiredLifestyleIncome || ''}
                onChange={(e) => setData({ ...data, desiredLifestyleIncome: Number(e.target.value) })}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'var(--canvas-inset)',
                  border: '1px solid var(--border-hairline)',
                  fontSize: '18px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  outline: 'none'
                }}
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                {[50000, 80000, 150000, 250000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setData({ ...data, desiredLifestyleIncome: amt })}
                    style={{
                      padding: '6px 12px',
                      background: data.desiredLifestyleIncome === amt ? 'var(--ink-primary)' : 'var(--canvas-inset)',
                      color: data.desiredLifestyleIncome === amt ? 'var(--ink-inverted)' : 'var(--ink-secondary)',
                      border: '1px solid var(--border-hairline)',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer'
                    }}
                  >
                    ₹{(amt / 1000).toFixed(0)}k/mo
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '32px',
          paddingTop: '20px',
          borderTop: '1px solid var(--border-hairline)'
        }}>
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={submitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: '1px solid var(--border-hairline)',
                  padding: '10px 16px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  color: 'var(--ink-secondary)'
                }}
              >
                <ArrowLeft size={14} />
                BACK
              </button>
            ) : (
              <div />
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={handleNext}
              disabled={submitting}
              className="instrument-btn"
              style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {submitting ? (
                'Securing Profile...'
              ) : step === 6 ? (
                <>
                  <Sparkles size={14} />
                  Calibrate & Enter Desk
                </>
              ) : (
                <>
                  NEXT
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Non-blocking skip */}
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <button
          type="button"
          onClick={handleSkip}
          disabled={submitting}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--ink-tertiary)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          Skip for now — explore workspace first
        </button>
      </div>
    </div>
  );
}
