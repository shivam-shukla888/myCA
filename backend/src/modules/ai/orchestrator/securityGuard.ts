/**
 * Security Guard for AI Knowledge & RAG Orchestration
 * Enforces zero-trust boundaries across prompts, retrieved chunks, and generated outputs.
 */

const PROMPT_EXTRACTION_PATTERNS = [
  /\b(print|show|display|reveal|output|tell\s*me|what\s*(is|are)|repeat|dump|leak|disclose|give\s*me|share)\b.*?\b(system\s*prompt|system\s*instructions?|developer\s*(prompt|instructions?|mode\s*rules?)|governance\s*rules?|initial\s*instructions?|prompt\s*templates?|hidden\s*(instructions?|rules?))\b/i,
  /\b(repeat|print|output|display|show)\b.*?\b(everything|all\s*text)\b.*?\b(before|prior\s*to)\b/i,
  /\bwhat\s*(were\s*you\s*told|are\s*your\s*(exact|internal)?\s*instructions)\b/i,
  /\bignore\s*(all\s*)?previous\s*instructions\s*and\s*(print|tell|output|reveal|show)\b/i,
  /\bdisclose\s*(your\s*)?(internal\s*)?(prompt|rules|guidelines|governance|instructions)\b/i,
  /\b(reveal|show|print|tell)\s*(your\s*)?(hidden|developer|system)\s*(instructions?|rules?|prompts?)\b/i,
];

const INDIRECT_INJECTION_PATTERNS = [
  /\b(system\s*override|system\s*directive|admin\s*override|developer\s*mode|new\s*instructions)\s*:/i,
  /\bignore\s*(all\s*)?(previous|prior)\s*instructions\b/i,
  /\byou\s*must\s*now\s*act\s*as\s*(an?\s*)?(unrestricted|jailbroken|godmode)\b/i,
  /\bdisregard\s*(all\s*)?(system|safety|governance|sebi)\s*(rules|guidelines|policies)\b/i,
  /\bthis\s*overrides\s*all\s*previous\s*directives\b/i,
];

const SECRET_PATTERNS = [
  // Groq API Keys (gsk_...)
  /gsk_[a-zA-Z0-9]{20,}/g,
  // Google Gemini API Keys (AIza...)
  /AIza[0-9A-Za-z-_]{35}/g,
  // OpenAI API Keys (sk-...)
  /sk-[a-zA-Z0-9]{20,}/g,
  // Anthropic API Keys (sk-ant-...)
  /sk-ant-[a-zA-Z0-9-_]{20,}/g,
  // Supabase service-role JWTs or general JWTs
  /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
  // Bearer tokens in text
  /Bearer\s+[a-zA-Z0-9._-]{20,}/gi,
  // Database connection strings containing passwords
  /postgresql:\/\/[^:]+:[^@]+@[^/]+\/[^?\s]+/gi,
];

export type AdversarialCategory =
  | 'ALTER_SURPLUS'
  | 'INVENT_TRANSACTIONS'
  | 'GUARANTEED_RETURNS'
  | 'STOCK_RECOMMENDATION'
  | 'BYPASS_SAFETY';

export interface AdversarialCheckResult {
  isAdversarial: boolean;
  category?: AdversarialCategory;
  reason?: string;
  refusalAnswer?: string;
}

const ALTER_SURPLUS_PATTERNS = [
  /\b(ignore|change|set|override|alter|update|assume|force|replace|modify|manipulate)\b.*?\b(surplus|savings\s*rate|income|expenses|database\s*values?|balance)\b/i,
  /\b(my\s+surplus\s+is\s+actually|surplus\s+ko\s+\d+|surplus\s+badha\s*kar|let\s*surplus\s*be)\b/i,
  /\b(surplus\s+is\s+now|man\s*lo\s*ki\s*surplus|suppose\s+my\s+surplus\s+is)\b/i,
  /\b(disregard\s+(the\s+)?(real\s+)?surplus)\b/i,
  /\b(alter|change|fake|increase|decrease)\s+(my\s+)?surplus\b/i,
];

const INVENT_TRANSACTION_PATTERNS = [
  /\b(add|record|invent|create|fabricate|insert|assume|simulate)\b.*?\b(fake\s*transactions?|fictitious|transactions?\s*of|spend\s*of\s*₹?[\d,]+|yesterday\s*i\s*spent|unrecorded\s*spend|unreal\s*transactions?)\b/i,
  /\b(invent|fabricate|simulate|create\s+fake)\s+(a\s+)?transactions?\b/i,
  /\b(record\s+(a\s+)?fictional\s+expenses?)\b/i,
  /\b(add\s+an?\s+(unreal|imaginary|fake|fictional)\s+transactions?)\b/i,
  /\b(add\s+an\s+expense\s+of\s+₹?[\d,]+)\b/i,
];

const GUARANTEED_RETURN_PATTERNS = [
  /\b(guarantee|guaranteed|promise|risk-free|100%\s*safe\s*returns?)\b.*?\b(returns?|profit|gain|doubling)\b/i,
  /\b(give\s+me|tell\s+me|show\s+me|recommend)\b.*?\b(guaranteed\s+(returns?|profit|scheme)|risk-free\s+high\s+returns?)\b/i,
  /\b(which\s+scheme\s+guarantees|scheme\s+jo\s+double\s+kare)\b/i,
  /\bguaranteed\s+returns?\b/i,
  /\bforce\s+guaranteed\s+returns?\b/i,
];

const STOCK_RECOMMENDATION_PATTERNS = [
  /\b(which|what)\b.*?\b(stocks?|shares?|mutual\s*funds?|funds?|crypto|tokens?|coins?)\b.*?\b(should\s+i|to|can\s+i)\s+(buy|sell|pick|invest)\b/i,
  /\b(buy|sell)\s+(tata\s*motors|reliance|hdfc|infy|btc|eth|sol|nifty|[a-zA-Z0-9_-]+\s+stocks?)\b/i,
  /\b(tell\s+me\s+to\s+buy|recommend\s+(to\s+)?buy|tell\s+me\s+which\s+stock)\b/i,
  /\b(recommend|give\s+me|tell\s+me)\s+(a\s+)?(stocks?|shares?|mutual\s*funds?|funds?|crypto|multibagger|hot\s+stocks?)\s+(to\s+buy|tip|picks?)\b/i,
  /\b(kal\s+kaunsa\s+stock\s+kharidu|share\s+market\s+me\s+kaunsa\s+share)\b/i,
  /\b(stock|share|equity|mutual\s*fund)\s+recommendations?\b/i,
  /\brecommend\s+(me\s+)?(some\s+)?(stocks?|funds?)\b/i,
  /\b(multibaggers?|stock\s*tips?)\b/i,
];

const BYPASS_SAFETY_PATTERNS = [
  /\b(ignore|bypass|disregard|override|disable)\b.*?\b(safety\s*rules?|guidelines?|system\s*instructions?|sebi\s*rules?|restrictions?|guardrails?|policies)\b/i,
  /\b(jailbreak|dan\s*mode|unrestricted\s*(financial\s*)?(planner|advisor|broker))\b/i,
  /\b(act\s+as\s+an?\s+unrestricted\s+financial\s+advisor)\b/i,
  /\bbypass\s+safety\b/i,
];

export class SecurityGuard {
  /**
   * Detects adversarial prompts attempting to alter surplus, invent transactions,
   * force guaranteed returns, force stock recommendations, or bypass safety rules.
   */
  detectAdversarialAttempt(query: string): AdversarialCheckResult {
    const normalized = query.trim();

    // 1. Attempts to alter financial numbers / surplus
    for (const pattern of ALTER_SURPLUS_PATTERNS) {
      if (pattern.test(normalized)) {
        return {
          isAdversarial: true,
          category: 'ALTER_SURPLUS',
          reason: 'Attempt to manually alter deterministic surplus or verified financial values.',
          refusalAnswer:
            'Financial numbers such as monthly surplus, savings rate, and expenses cannot be altered or overridden through conversational prompts. All figures are strictly calculated from your verified ledger and profile baseline.',
        };
      }
    }

    // 2. Attempts to invent or inject unverified transactions
    for (const pattern of INVENT_TRANSACTION_PATTERNS) {
      if (pattern.test(normalized)) {
        return {
          isAdversarial: true,
          category: 'INVENT_TRANSACTIONS',
          reason: 'Attempt to fabricate transactions via chat prompt.',
          refusalAnswer:
            'Transactions cannot be invented, assumed, or created through conversational chat prompts. All transactions must be recorded via the ledger or uploaded through verified bank statements.',
        };
      }
    }

    // 3. Attempts to force guaranteed returns
    for (const pattern of GUARANTEED_RETURN_PATTERNS) {
      if (pattern.test(normalized)) {
        return {
          isAdversarial: true,
          category: 'GUARANTEED_RETURNS',
          reason: 'Attempt to force guaranteed returns or promise risk-free market returns.',
          refusalAnswer:
            'There are no guaranteed returns in market-linked investments or equities. Under SEBI regulations, promising or projecting guaranteed returns on securities is strictly prohibited. All market investments carry financial risk.',
        };
      }
    }

    // 4. Attempts to force specific stock recommendations
    for (const pattern of STOCK_RECOMMENDATION_PATTERNS) {
      if (pattern.test(normalized)) {
        return {
          isAdversarial: true,
          category: 'STOCK_RECOMMENDATION',
          reason: 'Attempt to elicit personalized buy/sell stock recommendations.',
          refusalAnswer:
            'I cannot recommend buying, selling, or investing in specific stocks. We cannot recommend buying, selling, or trading specific stocks, mutual funds, or securities. Personal AI CA is an educational and analytical financial assistant, not a SEBI-registered Investment Adviser.',
        };
      }
    }

    // 5. Attempts to bypass safety rules or jailbreak
    for (const pattern of BYPASS_SAFETY_PATTERNS) {
      if (pattern.test(normalized)) {
        return {
          isAdversarial: true,
          category: 'BYPASS_SAFETY',
          reason: 'Attempt to bypass safety rules or system governance directives.',
          refusalAnswer:
            'Platform safety rules, regulatory boundaries, and system governance cannot be bypassed or disabled. I operate strictly within authorized personal finance and Indian regulatory guidelines.',
        };
      }
    }

    return { isAdversarial: false };
  }

  /**
   * Detects attempts to extract the system prompt, instructions, or governance rules.
   */
  detectPromptExtraction(query: string): { isExtraction: boolean; reason?: string } {
    const normalized = query.trim();
    for (const pattern of PROMPT_EXTRACTION_PATTERNS) {
      if (pattern.test(normalized)) {
        return {
          isExtraction: true,
          reason: 'Matches system prompt extraction pattern',
        };
      }
    }
    return { isExtraction: false };
  }

  /**
   * Scans text (e.g. ingested knowledge, retrieved chunks) for indirect prompt injection.
   */
  detectIndirectInjection(content: string): { hasInjection: boolean; reason?: string } {
    for (const pattern of INDIRECT_INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        return {
          hasInjection: true,
          reason: 'Contains unauthorized system directive or jailbreak override attempt',
        };
      }
    }
    return { hasInjection: false };
  }

  /**
   * Scans output text for any accidental secrets, API keys, JWTs, or passwords.
   * Redacts any detected secrets immediately.
   */
  scanAndSanitizeOutput(text: string): { sanitized: string; redactedCount: number; violations: string[] } {
    let sanitized = text;
    let redactedCount = 0;
    const violations: string[] = [];

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(sanitized)) {
        redactedCount++;
        violations.push(pattern.source);
        sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]');
      }
    }

    return {
      sanitized,
      redactedCount,
      violations,
    };
  }

  /**
   * Safe canned refusal response for prompt extraction attempts
   */
  getExtractionRefusalAnswer(): string {
    return 'I am an AI financial assistant focused on personal finance education, financial planning, and analytical cashflow reviews. I do not disclose internal system prompts, architectural directives, or governance configurations.';
  }
}

export const securityGuard = new SecurityGuard();
