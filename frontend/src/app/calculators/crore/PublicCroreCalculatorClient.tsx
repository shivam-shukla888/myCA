'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Shield,
  ArrowRight,
  Calculator,
  Sliders,
  Sparkles,
  Info,
  Calendar,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export default function PublicCroreCalculatorClient() {
  const [currentCapital, setCurrentCapital] = useState<number>(300000);
  const [monthlyContribution, setMonthlyContribution] = useState<number>(35000);
  const [expectedReturnRate, setExpectedReturnRate] = useState<number>(12); // in %
  const [annualStepUpRate, setAnnualStepUpRate] = useState<number>(10); // in %

  const TARGET_CORPUS = 10000000; // ₹1,00,00,000

  // Deterministic simulation month-by-month
  const simulation = useMemo(() => {
    const monthlyRate = expectedReturnRate / 100 / 12;
    const stepUpFraction = annualStepUpRate / 100;

    let balance = currentCapital;
    let totalInvested = currentCapital;
    let months = 0;
    let currentMonthly = monthlyContribution;

    const yearlyCheckpoints: {
      year: number;
      invested: number;
      balance: number;
      returns: number;
    }[] = [];

    // Safety guard max 50 years = 600 months
    while (balance < TARGET_CORPUS && months < 600) {
      // Step up monthly contribution at the start of each year (after year 1)
      if (months > 0 && months % 12 === 0 && stepUpFraction > 0) {
        currentMonthly = Math.round(currentMonthly * (1 + stepUpFraction));
      }

      // SIP contribution
      balance += currentMonthly;
      totalInvested += currentMonthly;

      // Compound for the month
      balance += balance * monthlyRate;
      months++;

      if (months % 12 === 0 || balance >= TARGET_CORPUS) {
        yearlyCheckpoints.push({
          year: Math.ceil(months / 12),
          invested: Math.round(totalInvested),
          balance: Math.min(TARGET_CORPUS, Math.round(balance)),
          returns: Math.max(0, Math.round(balance - totalInvested)),
        });
      }
    }

    const years = (months / 12).toFixed(1);

    // Lever 1: Flat SIP (no step-up)
    let flatBalance = currentCapital;
    let flatMonths = 0;
    while (flatBalance < TARGET_CORPUS && flatMonths < 600) {
      flatBalance += monthlyContribution;
      flatBalance += flatBalance * monthlyRate;
      flatMonths++;
    }

    // Lever 2: Extra ₹5,000/mo flat
    let boostBalance = currentCapital;
    let boostMonths = 0;
    while (boostBalance < TARGET_CORPUS && boostMonths < 600) {
      boostBalance += monthlyContribution + 5000;
      boostBalance += boostBalance * monthlyRate;
      boostMonths++;
    }

    return {
      monthsToTarget: months,
      yearsToTarget: years,
      totalInvested: Math.round(totalInvested),
      totalGains: Math.max(0, Math.round(balance - totalInvested)),
      yearlyCheckpoints,
      monthsSavedWithStepUp: Math.max(0, flatMonths - months),
      monthsSavedWithExtra5k: Math.max(0, flatMonths - boostMonths),
    };
  }, [currentCapital, monthlyContribution, expectedReturnRate, annualStepUpRate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', maxWidth: '960px', margin: '0 auto', padding: '16px 0 64px' }}>
      {/* Header Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ fontSize: '12px', color: 'var(--ink-secondary)', display: 'flex', gap: '8px' }}>
        <Link href="/" style={{ color: 'var(--ink-secondary)', textDecoration: 'none' }}>Home</Link>
        <span>/</span>
        <span style={{ color: 'var(--ink-primary)', fontWeight: 600 }}>₹1 Crore Calculator</span>
      </nav>

      {/* Hero Intro */}
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span className="badge-signal badge-forest" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Verified Deterministic Model
          </span>
          <span className="badge-signal" style={{ fontSize: '11px' }}>
            No Sign-up Required
          </span>
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink-primary)', margin: '0 0 12px' }}>
          ₹1 Crore Wealth & SIP Acceleration Calculator
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--ink-secondary)', lineHeight: 1.6, margin: 0, maxWidth: '760px' }}>
          Model the exact mathematical horizon to accumulate a ₹1,00,00,000 corpus. Learn how annual contribution step-ups and disciplined monthly surplus compress your timeline by years.
        </p>
      </div>

      {/* Main Interactive Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Controls Card */}
        <section
          style={{
            background: 'var(--canvas-surface)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-card)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
          aria-labelledby="controls-heading"
        >
          <h2 id="controls-heading" style={{ fontSize: '16px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={18} style={{ color: 'var(--signal-forest)' }} />
            Investment Levers
          </h2>

          {/* Current Capital */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
              <label htmlFor="capital-input" style={{ color: 'var(--ink-secondary)' }}>Current Liquid Capital</label>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>₹{currentCapital.toLocaleString('en-IN')}</span>
            </div>
            <input
              id="capital-input"
              type="range"
              min={0}
              max={5000000}
              step={25000}
              value={currentCapital}
              onChange={(e) => setCurrentCapital(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--signal-forest)', cursor: 'pointer' }}
            />
          </div>

          {/* Monthly Contribution */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
              <label htmlFor="sip-input" style={{ color: 'var(--ink-secondary)' }}>Monthly Investment (Surplus / SIP)</label>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>₹{monthlyContribution.toLocaleString('en-IN')}</span>
            </div>
            <input
              id="sip-input"
              type="range"
              min={5000}
              max={250000}
              step={5000}
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--signal-forest)', cursor: 'pointer' }}
            />
          </div>

          {/* Expected CAGR */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
              <label htmlFor="rate-input" style={{ color: 'var(--ink-secondary)' }}>Expected Annual Return (CAGR)</label>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{expectedReturnRate}% p.a.</span>
            </div>
            <input
              id="rate-input"
              type="range"
              min={6}
              max={16}
              step={0.5}
              value={expectedReturnRate}
              onChange={(e) => setExpectedReturnRate(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--signal-forest)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--ink-tertiary)', display: 'block', marginTop: '4px' }}>
              Historical Indian diversified equity index (Nifty 50 TRI) ~12% nominal CAGR over 15+ years.
            </span>
          </div>

          {/* Annual Step-Up */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
              <label htmlFor="stepup-input" style={{ color: 'var(--ink-secondary)' }}>Annual SIP Step-Up</label>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{annualStepUpRate}% / year</span>
            </div>
            <input
              id="stepup-input"
              type="range"
              min={0}
              max={20}
              step={2}
              value={annualStepUpRate}
              onChange={(e) => setAnnualStepUpRate(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--signal-forest)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '11px', color: 'var(--ink-tertiary)', display: 'block', marginTop: '4px' }}>
              Increasing your SIP with annual salary increments creates exponential timeline reduction.
            </span>
          </div>
        </section>

        {/* Results Card */}
        <section
          style={{
            background: 'var(--canvas-surface)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-card)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '24px',
          }}
          aria-labelledby="results-heading"
        >
          <div>
            <span style={{ fontSize: '11px', color: 'var(--ink-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Estimated Horizon
            </span>
            <h2 id="results-heading" style={{ fontSize: '38px', fontWeight: 800, color: 'var(--signal-forest)', margin: '6px 0 4px', letterSpacing: '-0.02em' }}>
              {simulation.yearsToTarget} Years
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', margin: 0 }}>
              (~{simulation.monthsToTarget} months) to reach <strong style={{ color: 'var(--ink-primary)' }}>₹1,00,00,000</strong>
            </p>
          </div>

          {/* Summary Split */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid var(--border-hairline)', paddingTop: '16px' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--ink-tertiary)', textTransform: 'uppercase' }}>Principal Outflow</span>
              <p style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>
                ₹{simulation.totalInvested.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--ink-tertiary)', textTransform: 'uppercase' }}>Compounded Wealth Gain</span>
              <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--signal-forest)', margin: '4px 0 0', fontFamily: 'var(--font-mono)' }}>
                ₹{simulation.totalGains.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Acceleration Impact */}
          {annualStepUpRate > 0 && simulation.monthsSavedWithStepUp > 0 && (
            <div
              style={{
                background: 'rgba(56, 161, 105, 0.08)',
                border: '1px solid rgba(56, 161, 105, 0.25)',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '12px',
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
              }}
            >
              <Sparkles size={16} style={{ color: 'var(--signal-forest)', flexShrink: 0 }} />
              <div>
                <strong>Step-Up Acceleration:</strong> Your {annualStepUpRate}% annual step-up cuts approximately{' '}
                <strong style={{ color: 'var(--signal-forest)' }}>{Math.round(simulation.monthsSavedWithStepUp / 12)} years</strong>{' '}
                off your target compared to a flat SIP.
              </div>
            </div>
          )}

          {/* Call to Action to Personal CA */}
          <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: '16px' }}>
            <Link
              href="/"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              Calculate Your Real Surplus in MyCA
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      </div>

      {/* Educational & Mathematical Transparency Section */}
      <section
        style={{
          background: 'var(--canvas-surface)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 'var(--radius-card)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={16} style={{ color: 'var(--ink-secondary)' }} />
          The Mathematical Mechanics of ₹1 Crore
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', lineHeight: 1.6, margin: 0 }}>
          In Indian personal finance, ₹1 Crore is a milestone where compounding begins to outpace monthly contributions. For a monthly investment of ₹35,000 at 12% CAGR, reaching ₹1 Crore takes approximately 10.5 years. However, compounding accelerates dramatically thereafter: the second crore typically takes less than 4 additional years under the same run-rate.
        </p>

        <div style={{ background: 'var(--canvas-inset)', padding: '16px', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-primary)' }}>
          <div>Formula (Monthly Compounding with Annuity Due):</div>
          <div style={{ margin: '6px 0', color: 'var(--signal-forest)' }}>
            FV = P × [((1 + r)ⁿ - 1) / r] × (1 + r)
          </div>
          <div style={{ color: 'var(--ink-tertiary)', fontSize: '11px' }}>
            Where P = Monthly Contribution, r = Monthly Rate (Annual Rate ÷ 12), n = Total Months.
          </div>
        </div>
      </section>

      {/* SEBI Compliance & Fiduciary Disclaimer */}
      <aside
        style={{
          background: 'rgba(237, 137, 54, 0.05)',
          border: '1px solid rgba(237, 137, 54, 0.25)',
          borderRadius: '8px',
          padding: '16px 20px',
          fontSize: '12px',
          color: 'var(--ink-secondary)',
          lineHeight: 1.5,
        }}
        aria-label="Regulatory Disclaimer"
      >
        <strong style={{ color: 'var(--ink-primary)', display: 'block', marginBottom: '4px' }}>
          Regulatory & Educational Disclosure
        </strong>
        This calculator is designed strictly for educational modeling and scenario simulations. Calculations assume constant annual compounding rates and do not account for market fluctuations, taxes, or expense ratios. Returns are not guaranteed. MyCA does not provide individualized investment advice, buy/sell recommendations, or broker financial securities. Mutual fund investments are subject to market risks.
      </aside>
    </div>
  );
}
