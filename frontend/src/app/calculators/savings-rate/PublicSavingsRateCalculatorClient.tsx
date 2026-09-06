'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, ShieldCheck, HelpCircle, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function PublicSavingsRateCalculatorClient() {
  const [monthlyIncome, setMonthlyIncome] = useState<number>(100000);
  const [essentialExpenses, setEssentialExpenses] = useState<number>(40000);
  const [discretionaryExpenses, setDiscretionaryExpenses] = useState<number>(20000);
  const [monthlyEmi, setMonthlyEmi] = useState<number>(15000);
  const [monthlySip, setMonthlySip] = useState<number>(15000);

  // Computations
  const results = useMemo(() => {
    const totalOutflows = essentialExpenses + discretionaryExpenses + monthlyEmi;
    const rawSurplus = monthlyIncome - totalOutflows;
    const savingsRatePct = monthlyIncome > 0 ? (rawSurplus / monthlyIncome) * 100 : 0;
    const investmentRatePct = monthlyIncome > 0 ? (monthlySip / monthlyIncome) * 100 : 0;

    const needsPct = monthlyIncome > 0 ? ((essentialExpenses + monthlyEmi) / monthlyIncome) * 100 : 0;
    const wantsPct = monthlyIncome > 0 ? (discretionaryExpenses / monthlyIncome) * 100 : 0;
    const savingsPct = Math.max(0, savingsRatePct);

    // Approximate Years to Financial Independence (FI)
    // Formula: 25x annual expenses target at 5% real return (11% return - 6% inflation)
    const annualExpenses = totalOutflows * 12;
    const targetCorpus = annualExpenses * 25;
    const annualSavings = Math.max(0, rawSurplus * 12);
    
    let yearsToFi = 0;
    if (annualSavings > 0 && annualExpenses > 0) {
      // Numerical compound accumulation with 5% real rate:
      let accumulated = 0;
      const realRate = 0.05;
      while (accumulated < targetCorpus && yearsToFi < 60) {
        accumulated = (accumulated + annualSavings) * (1 + realRate);
        yearsToFi++;
      }
    } else {
      yearsToFi = 99;
    }

    return {
      totalOutflows,
      rawSurplus,
      savingsRatePct,
      investmentRatePct,
      needsPct,
      wantsPct,
      savingsPct,
      annualExpenses,
      targetCorpus,
      yearsToFi,
      isDeficit: rawSurplus < 0,
    };
  }, [monthlyIncome, essentialExpenses, discretionaryExpenses, monthlyEmi, monthlySip]);

  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--canvas-base, #0b0f19)', color: '#f3f4f6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Navigation Top Bar */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(11, 15, 25, 0.8)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#9ca3af', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>
          <ArrowLeft size={16} /> Back to MyCA
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '4px 10px', borderRadius: '999px', fontWeight: 600 }}>
            Deterministic Engine
          </span>
          <Link href="/login" style={{ background: '#2563eb', color: '#fff', textDecoration: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>
            Sign In
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px 80px' }}>
        {/* Hero Section */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, marginBottom: '16px' }}>
            <Sparkles size={14} /> 50 / 30 / 20 Rule &amp; Freedom Timeline
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 12px', color: '#ffffff', letterSpacing: '-0.02em' }}>
            Indian Savings Rate &amp; Financial Freedom Calculator
          </h1>
          <p style={{ fontSize: '15px', color: '#9ca3af', maxWidth: '650px', margin: '0 auto', lineHeight: '1.6' }}>
            Calculate your true monthly surplus, evaluate your 50/30/20 budget ratio, and compute how many years until your savings can fund your living expenses indefinitely.
          </p>
        </div>

        {/* Grid Layout: Controls & Output */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px', alignItems: 'start' }}>
          {/* Inputs Card */}
          <div style={{ background: 'rgba(17, 24, 39, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '28px', backdropFilter: 'blur(10px)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 20px', color: '#f9fafb' }}>
              Your Monthly Cash Flow
            </h2>

            {/* Income Slider */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label htmlFor="income-input" style={{ fontSize: '13px', color: '#d1d5db', fontWeight: 500 }}>Monthly Net In-Hand Income</label>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#60a5fa' }}>{formatINR(monthlyIncome)}</span>
              </div>
              <input
                id="income-input"
                type="range"
                min={20000}
                max={1000000}
                step={5000}
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#2563eb' }}
                aria-label="Monthly In-Hand Income"
              />
            </div>

            {/* Essential Expenses */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label htmlFor="essential-input" style={{ fontSize: '13px', color: '#d1d5db', fontWeight: 500 }}>Essential Needs (Rent, Food, Utilities)</label>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#f87171' }}>{formatINR(essentialExpenses)}</span>
              </div>
              <input
                id="essential-input"
                type="range"
                min={5000}
                max={500000}
                step={2000}
                value={essentialExpenses}
                onChange={(e) => setEssentialExpenses(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#ef4444' }}
                aria-label="Essential Needs Expenses"
              />
            </div>

            {/* Debt EMIs */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label htmlFor="emi-input" style={{ fontSize: '13px', color: '#d1d5db', fontWeight: 500 }}>Debt Obligations &amp; EMIs</label>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#fb923c' }}>{formatINR(monthlyEmi)}</span>
              </div>
              <input
                id="emi-input"
                type="range"
                min={0}
                max={300000}
                step={1000}
                value={monthlyEmi}
                onChange={(e) => setMonthlyEmi(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#f97316' }}
                aria-label="Debt Obligations & EMIs"
              />
            </div>

            {/* Discretionary Wants */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label htmlFor="wants-input" style={{ fontSize: '13px', color: '#d1d5db', fontWeight: 500 }}>Discretionary Wants (Dining, Outings, Subscriptions)</label>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#fbbf24' }}>{formatINR(discretionaryExpenses)}</span>
              </div>
              <input
                id="wants-input"
                type="range"
                min={0}
                max={300000}
                step={1000}
                value={discretionaryExpenses}
                onChange={(e) => setDiscretionaryExpenses(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#f59e0b' }}
                aria-label="Discretionary Expenses"
              />
            </div>

            {/* Monthly SIP */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label htmlFor="sip-input" style={{ fontSize: '13px', color: '#d1d5db', fontWeight: 500 }}>Current Mutual Fund / Stock SIP</label>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#34d399' }}>{formatINR(monthlySip)}</span>
              </div>
              <input
                id="sip-input"
                type="range"
                min={0}
                max={400000}
                step={1000}
                value={monthlySip}
                onChange={(e) => setMonthlySip(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#10b981' }}
                aria-label="Monthly SIP"
              />
            </div>
          </div>

          {/* Results Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Primary KPI Box */}
            <div style={{ background: results.isDeficit ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', border: `1px solid ${results.isDeficit ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`, borderRadius: '16px', padding: '24px', backdropFilter: 'blur(10px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: results.isDeficit ? '#f87171' : '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {results.isDeficit ? 'Deficit Detected' : 'Actual Monthly Surplus'}
                </span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: results.isDeficit ? '#ef4444' : '#10b981' }}>
                  {results.savingsRatePct.toFixed(1)}%
                </span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
                {formatINR(results.rawSurplus)} <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 400 }}>/ month</span>
              </div>
              <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0, lineHeight: '1.5' }}>
                {results.isDeficit
                  ? 'Your monthly living expenses exceed your income. Immediate deficit stabilization required before deploying investments.'
                  : results.savingsRatePct >= 30
                  ? 'Exceptional savings rate! You are in the top tier of Indian wealth accumulators on track for financial freedom.'
                  : 'Healthy savings buffer. Directing surplus systematically into emergency buffer and index SIPs will accelerate your goals.'}
              </p>
            </div>

            {/* 50/30/20 Breakdown Card */}
            <div style={{ background: 'rgba(17, 24, 39, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(10px)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 16px', color: '#f3f4f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={16} color="#60a5fa" /> 50 / 30 / 20 Budget Ratio Analysis
              </h3>

              {/* Stacked Progress Bar */}
              <div style={{ height: '14px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden', display: 'flex', marginBottom: '16px' }}>
                <div style={{ width: `${Math.min(100, results.needsPct)}%`, background: '#ef4444' }} title={`Needs: ${results.needsPct.toFixed(1)}%`} />
                <div style={{ width: `${Math.min(100, results.wantsPct)}%`, background: '#f59e0b' }} title={`Wants: ${results.wantsPct.toFixed(1)}%`} />
                <div style={{ width: `${Math.min(100, results.savingsPct)}%`, background: '#10b981' }} title={`Savings: ${results.savingsPct.toFixed(1)}%`} />
              </div>

              {/* Ratios Table */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', textAlign: 'center' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div style={{ fontSize: '11px', color: '#fca5a5', fontWeight: 600 }}>NEEDS (≤50%)</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginTop: '4px' }}>{results.needsPct.toFixed(1)}%</div>
                </div>
                <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <div style={{ fontSize: '11px', color: '#fcd34d', fontWeight: 600 }}>WANTS (≤30%)</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginTop: '4px' }}>{results.wantsPct.toFixed(1)}%</div>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ fontSize: '11px', color: '#6ee7b7', fontWeight: 600 }}>SAVINGS (≥20%)</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginTop: '4px' }}>{results.savingsPct.toFixed(1)}%</div>
                </div>
              </div>
            </div>

            {/* Financial Independence Horizon */}
            <div style={{ background: 'rgba(17, 24, 39, 0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(10px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#f3f4f6' }}>Years to Financial Independence</span>
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#60a5fa' }}>
                  {results.isDeficit ? '∞' : `${results.yearsToFi} Years`}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 12px', lineHeight: '1.5' }}>
                Target Corpus (25x Annual Outflows): <strong style={{ color: '#ffffff' }}>{formatINR(results.targetCorpus)}</strong> (at 5% real return above inflation).
              </p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px', color: '#34d399' }}>
                <CheckCircle2 size={14} /> Zero guesswork: 100% deterministic compound mathematics.
              </div>
            </div>
          </div>
        </div>

        {/* Deep Dive & Methodology Section */}
        <div style={{ marginTop: '48px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '40px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '16px' }}>
            Why Savings Rate Beats Investment Return for Most Indians
          </h3>
          <p style={{ fontSize: '14px', color: '#9ca3af', lineHeight: '1.7', marginBottom: '16px' }}>
            In early-to-mid career wealth building, your <strong>Savings Rate</strong> accounts for over 80% of your portfolio value in the first 10 years. An investor saving 40% with an index fund return will reach ₹1 Crore significantly faster than an investor saving 10% attempting high-risk stock trading.
          </p>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '24px' }}>
            <Link href="/calculators/crore" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', textDecoration: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: '1px solid rgba(59, 130, 246, 0.25)' }}>
              Explore ₹1 Crore Calculator &rarr;
            </Link>
            <Link href="/calculators/emergency-fund" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', textDecoration: 'none', padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              Calculate Emergency Fund Buffer &rarr;
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
