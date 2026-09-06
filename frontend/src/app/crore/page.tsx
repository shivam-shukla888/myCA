'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { AuthRequiredState } from '../../components/auth/AuthRequiredState';
import { croreApi, CroreCalculation, CroreSimulationInput } from '../../lib/api';
import {
  TrendingUp,
  Target,
  Zap,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Clock,
  Coins,
  ChevronRight,
  Info,
  Calendar,
} from 'lucide-react';

export default function CrorePage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [calculation, setCalculation] = useState<CroreCalculation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interactive What-If State
  const [simCapital, setSimCapital] = useState<number>(500000);
  const [simContribution, setSimContribution] = useState<number>(25000);
  const [simReturn, setSimReturn] = useState<number>(12);
  const [simStepUp, setSimStepUp] = useState<number>(10);
  const [simulating, setSimulating] = useState(false);

  // Active Tab for Deep Dive Drawer
  const [activeTab, setActiveTab] = useState<'scenarios' | 'milestones' | 'sensitivity' | 'simulator'>('scenarios');

  async function loadStatus() {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await croreApi.getStatus();
      if (res && res.calculation) {
        setCalculation(res.calculation);
        setSimCapital(res.calculation.starting_capital || 0);
        setSimContribution(res.calculation.current_monthly_contribution || 25000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load ₹1 Crore projection engine.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    loadStatus();
  }, [authLoading, isAuthenticated]);

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
        setCalculation(res);
      }
    } catch (err: unknown) {
      console.error('Simulation failed:', err);
    } finally {
      setSimulating(false);
    }
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
        title="₹1 Crore Shortest Path Engine"
        description="Authenticate your session to run deterministic compounding simulations against your verified capital baseline."
      />
    );
  }

  const baseCase = calculation?.base_case;
  const shortestPath = calculation?.shortest_modeled_path;
  const milestones = calculation?.milestones || [];
  const sensitivity = calculation?.sensitivity_matrix || [];
  const lever = calculation?.lever_analysis;

  const timeSavedMonths = (baseCase?.months_to_target && shortestPath?.months_to_target)
    ? Math.max(0, baseCase.months_to_target - shortestPath.months_to_target)
    : 0;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase'
            }}>
              Deterministic Mathematical Engine
            </span>
            <span style={{ fontSize: '12px', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
              Model v2.0 • Max Return Bound ≤ 15% p.a.
            </span>
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink-primary)', margin: 0 }}>
            ₹1 Crore Shortest Path
          </h1>
          <p style={{ color: 'var(--ink-muted)', fontSize: '14px', marginTop: '6px', maxWidth: '640px' }}>
            Month-by-month compounding simulation grounded strictly in your verified ledger surplus and capital baseline.
          </p>
        </div>

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

      {/* Hero Projection Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Base Case Target Card */}
        <div style={{
          background: 'var(--canvas-elevated)',
          border: '1px solid var(--border-hairline)',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                Base Case (Status Quo)
              </span>
              <Clock size={16} color="var(--ink-muted)" />
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--ink-primary)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
              {baseCase?.target_date || 'N/A'}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--ink-muted)' }}>
              {baseCase?.months_to_target ? `${baseCase.months_to_target} months (${(baseCase.months_to_target / 12).toFixed(1)} years)` : 'Out of scope'}
            </div>
          </div>

          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-hairline)', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--ink-muted)' }}>
            <span>SIP: ₹{(baseCase?.monthly_contribution || 0).toLocaleString('en-IN')}/mo</span>
            <span>Return: {baseCase?.assumed_return_pct ?? 12}% p.a.</span>
            <span>Step-up: {baseCase?.annual_step_up_pct ?? 0}%</span>
          </div>
        </div>

        {/* Shortest Modeled Path Card (Highlighted) */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={15} color="#10b981" />
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                  Fastest Modeled Path
                </span>
              </div>
              {timeSavedMonths > 0 && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '999px' }}>
                  {(timeSavedMonths / 12).toFixed(1)} YRS FASTER
                </span>
              )}
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--ink-primary)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
              {shortestPath?.target_date || 'N/A'}
            </div>
            <div style={{ fontSize: '14px', color: '#10b981', fontWeight: 500 }}>
              {shortestPath?.months_to_target ? `${shortestPath.months_to_target} months (${(shortestPath.months_to_target / 12).toFixed(1)} years)` : 'Simulated'}
            </div>
          </div>

          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--ink-muted)' }}>
            <span>SIP: ₹{(shortestPath?.monthly_contribution || 0).toLocaleString('en-IN')}/mo</span>
            <span>Return: {shortestPath?.assumed_return_pct ?? 12}% p.a.</span>
            <span>Step-up: {shortestPath?.annual_step_up_pct ?? 10}%</span>
          </div>
        </div>

        {/* ONE Next Action Card */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Sparkles size={16} color="#f59e0b" />
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
                ONE Next Action
              </span>
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink-primary)', marginBottom: '8px', lineHeight: 1.4 }}>
              {calculation?.one_next_action || 'Maintain regular monthly contributions into your diversified core index portfolio.'}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--ink-muted)', lineHeight: 1.5, margin: 0 }}>
              {lever?.description || 'Your primary controllable lever is increasing monthly surplus and implementing annual step-up SIPs.'}
            </p>
          </div>

          <div style={{ marginTop: '20px' }}>
            <Link
              href="/plan"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--ink-primary)',
                textDecoration: 'none'
              }}
            >
              Configure Allocation Plan <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation Tabs for Deep Dive */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-hairline)', paddingBottom: '8px' }}>
        {[
          { id: 'scenarios', label: '5 Scenarios Comparison' },
          { id: 'milestones', label: 'Milestones (₹1L → ₹1Cr)' },
          { id: 'sensitivity', label: 'Sensitivity Matrix' },
          { id: 'simulator', label: 'Interactive Simulator' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              background: activeTab === tab.id ? 'var(--canvas-elevated)' : 'transparent',
              border: activeTab === tab.id ? '1px solid var(--border-hairline)' : '1px solid transparent',
              color: activeTab === tab.id ? 'var(--ink-primary)' : 'var(--ink-muted)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
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
                  { s: calculation.base_case, tag: 'Status Quo' },
                  { s: calculation.improved_case, tag: 'Surplus Lever' },
                  { s: calculation.accelerated_case, tag: 'Step-Up Lever' },
                  { s: calculation.shortest_modeled_path, tag: 'Fastest' },
                ].map(({ s, tag }, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{s.name}</span>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: tag === 'Fastest' ? 'rgba(16, 185, 129, 0.15)' : 'var(--canvas-surface)', color: tag === 'Fastest' ? '#10b981' : 'var(--ink-muted)' }}>
                          {tag}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', fontWeight: 700, color: tag === 'Fastest' ? '#10b981' : 'var(--ink-primary)' }}>
                      {s.target_date || 'Exceeds 60 Yrs'}
                    </td>
                    <td style={{ padding: '14px 20px', color: 'var(--ink-muted)' }}>
                      {s.months_to_target ? `${s.months_to_target} mos (${(s.months_to_target / 12).toFixed(1)} yrs)` : 'N/A'}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      ₹{(s.monthly_contribution || 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {s.annual_step_up_pct}% / yr
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {s.assumed_return_pct}% p.a.
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
            {milestones.map((m, idx) => (
              <div
                key={idx}
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  background: m.is_already_reached ? 'rgba(16, 185, 129, 0.06)' : 'var(--canvas-surface)',
                  border: m.is_already_reached ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-hairline)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-muted)' }}>
                    {m.milestone_label}
                  </span>
                  {m.is_already_reached && (
                    <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
                      ACHIEVED
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink-primary)', marginBottom: '4px' }}>
                  ₹{(m.milestone_corpus).toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '12px', color: m.is_already_reached ? '#10b981' : 'var(--ink-muted)' }}>
                  {m.is_already_reached ? 'Capital baseline reached' : m.reached_at_date ? `Projected: ${m.reached_at_date} (Month ${m.reached_at_month})` : 'Simulating...'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Sensitivity Matrix */}
      {activeTab === 'sensitivity' && (
        <div style={{ background: 'var(--canvas-elevated)', border: '1px solid var(--border-hairline)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-hairline)' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>12-Cell Return & Contribution Sensitivity Matrix</h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--ink-muted)' }}>
              Inspect how altering monthly investing amount and compounding rates impact your ₹1 Crore target year.
            </p>
          </div>
          <div style={{ overflowX: 'auto', padding: '16px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {sensitivity.map((cell, idx) => (
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
                  <div style={{ fontSize: '11px', color: 'var(--ink-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>SIP: ₹{cell.monthly_investment.toLocaleString('en-IN')}</span>
                    <span style={{ fontWeight: 600 }}>{cell.annual_return_pct}% p.a.</span>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink-primary)', marginTop: '4px' }}>
                    {cell.target_date || 'Exceeds 60 Yrs'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ink-muted)' }}>
                    {cell.months_to_target ? `${cell.months_to_target} months` : 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Interactive What-If Simulator */}
      {activeTab === 'simulator' && (
        <div style={{ background: 'var(--canvas-elevated)', border: '1px solid var(--border-hairline)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>Interactive Compounding Sandbox</h3>
          <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--ink-muted)' }}>
            Test custom levers. Strictly bounded by educational compounding rules (return ≤ 15% p.a.).
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
