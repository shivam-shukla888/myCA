import { AIStructuredResponse } from '../schemas/aiResponse.schema.js';
import { RetrievedContext } from '../retrieval/retrieval.service.js';

export class ConfidenceEngine {
  /**
   * Calculates application-level confidence score overriding ungrounded model outputs
   */
  assessConfidence(response: AIStructuredResponse, context: RetrievedContext): number {
    let score = response.confidence_score;

    // Rule 1: Missing evidence or missing financial profile drastically penalizes confidence
    if (
      !context.has_evidence &&
      (response.intent === 'TRANSACTION_ANALYSIS' ||
        response.intent === 'DOCUMENT_ANALYSIS' ||
        response.intent === 'PERSONAL_FINANCE')
    ) {
      score = Math.min(score, 0.35);
    }

    // Rule 2: Unresolved missing information reduces score
    if (response.missing_information && response.missing_information.length > 0) {
      score = Math.min(score, 0.60);
    }

    // Rule 3: High-risk, critical, or unknown-risk questions require verified domain grounding
    if (
      (response.risk_level === 'HIGH' ||
        response.risk_level === 'CRITICAL' ||
        response.risk_level === 'UNKNOWN') &&
      response.evidence.length === 0
    ) {
      score = Math.min(score, 0.40);
    }

    // Rule 4: If answering personal finance with fully grounded deterministic context and no missing data
    if (
      response.intent === 'PERSONAL_FINANCE' &&
      context.deterministic_financial_context?.has_monthly_data &&
      context.deterministic_financial_context?.has_financial_profile &&
      (!response.missing_information || response.missing_information.length === 0)
    ) {
      // High confidence for grounded, verified numbers
      score = Math.max(score, 0.92);
    }

    // Keep strictly within bounds [0.0, 1.0]
    return Math.round(Math.max(0, Math.min(1, score)) * 100) / 100;
  }
}

export const confidenceEngine = new ConfidenceEngine();
