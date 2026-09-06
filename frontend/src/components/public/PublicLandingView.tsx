'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Shield,
  Compass,
  ArrowRight,
  Calculator,
  BookOpen,
  CheckCircle2,
  Lock,
  Percent,
  Layers,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

export function PublicLandingView() {
  // Client-side interactive demo states (no private data, pure educational math)
  const [demoIncome, setDemoIncome] = useState<number>(85000);
  const [demoExpenses, setDemoExpenses] = useState<number>(50000);

  const demoSurplus = Math.max(0, demoIncome - demoExpenses);
  const demoSavingsRate = demoIncome > 0 ? Math.round((demoSurplus / demoIncome) * 100) : 0;
  const demoEmergencyTarget = demoExpenses * 6;

  // Simple SIP formula: FV = P * [((1+r)^n - 1) / r] * (1+r)
  // Monthly rate for 12% p.a.
  const r = 0.12 / 12;
  const targetCorpus = 10000000;
  let monthsToCrore = 0;
  if (demoSurplus > 0) {
    // Solve for n: FV = P * ((1+r)^n - 1) / r * (1+r)
    // (1+r)^n = 1 + (FV * r) / (P * (1+r))
    const numerator = targetCorpus * r;
    const denominator = demoSurplus * (1 + r);
    const n = Math.log(1 + numerator / denominator) / Math.log(1 + r);
    monthsToCrore = Math.round(n);
  }
  const yearsToCrore = monthsToCrore > 0 ? (monthsToCrore / 12).toFixed(1) : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '48px', maxWidth: '100%', overflowX: 'hidden' }}>
      {/* 1. HERO SECTION */}
      <section
        style={{
          padding: '40px 0 24px',
          borderBottom: '1px solid var(--border-hairline)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
        aria-labelledby="hero-heading"
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="badge-signal badge-forest"
            style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}
          >
            <Shield size={12} /> Fiduciary Financial Intelligence for India
          </span>
        </div>

        <h1
          id="hero-heading"
          style={{
            fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            color: 'var(--ink-primary)',
            margin: 0,
            maxWidth: '820px',
          }}
        >
          Real Financial Clarity. Calculated Surplus. Your Shortest Path to ₹1 Crore.
        </h1>

        <p
          style={{
            fontSize: '16px',
            lineHeight: 1.6,
            color: 'var(--ink-secondary)',
            margin: 0,
            maxWidth: '680px',
          }}
        >
          A private, mathematically grounded personal financial desk engineered for Indian households.
          Discover your true monthly surplus from verified records, protect your family with an emergency
          cushion, and model wealth compounding without advertisements, spam, or commission-driven advice.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', paddingTop: '8px' }}>
          <Link
            href="/login"
            className="btn-action btn-forest"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: '6px',
            }}
          >
            <span>Set Up Your Financial Baseline</span>
            <ArrowRight size={15} />
          </Link>

          <Link
            href="/calculators/crore"
            className="btn-action"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: '6px',
              border: '1px solid var(--border-hairline)',
              background: 'var(--canvas-inset)',
              color: 'var(--ink-primary)',
            }}
          >
            <Calculator size={15} />
            <span>Try Public ₹1 Crore Calculator</span>
          </Link>

          <Link
            href="/calculators/emergency-fund"
            className="btn-action"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: '6px',
              border: '1px solid var(--border-hairline)',
              background: 'var(--canvas-inset)',
              color: 'var(--ink-primary)',
            }}
          >
            <Shield size={15} />
            <span>Emergency Buffer Calculator</span>
          </Link>
        </div>
      </section>

      {/* 2. INTERACTIVE DEMO TEASER (PURE CLIENT MATH, ZERO AUTH REQUIRED) */}
      <section
        style={{
          background: 'var(--canvas-surface)',
          border: '1px solid var(--border-hairline)',
          borderRadius: '8px',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
        aria-labelledby="interactive-math-heading"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div className="meta-tag" style={{ marginBottom: '6px' }}>
              DETERMINISTIC CASHFLOW DEMO • MATHEMATICAL TRANSPARENCY
            </div>
            <h2 id="interactive-math-heading" style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>
              How True Surplus Drives Wealth Mobility
            </h2>
          </div>
          <span className="badge-signal badge-amber" style={{ fontSize: '10px' }}>
            Interactive Demo — No Data Stored
          </span>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', margin: 0 }}>
          Adjust the sliders below to see how mathematical surplus defines your emergency cushion and projected ₹1 Crore timeline:
        </p>

        {/* Sliders */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <label htmlFor="income-range" style={{ color: 'var(--ink-secondary)' }}>Monthly Net Income</label>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>₹{demoIncome.toLocaleString('en-IN')}</strong>
            </div>
            <input
              id="income-range"
              type="range"
              min="30000"
              max="300000"
              step="5000"
              value={demoIncome}
              onChange={(e) => setDemoIncome(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--signal-forest)' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <label htmlFor="expense-range" style={{ color: 'var(--ink-secondary)' }}>Total Monthly Expenses</label>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>₹{demoExpenses.toLocaleString('en-IN')}</strong>
            </div>
            <input
              id="expense-range"
              type="range"
              min="20000"
              max="250000"
              step="5000"
              value={demoExpenses}
              onChange={(e) => setDemoExpenses(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--signal-amber)' }}
            />
          </div>
        </div>

        {/* Real-time calculated outcomes */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px',
            marginTop: '8px',
          }}
        >
          <div style={{ background: 'var(--canvas-inset)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border-hairline)' }}>
            <div style={{ fontSize: '11px', color: 'var(--ink-tertiary)', textTransform: 'uppercase' }}>Monthly Surplus</div>
            <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: demoSurplus > 0 ? 'var(--signal-forest)' : 'var(--signal-crimson)', marginTop: '4px' }}>
              ₹{demoSurplus.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
              Savings Rate: {demoSavingsRate}%
            </div>
          </div>

          <div style={{ background: 'var(--canvas-inset)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border-hairline)' }}>
            <div style={{ fontSize: '11px', color: 'var(--ink-tertiary)', textTransform: 'uppercase' }}>6-Mo Emergency Fund</div>
            <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--ink-primary)', marginTop: '4px' }}>
              ₹{demoEmergencyTarget.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
              Essential Liquid Buffer
            </div>
          </div>

          <div style={{ background: 'var(--canvas-inset)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border-hairline)' }}>
            <div style={{ fontSize: '11px', color: 'var(--ink-tertiary)', textTransform: 'uppercase' }}>₹1 Crore Timeline</div>
            <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--signal-forest)', marginTop: '4px' }}>
              {yearsToCrore} years
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
              @ 12% p.a. Compounding
            </div>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--ink-tertiary)', fontStyle: 'italic', borderTop: '1px solid var(--border-hairline)', paddingTop: '10px' }}>
          *Formula: SIP Future Value FV = P × [((1 + r)ⁿ - 1) / r] × (1 + r). Compounding projections are educational estimates based on assumed return rates, not guaranteed returns.
        </div>
      </section>

      {/* 3. SIX CORE USER OUTCOMES HIERARCHY */}
      <section aria-labelledby="outcomes-heading">
        <div style={{ marginBottom: '24px' }}>
          <div className="meta-tag" style={{ marginBottom: '6px' }}>PHILOSOPHICAL & ARCHITECTURAL FOUNDATION</div>
          <h2 id="outcomes-heading" style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
            Positioned Strictly Around Real Financial Outcomes
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--ink-secondary)', marginTop: '6px', maxWidth: '700px' }}>
            Personal finance software often confuses activity with progress. MyCA focuses entirely on the 6 foundational pillars that transform household wealth:
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Outcome 1 */}
          <article
            style={{
              background: 'var(--canvas-surface)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '8px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ padding: '8px', borderRadius: '6px', background: 'var(--canvas-inset)', color: 'var(--signal-forest)' }}>
                <Compass size={18} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>1. Personal Finance Clarity</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', lineHeight: 1.6, margin: 0 }}>
              End spreadsheet fatigue and fragmented bank apps. MyCA reconciles your temporal ledger, clearly labeling
              every number by its source — whether from verified bank statements or stated baseline profiles.
            </p>
          </article>

          {/* Outcome 2 */}
          <article
            style={{
              background: 'var(--canvas-surface)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '8px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ padding: '8px', borderRadius: '6px', background: 'var(--canvas-inset)', color: 'var(--signal-forest)' }}>
                <Percent size={18} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>2. Authoritative Monthly Surplus</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', lineHeight: 1.6, margin: 0 }}>
              Your surplus is the root of all financial capability. We calculate your actual savings rate deterministically:
              Income minus true living expenses and debt payments. Never estimated, never hallucinated.
            </p>
          </article>

          {/* Outcome 3 */}
          <article
            style={{
              background: 'var(--canvas-surface)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '8px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ padding: '8px', borderRadius: '6px', background: 'var(--canvas-inset)', color: 'var(--signal-amber)' }}>
                <Shield size={18} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>3. Emergency Cushion First</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', lineHeight: 1.6, margin: 0 }}>
              Before deploying capital into market risk, your household requires 3 to 6 months of essential survival
              buffer. Having liquid savings prevents predatory borrowing and premature equity liquidation.
            </p>
          </article>

          {/* Outcome 4 */}
          <article
            style={{
              background: 'var(--canvas-surface)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '8px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ padding: '8px', borderRadius: '6px', background: 'var(--canvas-inset)', color: 'var(--signal-forest)' }}>
                <TrendingUp size={18} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>4. ₹1 Crore Milestone Planning</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', lineHeight: 1.6, margin: 0 }}>
              The first ₹1 Crore is the hardest mathematical hurdle in wealth creation. Our deterministic engine models
              your baseline target date and tests controllable levers: surplus increases, spending cuts, and step-ups.
            </p>
          </article>

          {/* Outcome 5 */}
          <article
            style={{
              background: 'var(--canvas-surface)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '8px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ padding: '8px', borderRadius: '6px', background: 'var(--canvas-inset)', color: 'var(--signal-forest)' }}>
                <Layers size={18} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>5. Financial Freedom Architecture</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', lineHeight: 1.6, margin: 0 }}>
              Freedom is not an arbitrary net-worth number. It is the ratio of sustainable passive cash flows to living expenses.
              We model your target retirement age, inflation runway, and required systematic investment rate.
            </p>
          </article>

          {/* Outcome 6 */}
          <article
            style={{
              background: 'var(--canvas-surface)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '8px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ padding: '8px', borderRadius: '6px', background: 'var(--canvas-inset)', color: 'var(--signal-forest)' }}>
                <BookOpen size={18} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>6. Indian Statutory & Tax Education</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', lineHeight: 1.6, margin: 0 }}>
              Grounded in official Indian tax statutes (Section 115BAC New Regime, Finance (No. 2) Act 2024, standard deduction
              ₹75,000, Section 87A rebate) and regulatory boundaries. Never fabricated, always cited.
            </p>
          </article>
        </div>
      </section>

      {/* 4. FIDUCIARY STANDARDS & PRIVACY GUARANTEE */}
      <section
        style={{
          background: 'var(--canvas-surface)',
          border: '1px solid var(--border-hairline)',
          borderRadius: '8px',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
        aria-labelledby="fiduciary-heading"
      >
        <div>
          <div className="meta-tag" style={{ marginBottom: '6px' }}>ZERO CONFLICT OF INTEREST</div>
          <h2 id="fiduciary-heading" style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>
            Our Fiduciary Commitment to Indian Households
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <CheckCircle2 size={20} style={{ color: 'var(--signal-forest)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>Zero Commission or Product Selling</strong>
              <p style={{ fontSize: '12px', color: 'var(--ink-secondary)', margin: 0, lineHeight: 1.5 }}>
                We do not sell mutual funds, life insurance, or consumer loans. No distributor kickbacks, affiliate links, or sponsored placements.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <CheckCircle2 size={20} style={{ color: 'var(--signal-forest)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>Zero Stock Tips or Speculation</strong>
              <p style={{ fontSize: '12px', color: 'var(--ink-secondary)', margin: 0, lineHeight: 1.5 }}>
                We do not offer day trading tips, intraday signals, or speculative calls. Real wealth is created through disciplined surplus allocation.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <CheckCircle2 size={20} style={{ color: 'var(--signal-forest)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>Private Financial Data Behind Auth</strong>
              <p style={{ fontSize: '12px', color: 'var(--ink-secondary)', margin: 0, lineHeight: 1.5 }}>
                Your private bank records, transactions, and profile inputs are strictly confidential and protected behind row-level security.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. VERIFIED PUBLIC TOOLS DIRECTORY */}
      <section aria-labelledby="tools-heading">
        <div style={{ marginBottom: '20px' }}>
          <div className="meta-tag" style={{ marginBottom: '6px' }}>VERIFIED PUBLIC CALCULATION SURFACES</div>
          <h2 id="tools-heading" style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>
            Authoritative Tools & Educational Guides
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', marginTop: '4px' }}>
            Explore verified calculators and statutory educational guides freely without creating an account:
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <Link
            href="/calculators/crore"
            style={{
              background: 'var(--canvas-surface)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '8px',
              padding: '20px',
              textDecoration: 'none',
              color: 'inherit',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge-signal badge-forest" style={{ fontSize: '10px' }}>Interactive Tool</span>
              <ArrowRight size={14} style={{ color: 'var(--ink-tertiary)' }} />
            </div>
            <strong style={{ fontSize: '15px' }}>₹1 Crore Path Calculator</strong>
            <p style={{ fontSize: '12px', color: 'var(--ink-secondary)', margin: 0, lineHeight: 1.5 }}>
              Deterministic compound interest timeline modeling with controllable acceleration levers.
            </p>
          </Link>

          <Link
            href="/calculators/emergency-fund"
            style={{
              background: 'var(--canvas-surface)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '8px',
              padding: '20px',
              textDecoration: 'none',
              color: 'inherit',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge-signal badge-amber" style={{ fontSize: '10px' }}>Liquid Buffer</span>
              <ArrowRight size={14} style={{ color: 'var(--ink-tertiary)' }} />
            </div>
            <strong style={{ fontSize: '15px' }}>Emergency Fund Calculator</strong>
            <p style={{ fontSize: '12px', color: 'var(--ink-secondary)', margin: 0, lineHeight: 1.5 }}>
              Essential survival cost calculator with RBI safety buffer recommendations.
            </p>
          </Link>

          <Link
            href="/education/tax-regimes-india"
            style={{
              background: 'var(--canvas-surface)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '8px',
              padding: '20px',
              textDecoration: 'none',
              color: 'inherit',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge-signal badge-forest" style={{ fontSize: '10px' }}>CBDT Sourced</span>
              <ArrowRight size={14} style={{ color: 'var(--ink-tertiary)' }} />
            </div>
            <strong style={{ fontSize: '15px' }}>Indian Tax Regimes (FY 2024-25)</strong>
            <p style={{ fontSize: '12px', color: 'var(--ink-secondary)', margin: 0, lineHeight: 1.5 }}>
              New vs Old tax regime comparison under Finance (No. 2) Act 2024 with official citations.
            </p>
          </Link>
        </div>
      </section>

      {/* 6. BOTTOM ACTION CTA */}
      <section
        style={{
          borderTop: '1px solid var(--border-hairline)',
          paddingTop: '32px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <h2 style={{ fontSize: '22px', fontWeight: 600, margin: 0 }}>
          Ready to Calculate Your True Financial Surplus?
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--ink-secondary)', margin: 0, maxWidth: '520px' }}>
          Join thousands of Indians building disciplined cashflows and reaching their ₹1 Crore milestones.
        </p>
        <Link
          href="/login"
          className="btn-action btn-forest"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 28px',
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
            borderRadius: '6px',
          }}
        >
          <span>Sign In / Create Account</span>
          <ArrowRight size={16} />
        </Link>
      </section>
    </div>
  );
}
