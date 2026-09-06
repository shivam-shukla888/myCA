import { AIStructuredResponse } from '../schemas/aiResponse.schema.js';
import { RetrievedContext } from '../retrieval/retrieval.service.js';

export interface ConfidenceDimensions {
  knowledge_confidence: number;
  data_confidence: number;
  calculation_confidence: number;
  current_fact_verified: boolean;
  answer_validation_status: 'PASS' | 'REGENERATE' | 'SAFE_FAILURE';
  overall_confidence: number;
  primary_limiting_factor: string;
}

export interface ConfidenceOptions {
  query?: string;
  isCurrentFactRequired?: boolean;
  currentFactVerified?: boolean;
  retrievedChunksCount?: number;
  topAuthorityLevel?: number;
  hasVerifiedRegulatoryEvidence?: boolean;
  validatorStatus?: 'PASS' | 'REGENERATE' | 'SAFE_FAILURE';
}

export class ConfidenceEngine {
  /**
   * Calculates multi-dimensional confidence across independent dimensions:
   * 1. Data Confidence (User financial context completeness)
   * 2. Calculation Confidence (Deterministic arithmetic validity)
   * 3. Knowledge / Grounding Confidence (Retrieved source authority & count)
   * 4. Current-Fact Verification Status (Statutory verification)
   * 5. Answer Validation Status (Post-generation verification)
   *
   * The overall confidence strictly respects the weakest critical dependency.
   */
  assessConfidenceDetailed(
    response: AIStructuredResponse,
    context: RetrievedContext,
    options: ConfidenceOptions = {}
  ): ConfidenceDimensions {
    const isCurrentFactRequired = Boolean(options.isCurrentFactRequired);
    const currentFactVerified = Boolean(options.currentFactVerified);
    const chunksCount = options.retrievedChunksCount ?? 0;
    const topAuthority = options.topAuthorityLevel ?? 6;
    const validatorStatus = options.validatorStatus || 'PASS';

    // -------------------------------------------------------------------------
    // 1. DATA CONFIDENCE (User transaction / profile completeness)
    // -------------------------------------------------------------------------
    let dataConfidence = 0.95;
    if (!context.deterministic_financial_context?.has_monthly_data) {
      dataConfidence = 0.60;
    }
    if (!context.deterministic_financial_context?.has_financial_profile) {
      dataConfidence = Math.min(dataConfidence, 0.50);
    }
    if (context.missing_evidence && context.missing_evidence.length > 0) {
      dataConfidence = Math.min(dataConfidence, 0.40);
    }

    // -------------------------------------------------------------------------
    // 2. CALCULATION CONFIDENCE (Deterministic math correctness)
    // -------------------------------------------------------------------------
    let calculationConfidence = 0.98;
    if (!context.deterministic_financial_context) {
      calculationConfidence = 0.50;
    }
    // If response indicates uncalculated assumptions or missing numbers
    if (response.missing_information && response.missing_information.some((m) => m.toLowerCase().includes('calculation') || m.toLowerCase().includes('data'))) {
      calculationConfidence = 0.60;
    }

    // -------------------------------------------------------------------------
    // 3. KNOWLEDGE / FACTUAL GROUNDING CONFIDENCE
    // -------------------------------------------------------------------------
    let knowledgeConfidence = 0.10; // Default when zero chunks exist
    if (chunksCount > 0) {
      if (topAuthority === 1) {
        knowledgeConfidence = 0.95; // Tier 1 Official Regulatory
      } else if (topAuthority === 2) {
        knowledgeConfidence = 0.90; // Tier 2 Institutional / Gov
      } else if (topAuthority === 3) {
        knowledgeConfidence = 0.85; // Tier 3 Authoritative Financial Education
      } else if (topAuthority === 4) {
        knowledgeConfidence = 0.80; // Tier 4 Curated Educational Summaries
      } else {
        knowledgeConfidence = 0.65; // Tier 5/6 Media / Other
      }
    } else {
      // Zero retrieved chunks: factual confidence is strictly low
      knowledgeConfidence = 0.10;
    }

    // -------------------------------------------------------------------------
    // 4. DETERMINE QUERY NATURE & LIMITING DEPENDENCY
    // -------------------------------------------------------------------------
    const isPureMathOrPersonalCashflow =
      (response.intent === 'TRANSACTION_ANALYSIS' || response.intent === 'PERSONAL_FINANCE') &&
      !isCurrentFactRequired &&
      chunksCount === 0 &&
      !this.queryRequiresExternalKnowledge(options.query || '');

    let overallConfidence: number;
    let primaryLimitingFactor: string;

    if (isCurrentFactRequired) {
      // Current regulatory questions: STRICT dependency on current regulatory verification
      if (!currentFactVerified) {
        overallConfidence = Math.min(0.35, knowledgeConfidence);
        primaryLimitingFactor = 'Unverified current statutory regulation or missing Tier 1 authority source.';
      } else {
        overallConfidence = Math.min(knowledgeConfidence, 0.95);
        primaryLimitingFactor = 'Verified current regulatory source.';
      }
    } else if (context.missing_evidence && context.missing_evidence.length > 0) {
      overallConfidence = Math.min(dataConfidence, calculationConfidence, knowledgeConfidence);
      primaryLimitingFactor = 'Missing user financial records or statement evidence.';
    } else if (this.queryRequiresExternalKnowledge(options.query || '') || response.intent === 'TAX_QUERY' || response.intent === 'INVESTMENT_EDUCATION' || response.intent === 'GENERAL_FINANCE') {
      // Factual / educational / tax question: STRICT dependency on knowledge grounding
      if (chunksCount === 0) {
        overallConfidence = 0.15;
        primaryLimitingFactor = 'Zero verified knowledge chunks retrieved for external factual inquiry.';
      } else {
        overallConfidence = knowledgeConfidence;
        primaryLimitingFactor = 'Knowledge source authority tier and retrieval coverage.';
      }
    } else if (isPureMathOrPersonalCashflow) {
      // Pure personal cashflow / calculation: depends on user transactions & calculation
      overallConfidence = Math.min(dataConfidence, calculationConfidence);
      primaryLimitingFactor = 'User transaction records and deterministic calculation.';
    } else {
      // Hybrid personal finance + external concepts
      overallConfidence = Math.min(dataConfidence, calculationConfidence, knowledgeConfidence);
      primaryLimitingFactor = 'Weakest link between user data and factual grounding.';
    }

    // Penalize if validator required regeneration or failed
    if (validatorStatus === 'REGENERATE') {
      overallConfidence = Math.min(overallConfidence, 0.40);
      primaryLimitingFactor = 'Grounding validator detected unverified claims or calculation mismatch.';
    } else if (validatorStatus === 'SAFE_FAILURE') {
      overallConfidence = 0.05;
      primaryLimitingFactor = 'Validator safe failure triggered.';
    }

    // High risk penalty if evidence is missing
    if ((response.risk_level === 'HIGH' || response.risk_level === 'CRITICAL') && chunksCount === 0 && !isPureMathOrPersonalCashflow) {
      overallConfidence = Math.min(overallConfidence, 0.30);
    }

    const roundedOverall = Math.round(Math.max(0.01, Math.min(1.0, overallConfidence)) * 100) / 100;

    return {
      knowledge_confidence: Math.round(knowledgeConfidence * 100) / 100,
      data_confidence: Math.round(dataConfidence * 100) / 100,
      calculation_confidence: Math.round(calculationConfidence * 100) / 100,
      current_fact_verified: currentFactVerified,
      answer_validation_status: validatorStatus,
      overall_confidence: roundedOverall,
      primary_limiting_factor: primaryLimitingFactor,
    };
  }

  /**
   * Backward-compatible wrapper returning the single overall confidence score [0.0 - 1.0]
   */
  assessConfidence(
    response: AIStructuredResponse,
    context: RetrievedContext,
    options: ConfidenceOptions = {}
  ): number {
    const detailed = this.assessConfidenceDetailed(response, context, options);
    return detailed.overall_confidence;
  }

  private queryRequiresExternalKnowledge(query: string): boolean {
    return /\b(tax|rebate|slab|deduction|80c|80d|87a|sebi|rbi|dicgc|fire|4%\s*rule|inflation|market|mutual\s*fund|equity|debt|rule|law|supreme\s*court|circular|regulation|scheme)\b/i.test(
      query
    );
  }
}

export const confidenceEngine = new ConfidenceEngine();
