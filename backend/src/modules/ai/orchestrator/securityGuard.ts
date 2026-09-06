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

export class SecurityGuard {
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
