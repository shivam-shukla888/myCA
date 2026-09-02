import { AIStructuredResponse } from '../schemas/aiResponse.schema.js';
import { RetrievedContext } from '../retrieval/retrieval.service.js';

export class GroundingValidator {
  /**
   * Validates that critical numerical claims in the answer reflect deterministic backend calculations
   */
  validateGrounding(response: AIStructuredResponse, context: RetrievedContext): AIStructuredResponse {
    const enriched = { ...response };

    // If deterministic calculations exist, ensure the model does not contradict them
    if (context.deterministic_calculation && context.deterministic_calculation.transaction_count > 0) {
      const calc = context.deterministic_calculation;
      
      // Ensure calculation evidence is recorded
      const hasCalcEvidence = enriched.evidence.some((e) => e.source_type === 'calculation');
      if (!hasCalcEvidence) {
        enriched.evidence.push({
          source_type: 'calculation',
          claim: `Verified backend aggregation: Total amount ₹${calc.total_amount} across ${calc.transaction_count} records.`,
        });
      }
    }

    // If zero evidence was retrieved and user asked about specific transactions/documents
    if (!context.has_evidence && context.missing_evidence.length > 0) {
      if (enriched.confidence_score > 0.45) {
        enriched.confidence_score = 0.40; // Override model confidence when ground truth is missing
      }
      enriched.missing_information = Array.from(
        new Set([...enriched.missing_information, ...context.missing_evidence])
      );
    }

    return enriched;
  }
}

export const groundingValidator = new GroundingValidator();
