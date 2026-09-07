'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { AuthRequiredState } from '../../components/auth/AuthRequiredState';
import {
  croreApi,
  CroreCalculation,
  CroreSimulationInput,
  AccelerationLeverOption,
} from '../../lib/api';
import {
  Zap,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Clock,
  ChevronRight,
  Info,
  TrendingUp,
  Target,
  Layers,
  ArrowRight,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';

export default function CrorePage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [calculation, setCalculation] = useState<CroreCalculation | null>(null);
  const [canonicalState, setCanonicalState] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active What-If Scenario Selection
  const [selectedLeverId, setSelectedLeverId] = useState<string | null>(null);

  // Interactive Sandbox What-If State
  const [simCapital, setSimCapital] = useState<number>(500000);
  const [simContribution, setSimContribution] = useState<number>(25000);
  const [simReturn, setSimReturn] = useState<number>(12);
  const [simStepUp, setSimStepUp] = useState<number>(10);
  const [simulating, setSimulating] = useState(false);
  const [customSimResult, setCustomSimResult] = useState<CroreCalculation | null>(null);

  // Active Tab for Deep Dive Section
  const [activeTab, setActiveTab] = useState<'scenarios' | 'milestones' | 'sensitivity' | 'simulator'>('scenarios');

  const loadStatus = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await croreApi.getStatus();
      if (res && res.calculation) {
        setCalculation(res.calculation);
        if (res.canonical_state) {
          setCanonicalState(res.canonical_state);
        }
        setSimCapital(res.calculation.starting_capital || 0);
        setSimContribution(res.calculation.current_monthly_contribution || 25000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load ₹1 Crore projection engine.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    loadStatus();
  }, [authLoading, isAuthenticated, loadStatus]);

  async function handleSimulate() {
    setSimulating(true);
    try {
      const input: CroreSimulationInput = {
        starting_capital: simCapital,
        monthly_contribution: simContribution,
        annual_return_pct: simReturn,
        annual_step_up_pct: simStepUp,
      };
      const res = await croreApi.simulate(input);
      if (res) {
        setCustomSimResult(res);
      }
    } catch (err: unknown) {
      console.error('Simulation failed:', err);
    } finally {
      setSimulating(false);
    }
  }

  function handleResetToCurrentPlan() {
    setSelectedLeverId(null);
    setCustomSimResult(null);
  }

  if (authLoading) {
    return (
      <div style={{ padding: '48px', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
        INITIALIZING CORE SIMULATION ENGINE...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthRequiredState
        title="₹1 Crore Path Engine"
        description="Authenticate your session to run deterministic compounding simulations against your verified capital baseline."
      />
    );
  }

  const baseCase = calculation?.base_case;
  const shortestPath = calculation?.shortest_modeled_path;
  const milestones = calculation?.milestones || [];
  const sensitivity = calculation?.sensitivity_matrix || [];
  const lever = calculation?.lever_analysis;
  const accelerationLevers = calculation?.acceleration_levers || [];

  // Active Lever if selected
  const activeLever: AccelerationLeverOption | undefined = accelerationLevers.find(
    (l) => l.id === selectedLeverId
  );

  const isWhatIfActive = Boolean(activeLever || customSimResult);

  // Capital & Cashflow values
  const currentCapital = calculation?.starting_capital ?? 0;
  const currentMonthlyContribution = calculation?.current_monthly_contribution ?? 0;
  const currentMonthlySurplus =
    (canonicalState?.cashflow as { monthly_surplus?: number } | undefined)?.monthly_surplus ?? currentMonthlyContribution;
  const assumedReturn = calculation?.assumed_return_pct ?? baseCase?.assumed_return_pct ?? 12;

  // Active Displayed Target Date & Months
  const displayedTargetDate = activeLever?.target_date ?? (customSimResult ? customSimResult.base_case.target_date : baseCase?.target_date);
  const displayedMonths = activeLever?.months_to_target ?? (customSimResult ? customSimResult.base_case.months_to_target : baseCase?.months_to_target);
  const displayedYears = displayedMonths !== null && displayedMonths !== undefined ? (displayedMonths / 12).toFixed(1) : null;
  const displayedMonthlyInv = activeLever?.monthly_contribution ?? (customSimResult ? customSimResult.current_monthly_contribution : currentMonthlyContribution);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header with Mode Distinction */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
            {/* Mode Distinction Badge */}
            {isWhatIfActive ? (
              <span style={{
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#d97706',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Sparkles size={12} />
                WHAT-IF SCENARIO — NOT A GUARANTEE
              </span>
            ) : (
              <span style={{
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <CheckCircle2 size={12} />
                CURRENT PLAN (VERIFIED STATE)
              </span>
            )}

            <span style={{ fontSize: '12px', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
              Model v2.0 • Max Return Bound ≤ 15% p.a.
            </span>
          </div>

          <h1 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink-primary)', margin: 0 }}>
            ₹1 Crore Path
          </h1>
          <p style={{ color: 'var(--ink-muted)', fontSize: '14px', marginTop: '6px', maxWidth: '680px' }}>
            Deterministic month-by-month compounding engine. Explore safe what-if scenarios to discover which controllable financial levers accelerate your journey.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isWhatIfActive && (
            <button
              onClick={handleResetToCurrentPlan}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={14} />
              Reset to Current Plan
            </button>
          )}

          <button
            onClick={loadStatus}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '8px',
              background: 'var(--canvas-elevated)',
              border: '1px solid var(--border-hairline)',
              color: 'var(--ink-primary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
            Sync Verified State
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '16px 20px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '8px',
          color: '#ef4444',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Active What-If Banner (When What-If is selected) */}
      {isWhatIfActive && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.02) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '12px',
          padding: '18px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706',
              flexShrink: 0
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                Active Simulation: {activeLever?.label || 'Custom Sandbox Simulation'}
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ink-primary)', marginTop: '2px' }}>
                {activeLever
                  ? activeLever.mathematical_impact_description
                  : `Custom monthly investment: ₹${simContribution.toLocaleString('en-IN')}/mo at ${simReturn}% return`}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ink-muted)', marginTop: '4px' }}>
                Educational what-if simulation only. Not an investment guarantee or mutual fund/stock recommendation.
              </div>
            </div>
          </div>

          <button
            onClick={handleResetToCurrentPlan}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              background: 'var(--canvas-elevated)',
              border: '1px solid var(--border-hairline)',
              color: 'var(--ink-primary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RotateCcw size={13} />
            Back to Current Plan
          </button>
        </div>
      )}

      {/* Primary Section: CURRENT POSITION & TARGET */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '20px' }}>
        {/* Card 1: CURRENT POSITION */}
        <div style={{
          background: 'var(--canvas-elevated)',
          border: '1px solid var(--border-hairline)',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} />
                CURRENT POSITION
              </span>
              <span style={{ fontSize: '11px', background: 'var(--canvas-surface)', padding: '3px 8px', borderRadius: '4px', color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)' }}>
                Baseline
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--ink-muted)', marginBottom: '4px' }}>Current Capital</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink-primary)', letterSpacing: '-0.02em' }}>
                  ₹{currentCapital.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ink-tertiary)', marginTop: '2px' }}>
                  Investable portfolio assets
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: 'var(--ink-muted)', marginBottom: '4px' }}>Monthly Surplus</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink-primary)', letterSpacing: '-0.02em' }}>
                  ₹{currentMonthlySurplus.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ink-tertiary)', marginTop: '2px' }}>
                  Net cashflow per month
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 16px', background: 'var(--canvas-surface)', borderRadius: '8px', border: '1px solid var(--border-hairline)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-primary)' }}>Monthly Contribution</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                  ₹{currentMonthlyContribution.toLocaleString('en-IN')}/mo
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ink-muted)', marginTop: '4px' }}>
                Active monthly compounding investment pace
              </div>
            </div>
          </div>

          <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-hairline)', fontSize: '12px', color: 'var(--ink-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontWeight: 600, color: 'var(--ink-secondary)' }}>Assumptions:</span>
            <span>• Compounding: Monthly at {assumedReturn}% p.a. (factor 1 + r/12)</span>
            <span>• Step-Up: 0% baseline (constant contribution)</span>
            <span>• Emergency Reserve: Excluded from investable capital for safety</span>
          </div>
        </div>

        {/* Card 2: TARGET */}
        <div style={{
          background: isWhatIfActive
            ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, var(--canvas-elevated) 100%)'
            : 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, var(--canvas-elevated) 100%)',
          border: isWhatIfActive ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: isWhatIfActive ? '#d97706' : '#10b981',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Target size={14} />
                {isWhatIfActive ? 'TARGET (WHAT-IF PROJECTION)' : 'TARGET (CURRENT PLAN)'}
              </span>
              <span style={{
                fontSize: '11px',
                background: isWhatIfActive ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: isWhatIfActive ? '#d97706' : '#10b981',
                padding: '3px 8px',
                borderRadius: '4px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)'
              }}>
                ₹1 CRORE TARGET
              </span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--ink-muted)', marginBottom: '4px' }}>Projected Target Date</div>
              <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--ink-primary)', letterSpacing: '-0.02em' }}>
                {displayedTargetDate || 'Out of 60-yr scope'}
              </div>
              <div style={{ fontSize: '14px', color: isWhatIfActive ? '#d97706' : '#10b981', fontWeight: 600, marginTop: '4px' }}>
                {displayedMonths !== null && displayedMonths !== undefined
                  ? `${displayedMonths} months (${displayedYears} years)`
                  : 'Requires consistent monthly contribution'}
              </div>
            </div>

            {/* Time saved comparison if scenario active */}
            {isWhatIfActive && activeLever && activeLever.months_saved > 0 && (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '8px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                color: '#d97706',
                fontWeight: 600
              }}>
                <Zap size={16} />
                <span>Accelerates target by {activeLever.years_saved} ({activeLever.months_saved} months earlier than Current Plan)</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '13px' }}>
              <div style={{ background: 'var(--canvas-surface)', padding: '10px 12px', borderRadius: '6px' }}>
                <div style={{ color: 'var(--ink-muted)', fontSize: '11px' }}>Corpus Target</div>
                <div style={{ fontWeight: 700, color: 'var(--ink-primary)', marginTop: '2px' }}>₹1,00,00,000</div>
              </div>
              <div style={{ background: 'var(--canvas-surface)', padding: '10px 12px', borderRadius: '6px' }}>
                <div style={{ color: 'var(--ink-muted)', fontSize: '11px' }}>Simulated Monthly SIP</div>
                <div style={{ fontWeight: 700, color: 'var(--ink-primary)', marginTop: '2px' }}>
                  ₹{displayedMonthlyInv.toLocaleString('en-IN')}/mo
                </div>
              </div>
            </div>
          </div>

          <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-hairline)', fontSize: '12px', color: 'var(--ink-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontWeight: 600, color: 'var(--ink-secondary)' }}>Uncertainty & Model Notes:</span>
            <span>• Nominal target: Inflation & capital gains tax are not subtracted.</span>
            <span>• Market risk: Equity returns fluctuate month to month; returns are not guaranteed.</span>
            <span>• Assumes continuous monthly execution without withdrawals.</span>
          </div>
        </div>
      </div>

      {/* ACCELERATION LEVERS SECTION */}
      <div style={{ background: 'var(--canvas-elevated)', border: '1px solid var(--border-hairline)', borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Zap size={18} color="#f59e0b" />
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink-primary)', margin: 0 }}>
                Acceleration Levers (Safe What-If Scenarios)
              </h2>
            </div>
            <p style={{ color: 'var(--ink-muted)', fontSize: '13px', margin: 0 }}>
              Each scenario is calculated deterministically using the exact same compounding equations. Click any lever to inspect its timeline impact.
            </p>
          </div>

          {selectedLeverId && (
            <button
              onClick={handleResetToCurrentPlan}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#ef4444',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RotateCcw size={12} /> Clear Selected Scenario
            </button>
          )}
        </div>

        {/* Highlight: LARGEST MATHEMATICAL IMPACT */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.04) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px'
        }}>
          <TrendingUp size={20} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
              LARGEST MATHEMATICAL IMPACT
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink-primary)', marginTop: '4px' }}>
              {calculation?.largest_impact_variable || 'Increasing monthly investable cashflow by +₹10,000 (via income growth or surplus optimization) has the largest mathematical impact.'}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--ink-muted)', marginTop: '4px', margin: '4px 0 0', lineHeight: 1.5 }}>
              Mathematical rationale: Because compounding returns act on every accumulated rupee, expanding regular monthly investment volume by ₹10,000 provides double the timeline acceleration of a ₹5,000 change, compounding exponentially over years.
            </p>
          </div>
        </div>

        {/* 4 Acceleration Lever Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '16px' }}>
          {accelerationLevers.map((item) => {
            const isSelected = selectedLeverId === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedLeverId(isSelected ? null : item.id)}
                style={{
                  background: isSelected ? 'rgba(245, 158, 11, 0.06)' : 'var(--canvas-surface)',
                  border: isSelected ? '2px solid #f59e0b' : '1px solid var(--border-hairline)',
                  borderRadius: '10px',
                  padding: '18px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: item.is_highest_impact ? 'rgba(16, 185, 129, 0.15)' : 'var(--canvas-elevated)',
                      color: item.is_highest_impact ? '#10b981' : 'var(--ink-muted)',
                      textTransform: 'uppercase',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {item.is_highest_impact ? 'HIGHEST IMPACT' : item.category}
                    </span>

                    {isSelected && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        ACTIVE <CheckCircle2 size={12} />
                      </span>
                    )}
                  </div>

                  <h4 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700, color: 'var(--ink-primary)' }}>
                    {item.label}
                  </h4>

                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--ink-muted)', lineHeight: 1.4 }}>
                    {item.mathematical_impact_description}
                  </p>
                </div>

                <div>
                  <div style={{ padding: '10px 12px', background: 'var(--canvas-elevated)', borderRadius: '6px', border: '1px solid var(--border-hairline)', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--ink-muted)' }}>
                      <span>New Target:</span>
                      <span style={{ fontWeight: 700, color: 'var(--ink-primary)' }}>{item.target_date || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--ink-muted)', marginTop: '4px' }}>
                      <span>Time Saved:</span>
                      <span style={{ fontWeight: 700, color: item.months_saved > 0 ? '#10b981' : 'var(--ink-muted)' }}>
                        {item.months_saved > 0 ? `-${item.years_saved}` : '0 months'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '6px',
                      background: isSelected ? '#f59e0b' : 'var(--canvas-elevated)',
                      border: isSelected ? 'none' : '1px solid var(--border-hairline)',
                      color: isSelected ? '#ffffff' : 'var(--ink-primary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    {isSelected ? 'Active What-If Scenario' : 'Simulate This Lever'}
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Never present scenarios as guarantees warning */}
        <div style={{
          marginTop: '18px',
          padding: '12px 16px',
          borderRadius: '8px',
          background: 'var(--canvas-surface)',
          border: '1px solid var(--border-hairline)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          fontSize: '11px',
          color: 'var(--ink-muted)',
          lineHeight: 1.5
        }}>
          <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--ink-secondary)' }} />
          <div>
            <strong>DISCLAIMER ON SCENARIOS & ADVISORY BOUNDARIES:</strong> What-if scenarios illustrate mathematical compounding relationships under static contribution and return assumptions. They are <strong>never guarantees</strong> of future financial performance. myCA never provides personalized stock, equity, or mutual fund buy/sell recommendations. Consult a certified financial planner for regulated investment advice.
          </div>
        </div>
      </div>

      {/* Navigation Tabs for Deep Dive Drawer */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-hairline)', paddingBottom: '8px', overflowX: 'auto' }}>
        {(
          [
            { id: 'scenarios', label: '5 Scenarios Comparison' },
            { id: 'milestones', label: 'Milestones (₹1L → ₹1Cr)' },
            { id: 'sensitivity', label: 'Sensitivity Matrix' },
            { id: 'simulator', label: 'Custom Sandbox Simulator' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              background: activeTab === tab.id ? 'var(--canvas-elevated)' : 'transparent',
              border: activeTab === tab.id ? '1px solid var(--border-hairline)' : '1px solid transparent',
              color: activeTab === tab.id ? 'var(--ink-primary)' : 'var(--ink-muted)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: 5 Scenarios Comparison */}
      {activeTab === 'scenarios' && calculation && (
        <div style={{ background: 'var(--canvas-elevated)', border: '1px solid var(--border-hairline)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-hairline)' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Modeled Compounding Scenarios</h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--ink-muted)' }}>
              Deterministic month-by-month math comparing status quo with controllable levers.
            </p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--canvas-surface)', color: 'var(--ink-muted)', borderBottom: '1px solid var(--border-hairline)' }}>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>Scenario</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>Target Date</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>Duration</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>Monthly SIP</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>Step-Up</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>Assumed Return</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { s: calculation.capital_only_case, tag: 'Baseline' },
                  { s: calculation.base_case, tag: 'Current Plan' },
                  { s: calculation.improved_case, tag: 'Surplus Lever' },
                  { s: calculation.accelerated_case, tag: 'Step-Up Lever' },
                  { s: calculation.shortest_modeled_path, tag: 'Fastest' },
                ].map(({ s, tag }, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{s?.scenario_label || s?.scenario_name || s?.name || tag}</span>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: tag === 'Fastest' ? 'rgba(16, 185, 129, 0.15)' : 'var(--canvas-surface)', color: tag === 'Fastest' ? '#10b981' : 'var(--ink-muted)' }}>
                          {tag}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', fontWeight: 700, color: tag === 'Fastest' ? '#10b981' : 'var(--ink-primary)' }}>
                      {s?.target_date || 'Exceeds 60 Yrs'}
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--ink-muted)' }}>
                      {s?.months_to_target ? `${s.months_to_target} mos (${(s.months_to_target / 12).toFixed(1)} yrs)` : 'N/A'}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      ₹{(s?.monthly_contribution || 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {s?.annual_step_up_pct ?? s?.annual_stepup_pct ?? 0}% / yr
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {s?.assumed_return_pct ?? 12}% p.a.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Milestones */}
      {activeTab === 'milestones' && (
        <div style={{ background: 'var(--canvas-elevated)', border: '1px solid var(--border-hairline)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>Milestone Progression Map</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {milestones.map((m, idx) => {
              const corpus = m.target_amount ?? m.milestone_corpus ?? 0;
              const isReached = m.status === 'ACHIEVED' || Boolean(m.is_already_reached);
              const targetDate = m.estimated_date ?? m.reached_at_date;
              const months = m.estimated_months ?? m.reached_at_month;

              return (
                <div
                  key={idx}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: isReached ? 'rgba(16, 185, 129, 0.06)' : 'var(--canvas-surface)',
                    border: isReached ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-hairline)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-muted)' }}>
                      {m.milestone_label}
                    </span>
                    {isReached && (
                      <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
                        ACHIEVED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink-primary)', marginBottom: '4px' }}>
                    {m.formatted_target || `₹${corpus.toLocaleString('en-IN')}`}
                  </div>
                  <div style={{ fontSize: '12px', color: isReached ? '#10b981' : 'var(--ink-muted)' }}>
                    {isReached
                      ? 'Capital baseline reached'
                      : targetDate
                        ? `Projected: ${targetDate} (Month ${months ?? 'N/A'})`
                        : m.status === 'UNREACHABLE'
                          ? 'Out of reach in 60 yrs'
                          : 'Simulating...'}
                  </div>
                  {m.required_monthly_contribution !== undefined && m.required_monthly_contribution > 0 && !isReached && (
                    <div style={{ fontSize: '11px', color: 'var(--ink-tertiary)', marginTop: '6px' }}>
                      Required SIP: ₹{Math.round(m.required_monthly_contribution).toLocaleString('en-IN')}/mo
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Sensitivity Matrix */}
      {activeTab === 'sensitivity' && (
        <div style={{ background: 'var(--canvas-elevated)', border: '1px solid var(--border-hairline)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-hairline)' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>12-Cell Return & Contribution Sensitivity Matrix</h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--ink-muted)' }}>
              Inspect how altering monthly investing amount and step-up rates impact your ₹1 Crore target arrival date.
            </p>
          </div>
          <div style={{ overflowX: 'auto', padding: '16px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {sensitivity.map((cell, idx) => {
                const monthlyInv = cell.contribution_amount ?? cell.monthly_investment ?? 0;
                const multiplierPct = cell.contribution_multiplier !== undefined ? Math.round(cell.contribution_multiplier * 100) : null;
                const stepUpOrReturn = cell.income_growth_pct !== undefined
                  ? `${cell.income_growth_pct}% Step-up`
                  : cell.annual_return_pct !== undefined
                    ? `${cell.annual_return_pct}% p.a.`
                    : '';

                return (
                  <div
                    key={idx}
                    style={{
                      padding: '14px',
                      borderRadius: '8px',
                      background: 'var(--canvas-surface)',
                      border: '1px solid var(--border-hairline)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ fontSize: '11px', color: 'var(--ink-muted)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                      <span>SIP: ₹{monthlyInv.toLocaleString('en-IN')}{multiplierPct ? ` (${multiplierPct}%)` : ''}</span>
                      {stepUpOrReturn && <span style={{ fontWeight: 600 }}>{stepUpOrReturn}</span>}
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink-primary)', marginTop: '4px' }}>
                      {cell.target_date || 'Exceeds 60 Yrs'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--ink-muted)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{cell.months_to_target ? `${cell.months_to_target} mos (${(cell.months_to_target / 12).toFixed(1)} yrs)` : 'N/A'}</span>
                      {(cell.time_saved_months ?? 0) > 0 && (
                        <span style={{ color: '#10b981', fontWeight: 600 }}>
                          -{(((cell.time_saved_months ?? 0)) / 12).toFixed(1)} yrs
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Interactive What-If Sandbox */}
      {activeTab === 'simulator' && (
        <div style={{ background: 'var(--canvas-elevated)', border: '1px solid var(--border-hairline)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>Interactive Compounding Sandbox</h3>
          <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--ink-muted)' }}>
            Test custom levers. Strictly bounded by educational compounding bounds (return ≤ 15% p.a.).
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-muted)', marginBottom: '8px' }}>
                STARTING CAPITAL: ₹{simCapital.toLocaleString('en-IN')}
              </label>
              <input
                type="range"
                min="0"
                max="5000000"
                step="50000"
                value={simCapital}
                onChange={(e) => setSimCapital(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-muted)', marginBottom: '8px' }}>
                MONTHLY CONTRIBUTION: ₹{simContribution.toLocaleString('en-IN')}
              </label>
              <input
                type="range"
                min="5000"
                max="200000"
                step="2500"
                value={simContribution}
                onChange={(e) => setSimContribution(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-muted)', marginBottom: '8px' }}>
                ANNUAL RETURN: {simReturn}% p.a. (Max 15%)
              </label>
              <input
                type="range"
                min="6"
                max="15"
                step="0.5"
                value={simReturn}
                onChange={(e) => setSimReturn(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ink-muted)', marginBottom: '8px' }}>
                ANNUAL STEP-UP SIP: {simStepUp}% / yr
              </label>
              <input
                type="range"
                min="0"
                max="25"
                step="2.5"
                value={simStepUp}
                onChange={(e) => setSimStepUp(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <button
            onClick={handleSimulate}
            disabled={simulating}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              background: '#10b981',
              border: 'none',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {simulating ? 'Calculating Projections...' : 'Simulate Custom Scenario'}
          </button>
        </div>
      )}

      {/* Mandatory SEBI / Regulatory Disclaimer */}
      <div style={{
        padding: '16px 20px',
        background: 'var(--canvas-surface)',
        border: '1px solid var(--border-hairline)',
        borderRadius: '8px',
        fontSize: '12px',
        color: 'var(--ink-muted)',
        lineHeight: 1.6,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong>REGULATORY DISCLAIMER:</strong> This tool is a deterministic educational calculation engine designed to model compounding growth based on specified mathematical assumptions. It does not constitute investment advice, financial planning advisory services under SEBI regulations, or a recommendation to buy or sell securities. Returns are not guaranteed, and market investments remain subject to equity volatility and principal risk.
        </div>
      </div>
    </div>
  );
}
