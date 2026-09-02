import { AIStructuredResponse } from '../schemas/aiResponse.schema.js';
import { RetrievedContext } from '../retrieval/retrieval.service.js';

export class ConfidenceEngine {
  /**
   * Calculates application-level confidence score overriding ungrounded model outputs
   */
  assessConfidence(response: AIStructuredResponse, context: RetrievedContext): number {
    let score = response.confidence_score;

    // Rule 1: Missing evidence drastically penalizes confidence
    if (!context.has_evidence && (response.intent === 'TRANSACTION_ANALYSIS' || response.intent === 'DOCUMENT_ANALYSIS')) {
      score = Math.min(score, 0.35);
    }

    // Rule 2: Unresolved missing information reduces score
    if (response.missing_information && response.missing_information.length > 0) {
      score = Math.min(score, 0.65);
    }

    // Rule 3: High-risk or complex tax questions require verified domain grounding
    if (response.risk_level === 'HIGH' && response.evidence.length === 0) {
      score = Math.min(score, 0.50);
    }

    // Keep within bounds [0.0, 1.0]
    return Math.round(Math.max(0, Math.min(1, score)) * 100) / 100;
  }
}

export const confidenceEngine = new ConfidenceEngine();
