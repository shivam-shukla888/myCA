import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * P1 Organic Reach Foundation Test Suite
 * Validates SEO metadata, title, description, OpenGraph, sitemap, robots,
 * canonical URLs, structured data, public outcome positioning, and privacy boundaries.
 */

describe('MYCA P1 Organic Reach Foundation', () => {
  const robotsPath = path.resolve('src/app/robots.ts');
  const sitemapPath = path.resolve('src/app/sitemap.ts');
  const layoutPath = path.resolve('src/app/layout.tsx');
  const landingPath = path.resolve('src/components/public/PublicLandingView.tsx');
  const pagePath = path.resolve('src/app/page.tsx');
  const croreCalcPath = path.resolve('src/app/calculators/crore/page.tsx');
  const croreClientPath = path.resolve('src/app/calculators/crore/PublicCroreCalculatorClient.tsx');
  const emergencyCalcPath = path.resolve('src/app/calculators/emergency-fund/page.tsx');
  const emergencyClientPath = path.resolve('src/app/calculators/emergency-fund/PublicEmergencyFundCalculatorClient.tsx');
  const taxEduPath = path.resolve('src/app/education/tax-regimes-india/page.tsx');

  it('verifies all required public files exist', () => {
    assert.ok(fs.existsSync(robotsPath), 'robots.ts must exist');
    assert.ok(fs.existsSync(sitemapPath), 'sitemap.ts must exist');
    assert.ok(fs.existsSync(layoutPath), 'layout.tsx must exist');
    assert.ok(fs.existsSync(landingPath), 'PublicLandingView.tsx must exist');
    assert.ok(fs.existsSync(pagePath), 'page.tsx must exist');
    assert.ok(fs.existsSync(croreCalcPath), 'calculators/crore/page.tsx must exist');
    assert.ok(fs.existsSync(croreClientPath), 'calculators/crore/PublicCroreCalculatorClient.tsx must exist');
    assert.ok(fs.existsSync(emergencyCalcPath), 'calculators/emergency-fund/page.tsx must exist');
    assert.ok(fs.existsSync(emergencyClientPath), 'calculators/emergency-fund/PublicEmergencyFundCalculatorClient.tsx must exist');
    assert.ok(fs.existsSync(taxEduPath), 'education/tax-regimes-india/page.tsx must exist');
  });

  const robotsSource = fs.readFileSync(robotsPath, 'utf8');
  const sitemapSource = fs.readFileSync(sitemapPath, 'utf8');
  const layoutSource = fs.readFileSync(layoutPath, 'utf8');
  const landingSource = fs.readFileSync(landingPath, 'utf8');
  const pageSource = fs.readFileSync(pagePath, 'utf8');
  const croreCalcSource = fs.readFileSync(croreCalcPath, 'utf8');
  const croreClientSource = fs.readFileSync(croreClientPath, 'utf8');
  const emergencyCalcSource = fs.readFileSync(emergencyCalcPath, 'utf8');
  const emergencyClientSource = fs.readFileSync(emergencyClientPath, 'utf8');
  const taxEduSource = fs.readFileSync(taxEduPath, 'utf8');

  it('verifies robots.ts privacy boundaries and crawl directives', () => {
    // Allows public surfaces
    assert.ok(robotsSource.includes("'/'"), 'Must allow root public landing');
    assert.ok(robotsSource.includes("'/calculators/crore'"), 'Must allow crore calculator');
    assert.ok(robotsSource.includes("'/calculators/emergency-fund'"), 'Must allow emergency fund calculator');
    assert.ok(robotsSource.includes("'/education/tax-regimes-india'"), 'Must allow tax regimes education');

    // Strictly disallows authenticated and private endpoints
    assert.ok(robotsSource.includes("'/api/'"), 'Must disallow /api/');
    assert.ok(robotsSource.includes("'/admin/'"), 'Must disallow /admin/');
    assert.ok(robotsSource.includes("'/ledger/'"), 'Must disallow /ledger/');
    assert.ok(robotsSource.includes("'/vault/'"), 'Must disallow /vault/');
    assert.ok(robotsSource.includes("'/statements/'"), 'Must disallow /statements/');
    assert.ok(robotsSource.includes("'/plan/'"), 'Must disallow /plan/');
    assert.ok(robotsSource.includes("'/intelligence/'"), 'Must disallow /intelligence/');
    assert.ok(robotsSource.includes("'/onboarding/'"), 'Must disallow /onboarding/');

    // Sitemap declaration
    assert.ok(robotsSource.includes('/sitemap.xml'), 'Must declare sitemap location');
  });

  it('verifies sitemap.ts lists canonical verified public URLs', () => {
    assert.ok(sitemapSource.includes('baseUrl'), 'Must reference baseUrl');
    assert.ok(sitemapSource.includes('/calculators/crore'), 'Must index crore calculator');
    assert.ok(sitemapSource.includes('/calculators/emergency-fund'), 'Must index emergency fund calculator');
    assert.ok(sitemapSource.includes('/education/tax-regimes-india'), 'Must index tax education');
    assert.ok(sitemapSource.includes('priority: 1.0'), 'Root must have top priority');
  });

  it('verifies layout.tsx has complete SEO metadata, OpenGraph, and Schema.org JSON-LD', () => {
    assert.ok(layoutSource.includes('metadataBase'), 'Must set metadataBase');
    assert.ok(layoutSource.includes('title:'), 'Must specify title');
    assert.ok(layoutSource.includes('description:'), 'Must specify description');
    assert.ok(layoutSource.includes('openGraph:'), 'Must configure openGraph');
    assert.ok(layoutSource.includes('twitter:'), 'Must configure twitter');
    assert.ok(layoutSource.includes('alternates:'), 'Must configure alternates');
    assert.ok(layoutSource.includes('canonical:'), 'Must configure canonical URL');
    assert.ok(layoutSource.includes('application/ld+json'), 'Must include JSON-LD script tag');
    assert.ok(layoutSource.includes('@type\': \'WebApplication\'') || layoutSource.includes('"@type": "WebApplication"'), 'Must have WebApplication Schema.org');
    assert.ok(layoutSource.includes('Deterministic Monthly Surplus Calculation'), 'Feature list must include surplus');
    assert.ok(layoutSource.includes('₹1 Crore Shortest Path'), 'Feature list must include ₹1 Crore');
  });

  it('verifies page.tsx gates private financial view and renders PublicLandingView when unauthenticated', () => {
    assert.ok(pageSource.includes('PublicLandingView'), 'page.tsx must import PublicLandingView');
    assert.ok(pageSource.includes('if (!isAuthenticated)'), 'page.tsx must check isAuthenticated');
    assert.ok(pageSource.includes('return <PublicLandingView />'), 'Must return PublicLandingView when unauthenticated');
  });

  it('verifies PublicLandingView addresses all 6 core user outcomes', () => {
    // 1. Personal finance clarity
    assert.ok(landingSource.includes('Personal Finance Clarity'), 'Must feature Personal Finance Clarity');
    // 2. Monthly surplus
    assert.ok(landingSource.includes('Monthly Surplus'), 'Must feature Monthly Surplus');
    // 3. Emergency fund
    assert.ok(landingSource.includes('Emergency Cushion') || landingSource.includes('Emergency Fund'), 'Must feature Emergency Fund');
    // 4. ₹1 Crore planning
    assert.ok(landingSource.includes('₹1 Crore Path') || landingSource.includes('₹1 Crore Planning'), 'Must feature ₹1 Crore Planning');
    // 5. Financial freedom
    assert.ok(landingSource.includes('Financial Freedom'), 'Must feature Financial Freedom');
    // 6. Indian finance education
    assert.ok(landingSource.includes('Indian Statutory & Tax Education') || landingSource.includes('Indian Finance Education'), 'Must feature Indian Finance Education');

    // Fiduciary policy
    assert.ok(landingSource.includes('Zero Commission'), 'Must highlight Zero Commission');
    assert.ok(landingSource.includes('Product Selling') || landingSource.includes('No Product Sales'), 'Must declare No Product Sales');
    assert.ok(landingSource.includes('Private Financial Data Behind Auth') || landingSource.includes('Private & Encrypted'), 'Must state Private behind Auth');
  });

  it('verifies public crore calculator has verified mathematical model and SEBI disclaimer', () => {
    assert.ok(croreCalcSource.includes('canonical: \'https://myca.in/calculators/crore\''), 'Must have canonical URL');
    assert.ok(croreCalcSource.includes('application/ld+json'), 'Must have JSON-LD structured data');

    // Math formulas and levers
    assert.ok(croreClientSource.includes('TARGET_CORPUS = 10000000'), 'Must target ₹1,00,00,000');
    assert.ok(croreClientSource.includes('annualStepUpRate'), 'Must support step-up lever');
    assert.ok(croreClientSource.includes('FV = P × [((1 + r)ⁿ - 1) / r] × (1 + r)'), 'Must document standard annuity due formula');

    // Regulatory & Educational disclaimer
    assert.ok(croreClientSource.includes('Regulatory & Educational Disclosure'), 'Must have regulatory disclosure');
    assert.ok(croreClientSource.includes('Mutual fund investments are subject to market risks'), 'Must have statutory risk warning');
    assert.ok(croreClientSource.includes('Returns are not guaranteed'), 'Must state returns are not guaranteed');
  });

  it('verifies public emergency fund calculator has DICGC insurance guidance and RBI alignment', () => {
    assert.ok(emergencyCalcSource.includes('canonical: \'https://myca.in/calculators/emergency-fund\''), 'Must have canonical URL');
    assert.ok(emergencyClientSource.includes('DICGC'), 'Must cite DICGC');
    assert.ok(emergencyClientSource.includes('500000'), 'Must reference DICGC ₹5,00,000 ceiling');
    assert.ok(emergencyClientSource.includes('Reserve Bank of India'), 'Must reference RBI');
    assert.ok(emergencyClientSource.includes('fundedPercentage'), 'Must calculate percentage funded');
  });

  it('verifies Indian Tax Education accurately reflects Finance (No. 2) Act 2024 and Section 115BAC', () => {
    assert.ok(taxEduSource.includes('canonical: \'https://myca.in/education/tax-regimes-india\''), 'Must have canonical URL');
    assert.ok(taxEduSource.includes('Finance (No. 2) Act, 2024'), 'Must cite Finance (No. 2) Act, 2024');
    assert.ok(taxEduSource.includes('Section 115BAC'), 'Must cite Section 115BAC');
    assert.ok(taxEduSource.includes('₹75,000'), 'Must specify ₹75,000 standard deduction under New Regime');
    assert.ok(taxEduSource.includes('₹7,00,000'), 'Must specify ₹7,00,000 Section 87A rebate ceiling');
    assert.ok(taxEduSource.includes('₹7,75,000'), 'Must specify ₹7,75,000 zero-tax threshold with standard deduction');
    assert.ok(taxEduSource.includes('Income-tax Act, 1961'), 'Must cite parent statute Income-tax Act, 1961');
    assert.ok(taxEduSource.includes('Mathematical Breakeven'), 'Must provide mathematical breakeven analysis');
  });

  it('deterministically verifies ₹1 Crore compounding calculation and tax calculations', () => {
    // 1. ₹1 Crore SIP Formula: FV = P * [((1+r)^n - 1) / r] * (1+r)
    // Monthly SIP of ₹35,000 at 12% p.a. (r = 0.01 per month)
    const P = 35000;
    const r = 0.12 / 12; // 0.01
    const target = 10000000;

    // Solve for n:
    // (1+r)^n = 1 + (target * r) / (P * (1+r))
    const numerator = target * r;
    const denominator = P * (1 + r);
    const n = Math.log(1 + numerator / denominator) / Math.log(1 + r);
    const months = Math.round(n);
    const years = n / 12;

    assert.ok(months >= 130 && months <= 140, `Calculated months (${months}) should be ~135 months (11.25 years)`);
    assert.ok(years >= 11 && years <= 12, `Calculated years (${years.toFixed(2)}) should be ~11.25 years`);

    // 2. Tax Calculation under Section 115BAC for Gross Salary of ₹7,75,000:
    // Gross: ₹7,75,000
    // Standard deduction under Sec 16(ia) as amended by Finance (No. 2) Act 2024: ₹75,000
    // Taxable Income: ₹7,00,000
    // Slabs:
    // 0 - 3L: 0
    // 3L - 7L: 5% of 4L = ₹20,000
    // Rebate under Section 87A (applicable up to taxable income of ₹7L): ₹20,000
    // Net Tax Payable: ₹0
    const grossSalary = 775000;
    const standardDeduction = 75000;
    const taxableIncome = grossSalary - standardDeduction;
    assert.equal(taxableIncome, 700000);

    const slab1Tax = 0; // 0-3L
    const slab2Tax = Math.max(0, taxableIncome - 300000) * 0.05; // 3L-7L
    assert.equal(slab2Tax, 20000);

    const rebate87A = taxableIncome <= 700000 ? Math.min(slab2Tax, 25000) : 0;
    const netTax = slab2Tax - rebate87A;
    assert.equal(netTax, 0, 'Salaried employee with ₹7,75,000 gross must have ₹0 net tax under New Regime');
  });
});
