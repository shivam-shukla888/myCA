import { IntentCategory, RiskLevel } from '../schemas/aiResponse.schema.js';

export interface ClassificationResult {
  intent: IntentCategory;
  risk_level: RiskLevel;
  is_personalized_advice_request: boolean;
  is_statutory_filing_request: boolean;
  reasons: string[];
}

// Regex patterns for deterministic risk detection
const STOCK_BUY_SELL_PATTERNS = [
  /\b(should\s+i|shall\s+i)\s+(buy|sell|invest\s+in)\s+[A-Za-z0-9]+/i,
  /\b(tell\s+me\s+to|recommend\s+(me\s+to)?|advise\s+(me\s+to)?)\s+(buy|sell|invest\s+in)\b/i,
  /\bwhich\s+(stock|share|crypto|token)\s+(should|to)\s+(i|we)\s+(buy|purchase)/i,
  /\b(tell\s+me|give\s+me)\s+(where|how)\s+to\s+invest\s+(₹|rs\.?|inr)?\s*[\d,]+/i,
  /\bwhich\s+mutual\s+fund\s+(should\s+i\s+buy|is\s+best\s+for\s+me)/i,
  /\b(target\s+price|multibagger|stock\s+tip|buy\s+call)\b/i,
  /\b(buy|sell)\s+[A-Za-z0-9]+\s+(stock|share|equity|token)\b/i,
  /\b(act\s+as\s+an?\s+unrestricted\s+broker)\b/i,
];

const FILING_EXECUTION_PATTERNS = [
  /\bfile\s+(my|our)?\s*(itr|income\s*tax\s*return|taxes)\b/i,
  /\bsubmit\s+(my|our)?\s*(gst|gstr|itr|return)\b/i,
  /\bpay\s+(my|our)?\s*(tax|taxes|advance\s+tax)\s+for\s+me\b/i,
];

const TAX_PATTERNS = [
  /\b(tax|income\s*tax|80c|80d|80g|hra|capital\s*gains|tds|tcs|new\s*tax\s*regime|old\s*tax\s*regime|itr|deduction|deductions|exemption)\b/i,
];

const GST_PATTERNS = [
  /\b(gst|gstr|input\s*tax\s*credit|itc|cgst|sgst|igst|hsn|sac|e-way|reverse\s*charge)\b/i,
];

const TRANSACTION_PATTERNS = [
  /\b(transaction|transactions|spend|spent|expense|expenses|how\s+much\s+did\s+i|total\s+for|merchant|bank\s+statement)\b/i,
];

const INVESTMENT_EDU_PATTERNS = [
  /\b(what\s+is|explain|concept\s+of|difference\s+between|how\s+does)\s+(mutual\s+fund|sip|equity|debt|index\s+fund|etf|elss|gold\s+etf|asset\s+allocation|diversification)\b/i,
  /\b(difference\s+between\s+equity\s+and\s+debt)\b/i,
];

export function classifyIntent(query: string): ClassificationResult {
  const normalized = query.trim();
  const reasons: string[] = [];

  // 1. Deterministic High-Risk Checks: Personalized stock/mutual fund buy/sell requests
  for (const pattern of STOCK_BUY_SELL_PATTERNS) {
    if (pattern.test(normalized)) {
      reasons.push('Matches personalized securities/stock buy/sell request pattern');
      return {
        intent: 'UNSUPPORTED_HIGH_RISK',
        risk_level: 'CRITICAL',
        is_personalized_advice_request: true,
        is_statutory_filing_request: false,
        reasons,
      };
    }
  }

  // 2. Deterministic High-Risk Checks: Automated statutory filing requests
  for (const pattern of FILING_EXECUTION_PATTERNS) {
    if (pattern.test(normalized)) {
      reasons.push('Matches automated tax/GST filing execution request');
      return {
        intent: 'UNSUPPORTED_HIGH_RISK',
        risk_level: 'HIGH',
        is_personalized_advice_request: false,
        is_statutory_filing_request: true,
        reasons,
      };
    }
  }

  // 3. Investment Education (Safe general educational queries)
  for (const pattern of INVESTMENT_EDU_PATTERNS) {
    if (pattern.test(normalized)) {
      reasons.push('General investment concept or educational question');
      return {
        intent: 'INVESTMENT_EDUCATION',
        risk_level: 'LOW',
        is_personalized_advice_request: false,
        is_statutory_filing_request: false,
        reasons,
      };
    }
  }

  // 4. Tax Queries
  for (const pattern of TAX_PATTERNS) {
    if (pattern.test(normalized)) {
      reasons.push('Indian Income Tax law or deduction query');
      return {
        intent: 'TAX_QUERY',
        risk_level: 'MEDIUM',
        is_personalized_advice_request: false,
        is_statutory_filing_request: false,
        reasons,
      };
    }
  }

  // 5. GST Queries
  for (const pattern of GST_PATTERNS) {
    if (pattern.test(normalized)) {
      reasons.push('Indian Goods and Services Tax query');
      return {
        intent: 'GST_QUERY',
        risk_level: 'MEDIUM',
        is_personalized_advice_request: false,
        is_statutory_filing_request: false,
        reasons,
      };
    }
  }

  // 6. Transaction Analysis queries
  for (const pattern of TRANSACTION_PATTERNS) {
    if (pattern.test(normalized)) {
      reasons.push('Query requests transaction or expenditure analysis');
      return {
        intent: 'TRANSACTION_ANALYSIS',
        risk_level: 'LOW',
        is_personalized_advice_request: false,
        is_statutory_filing_request: false,
        reasons,
      };
    }
  }

  // Fallback
  return {
    intent: 'GENERAL_FINANCE',
    risk_level: 'LOW',
    is_personalized_advice_request: false,
    is_statutory_filing_request: false,
    reasons: ['General personal finance query'],
  };
}
