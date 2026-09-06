'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Shield,
  Sliders,
  ArrowRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  Building2,
  HelpCircle,
} from 'lucide-react';

export default function PublicEmergencyFundCalculatorClient() {
  const [rentAndLiving, setRentAndLiving] = useState<number>(25000);
  const [groceriesAndUtilities, setGroceriesAndUtilities] = useState<number>(15000);
  const [loanEmis, setLoanEmis] = useState<number>(15000);
  const [insuranceAndHealthcare, setInsuranceAndHealthcare] = useState<number>(5000);
  const [dependentNeeds, setDependentNeeds] = useState<number>(5000);

  const [monthsBuffer, setMonthsBuffer] = useState<number>(6);
  const [currentSavings, setCurrentSavings] = useState<number>(150000);

  const monthlyEssentialCommitments = useMemo(() => {
    return (
      rentAndLiving +
      groceriesAndUtilities +
      loanEmis +
      insuranceAndHealthcare +
      dependentNeeds
    );
  }, [
    rentAndLiving,
    groceriesAndUtilities,
    loanEmis,
    insuranceAndHealthcare,
    dependentNeeds,
  ]);

  const targetEmergencyFund = monthlyEssentialCommitments * monthsBuffer;
  const fundingGap = Math.max(0, targetEmergencyFund - currentSavings);
  const fundedPercentage =
    targetEmergencyFund > 0
      ? Math.min(100, Math.round((currentSavings / targetEmergencyFund) * 100))
      : 0;

  // DICGC Insurance Limit reference: ₹5,00,000 per depositor per scheduled bank
  const DICGC_LIMIT = 500000;
  const banksRecommended = Math.ceil(targetEmergencyFund / DICGC_LIMIT);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '40px',
        maxWidth: '960px',
        margin: '0 auto',
        padding: '16px 0 64px',
      }}
    >
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        style={{ fontSize: '12px', color: 'var(--ink-secondary)', display: 'flex', gap: '8px' }}
      >
        <Link href="/" style={{ color: 'var(--ink-secondary)', textDecoration: 'none' }}>
          Home
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--ink-primary)', fontWeight: 600 }}>
          Emergency Fund Calculator
        </span>
      </nav>

      {/* Hero Header */}
      <div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
          }}
        >
          <span
            className="badge-signal badge-forest"
            style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}
          >
            Zero-Anxiety Liquidity Planning
          </span>
          <span className="badge-signal" style={{ fontSize: '11px' }}>
            DICGC & RBI Guidelines
          </span>
        </div>
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--ink-primary)',
            margin: '0 0 12px',
          }}
        >
          Emergency Fund & Liquidity Cushion Calculator
        </h1>
        <p
          style={{
            fontSize: '15px',
            color: 'var(--ink-secondary)',
            lineHeight: 1.6,
            margin: 0,
            maxWidth: '760px',
          }}
        >
          Calculate your true survival budget without guessing. Protect your family from sudden
          career pauses or medical emergencies before taking equity risks.
        </p>
      </div>

      {/* Interactive Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
        }}
      >
        {/* Input Form */}
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
          aria-labelledby="inputs-heading"
        >
          <h2
            id="inputs-heading"
            style={{
              fontSize: '16px',
              fontWeight: 600,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Sliders size={18} style={{ color: 'var(--signal-forest)' }} />
            Non-Negotiable Monthly Outflows
          </h2>

          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '6px',
                fontSize: '13px',
              }}
            >
              <label htmlFor="rent-input" style={{ color: 'var(--ink-secondary)' }}>
                Rent / Housing Maintenance
              </label>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                ₹{rentAndLiving.toLocaleString('en-IN')}
              </span>
            </div>
            <input
              id="rent-input"
              type="range"
              min={0}
              max={100000}
              step={2000}
              value={rentAndLiving}
              onChange={(e) => setRentAndLiving(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--signal-forest)', cursor: 'pointer' }}
            />
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '6px',
                fontSize: '13px',
              }}
            >
              <label htmlFor="groceries-input" style={{ color: 'var(--ink-secondary)' }}>
                Food, Groceries & Essential Utilities
              </label>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                ₹{groceriesAndUtilities.toLocaleString('en-IN')}
              </span>
            </div>
            <input
              id="groceries-input"
              type="range"
              min={5000}
              max={60000}
              step={1000}
              value={groceriesAndUtilities}
              onChange={(e) => setGroceriesAndUtilities(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--signal-forest)', cursor: 'pointer' }}
            />
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '6px',
                fontSize: '13px',
              }}
            >
              <label htmlFor="emi-input" style={{ color: 'var(--ink-secondary)' }}>
                Mandatory Debt & Loan EMIs
              </label>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                ₹{loanEmis.toLocaleString('en-IN')}
              </span>
            </div>
            <input
              id="emi-input"
              type="range"
              min={0}
              max={150000}
              step={2500}
              value={loanEmis}
              onChange={(e) => setLoanEmis(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--signal-forest)', cursor: 'pointer' }}
            />
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '6px',
                fontSize: '13px',
              }}
            >
              <label htmlFor="insurance-input" style={{ color: 'var(--ink-secondary)' }}>
                Health/Term Insurance & Medications
              </label>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                ₹{insuranceAndHealthcare.toLocaleString('en-IN')}
              </span>
            </div>
            <input
              id="insurance-input"
              type="range"
              min={0}
              max={30000}
              step={1000}
              value={insuranceAndHealthcare}
              onChange={(e) => setInsuranceAndHealthcare(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--signal-forest)', cursor: 'pointer' }}
            />
          </div>

          {/* Safety Horizon Multiplier */}
          <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: '16px' }}>
            <label style={{ fontSize: '13px', color: 'var(--ink-secondary)', display: 'block', marginBottom: '8px' }}>
              Safety Runway Horizon
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[
                { months: 3, label: '3 Months', sub: 'Dual income' },
                { months: 6, label: '6 Months', sub: 'Salaried norm' },
                { months: 12, label: '12 Months', sub: 'Freelance/Founder' },
              ].map((tier) => (
                <button
                  key={tier.months}
                  type="button"
                  onClick={() => setMonthsBuffer(tier.months)}
                  className={`btn ${monthsBuffer === tier.months ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    flexDirection: 'column',
                    padding: '8px 4px',
                    height: 'auto',
                    fontSize: '12px',
                    textAlign: 'center',
                  }}
                >
                  <strong>{tier.label}</strong>
                  <span style={{ fontSize: '10px', opacity: 0.8 }}>{tier.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Current Saved Liquid Buffer */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '6px',
                fontSize: '13px',
              }}
            >
              <label htmlFor="saved-input" style={{ color: 'var(--ink-secondary)' }}>
                Current Liquid Emergency Savings
              </label>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                ₹{currentSavings.toLocaleString('en-IN')}
              </span>
            </div>
            <input
              id="saved-input"
              type="range"
              min={0}
              max={1500000}
              step={10000}
              value={currentSavings}
              onChange={(e) => setCurrentSavings(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--signal-forest)', cursor: 'pointer' }}
            />
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
          aria-labelledby="results-target-heading"
        >
          <div>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--ink-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Target Emergency Cushion
            </span>
            <h2
              id="results-target-heading"
              style={{
                fontSize: '38px',
                fontWeight: 800,
                color: 'var(--signal-forest)',
                margin: '6px 0 4px',
                letterSpacing: '-0.02em',
                fontFamily: 'var(--font-mono)',
              }}
            >
              ₹{targetEmergencyFund.toLocaleString('en-IN')}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', margin: 0 }}>
              Based on monthly mandatory commitments of{' '}
              <strong style={{ color: 'var(--ink-primary)' }}>
                ₹{monthlyEssentialCommitments.toLocaleString('en-IN')}/mo
              </strong>{' '}
              for {monthsBuffer} months.
            </p>
          </div>

          {/* Progress Bar */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                marginBottom: '6px',
              }}
            >
              <span>Current Cushion Funding</span>
              <strong>{fundedPercentage}% Funded</strong>
            </div>
            <div
              style={{
                width: '100%',
                height: '10px',
                background: 'var(--canvas-inset)',
                borderRadius: '5px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${fundedPercentage}%`,
                  height: '100%',
                  background:
                    fundedPercentage >= 100
                      ? 'var(--signal-forest)'
                      : fundedPercentage >= 50
                      ? '#d69e2e'
                      : '#e53e3e',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            {fundingGap > 0 ? (
              <span
                style={{
                  display: 'block',
                  marginTop: '8px',
                  fontSize: '12px',
                  color: 'var(--ink-secondary)',
                }}
              >
                Remaining gap to fund:{' '}
                <strong style={{ color: 'var(--ink-primary)', fontFamily: 'var(--font-mono)' }}>
                  ₹{fundingGap.toLocaleString('en-IN')}
                </strong>
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '8px',
                  fontSize: '12px',
                  color: 'var(--signal-forest)',
                  fontWeight: 600,
                }}
              >
                <CheckCircle2 size={14} /> Full Safety Cushion Achieved!
              </span>
            )}
          </div>

          {/* DICGC Insurance Architecture Tip */}
          <div
            style={{
              background: 'rgba(66, 153, 225, 0.08)',
              border: '1px solid rgba(66, 153, 225, 0.25)',
              borderRadius: '8px',
              padding: '14px 16px',
              fontSize: '12px',
              lineHeight: 1.5,
              display: 'flex',
              gap: '12px',
            }}
          >
            <Building2 size={18} style={{ color: '#3182ce', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--ink-primary)', display: 'block', marginBottom: '2px' }}>
                DICGC Insurance Architecture
              </strong>
              Under Reserve Bank of India regulations, the DICGC covers deposits up to ₹5,00,000
              per depositor per bank (principal + interest).{' '}
              {targetEmergencyFund > DICGC_LIMIT ? (
                <span>
                  Since your target is ₹{targetEmergencyFund.toLocaleString('en-IN')}, consider
                  allocating across at least{' '}
                  <strong style={{ color: 'var(--ink-primary)' }}>
                    {banksRecommended} separate scheduled commercial banks
                  </strong>{' '}
                  or top-tier overnight/liquid mutual funds for 100% principal protection.
                </span>
              ) : (
                <span>
                  Your target is fully within the ₹5 Lakh statutory deposit insurance threshold of a
                  single scheduled bank.
                </span>
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: '16px' }}>
            <Link
              href="/"
              className="btn btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              Verify Your Ledger in MyCA
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      </div>

      {/* Best Practices Section */}
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
        <h3
          style={{
            fontSize: '16px',
            fontWeight: 600,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Info size={16} style={{ color: 'var(--ink-secondary)' }} />
          Where Should Your Indian Emergency Fund Be Parked?
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            fontSize: '13px',
            lineHeight: 1.5,
          }}
        >
          <div style={{ background: 'var(--canvas-inset)', padding: '16px', borderRadius: '8px' }}>
            <strong style={{ color: 'var(--ink-primary)', display: 'block', marginBottom: '4px' }}>
              Tier 1: Instant Access (1 Month)
            </strong>
            <span style={{ color: 'var(--ink-secondary)' }}>
              High-yield savings account or auto-sweep fixed deposit with immediate UPI / debit card
              withdrawal capability.
            </span>
          </div>
          <div style={{ background: 'var(--canvas-inset)', padding: '16px', borderRadius: '8px' }}>
            <strong style={{ color: 'var(--ink-primary)', display: 'block', marginBottom: '4px' }}>
              Tier 2: Short Notice (2-3 Months)
            </strong>
            <span style={{ color: 'var(--ink-secondary)' }}>
              Liquid mutual funds with instant redemption facility (up to ₹50,000 or 90% of folio
              within seconds) and T+1 regular settlement.
            </span>
          </div>
          <div style={{ background: 'var(--canvas-inset)', padding: '16px', borderRadius: '8px' }}>
            <strong style={{ color: 'var(--ink-primary)', display: 'block', marginBottom: '4px' }}>
              Tier 3: Extended Buffer (Remaining)
            </strong>
            <span style={{ color: 'var(--ink-secondary)' }}>
              Short-term bank fixed deposits or ultra-short duration debt funds yielding competitive
              returns while avoiding stock market volatility.
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
