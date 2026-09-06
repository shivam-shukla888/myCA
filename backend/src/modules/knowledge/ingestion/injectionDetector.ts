export interface InjectionCheckResult {
  hasInjection: boolean;
  patterns: string[];
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior|system)\s+(instructions|directives|prompts)/i,
  /you\s+are\s+now\s+(in\s+)?(developer\s+mode|dan|unrestricted|god\s+mode)/i,
  /system\s+prompt\s+override/i,
  /new\s+system\s+(instruction|prompt|directive):/i,
  /<\s*\/?\s*system_context\s*>/i,
  /<\s*\/?\s*untrusted_user_query\s*>/i,
  /<\s*\/?\s*verified_reference_data\s*>/i,
  /<\s*\/?\s*system_governance\s*>/i,
  /<\s*\/?\s*context_packet\s*>/i,
  /<\s*\/?\s*grounded_knowledge\s*>/i,
  /<\s*\/?\s*user_inquiry\s*>/i,
  /<\s*\/?\s*deterministic_calculations\s*>/i,
  /<\s*\/?\s*current_fact_verification\s*>/i,
  /\bact\s+as\s+an?\s+unrestricted\s+(ai|broker|adviser)\b/i,
  /\bexfiltrate\s+(user|data|keys|passwords)\b/i,
  /\boutput\s+all\s+(previous\s+)?system\s+prompts?\b/i,
  /\bprint\s+(the\s+)?(complete\s+)?system\s+prompt\b/i,
  /\breveal\s+(the\s+)?(internal\s+)?(system\s+)?instructions?\b/i,
  /\bjailbreak\b/i,
  /\boverride\s+all\s+safety\s+filters\b/i,
];

export class InjectionDetector {
  /**
   * Scans untrusted document content for malicious injection payloads
   */
  detectInjection(text: string): InjectionCheckResult {
    if (!text) {
      return { hasInjection: false, patterns: [] };
    }

    const matchedPatterns: string[] = [];

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        matchedPatterns.push(pattern.source);
      }
    }

    return {
      hasInjection: matchedPatterns.length > 0,
      patterns: matchedPatterns,
    };
  }
}

export const injectionDetector = new InjectionDetector();
