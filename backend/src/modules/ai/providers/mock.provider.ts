import { AIProvider, GenerateOptions } from './aiProvider.interface.js';
import { AIStructuredResponse } from '../schemas/aiResponse.schema.js';
import { AppError } from '../../../middleware/errorHandler.js';

export class MockAIProvider implements AIProvider {
  private customHandler?: (prompt: string) => AIStructuredResponse;
  private simulateFailure = false;
  private simulateMalformedJson = false;

  setCustomHandler(handler: (prompt: string) => AIStructuredResponse) {
    this.customHandler = handler;
  }

  setSimulateFailure(fail: boolean) {
    this.simulateFailure = fail;
  }

  setSimulateMalformedJson(malformed: boolean) {
    this.simulateMalformedJson = malformed;
  }

  getModelName(): string {
    return 'mock-ai-provider-test';
  }

  isAvailable(): boolean {
    return true;
  }

  async generateStructuredResponse(
    prompt: string,
    options?: GenerateOptions
  ): Promise<AIStructuredResponse> {
    if (this.simulateFailure) {
      throw new AppError('Simulated Gemini API service unavailable', 503, 'GEMINI_API_FAILURE');
    }

    if (this.simulateMalformedJson) {
      throw new AppError('Gemini output violated required structured schema', 502, 'GEMINI_SCHEMA_VALIDATION_FAILED');
    }

    if (this.customHandler) {
      return this.customHandler(prompt);
    }

    const lower = prompt.toLowerCase();

    // 1. Investment Education
    if (lower.includes('mutual fund') || lower.includes('equity') || lower.includes('debt') || lower.includes('asset allocation')) {
      return {
        answer: 'Equity mutual funds invest primarily in company shares with higher growth potential and volatility, whereas debt mutual funds invest in fixed-income securities offering capital preservation and steady returns.',
        intent: 'INVESTMENT_EDUCATION',
        risk_level: 'LOW',
        confidence_score: 0.90,
        evidence: [
          {
            source_type: 'domain_knowledge',
            claim: 'Standard asset class definitions and risk-return characteristics',
          },
        ],
        missing_information: [],
        disclaimer_required: true,
        disclaimer: 'DISCLAIMER: Educational information only. The platform is NOT a SEBI-registered Investment Adviser.',
        human_review_required: false,
        refusal_or_limitation: null,
      };
    }

    // 2. Tax Queries
    if (lower.includes('deduction') || lower.includes('80d') || lower.includes('80c') || lower.includes('income tax') || lower.includes('tax regime')) {
      return {
        answer: 'Under Section 80D of the Indian Income Tax Act, premiums paid for health insurance for self and family are deductible up to ₹25,000 (or ₹50,000 for senior citizens).',
        intent: 'TAX_QUERY',
        risk_level: 'MEDIUM',
        confidence_score: 0.90,
        evidence: [
          {
            source_type: 'domain_knowledge',
            claim: 'Income Tax Act 1961 Section 80D statutory limits',
          },
        ],
        missing_information: [],
        disclaimer_required: true,
        disclaimer: 'DISCLAIMER: This guidance is provided for educational and analytical purposes under the Indian Income Tax Act 1961. It does not constitute statutory certification or a formal tax audit. Consult a qualified Chartered Accountant for definitive filing decisions.',
        human_review_required: false,
        refusal_or_limitation: null,
      };
    }

    // 3. Transaction Analysis / Totals
    if (lower.includes('total') || lower.includes('spend') || lower.includes('expenses')) {
      return {
        answer: 'Based on your verified records, your healthcare expenses for FY 2025-26 total ₹25,000 across 1 transaction.',
        intent: 'TRANSACTION_ANALYSIS',
        risk_level: 'LOW',
        confidence_score: 0.95,
        evidence: [
          {
            source_type: 'calculation',
            claim: 'Total healthcare expenditure calculated as ₹25,000 across 1 record',
          },
        ],
        missing_information: [],
        disclaimer_required: false,
        disclaimer: '',
        human_review_required: false,
        refusal_or_limitation: null,
      };
    }

    // Generic educational answer
    return {
      answer: 'This is an educational summary of personal finance principles in the Indian context.',
      intent: 'GENERAL_FINANCE',
      risk_level: 'LOW',
      confidence_score: 0.85,
      evidence: [],
      missing_information: [],
      disclaimer_required: false,
      disclaimer: '',
      human_review_required: false,
      refusal_or_limitation: null,
    };
  }
}
