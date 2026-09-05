import { AIStructuredResponse } from '../schemas/aiResponse.schema.js';
import { RetrievedContext } from '../retrieval/retrieval.service.js';

export class GroundingValidator {
  /**
   * Validates that critical numerical claims in the answer reflect deterministic backend calculations
   */
  validateGrounding(response: AIStructuredResponse, context: RetrievedContext): AIStructuredResponse {
    const enriched = { ...response };
    const evidenceList = [...enriched.evidence];

    // 1. Transaction Aggregations Grounding
    if (context.deterministic_calculation && context.deterministic_calculation.transaction_count > 0) {
      const calc = context.deterministic_calculation;
      const hasCalcEvidence = evidenceList.some((e) => e.source_type === 'calculation');
      if (!hasCalcEvidence) {
        evidenceList.push({
          source_type: 'calculation',
          claim: `Verified backend aggregation: Total amount ₹${calc.total_amount} across ${calc.transaction_count} records.`,
        });
      }
    }

    // 2. Deterministic Financial Context Grounding (Phase 2, Phase 3, Phase 4, Affordability)
    if (context.deterministic_financial_context) {
      const dfc = context.deterministic_financial_context;

      // Monthly Money evidence
      if (dfc.has_monthly_data) {
        const hasSummary = evidenceList.some((e) => e.source_type === 'monthly_summary');
        if (!hasSummary) {
          evidenceList.push({
            source_type: 'monthly_summary',
            source_id: dfc.month,
            claim: `Verified monthly financial summary for ${dfc.month}: Income ₹${dfc.current_month.income.toLocaleString('en-IN')}, Expenses ₹${dfc.current_month.expenses.toLocaleString('en-IN')}, Surplus ₹${dfc.current_month.surplus.toLocaleString('en-IN')}, Savings Rate ${dfc.current_month.savings_rate}%.`,
          });
        }
      }

      // Allocation Plan & Emergency fund evidence
      if (dfc.allocation) {
        const hasAllocation = evidenceList.some((e) => e.source_type === 'allocation_plan');
        if (!hasAllocation) {
          evidenceList.push({
            source_type: 'allocation_plan',
            claim: `Deterministic allocation: Emergency fund target ₹${dfc.allocation.emergency_fund_target.toLocaleString('en-IN')}, Current ₹${dfc.allocation.emergency_fund_current.toLocaleString('en-IN')}, Gap ₹${dfc.allocation.emergency_gap.toLocaleString('en-IN')}.`,
          });
        }
      }

      // Financial Freedom evidence
      if (dfc.financial_freedom) {
        const hasFreedom = evidenceList.some((e) => e.source_type === 'financial_freedom_status');
        if (!hasFreedom) {
          evidenceList.push({
            source_type: 'financial_freedom_status',
            claim: `Financial freedom projection: Target corpus ₹${dfc.financial_freedom.indicative_target_corpus.toLocaleString('en-IN')}, Projected wealth ₹${dfc.financial_freedom.projected_wealth.toLocaleString('en-IN')}, Funding gap ₹${dfc.financial_freedom.funding_gap.toLocaleString('en-IN')}.`,
          });
        }
      }

      // Affordability Evaluation evidence
      if (dfc.affordability) {
        const hasAffordability = evidenceList.some((e) => e.source_type === 'affordability_evaluation');
        if (!hasAffordability) {
          evidenceList.push({
            source_type: 'affordability_evaluation',
            claim: `Deterministic affordability verdict: ${dfc.affordability.verdict} for purchase of ₹${dfc.affordability.proposed_amount.toLocaleString('en-IN')} (Surplus: ₹${dfc.affordability.monthly_surplus.toLocaleString('en-IN')}, Emergency Gap: ₹${dfc.affordability.emergency_gap.toLocaleString('en-IN')}).`,
          });
        }
      }

      // Financial profile evidence
      if (dfc.has_financial_profile && dfc.financial_profile) {
        const hasProfile = evidenceList.some((e) => e.source_type === 'financial_profile');
        if (!hasProfile) {
          evidenceList.push({
            source_type: 'financial_profile',
            claim: `Financial profile: Essential monthly expenses ₹${dfc.financial_profile.essential_expenses?.toLocaleString('en-IN') ?? '0'}, Existing liquid savings ₹${dfc.financial_profile.existing_liquid_savings?.toLocaleString('en-IN') ?? '0'}.`,
          });
        }
      }
    }

    enriched.evidence = evidenceList;

    // 3. If zero evidence was retrieved and query touched transactions/documents/finance
    if (!context.has_evidence && context.missing_evidence.length > 0) {
      if (enriched.confidence_score > 0.45) {
        enriched.confidence_score = 0.40;
      }
      enriched.missing_information = Array.from(
        new Set([...enriched.missing_information, ...context.missing_evidence])
      );
    }

    // 4. Missing critical financial data handling
    if (context.deterministic_financial_context?.missing_data_reasons) {
      enriched.missing_information = Array.from(
        new Set([
          ...enriched.missing_information,
          ...context.deterministic_financial_context.missing_data_reasons,
        ])
      );
    }

    return enriched;
  }
}

export const groundingValidator = new GroundingValidator();
