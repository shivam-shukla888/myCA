import { IntentCategory, AIStructuredResponse } from '../schemas/aiResponse.schema.js';
import { ClassificationResult } from './intentClassifier.js';

export const DISCLAIMERS = {
  TAX: 'DISCLAIMER: This guidance is provided for educational and analytical purposes under the Indian Income Tax Act 1961. It does not constitute statutory certification or a formal tax audit. Consult a qualified Chartered Accountant for definitive filing decisions.',
  GST: 'DISCLAIMER: GST provisions and Input Tax Credit rules are subject to CBIC notifications. Reconcile transactions with GSTR-2B before claiming credits.',
  INVESTMENT_EDU: 'DISCLAIMER: Educational information only. The platform is NOT a SEBI-registered Investment Adviser or Research Analyst. Do not treat this as personalized securities recommendations.',
  UNSUPPORTED: 'DISCLAIMER: Personalized stock tips, specific securities recommendations, and automated statutory return submissions are strictly prohibited by platform policy.',
};

export class SafetyPolicyEngine {
  /**
   * Evaluates deterministic policy violations before invoking the model
   */
  evaluatePreGenerationPolicy(classification: ClassificationResult): AIStructuredResponse | null {
    if (classification.is_personalized_advice_request) {
      return {
        answer:
          'I cannot recommend buying, selling, or investing in specific stocks, mutual funds, or securities. Personal AI CA is an educational and analytical financial assistant and is NOT a SEBI-registered Investment Adviser. I can, however, explain asset allocation strategies, risk tolerance concepts, or the tax implications of different investment categories under Indian tax law.',
        intent: 'UNSUPPORTED_HIGH_RISK',
        risk_level: 'CRITICAL',
        confidence_score: 1.0, // High confidence in the policy enforcement
        evidence: [],
        missing_information: [],
        disclaimer_required: true,
        disclaimer: DISCLAIMERS.INVESTMENT_EDU,
        human_review_required: true,
        refusal_or_limitation:
          'Personalized investment recommendation refused in compliance with SEBI regulatory boundaries.',
      };
    }

    if (classification.is_statutory_filing_request) {
      return {
        answer:
          'I cannot directly file your Income Tax Return (ITR) or submit your GST returns to the government portal. Direct statutory filing requires formal authorization and physical/digital verification through an authorized Chartered Accountant or the official ITD e-filing portal. I can help organize your deductions, calculate tax liability estimates, and summarize your transactions for your CA.',
        intent: 'UNSUPPORTED_HIGH_RISK',
        risk_level: 'HIGH',
        confidence_score: 1.0,
        evidence: [],
        missing_information: [],
        disclaimer_required: true,
        disclaimer: DISCLAIMERS.TAX,
        human_review_required: true,
        refusal_or_limitation:
          'Automated return filing refused. Statutory returns must be submitted through authorized government channels.',
      };
    }

    return null;
  }

  /**
   * Deterministically applies mandatory disclaimers based on intent
   */
  getMandatoryDisclaimer(intent: IntentCategory): { required: boolean; text: string } {
    switch (intent) {
      case 'TAX_QUERY':
        return { required: true, text: DISCLAIMERS.TAX };
      case 'GST_QUERY':
        return { required: true, text: DISCLAIMERS.GST };
      case 'INVESTMENT_EDUCATION':
        return { required: true, text: DISCLAIMERS.INVESTMENT_EDU };
      case 'UNSUPPORTED_HIGH_RISK':
        return { required: true, text: DISCLAIMERS.UNSUPPORTED };
      default:
        return { required: false, text: '' };
    }
  }
}

export const safetyPolicyEngine = new SafetyPolicyEngine();
