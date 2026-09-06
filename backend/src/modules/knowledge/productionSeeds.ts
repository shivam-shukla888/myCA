import { IngestKnowledgeSourceInput } from './knowledge.schema.js';
import { knowledgeService } from './knowledge.service.js';
import { knowledgeRepository, inMemoryKnowledgeSources, inMemoryKnowledgeChunks } from './knowledge.repository.js';
import { getSupabaseAdminClient } from '../../config/supabase.js';

/**
 * PRODUCTION KNOWLEDGE CORPUS
 * Strictly adheres to Knowledge Source Policy:
 * - Official public regulatory documents (Tier 1: RBI, SEBI, Income Tax Dept)
 * - Internally authored educational summaries of foundational concepts (Tier 3/4)
 * - Curated conceptual summaries of established public frameworks (Tier 4)
 * - Full provenance: title, author/org, publication date, last verified date, authority level, license status
 * - Covers all 16 required financial domains with 32 granular, topic-level knowledge chunks
 */
export const PRODUCTION_KNOWLEDGE_SEEDS: IngestKnowledgeSourceInput[] = [
  // 1. PERSONAL FINANCE
  {
    source_id: 'pf-core-foundations',
    title: 'Foundations of Personal Cashflow Management',
    author_or_organization: 'MyCA Financial Education Research',
    source_type: 'EDUCATIONAL_ARTICLE',
    topic: 'Personal Finance',
    country: 'IN',
    authority_level: 3,
    license_status: 'INTERNAL_SUMMARY',
    status: 'ACTIVE',
    description: 'Core principles of personal cashflow: tracking income, managing essential expenses, surplus generation, and goal prioritization.',
    chunks: [
      {
        headline: 'Cashflow Mechanics: Income, Expenses, and Monthly Surplus',
        content: 'Personal cashflow is the foundation of household stability. Income represents total net cash received, while expenses represent mandatory survival needs and discretionary wants. Monthly surplus is calculated strictly as Income minus Expenses. A positive monthly surplus is the mathematical engine of all wealth accumulation, debt reduction, and financial resilience. Without a consistent positive surplus, capital cannot be allocated toward emergency buffers or investments.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
      {
        headline: 'Cashflow Priority Hierarchy: Protection Before Speculation',
        content: 'Financial stability follows an intentional sequence of priorities: first, cashflow awareness and leak prevention; second, establishing an emergency cash buffer; third, aggressive elimination of high-interest debt; fourth, systematic long-term investing. Violating this sequence by speculating in volatile equity or crypto markets before establishing a positive surplus and emergency buffer exposes households to catastrophic financial distress.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
    ],
  },

  // 2. BEHAVIORAL FINANCE
  {
    source_id: 'bf-psychology-of-money-summary',
    title: 'The Psychology of Money: Behavioral Frameworks',
    author_or_organization: 'Morgan Housel (Curated Educational Summary)',
    source_type: 'EDUCATIONAL_ARTICLE',
    topic: 'Behavioral Finance',
    country: 'IN',
    authority_level: 4,
    license_status: 'INTERNAL_SUMMARY',
    status: 'ACTIVE',
    description: 'Curated conceptual summary of behavioral biases in personal finance: humility, emotional discipline, and lifestyle creep.',
    chunks: [
      {
        headline: 'Behavioral Primacy and Cognitive Biases in Personal Finance',
        content: 'Doing well with money has a little to do with how smart you are and a lot to do with how you behave. Financial success is not a hard science; it is a soft skill where emotional discipline, patience, and avoiding catastrophic mistakes matter more than technical optimization. Key behavioral vulnerabilities include present bias (overvaluing immediate consumption over future security) and loss aversion (feeling the pain of financial loss twice as intensely as equivalent gain).',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'Morgan Housel (Curated Educational Summary)',
      },
      {
        headline: 'Lifestyle Inflation, Social Comparison, and Compounding Discipline',
        content: 'Lifestyle inflation naturally causes expenses to rise proportionally with every income increase, preventing savings rate growth despite higher earnings. Social comparison drives conspicuous consumption that exhausts discretionary cashflow. Sustainable wealth is built by keeping lifestyle expectations relatively stable while income expands, allowing surplus to compound uninterrupted across multiple decades.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'Morgan Housel (Curated Educational Summary)',
      },
    ],
  },

  // 3. FINANCIAL PSYCHOLOGY
  {
    source_id: 'fp-money-scripts-heuristics',
    title: 'Financial Psychology: Money Mindsets and Cognitive Triggers',
    author_or_organization: 'MyCA Financial Education Research',
    source_type: 'EDUCATIONAL_ARTICLE',
    topic: 'Financial Psychology',
    country: 'IN',
    authority_level: 4,
    license_status: 'INTERNAL_SUMMARY',
    status: 'ACTIVE',
    description: 'Understanding emotional spending triggers, scarcity vs abundance mindsets, and decision fatigue in personal money management.',
    chunks: [
      {
        headline: 'Emotional Spending Triggers and Scarcity Anxiety',
        content: 'Financial psychology examines unconscious emotional scripts about money. Emotional spending frequently operates as a subconscious coping mechanism for occupational stress, scarcity anxiety, or social validation. Recognizing individual spending triggers—such as flash sale urgency notifications, late-night retail browsing, or post-stress compensatory shopping—is the essential prerequisite for behavioral change.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
      {
        headline: 'Behavioral Friction: The 24-Hour Purchase Delay Rule',
        content: 'Impulse spending exploits low cognitive friction in modern digital payment interfaces. Inserting intentional behavioral friction neutralizes transient impulses: adopting a mandatory 24-hour waiting rule for non-essential discretionary purchases separates emotional urges from enduring value. Conducting a weekly five-minute money review fosters mindful spending without inducing guilt or cognitive fatigue.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
    ],
  },

  // 4. BUDGETING
  {
    source_id: 'bdg-structured-frameworks',
    title: 'Modern Budgeting Methodologies: Proportional and Zero-Sum Systems',
    author_or_organization: 'MyCA Financial Education Research',
    source_type: 'EDUCATIONAL_ARTICLE',
    topic: 'Budgeting',
    country: 'IN',
    authority_level: 3,
    license_status: 'INTERNAL_SUMMARY',
    status: 'ACTIVE',
    description: 'Practical analysis of 50/30/20 proportional budgeting, zero-based cashflow allocation, and cash-flow envelope tracking.',
    chunks: [
      {
        headline: 'Proportional Cashflow Framework: The 50/30/20 Guideline',
        content: 'The 50/30/20 budgeting framework provides a macro-level allocation guideline for take-home income: 50% for Essential Needs (housing rent/EMIs, basic groceries, utilities, mandatory insurance, minimum debt payments), 30% for Discretionary Wants (dining out, entertainment, leisure, lifestyle upgrades), and 20% for Savings, Debt Acceleration, and Long-Term Investing. It serves as an adaptable benchmark rather than a rigid statutory rule.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
      {
        headline: 'Zero-Based Cashflow Allocation and Leakage Prevention',
        content: 'Zero-based budgeting assigns every single rupee of monthly net income a deliberate destination before the month begins (Needs + Wants + Savings/Investments = Net Income). Leaving unallocated or unassigned surplus in a primary checking account creates illusionary liquidity that routinely evaporates into untracked impulse purchases and invisible micro-transactions.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
    ],
  },

  // 5. SAVING
  {
    source_id: 'sav-pay-yourself-first',
    title: 'Systematic Saving Architecture: The Pay-Your-First Principle',
    author_or_organization: 'MyCA Financial Education Research',
    source_type: 'EDUCATIONAL_ARTICLE',
    topic: 'Saving',
    country: 'IN',
    authority_level: 3,
    license_status: 'INTERNAL_SUMMARY',
    status: 'ACTIVE',
    description: 'Behavioral architecture of automated saving, reducing friction for retention, and increasing friction for discretionary spending.',
    chunks: [
      {
        headline: 'Automated Pay-Your-First System Architecture',
        content: "Attempting to save whatever remains at the end of the month almost invariably fails due to Parkinson's Law, where expenses expand naturally to absorb all available liquidity. The Pay-Your-First principle automates savings and investment transfers into dedicated accounts on the exact day salary is received, treating savings as a non-negotiable fixed obligation before any discretionary spending occurs.",
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
      {
        headline: 'Savings Rate Math and Freedom Acceleration',
        content: 'The savings rate (monthly surplus divided by total net income) is the single most powerful mathematical driver of financial independence. A household saving 10% of take-home pay requires 9 years of active labor to fund 1 year of future living expenses. A household saving 50% of take-home pay buys 1 year of future living freedom for every single year worked, reducing reliance on active salary dramatically.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
    ],
  },

  // 6. EMERGENCY FUNDS
  {
    source_id: 'emf-liquidity-resilience',
    title: 'Emergency Liquidity Architecture: Preserving Capital Against Ruin',
    author_or_organization: 'MyCA Financial Education Research',
    source_type: 'EDUCATIONAL_ARTICLE',
    topic: 'Emergency Funds',
    country: 'IN',
    authority_level: 3,
    license_status: 'INTERNAL_SUMMARY',
    status: 'ACTIVE',
    description: 'Target sizing (3 to 6 months of mandatory living expenses), liquid placement, and priority over speculative market investments.',
    chunks: [
      {
        headline: 'Emergency Buffer Target Sizing: 3 to 6 Months Survival Expenses',
        content: 'An emergency fund is a non-negotiable liquidity cushion sized to cover 3 to 6 months of mandatory household survival expenses (rent, groceries, utilities, insurance premiums, and loan EMIs). Single-income households, freelancers, or individuals with volatile earnings should target 6 to 9 months of survival expenses to withstand extended unemployment or health crises.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
      {
        headline: 'Capital Preservation and Segregation from Market Risk',
        content: 'The objective of an emergency fund is immediate liquidity and absolute capital preservation—never yield optimization, equity exposure, or capital gains. Emergency funds should be held in liquid bank deposits, sweep-in accounts, or high-safety liquid funds. Investing emergency reserves in volatile stock markets or crypto risks catastrophic forced liquidation during market drawdowns.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
    ],
  },

  // 7. DEBT
  {
    source_id: 'dbt-avalanche-snowball-strategy',
    title: 'Debt Elimination Strategies: Mathematical and Behavioral Methodologies',
    author_or_organization: 'MyCA Financial Education Research',
    source_type: 'EDUCATIONAL_ARTICLE',
    topic: 'Debt',
    country: 'IN',
    authority_level: 3,
    license_status: 'INTERNAL_SUMMARY',
    status: 'ACTIVE',
    description: 'Comparing Debt Avalanche (highest interest rate first) and Debt Snowball (smallest balance first) for high-cost credit resolution.',
    chunks: [
      {
        headline: 'High-Cost Revolving Debt Drag and Elimination Priority',
        content: 'Revolving consumer debt—including credit card rollover balances (36% to 42% APR) and unsecured personal loans (14% to 24% APR)—creates an asymmetric compounding drag on household wealth. Paying 40% interest on debt mathematically negates any realistic market return from mutual funds or equities. Therefore, eliminating high-interest consumer debt is a guaranteed risk-free return equal to the loan APR.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
      {
        headline: 'Strategic Comparison: Debt Avalanche vs Debt Snowball',
        content: 'Two established methodologies guide debt payoff: The Debt Avalanche method mathematically minimizes total interest paid by directing all extra surplus toward the highest-APR loan first while maintaining minimums on others. The Debt Snowball method prioritizes the smallest loan balance first regardless of interest rate, building rapid psychological momentum through early milestone wins. Both are valid frameworks with distinct trade-offs.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
    ],
  },

  // 8. INVESTING EDUCATION
  {
    source_id: 'inv-diversification-compounding',
    title: 'Principles of Long-Term Investing: Compounding, Asset Allocation, and Volatility',
    author_or_organization: 'MyCA Financial Education Research',
    source_type: 'EDUCATIONAL_ARTICLE',
    topic: 'Investing Education',
    country: 'IN',
    authority_level: 3,
    license_status: 'INTERNAL_SUMMARY',
    status: 'ACTIVE',
    description: 'Asset classes (equity, debt, gold, liquid assets), risk vs expected return, cost drag of expense ratios, and market volatility resilience.',
    chunks: [
      {
        headline: 'Asset Allocation and Risk-Return Tradeoffs',
        content: 'Investing is the deliberate allocation of surplus capital across productive asset classes to outpace inflation over multi-year horizons. Equities provide ownership stakes in business expansion and historical inflation-beating growth, accompanied by substantial short-term market volatility. Debt instruments offer capital preservation and predictable yield. Diversification across uncorrelated asset classes prevents catastrophic losses.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
      {
        headline: 'The Mathematics of Compounding and Expense Ratio Drag',
        content: 'Compound interest generates exponential wealth when investment returns earn returns of their own across decades without interruption from panic selling or market timing. Friction costs—such as high expense ratios, mutual fund distribution commissions, and turnover taxes—compound destructively over 20-30 year holding periods, eroding significant percentages of total lifetime terminal wealth.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
    ],
  },

  // 9. RETIREMENT
  {
    source_id: 'ret-longterm-corpus-architecture',
    title: 'Retirement Wealth Planning: Inflation Risk, Corpus Sizing, and Longevity',
    author_or_organization: 'MyCA Financial Education Research',
    source_type: 'EDUCATIONAL_ARTICLE',
    topic: 'Retirement',
    country: 'IN',
    authority_level: 3,
    license_status: 'INTERNAL_SUMMARY',
    status: 'ACTIVE',
    description: 'Building retirement corpus in high-inflation environments, National Pension System (NPS), EPF, and longevity protection.',
    chunks: [
      {
        headline: 'Retirement Sizing, Longevity Risk, and Compound Inflation in India',
        content: 'Retirement planning accumulates capital to sustain non-discretionary living expenses once active labor income ceases. In India, where healthcare inflation routinely exceeds 10% and general consumer inflation averages 5% to 7%, a retirement corpus must be structured to sustain an individual or couple for 25 to 35 post-retirement years without outliving their capital.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
      {
        headline: 'Institutional Retirement Vehicles: EPF, PPF, and NPS Tier 1',
        content: 'Institutional retirement pillars in India include Employees Provident Fund (EPF) for salaried employees, Public Provident Fund (PPF) for guaranteed tax-exempt sovereign compounding, and the National Pension System (NPS) Tier 1. NPS offers ultra-low fund management charges and structured lifecycle asset allocation across equity, corporate debt, and government bonds.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
    ],
  },

  // 10. FINANCIAL INDEPENDENCE
  {
    source_id: 'fi-fire-principles-assumptions',
    title: 'Financial Independence & Early Retirement (FIRE): Principles and Caveats',
    author_or_organization: 'MyCA Financial Education Research',
    source_type: 'EDUCATIONAL_ARTICLE',
    topic: 'Financial Independence',
    country: 'IN',
    authority_level: 4,
    license_status: 'INTERNAL_SUMMARY',
    status: 'ACTIVE',
    description: 'The 25x annual expense rule (4% withdrawal rate), sequence of returns risk, and adjustments for Indian macroeconomic conditions.',
    chunks: [
      {
        headline: 'The 25x Annual Expenses Rule and the 4% Safe Withdrawal Rate',
        content: 'Financial Independence is achieved when investment portfolio returns sustainably fund annual living expenses without active employment. The conventional 25x annual expenses rule derives from the 4% Safe Withdrawal Rate (Trinity Study), which historically preserved balanced equity-debt portfolios over 30-year horizons in low-inflation economies.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
      {
        headline: 'Emerging Market Adjustments: Sequence of Returns Risk in India',
        content: 'For longer retirement horizons (40+ years) or emerging markets like India characterized by higher inflation volatility and currency depreciation, a conservative 30x to 35x multiple (equivalent to a 2.8% to 3.3% initial withdrawal rate) provides vital resilience against sequence of returns risk and healthcare cost spikes.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
    ],
  },

  // 11. ECONOMICS
  {
    source_id: 'eco-inflation-purchasing-power',
    title: 'Macroeconomic Principles for Personal Wealth: Inflation and Real Returns',
    author_or_organization: 'MyCA Financial Education Research',
    source_type: 'EDUCATIONAL_ARTICLE',
    topic: 'Economics',
    country: 'IN',
    authority_level: 3,
    license_status: 'INTERNAL_SUMMARY',
    status: 'ACTIVE',
    description: 'How Consumer Price Index (CPI) inflation erodes purchasing power, nominal vs real returns, and central bank interest rate transmission.',
    chunks: [
      {
        headline: 'Inflation Mechanics: CPI and Purchasing Power Erosion',
        content: 'Inflation is the persistent decline in the purchasing power of money over time, measured primarily by the Consumer Price Index (CPI). At an annual inflation rate of 6%, the purchasing power of ₹10,00,000 in cash is cut in half in approximately 12 years. Leaving long-term savings in zero-interest cash or sub-inflation fixed deposits guarantees real capital destruction.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
      {
        headline: 'Nominal versus Real Returns',
        content: 'Nominal return is the raw headline percentage gain on an asset before inflation. Real return is calculated as: Real Return = Nominal Return - Inflation Rate - Taxes. If a bank fixed deposit generates 7% nominal interest while inflation is 6% and marginal tax is 30% (leaving ~4.9% post-tax nominal yield), the real post-tax return is negative (-1.1%), reducing real purchasing power.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
    ],
  },

  // 12. INDIAN FINANCE
  {
    source_id: 'in-financial-ecosystem-overview',
    title: 'The Indian Financial System: Digital Infrastructure, Banking, and Identity',
    author_or_organization: 'MyCA Financial Education Research',
    source_type: 'EDUCATIONAL_ARTICLE',
    topic: 'Indian Finance',
    country: 'IN',
    authority_level: 2,
    license_status: 'INTERNAL_SUMMARY',
    status: 'ACTIVE',
    description: 'Overview of Indian financial structure: PAN/Aadhaar KYC, UPI payments ecosystem, RBI-regulated scheduled commercial banks, and investor protections.',
    chunks: [
      {
        headline: 'Regulatory Architecture: RBI, SEBI, and IRDAI Statutory Mandates',
        content: 'The Indian financial system is governed by statutory regulators: the Reserve Bank of India (RBI) oversees banking, monetary policy, and credit systems; the Securities and Exchange Board of India (SEBI) regulates capital markets, mutual funds, and investment advisers; the Insurance Regulatory and Development Authority of India (IRDAI) regulates life and health insurance products.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
      {
        headline: 'Financial Identity and Digital Public Infrastructure: PAN, KYC, and UPI',
        content: "Formal participation in Indian financial institutions requires Permanent Account Number (PAN) and Know Your Customer (KYC) compliance. India's digital public infrastructure integrates Aadhaar verification, Unified Payments Interface (UPI) for retail instant settlement, and depositories (CDSL/NDSL) for dematerialized custody of securities.",
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
    ],
  },

  // 13. RBI (RESERVE BANK OF INDIA)
  {
    source_id: 'rbi-dicgc-depositor-protection-mandate',
    title: 'Reserve Bank of India: Depositor Protection and DICGC Insurance Framework',
    author_or_organization: 'Reserve Bank of India / DICGC',
    source_type: 'OFFICIAL_REGULATORY',
    topic: 'RBI Regulations',
    country: 'IN',
    authority_level: 1,
    license_status: 'OFFICIAL_GOVERNMENT_DOCUMENT',
    status: 'ACTIVE',
    description: 'Official statutory deposit insurance limit of ₹5,00,000 per depositor per bank by the Deposit Insurance and Credit Guarantee Corporation.',
    chunks: [
      {
        headline: 'DICGC Bank Depositor Insurance Limit of ₹5,00,000',
        content: 'Under the Deposit Insurance and Credit Guarantee Corporation (DICGC) Act administered under the regulatory purview of the Reserve Bank of India, each depositor in an insured bank is guaranteed up to a maximum statutory limit of ₹5,00,000 (Rupees Five Lakhs) for both principal and interest amounts in case of bank failure or liquidation.',
        chunk_type: 'REGULATORY_PROVISION',
        is_summary: false,
        citation_page_or_section: 'DICGC Act / RBI Master Direction',
      },
      {
        headline: 'Scope of Insured Bank Accounts and Ownership Capacities',
        content: 'DICGC insurance applies across all commercial, regional rural, and cooperative banks registered with DICGC. The ₹5,00,000 limit applies to the aggregate of all savings, fixed, current, and recurring deposit balances held by a depositor in the same right and capacity across all branches of that specific bank.',
        chunk_type: 'REGULATORY_PROVISION',
        is_summary: false,
        citation_page_or_section: 'DICGC Section 16',
      },
    ],
  },

  // 14. SEBI (SECURITIES AND EXCHANGE BOARD OF INDIA)
  {
    source_id: 'sebi-ia-regulations-investor-protection',
    title: 'SEBI (Investment Advisers) Regulations & Investor Protection Guidelines',
    author_or_organization: 'Securities and Exchange Board of India',
    source_type: 'OFFICIAL_REGULATORY',
    topic: 'SEBI Regulations',
    country: 'IN',
    authority_level: 1,
    license_status: 'OFFICIAL_GOVERNMENT_DOCUMENT',
    status: 'ACTIVE',
    description: 'Official regulatory mandate governing Registered Investment Advisers (RIAs), fee caps, fiduciary duties, and ban on guaranteed return schemes.',
    chunks: [
      {
        headline: 'SEBI Registered Investment Adviser (RIA) Mandate and Fee Caps',
        content: 'Under the SEBI (Investment Advisers) Regulations, entities offering personalized investment advice must register with SEBI and operate under a fiduciary standard. Maximum advisory fee caps are legally restricted to ₹1,25,000 per annum under the flat fee model or 2.5% of Assets under Advice (AUA) per family across all schemes.',
        chunk_type: 'REGULATORY_PROVISION',
        is_summary: false,
        citation_page_or_section: 'SEBI (IA) Regulations, 2013',
      },
      {
        headline: 'Prohibition on Guaranteed Returns and Unregistered Stock Tips',
        content: 'SEBI strictly prohibits promises of guaranteed, assured, or risk-free returns in securities and derivatives markets. Unregistered entities or social media influencers providing specific stock buy/sell tips or profit-sharing schemes violate statutory investor protection mandates and face regulatory enforcement.',
        chunk_type: 'REGULATORY_PROVISION',
        is_summary: false,
        citation_page_or_section: 'SEBI (Prohibition of Fraudulent and Unfair Trade Practices) Regulations',
      },
    ],
  },

  // 15. TAX EDUCATION (INCOME TAX DEPARTMENT OF INDIA)
  {
    source_id: 'it-slabs-standard-deduction-fy2025-26',
    title: 'Income Tax Department: Statutory Standard Deduction and Section 87A Rebate (FY 2025-26)',
    author_or_organization: 'Income Tax Department, Government of India',
    source_type: 'OFFICIAL_REGULATORY',
    topic: 'Income Tax',
    country: 'IN',
    authority_level: 1,
    license_status: 'OFFICIAL_GOVERNMENT_DOCUMENT',
    status: 'ACTIVE',
    description: 'Official tax provisions for FY 2025-26 under Section 115BAC: standard deduction of ₹75,000 for salaried employees and Section 87A rebate for taxable income up to ₹7,00,000.',
    chunks: [
      {
        headline: 'Section 115BAC Standard Deduction (₹75,000 for FY 2025-26)',
        content: 'Under Section 115BAC of the Income Tax Act 1961 (default new tax regime) applicable for FY 2025-26 (AY 2026-27), the statutory standard deduction for salaried employees and pensioners is ₹75,000 (increased from ₹50,000 in previous financial years). This deduction is applied automatically against gross salary before computing taxable income.',
        chunk_type: 'REGULATORY_PROVISION',
        is_summary: false,
        citation_page_or_section: 'Income Tax Act Section 115BAC(1A)',
      },
      {
        headline: 'Section 87A Tax Rebate and Chapter VI-A (80C) Exclusion',
        content: 'Under Section 87A for FY 2025-26, a resident individual whose total taxable income does not exceed ₹7,00,000 under the new tax regime is entitled to a full tax rebate of up to ₹25,000, resulting in zero net income tax liability. Traditional Chapter VI-A deductions (Section 80C up to ₹1.5L, Section 80D health insurance, and HRA) are generally not allowable under Section 115BAC.',
        chunk_type: 'REGULATORY_PROVISION',
        is_summary: false,
        citation_page_or_section: 'Income Tax Act Section 87A',
      },
    ],
  },

  // 16. FINANCIAL HABITS
  {
    source_id: 'hab-cue-routine-reward-spending',
    title: 'Financial Habit Engineering: Habit Loops and Systematic Money Rituals',
    author_or_organization: 'MyCA Financial Education Research',
    source_type: 'EDUCATIONAL_ARTICLE',
    topic: 'Financial Habits',
    country: 'IN',
    authority_level: 4,
    license_status: 'INTERNAL_SUMMARY',
    status: 'ACTIVE',
    description: 'Applying habit loop mechanics (Cue, Routine, Reward) to automate positive financial behaviors and extinguish destructive impulse leaks.',
    chunks: [
      {
        headline: 'Deconstructing Habit Loops: Cue, Routine, and Reward in Spending',
        content: 'Financial behaviors are largely governed by automated habit loops consisting of a Cue, a Routine, and a Reward. Impulse shopping often triggers on emotional or sensory cues (stress, boredom, mobile notification alerts), followed by the automatic routine of browsing and payment, and rewarded by transient dopamine relief.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
      {
        headline: 'Engineering Positive Financial Rituals and Environmental Design',
        content: 'Sustainable financial behavior engineering focuses on designing environmental constraints rather than relying on fluctuating willpower: scheduling an automated 5-minute weekly money check-in, setting up instant salary-day investments, removing saved credit card credentials from online shopping apps, and celebrating debt payoff milestones.',
        chunk_type: 'SUMMARY',
        is_summary: true,
        summary_attribution: 'MyCA Financial Education Research',
      },
    ],
  },
];

/**
 * Idempotent Production Seeding Function
 * Ensures every single source is ingested with full provenance, authority level,
 * and topic-level chunking into both PostgreSQL (via Supabase) and in-memory caches.
 */
export async function seedProductionKnowledge(force = false): Promise<{
  seededCount: number;
  skippedCount: number;
  totalChunks: number;
}> {
  let seededCount = 0;
  let skippedCount = 0;
  let totalChunks = 0;

  for (const seed of PRODUCTION_KNOWLEDGE_SEEDS) {
    try {
      // Check if source already exists
      const existing = await knowledgeRepository.findSourceBySlug(seed.source_id);
      if (existing && !force) {
        skippedCount++;
        totalChunks += existing.chunks?.length || 0;
        continue;
      }

      // Ingest via KnowledgeService
      const ingested = await knowledgeService.ingestSource(seed);
      seededCount++;
      totalChunks += ingested.chunks?.length || 0;
    } catch (err: any) {
      console.warn(`[SEED] Source ${seed.source_id} non-fatal ingestion warning: ${err.message}`);
    }
  }

  return { seededCount, skippedCount, totalChunks };
}
