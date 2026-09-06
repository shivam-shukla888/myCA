import { Request, Response, NextFunction } from 'express';
import { redactSensitiveData } from './logger.js';

/**
 * SecurityGuard – sanitizes untrusted input for AI/RAG pipelines.
 * Treats all external content (user prompts, retrieved docs, summaries) as untrusted.
 * Ensures they cannot modify system instructions, security rules, auth config, etc.
 */
export function securityGuard(req: Request, res: Response, next: NextFunction) {
  // Only process JSON bodies that may contain AI input.
  if (req.body && typeof req.body === 'object') {
    // Deep redact any potential secrets in the payload.
    const redacted = redactSensitiveData(req.body);
    // Ensure no fields that could override system instructions are present.
    const forbidden = ['system_prompt', 'security_rules', 'authorization', 'rls', 'financial_policy', 'provider_config'];
    for (const key of forbidden) {
      if (key in redacted) {
        delete (redacted as any)[key];
      }
    }
    // Replace request body with the sanitized version.
    req.body = redacted;
  }
  next();
}
