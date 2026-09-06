import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Scale,
  Percent,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'New vs Old Tax Regime FY 2024-25 (AY 2025-26) Guide | MyCA',
  description:
    'Comprehensive statutory guide to Indian Income Tax slabs under Finance (No. 2) Act 2024. Understand the revised Section 115BAC slabs, ₹75,000 standard deduction, and mathematical breakeven analysis.',
  alternates: {
    canonical: 'https://myca.in/education/tax-regimes-india',
  },
  openGraph: {
    title: 'New vs Old Tax Regime FY 2024-25 Guide | Section 115BAC Explained | MyCA',
    description:
      'Authoritative statutory comparison of Indian Income Tax regimes for FY 2024-25. Accurate slabs, Sec 87A rebate, ₹75,000 standard deduction, and deduction breakeven thresholds.',
    url: 'https://myca.in/education/tax-regimes-india',
    siteName: 'MyCA',
    locale: 'en_IN',
    type: 'article',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Income Tax Regimes in India: FY 2024-25 (AY 2025-26) Statutory Analysis',
  description:
    'Authoritative breakdown of the New Tax Regime (Section 115BAC) under Finance (No. 2) Act 2024 versus the Old Tax Regime for Indian salaried taxpayers.',
  publisher: {
    '@type': 'Organization',
    name: 'MyCA',
    url: 'https://myca.in',
  },
  mainEntityOfPage: {
    '@type': 'WebPage',
    '@id': 'https://myca.in/education/tax-regimes-india',
  },
};

export default function TaxRegimesIndiaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '40px',
          maxWidth: '880px',
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
          <span style={{ color: 'var(--ink-secondary)' }}>Education</span>
          <span>/</span>
          <span style={{ color: 'var(--ink-primary)', fontWeight: 600 }}>
            Tax Regimes FY 2024-25
          </span>
        </nav>

        {/* Header */}
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
              Finance (No. 2) Act, 2024
            </span>
            <span className="badge-signal" style={{ fontSize: '11px' }}>
              Statutory Verification
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
            New vs Old Tax Regime: FY 2024-25 (AY 2025-26)
          </h1>
          <p
            style={{
              fontSize: '15px',
              color: 'var(--ink-secondary)',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            A verified, numbers-driven guide to Indian income tax brackets. Understand when the
            concessional Section 115BAC regime saves you the most money, and when itemized
            deductions justify remaining in the Old Regime.
          </p>
        </div>

        {/* Key Statutory Update Highlight */}
        <div
          style={{
            background: 'var(--canvas-surface)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-card)',
            padding: '20px 24px',
            borderLeft: '4px solid var(--signal-forest)',
            display: 'flex',
            gap: '16px',
          }}
        >
          <Scale size={24} style={{ color: 'var(--signal-forest)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--ink-primary)', display: 'block', fontSize: '14px', marginBottom: '4px' }}>
              Official Finance (No. 2) Act 2024 Amendments (Effective FY 2024-25):
            </strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: '18px', color: 'var(--ink-secondary)' }}>
              <li>
                <strong>Increased Standard Deduction:</strong> Raised from ₹50,000 to{' '}
                <strong style={{ color: 'var(--ink-primary)' }}>₹75,000</strong> for salaried
                individuals choosing the New Tax Regime (Section 115BAC).
              </li>
              <li>
                <strong>Revised Slabs under Sec 115BAC:</strong> The 5% slab now covers ₹3L to ₹7L (previously ₹3L to ₹6L), and the 10% slab covers ₹7L to ₹10L (previously ₹6L to ₹9L).
              </li>
              <li>
                <strong>Section 87A Tax Rebate:</strong> Rebate continues up to taxable income of ₹7,00,000 under the New Regime. With the ₹75,000 standard deduction, a salaried employee earning up to{' '}
                <strong style={{ color: 'var(--ink-primary)' }}>₹7,75,000</strong> incurs zero net tax liability under the New Regime.
              </li>
            </ul>
          </div>
        </div>

        {/* Side-by-Side Slabs Comparison Table */}
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
          aria-labelledby="slabs-heading"
        >
          <h2 id="slabs-heading" style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
            Tax Slab Comparison (Individuals &lt; 60 Years)
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px',
                textAlign: 'left',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-hairline)', color: 'var(--ink-secondary)' }}>
                  <th style={{ padding: '10px 12px' }}>New Regime (Sec 115BAC) Slabs</th>
                  <th style={{ padding: '10px 12px' }}>New Tax Rate</th>
                  <th style={{ padding: '10px 12px' }}>Old Regime Slabs</th>
                  <th style={{ padding: '10px 12px' }}>Old Tax Rate</th>
                </tr>
              </thead>
              <tbody style={{ fontFamily: 'var(--font-mono)' }}>
                <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                  <td style={{ padding: '10px 12px' }}>₹0 to ₹3,00,000</td>
                  <td style={{ padding: '10px 12px', color: 'var(--signal-forest)' }}>Nil</td>
                  <td style={{ padding: '10px 12px' }}>₹0 to ₹2,50,000</td>
                  <td style={{ padding: '10px 12px' }}>Nil</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                  <td style={{ padding: '10px 12px' }}>₹3,00,001 to ₹7,00,000</td>
                  <td style={{ padding: '10px 12px' }}>5% (Rebate under 87A)</td>
                  <td style={{ padding: '10px 12px' }}>₹2,50,001 to ₹5,00,000</td>
                  <td style={{ padding: '10px 12px' }}>5% (Rebate under 87A)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                  <td style={{ padding: '10px 12px' }}>₹7,00,001 to ₹10,00,000</td>
                  <td style={{ padding: '10px 12px' }}>10%</td>
                  <td style={{ padding: '10px 12px' }}>₹5,00,001 to ₹10,00,000</td>
                  <td style={{ padding: '10px 12px' }}>20%</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                  <td style={{ padding: '10px 12px' }}>₹10,00,001 to ₹12,00,000</td>
                  <td style={{ padding: '10px 12px' }}>15%</td>
                  <td style={{ padding: '10px 12px' }} rowSpan={2}>Above ₹10,00,000</td>
                  <td style={{ padding: '10px 12px' }} rowSpan={2}>30%</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                  <td style={{ padding: '10px 12px' }}>₹12,00,001 to ₹15,00,000</td>
                  <td style={{ padding: '10px 12px' }}>20%</td>
                </tr>
                <tr>
                  <td style={{ padding: '10px 12px' }}>Above ₹15,00,000</td>
                  <td style={{ padding: '10px 12px' }}>30%</td>
                  <td style={{ padding: '10px 12px' }}>—</td>
                  <td style={{ padding: '10px 12px' }}>—</td>
                </tr>
              </tbody>
            </table>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--ink-tertiary)' }}>
            Note: Health & Education Cess of 4% applies on total tax payable under both regimes. Applicable surcharge applies for taxable income exceeding ₹50 Lakhs.
          </span>
        </section>

        {/* Mathematical Breakeven Analysis */}
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
          aria-labelledby="breakeven-heading"
        >
          <h2 id="breakeven-heading" style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
            Mathematical Breakeven: When Does the Old Regime Win?
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', lineHeight: 1.6, margin: 0 }}>
            Under the Old Regime, you are permitted to claim itemized deductions including Section 80C (up to ₹1.5L), Section 80D (Health Insurance up to ₹25k/₹50k), Section 24(b) (Home Loan Interest up to ₹2L), and House Rent Allowance (HRA under Section 10(13A)).
          </p>
          <p style={{ fontSize: '13px', color: 'var(--ink-secondary)', lineHeight: 1.6, margin: 0 }}>
            For the Old Regime to result in lower total tax than the New Regime, your total eligible deductions must exceed the breakeven threshold for your gross income bracket:
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
            }}
          >
            <div style={{ background: 'var(--canvas-inset)', padding: '16px', borderRadius: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--ink-tertiary)', textTransform: 'uppercase' }}>
                Gross Salary: ₹10,00,000
              </span>
              <p style={{ fontSize: '18px', fontWeight: 700, margin: '6px 0', fontFamily: 'var(--font-mono)' }}>
                ~₹3,00,000
              </p>
              <span style={{ fontSize: '12px', color: 'var(--ink-secondary)' }}>
                Deductions required to break even. If deductions &lt; ₹3.0L, New Regime saves tax.
              </span>
            </div>

            <div style={{ background: 'var(--canvas-inset)', padding: '16px', borderRadius: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--ink-tertiary)', textTransform: 'uppercase' }}>
                Gross Salary: ₹15,00,000
              </span>
              <p style={{ fontSize: '18px', fontWeight: 700, margin: '6px 0', fontFamily: 'var(--font-mono)' }}>
                ~₹3,75,000
              </p>
              <span style={{ fontSize: '12px', color: 'var(--ink-secondary)' }}>
                Deductions required (e.g. 80C + 80D + HRA/Home Loan). If deductions &lt; ₹3.75L, New Regime is superior.
              </span>
            </div>

            <div style={{ background: 'var(--canvas-inset)', padding: '16px', borderRadius: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--ink-tertiary)', textTransform: 'uppercase' }}>
                Gross Salary: ₹20,00,000
              </span>
              <p style={{ fontSize: '18px', fontWeight: 700, margin: '6px 0', fontFamily: 'var(--font-mono)' }}>
                ~₹4,25,000
              </p>
              <span style={{ fontSize: '12px', color: 'var(--ink-secondary)' }}>
                Deductions required. Salaried individuals without heavy home loan interest or high HRA benefit from the New Regime.
              </span>
            </div>
          </div>
        </section>

        {/* Official Statutory References */}
        <section
          style={{
            background: 'var(--canvas-surface)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-card)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
          aria-labelledby="references-heading"
        >
          <h3 id="references-heading" style={{ fontSize: '14px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={16} style={{ color: 'var(--signal-forest)' }} />
            Authoritative Regulatory References
          </h3>
          <ul style={{ fontSize: '12px', color: 'var(--ink-secondary)', margin: 0, paddingLeft: '18px', lineHeight: 1.6 }}>
            <li>
              <strong>Income-tax Act, 1961</strong>: Section 115BAC (Special provisions relating to tax on income of individuals, Hindu undivided family and others).
            </li>
            <li>
              <strong>Finance (No. 2) Act, 2024</strong>: Section 115BAC amendments enhancing standard deduction from ₹50,000 to ₹75,000 and widening the 5% and 10% rate brackets.
            </li>
            <li>
              <strong>Central Board of Direct Taxes (CBDT)</strong>: Notification No. 43/2023 regarding default tax regime status and Form 10-IEA for opting into the Old Regime.
            </li>
          </ul>
        </section>

        {/* CTA */}
        <div
          style={{
            background: 'var(--canvas-surface)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-card)',
            padding: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600 }}>
              Need Your Exact Tax Computation Dossier?
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-secondary)' }}>
              MyCA creates a clean, deterministic statement comparing both regimes against your verified ledger records.
            </p>
          </div>
          <Link
            href="/"
            className="btn btn-primary"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            Explore MyCA
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </>
  );
}
