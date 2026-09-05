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

    // Helper to extract JSON from XML tags
    const extractXmlBlock = (tag: string): any => {
      const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
      const match = prompt.match(regex);
      if (!match) return null;
      try {
        const jsonMatch = match[1].match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        return null;
      }
    };

    const monthlyContext = extractXmlBlock('verified_monthly_money_context');
    const allocationContext = extractXmlBlock('verified_savings_allocation_context');
    const freedomContext = extractXmlBlock('verified_financial_freedom_context');
    const affordabilityContext = extractXmlBlock('verified_affordability_context');
    const missingNotes = extractXmlBlock('missing_evidence_notes');

    // 1. Missing information check
    if (
      (lower.includes('emergency fund') && !allocationContext && lower.includes('missing')) ||
      (missingNotes && missingNotes.length > 0 && lower.includes('reliable'))
    ) {
      return {
        answer: "I don't have enough information to answer this reliably. Please set up your financial profile and ensure transaction data is recorded.",
        intent: 'PERSONAL_FINANCE',
        risk_level: 'LOW',
        confidence_score: 0.35,
        evidence: [],
        missing_information: Array.isArray(missingNotes) ? missingNotes : ['Required financial context is incomplete'],
        disclaimer_required: false,
        disclaimer: '',
        human_review_required: true,
        refusal_or_limitation: null,
      };
    }

    // 2. Affordability Queries
    if (affordabilityContext) {
      const aff = affordabilityContext;
      let answerText = '';
      if (aff.verdict === 'comfortable') {
        answerText = `You can comfortably afford this purchase of ₹${aff.proposed_amount.toLocaleString('en-IN')}. Your monthly income is ₹${aff.monthly_income.toLocaleString('en-IN')} with expenses of ₹${aff.monthly_expenses.toLocaleString('en-IN')}, leaving ₹${aff.monthly_surplus.toLocaleString('en-IN')} in surplus. Because your emergency fund is fully funded, this discretionary expense can be absorbed cleanly without taking on debt or touching your savings cushion.`;
      } else if (aff.verdict === 'caution_tight') {
        answerText = `Caution: While your surplus is ₹${aff.monthly_surplus.toLocaleString('en-IN')}, your emergency fund still has an unmet target gap of ₹${aff.emergency_gap.toLocaleString('en-IN')}. Allocating ₹${aff.proposed_amount.toLocaleString('en-IN')} towards this purchase will delay building your emergency cushion. Consider whether this purchase can be postponed until your safety buffer is fully funded.`;
      } else {
        answerText = `Based on your verified records, this purchase of ₹${aff.proposed_amount.toLocaleString('en-IN')} is not recommended right now. ${aff.deterministic_notes} We do not recommend financing discretionary purchases through personal loans, credit card debt, or EMIs.`;
      }

      return {
        answer: answerText,
        intent: 'PERSONAL_FINANCE',
        risk_level: 'LOW',
        confidence_score: 0.95,
        evidence: [
          {
            source_type: 'affordability_evaluation',
            claim: `Deterministic affordability assessment: ${aff.verdict} for ₹${aff.proposed_amount}.`,
          },
          {
            source_type: 'monthly_summary',
            claim: `Monthly surplus verified at ₹${aff.monthly_surplus}.`,
          },
        ],
        missing_information: [],
        disclaimer_required: false,
        disclaimer: '',
        human_review_required: false,
        refusal_or_limitation: null,
      };
    }

    // 3. User Specific Questions & Monthly Financial Review
    if (monthlyContext) {
      const inc = monthlyContext.income ?? 0;
      const exp = monthlyContext.expenses ?? 0;
      const sur = monthlyContext.surplus ?? 0;
      const rate = monthlyContext.savings_rate_pct ?? (inc > 0 ? Math.round((sur / inc) * 100) : 0);
      const topCats = monthlyContext.top_expense_categories || [];
      const topCat = topCats.length > 0 ? topCats[0].category : 'Housing';
      const topCatAmt = topCats.length > 0 ? topCats[0].amount : 0;
      const emergencyGap = allocationContext?.emergency_gap ?? 0;
      const targetCorpus = freedomContext?.indicative_target_corpus ?? 0;

      // 3A. "Where did most of my money go?"
      if (lower.includes('where did most of my money go') || lower.includes('where did my money go')) {
        const catBreakdownText = topCats.length > 0
          ? topCats.map((c: any) => `- **${c.category}**: ₹${Number(c.amount).toLocaleString('en-IN')} (${c.percentage}%)`).join('\n')
          : `- **${topCat}**: ₹${topCatAmt.toLocaleString('en-IN')}`;

        return {
          answer: `Based on your verified records for this month, your total expenses were ₹${exp.toLocaleString('en-IN')}.\n\nYour largest spending pressure was **${topCat}** at ₹${topCatAmt.toLocaleString('en-IN')}.\n\n**Top Spending Breakdown:**\n${catBreakdownText}\n\n**Next Action:** Review discretionary categories to protect your monthly savings rate of ${rate}%.`,
          intent: 'PERSONAL_FINANCE',
          risk_level: 'LOW',
          confidence_score: 0.95,
          evidence: [
            {
              source_type: 'monthly_summary',
              source_id: monthlyContext.month || 'current_month',
              claim: `Verified monthly expenses: ₹${exp}, with top category ${topCat} (₹${topCatAmt}).`,
            },
          ],
          missing_information: [],
          disclaimer_required: false,
          disclaimer: '',
          human_review_required: false,
          refusal_or_limitation: null,
        };
      }

      // 3B. "Why is my emergency fund getting priority?"
      if (lower.includes('why is my emergency fund getting priority') || lower.includes('why is emergency fund priority')) {
        return {
          answer: `Your emergency fund is prioritized because your current liquid savings has an unmet target gap of ₹${emergencyGap.toLocaleString('en-IN')} (Target: ₹${allocationContext?.emergency_fund_target?.toLocaleString('en-IN') ?? '0'}, Current: ₹${allocationContext?.emergency_fund_current?.toLocaleString('en-IN') ?? '0'}).\n\n**Rationale:** Having an adequate liquid buffer protects your long-term wealth from premature liquidation and prevents you from incurring high-interest personal debt during unforeseen emergencies.\n\n**Next Action:** Continue routing your monthly surplus to close the ₹${emergencyGap.toLocaleString('en-IN')} reserve gap before accelerating long-term market investments.`,
          intent: 'PERSONAL_FINANCE',
          risk_level: 'LOW',
          confidence_score: 0.95,
          evidence: [
            {
              source_type: 'allocation_plan',
              claim: `Emergency gap ₹${emergencyGap} against target ₹${allocationContext?.emergency_fund_target ?? 0}.`,
            },
            {
              source_type: 'financial_profile',
              claim: `Verified essential monthly expenses and liquid savings baseline.`,
            },
          ],
          missing_information: [],
          disclaimer_required: false,
          disclaimer: '',
          human_review_required: false,
          refusal_or_limitation: null,
        };
      }

      // 3C. "How much am I saving?"
      if (lower.includes('how much am i saving') || lower.includes('how much am i saving this month')) {
        return {
          answer: `This month, you are saving ₹${sur.toLocaleString('en-IN')} from a verified income of ₹${inc.toLocaleString('en-IN')} after expenses of ₹${exp.toLocaleString('en-IN')}.\n\nThis translates to a **${rate}% savings rate**.\n\n**Next Action:** ${emergencyGap > 0 ? `Allocate ₹${sur.toLocaleString('en-IN')} toward your emergency buffer gap of ₹${emergencyGap.toLocaleString('en-IN')}.` : 'Deploy surplus according to your target allocation plan.'}`,
          intent: 'PERSONAL_FINANCE',
          risk_level: 'LOW',
          confidence_score: 0.95,
          evidence: [
            {
              source_type: 'monthly_summary',
              source_id: monthlyContext.month || 'current_month',
              claim: `Verified monthly surplus ₹${sur} and savings rate ${rate}%.`,
            },
          ],
          missing_information: [],
          disclaimer_required: false,
          disclaimer: '',
          human_review_required: false,
          refusal_or_limitation: null,
        };
      }

      // 3D. "Explain my allocation"
      if (lower.includes('explain my allocation') || lower.includes('explain my current monthly savings allocation')) {
        const alloc = allocationContext?.current_monthly_allocation;
        return {
          answer: `Your monthly surplus of ₹${sur.toLocaleString('en-IN')} is deterministically allocated based on safety rules:\n\n- **Emergency Fund Reserve:** ₹${alloc?.emergency_fund?.toLocaleString('en-IN') ?? '0'} (Target gap: ₹${emergencyGap.toLocaleString('en-IN')})\n- **Active Goals:** ₹${alloc?.goals?.toLocaleString('en-IN') ?? '0'}\n- **Long-term Wealth:** ₹${alloc?.long_term?.toLocaleString('en-IN') ?? '0'}\n- **Flexible Buffer:** ₹${alloc?.buffer?.toLocaleString('en-IN') ?? '0'}\n\n**Next Action:** Maintain this disciplined allocation to systematically build your financial foundation.`,
          intent: 'PERSONAL_FINANCE',
          risk_level: 'LOW',
          confidence_score: 0.95,
          evidence: [
            {
              source_type: 'allocation_plan',
              claim: `Deterministic monthly allocation: Emergency ₹${alloc?.emergency_fund ?? 0}, Goals ₹${alloc?.goals ?? 0}, Long-term ₹${alloc?.long_term ?? 0}.`,
            },
          ],
          missing_information: [],
          disclaimer_required: false,
          disclaimer: '',
          human_review_required: false,
          refusal_or_limitation: null,
        };
      }

      // 3E. "What should I improve next month?" / "What should I improve?"
      if (lower.includes('what should i improve')) {
        return {
          answer: `Here is your targeted improvement plan based on this month's data:\n\n1. **Contain Spending on ${topCat}:** It represents your largest spending outflow at ₹${topCatAmt.toLocaleString('en-IN')}.\n2. **Emergency Cushion:** Continue routing surplus toward closing your ₹${emergencyGap.toLocaleString('en-IN')} emergency reserve gap.\n3. **Savings Rate Target:** Protect your current ${rate}% savings rate by keeping discretionary expenses in check.\n\n**Next Action:** Set a spending limit for ${topCat} and allocate this month's ₹${sur.toLocaleString('en-IN')} surplus directly to your emergency fund.`,
          intent: 'PERSONAL_FINANCE',
          risk_level: 'LOW',
          confidence_score: 0.95,
          evidence: [
            {
              source_type: 'monthly_summary',
              source_id: monthlyContext.month || 'current_month',
              claim: `Verified monthly spending on ${topCat} of ₹${topCatAmt}.`,
            },
            {
              source_type: 'allocation_plan',
              claim: `Emergency gap of ₹${emergencyGap}.`,
            },
          ],
          missing_information: [],
          disclaimer_required: false,
          disclaimer: '',
          human_review_required: false,
          refusal_or_limitation: null,
        };
      }

      // 3F. General Monthly Financial Review / How did I do
      if (
        lower.includes('review') ||
        lower.includes('how did i do') ||
        lower.includes('how am i doing') ||
        lower.includes('monthly review') ||
        lower.includes('saving less')
      ) {
        const summarySentence = `Your income was ₹${inc.toLocaleString('en-IN')} and expenses were ₹${exp.toLocaleString('en-IN')}, leaving ₹${sur.toLocaleString('en-IN')} of surplus (Savings rate: ${rate}%).`;
        const whatWentWell = sur > 0 ? 'You generated positive surplus this month.' : 'You tracked and categorized your cash flows accurately.';
        const pressurePoint = `Your largest spending pressure was ${topCat}.`;
        const priority =
          emergencyGap > 0
            ? 'Your emergency fund is still below your selected target.'
            : targetCorpus > 0
            ? 'Your current priority is compounding wealth toward financial freedom.'
            : 'Your current priority is allocating surplus into structured emergency and goal buckets.';
        const nextAction =
          emergencyGap > 0
            ? 'Your next priority is strengthening the emergency reserve before increasing long-term allocations.'
            : 'Deploy surplus according to your target allocation plan.';
        const explanation =
          emergencyGap > 0
            ? 'Strengthening your liquid emergency buffer protects you from high-interest borrowing during emergencies.'
            : 'Consistent contributions toward diversified goals keep you aligned with your long-term roadmap.';

        const fullAnswer = `${summarySentence}\n\n**What Went Well:** ${whatWentWell}\n**Main Pressure Point:** ${pressurePoint}\n**Current Priority:** ${priority}\n**Next Action:** ${nextAction}\n**Short Explanation:** ${explanation}`;

        const evidence: any[] = [
          {
            source_type: 'monthly_summary',
            source_id: monthlyContext.month || 'current_month',
            claim: `Verified monthly summary: Income ₹${inc}, Expenses ₹${exp}, Surplus ₹${sur}, Savings Rate ${rate}%.`,
          },
        ];

        if (allocationContext) {
          evidence.push({
            source_type: 'allocation_plan',
            claim: `Emergency fund target ₹${allocationContext.emergency_fund_target}, current ₹${allocationContext.emergency_fund_current}, gap ₹${emergencyGap}.`,
          });
        }

        if (freedomContext) {
          evidence.push({
            source_type: 'financial_freedom_status',
            claim: `Freedom target corpus ₹${targetCorpus}, projected wealth ₹${freedomContext.projected_wealth}.`,
          });
        }

        return {
          answer: fullAnswer,
          intent: 'PERSONAL_FINANCE',
          risk_level: 'LOW',
          confidence_score: 0.95,
          evidence,
          missing_information: [],
          disclaimer_required: false,
          disclaimer: '',
          human_review_required: false,
          refusal_or_limitation: null,
        };
      }
    }

    // 4. Financial Freedom queries
    if (lower.includes('financial freedom') || lower.includes('on track') || lower.includes('retire')) {
      if (freedomContext) {
        const fc = freedomContext;
        return {
          answer: `Based on your deterministic financial model, your indicative target corpus is ₹${fc.indicative_target_corpus.toLocaleString('en-IN')}. At your current monthly contribution, your projected wealth at age ${fc.target_age} is ₹${fc.projected_wealth.toLocaleString('en-IN')}, leaving a funding gap of ₹${fc.funding_gap.toLocaleString('en-IN')}. Required monthly contribution to bridge this gap is ₹${fc.required_monthly_contribution.toLocaleString('en-IN')}.`,
          intent: 'PERSONAL_FINANCE',
          risk_level: 'LOW',
          confidence_score: 0.94,
          evidence: [
            {
              source_type: 'financial_freedom_status',
              claim: `Indicative target corpus ₹${fc.indicative_target_corpus}, projected wealth ₹${fc.projected_wealth}, funding gap ₹${fc.funding_gap}.`,
            },
          ],
          missing_information: [],
          disclaimer_required: false,
          disclaimer: '',
          human_review_required: false,
          refusal_or_limitation: null,
        };
      }
    }

    // 5. Investment Education
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

    // 6. Tax Queries
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

    // 7. Transaction Analysis / Totals
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
