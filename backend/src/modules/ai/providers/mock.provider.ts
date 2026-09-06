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

    const userInquiryMatch = prompt.match(/<(?:user_inquiry|untrusted_user_query)>([\s\S]*?)<\/(?:user_inquiry|untrusted_user_query)>/i);
    const userQuestion = (userInquiryMatch ? userInquiryMatch[1] : prompt).trim().toLowerCase();
    const lower = userQuestion;

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

    let monthlyContext = extractXmlBlock('verified_monthly_money_context');
    if (!monthlyContext) {
      const incMatch = prompt.match(/<monthly_income[^>]*>([\d.]+)/i);
      const expMatch = prompt.match(/<monthly_expenses[^>]*>([\d.]+)/i);
      const surMatch = prompt.match(/<monthly_surplus[^>]*>([\d.]+)/i);
      const rateMatch = prompt.match(/<savings_rate_pct[^>]*>([\d.]+)/i);
      if (incMatch || expMatch || surMatch) {
        monthlyContext = {
          income: incMatch ? parseFloat(incMatch[1]) : 0,
          expenses: expMatch ? parseFloat(expMatch[1]) : 0,
          surplus: surMatch ? parseFloat(surMatch[1]) : 0,
          savings_rate_pct: rateMatch ? parseFloat(rateMatch[1]) : 0,
          top_expense_categories: [],
        };
      }
    }

    const allocationContext = extractXmlBlock('verified_savings_allocation_context');
    const freedomContext = extractXmlBlock('verified_financial_freedom_context');
    const affordabilityContext = extractXmlBlock('verified_affordability_context');
    const croreContext = extractXmlBlock('verified_crore_path_context');
    const retrievedDocs = extractXmlBlock('retrieved_user_documents');
    const missingNotes = extractXmlBlock('missing_evidence_notes');

    // 0A. Prohibited document / identity facts not present (e.g. passport)
    if (lower.includes('passport') || (lower.includes('expiry') && !lower.includes('card'))) {
      return {
        answer: "I don't have enough verified information yet. No passport records were found in your verified documents or account.",
        intent: 'GENERAL_FINANCE',
        risk_level: 'LOW',
        confidence_score: 0.25,
        evidence: [],
        missing_information: ['Passport document not found in verified records'],
        disclaimer_required: false,
        disclaimer: '',
        human_review_required: true,
        refusal_or_limitation: 'NOT_FOUND',
      };
    }

    // 0B. Verified Document RAG (e.g. salary slip)
    if (
      lower.includes('salary slip') ||
      (lower.includes('salary') && lower.includes('mutabik')) ||
      (lower.includes('slip') && lower.includes('income'))
    ) {
      let docIncome = 95000;
      if (Array.isArray(retrievedDocs)) {
        for (const doc of retrievedDocs) {
          const m = doc.summary?.match(/"net_income":\s*(\d+)/);
          if (m) docIncome = parseInt(m[1], 10);
        }
      }
      return {
        answer: `Aapki confirmed salary slip ke mutabik monthly income ₹${docIncome.toLocaleString('en-IN')} hai. Yeh verified document records se confirm kiya gaya hai.`,
        intent: 'DOCUMENT_ANALYSIS',
        risk_level: 'LOW',
        confidence_score: 0.98,
        evidence: [
          {
            source_type: 'document',
            claim: `Verified salary slip records net monthly income of ₹${docIncome.toLocaleString('en-IN')}.`,
          },
        ],
        missing_information: [],
        disclaimer_required: false,
        disclaimer: '',
        human_review_required: false,
        refusal_or_limitation: null,
      };
    }

    // 1. Missing information check (only trigger if the user's specific inquiry lacks the required data)
    if (
      (userQuestion.includes('emergency fund') && !allocationContext && userQuestion.includes('missing')) ||
      ((!monthlyContext || (monthlyContext.income === 0 && monthlyContext.expenses === 0)) && (missingNotes && missingNotes.length > 0 || !monthlyContext) && (lower.includes('surplus') || lower.includes('savings rate') || lower.includes('1 crore') || lower.includes('mera') || lower.includes('meri') || lower.includes('improve')))
    ) {
      return {
        answer: "I don't have enough verified information yet.",
        intent: 'PERSONAL_FINANCE',
        risk_level: 'LOW',
        confidence_score: 0.35,
        evidence: [],
        missing_information: Array.isArray(missingNotes) ? missingNotes : ['Required financial context is incomplete'],
        disclaimer_required: false,
        disclaimer: '',
        human_review_required: true,
        refusal_or_limitation: 'MISSING_DATA',
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

      // 3C-1. "Mera monthly surplus kitna hai?"
      if (
        lower.includes('monthly surplus kitna') ||
        lower.includes('mera surplus kitna') ||
        lower.includes('mera monthly surplus') ||
        (lower.includes('surplus') && (lower.includes('kitna') || lower.includes('mera')))
      ) {
        return {
          answer: `ANSWER: Aapka monthly surplus ₹${sur.toLocaleString('en-IN')} hai.\n\nWHY: Yeh aapki verified monthly aamdani (₹${inc.toLocaleString('en-IN')}) me se kul kharche (₹${exp.toLocaleString('en-IN')}) ghatane ke baad bachi hui authoritative bachat hai.\n\nDATA USED: Income ₹${inc.toLocaleString('en-IN')}, Expenses ₹${exp.toLocaleString('en-IN')}.\n\nNEXT ACTION: ${emergencyGap > 0 ? `Is surplus ko apne ₹${emergencyGap.toLocaleString('en-IN')} emergency buffer gap ko bharne me lagayein.` : 'Surplus ko apne target goals aur wealth acceleration me deploy karein.'}`,
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

      // 3C-2. "Meri savings rate kya hai?"
      if (
        lower.includes('savings rate kya hai') ||
        lower.includes('meri savings rate') ||
        (lower.includes('savings rate') && (lower.includes('kya') || lower.includes('meri')))
      ) {
        return {
          answer: `ANSWER: Aapki savings rate ${rate}% hai.\n\nWHY: Yeh darshata hai ki aap apni monthly income (₹${inc.toLocaleString('en-IN')}) ka kitna hissa surplus (₹${sur.toLocaleString('en-IN')}) ke roop me bacha rahe hain.\n\nDATA USED: Monthly Income ₹${inc.toLocaleString('en-IN')}, Monthly Surplus ₹${sur.toLocaleString('en-IN')}.\n\nNEXT ACTION: ${rate < 20 ? 'Discretionary spending audit karein taaki savings rate 20% ya usse adhik ho sake.' : 'Is disciplined savings rate ko banaye rakhein aur structured allocation follow karein.'}`,
          intent: 'PERSONAL_FINANCE',
          risk_level: 'LOW',
          confidence_score: 0.95,
          evidence: [
            {
              source_type: 'monthly_summary',
              source_id: monthlyContext.month || 'current_month',
              claim: `Verified savings rate ${rate}% from monthly surplus ₹${sur}.`,
            },
          ],
          missing_information: [],
          disclaimer_required: false,
          disclaimer: '',
          human_review_required: false,
          refusal_or_limitation: null,
        };
      }

      // 3C-3. General "How much am I saving?"
      if (
        (lower.includes('how much am i saving') ||
          lower.includes('how much am i saving this month') ||
          lower.includes('surplus') ||
          lower.includes('savings rate')) &&
        !lower.includes('review') &&
        !lower.includes('pehle') &&
        !lower.includes('share market') &&
        !lower.includes('emergency') &&
        !lower.includes('1 crore') &&
        !lower.includes('1 cr') &&
        !lower.includes('1cr') &&
        !lower.includes('ek crore')
      ) {
        return {
          answer: `ANSWER: This month, you are saving ₹${sur.toLocaleString('en-IN')} from a verified income of ₹${inc.toLocaleString('en-IN')} after expenses of ₹${exp.toLocaleString('en-IN')}.\n\nWHY: This represents a disciplined ${rate}% savings rate across your verified cashflows.\n\nDATA USED: Income ₹${inc.toLocaleString('en-IN')}, Expenses ₹${exp.toLocaleString('en-IN')}, Surplus ₹${sur.toLocaleString('en-IN')}.\n\nNEXT ACTION: ${emergencyGap > 0 ? `Allocate ₹${sur.toLocaleString('en-IN')} toward your emergency buffer gap of ₹${emergencyGap.toLocaleString('en-IN')}.` : 'Deploy surplus according to your target allocation plan.'}`,
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

      // 3E. "Is month kya improve karu?" / "What should I improve?"
      if (
        lower.includes('what should i improve') ||
        lower.includes('is month kya improve karu') ||
        lower.includes('kya improve karu') ||
        lower.includes('kya improve karein')
      ) {
        const highestActionMatch = prompt.match(/<calculation metric="highest_priority_action" result="([^"]+)"/i);
        let highAction: any = null;
        if (highestActionMatch) {
          try {
            highAction = JSON.parse(highestActionMatch[1].replace(/&quot;/g, '"'));
          } catch {}
        }

        const actionTitle = highAction?.title || `Discretionary spend audit on ${topCat}`;
        const actionWhy = highAction?.why_it_matters || `${topCat} represents your largest spending pressure point at ₹${topCatAmt.toLocaleString('en-IN')}.`;
        const actionData = highAction?.data_used || `Expenses ₹${exp.toLocaleString('en-IN')}, Top Category: ${topCat} (₹${topCatAmt.toLocaleString('en-IN')}), Surplus ₹${sur.toLocaleString('en-IN')}.`;
        const actionCta = highAction?.cta || `Set a spending limit for ${topCat} and allocate this month's ₹${sur.toLocaleString('en-IN')} surplus directly to emergency buffer.`;

        return {
          answer: `ANSWER: Is mahine aapka primary improvement focus hai: **${actionTitle}**.\n\nWHY: ${actionWhy}\n\nDATA USED: ${actionData}\n\nNEXT ACTION: **Next Action:** ${actionCta}`,
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

    // 4B. ₹1 Crore Shortest Path Queries
    if (
      lower.includes('1 crore') ||
      lower.includes('1cr') ||
      lower.includes('1 cr') ||
      lower.includes('ek crore') ||
      lower.includes('one crore') ||
      lower.includes('kab banaunga') ||
      lower.includes('kitne saal mein') ||
      lower.includes('shortest path') ||
      lower.includes('fastest path') ||
      lower.includes('jaldi kaise')
    ) {
      if (croreContext) {
        const cc = croreContext;
        const baseDate = cc.base_case?.target_date || 'Unreachable within 60 years at current contribution';
        const baseMonths = cc.base_case?.months_to_target;
        const baseYears = baseMonths ? (baseMonths / 12).toFixed(1) : 'N/A';
        const shortestDate = cc.shortest_modeled_path?.target_date || baseDate;
        const rec = cc.lever_analysis?.recommended_change || 'Increase your monthly surplus';
        const nextAction = cc.one_next_action || 'Maintain consistent monthly investing';

        const sur = monthlyContext?.surplus ?? cc.current_monthly_contribution ?? 0;

        return {
          answer: `ANSWER: Aapke current financial trajectory ke anusaar, Base case estimated ₹1 Crore date **${baseDate}** (${baseYears} saal) tak projected hai.\n\nWHY: Yeh projection ₹${Number(sur).toLocaleString('en-IN')}/month contribution aur ${cc.base_case?.assumed_return_pct ?? 12}% p.a. deterministic compounding assumptions par aadharit hai.\n\nDATA USED: Starting Capital ₹${Number(cc.starting_capital || 0).toLocaleString('en-IN')}, Monthly Contribution ₹${Number(sur).toLocaleString('en-IN')}, Modeled Rate ${cc.base_case?.assumed_return_pct ?? 12}%.\n\nNEXT ACTION: ${nextAction} (${rec}). Fastest modeled path timeline ko **${shortestDate}** tak accelerate kar sakta hai.`,
          intent: 'PERSONAL_FINANCE',
          risk_level: 'LOW',
          confidence_score: 0.96,
          evidence: [
            {
              source_type: 'calculation',
              claim: `Deterministic ₹1 Cr projection: Base case target date ${baseDate}, fastest modeled path ${shortestDate}.`,
            },
            {
              source_type: 'monthly_summary',
              claim: `Starting capital ₹${cc.starting_capital}, monthly contribution ₹${sur}.`,
            },
          ],
          missing_information: [],
          disclaimer_required: true,
          disclaimer: 'DISCLAIMER: Educational mathematical projection based on explicit compounding assumptions. Returns are not guaranteed.',
          human_review_required: false,
          refusal_or_limitation: null,
        };
      }
    }

    // 4C. "Meri emergency fund position kya hai?" / "Emergency fund kitna hona chahiye?"
    if (
      lower.includes('emergency fund position') ||
      lower.includes('meri emergency fund') ||
      lower.includes('emergency fund kitna') ||
      lower.includes('kitna hona chahiye') ||
      lower.includes('how much emergency fund') ||
      lower.includes('emergency position')
    ) {
      const target = allocationContext?.emergency_fund_target ?? 300000;
      const current = allocationContext?.emergency_fund_current ?? 0;
      const gap = allocationContext?.emergency_gap ?? target;
      const statusText = gap <= 0 ? 'fully funded hai' : `₹${gap.toLocaleString('en-IN')} ka gap baaki hai`;
      return {
        answer: `ANSWER: Aapka emergency fund abhi ${statusText} (Current: ₹${current.toLocaleString('en-IN')}, Target: ₹${target.toLocaleString('en-IN')}).\n\nWHY: 3 se 6 mahine ke anivarya kharchon ka emergency liquid buffer financial shocks ke samay aapke investments ko tootne se bachata hai taaki karz na lena pade.\n\nDATA USED: Target ₹${target.toLocaleString('en-IN')}, Current Savings ₹${current.toLocaleString('en-IN')}, Remaining Gap ₹${gap.toLocaleString('en-IN')}.\n\nNEXT ACTION: ${gap > 0 ? `Apne monthly surplus se ₹${Math.min(gap, monthlyContext?.surplus || gap).toLocaleString('en-IN')} liquid savings me daal kar is gap ko close karein.` : 'Emergency buffer complete hai; ab surplus ko long-term wealth acceleration me lagayein.'}`,
        intent: 'PERSONAL_FINANCE',
        risk_level: 'LOW',
        confidence_score: 0.95,
        evidence: [
          {
            source_type: 'allocation_plan',
            claim: `Emergency target ₹${target}, current ₹${current}, gap ₹${gap}.`,
          },
        ],
        missing_information: [],
        disclaimer_required: false,
        disclaimer: '',
        human_review_required: false,
        refusal_or_limitation: null,
      };
    }

    // 4D. Guaranteed Returns Rejection
    if (lower.includes('guarantee') || lower.includes('guaranteed return') || lower.includes('20% return')) {
      return {
        answer: 'There are no guaranteed returns in equity or market-linked investments. All investments are subject to market risks. SEBI regulations strictly prohibit promising guaranteed returns on securities. Any scheme or advisor promising guaranteed high returns is high-risk or non-compliant.',
        intent: 'GENERAL_FINANCE',
        risk_level: 'MEDIUM',
        confidence_score: 0.98,
        evidence: [
          {
            source_type: 'domain_knowledge',
            claim: 'SEBI regulations and investment disclosure guidelines strictly prohibit guaranteed return assurances.',
          },
        ],
        missing_information: [],
        disclaimer_required: true,
        disclaimer: 'DISCLAIMER: Investments are subject to market risks. No guaranteed returns exist in market-linked assets.',
        human_review_required: false,
        refusal_or_limitation: null,
      };
    }

    // 4E. Loan for Stock Investing / Leverage Warning
    if (
      (lower.includes('loan') || lower.includes('karz') || lower.includes('borrow') || lower.includes('leverage')) &&
      (lower.includes('invest') || lower.includes('stock') || lower.includes('share market') || lower.includes('shares'))
    ) {
      return {
        answer: 'We strictly do not recommend taking a personal loan or debt to invest in the share market. Using leverage multiplies downside risk because loan EMIs and interest are fixed obligations, whereas equity returns are volatile and never guaranteed. Borrowing to invest creates dangerous risk of financial distress.',
        intent: 'PERSONAL_FINANCE',
        risk_level: 'HIGH',
        confidence_score: 0.98,
        evidence: [
          {
            source_type: 'domain_knowledge',
            claim: 'Prudent financial planning principles strictly discourage borrowing unsecured personal loans for market investments.',
          },
        ],
        missing_information: [],
        disclaimer_required: true,
        disclaimer: 'DISCLAIMER: Never borrow money or take personal loans to invest in volatile assets.',
        human_review_required: false,
        refusal_or_limitation: null,
      };
    }

    // Helper to extract evidence chunks
    const chunkMatches = prompt.matchAll(/<chunk id="([^"]*)" source="([^"]*)" authority_tier="([^"]*)"[^>]*>[\s\S]*?<headline>([\s\S]*?)<\/headline>[\s\S]*?<content>([\s\S]*?)<\/content>[\s\S]*?<\/chunk>/gi);
    const evidenceChunks: Array<{ id: string; source: string; tier: number; headline: string; content: string }> = [];
    for (const m of chunkMatches) {
      evidenceChunks.push({
        id: m[1],
        source: m[2],
        tier: parseInt(m[3], 10) || 4,
        headline: m[4].trim(),
        content: m[5].trim(),
      });
    }

    // 4A. Hinglish Financial Priority / Decision Coaching
    if (
      (userQuestion.includes('emergency fund') || userQuestion.includes('emergency')) &&
      (userQuestion.includes('share market') || userQuestion.includes('stock market') || userQuestion.includes('nivesh') || userQuestion.includes('lagau')) &&
      (userQuestion.includes('pehle') || userQuestion.includes('surplus'))
    ) {
      return {
        answer: 'Aapko pehle apna emergency fund safety buffer banau chahiye. Share market me surplus invest karne se pehle 3 se 6 mahine ke zaroori kharche ka emergency reserve tayar karna mathematical aur psychological safety rule hai. Isse aapko market crash ke dauran share bechne ki naubat nahi aayegi.',
        intent: 'PERSONAL_FINANCE',
        risk_level: 'LOW',
        confidence_score: 0.95,
        evidence: [
          {
            source_type: 'domain_knowledge',
            claim: 'Emergency liquidity priority over market risk allocation',
          },
        ],
        missing_information: [],
        disclaimer_required: false,
        disclaimer: '',
        human_review_required: false,
        refusal_or_limitation: null,
      };
    }

    // 4B. Grounded Knowledge Chunk Utilization
    if (evidenceChunks.length > 0) {
      // Income Tax / Slabs / Standard Deduction / 87A Rebate / 80C
      const taxChunk = evidenceChunks.find((c) => c.source.toLowerCase().includes('income tax') || c.content.toLowerCase().includes('section 115bac'));
      if (taxChunk && (lower.includes('standard deduction') || lower.includes('75,000') || lower.includes('87a') || lower.includes('rebate') || lower.includes('80c') || lower.includes('new tax regime') || lower.includes('115bac') || lower.includes('deduction'))) {
        if (lower.includes('80c') && (lower.includes('new tax regime') || lower.includes('apply'))) {
          return {
            answer: 'Under Section 115BAC of the default new tax regime, deductions under Section 80C (PPF, ELSS, life insurance) are not allowable. The new tax regime provides simplified lower tax slabs and an enhanced standard deduction of ₹75,000 instead of Chapter VI-A deductions.',
            intent: 'TAX_QUERY',
            risk_level: 'MEDIUM',
            confidence_score: 0.95,
            evidence: [
              {
                source_type: 'domain_knowledge',
                source_id: taxChunk.id,
                claim: taxChunk.headline,
              },
            ],
            missing_information: [],
            disclaimer_required: true,
            disclaimer: 'DISCLAIMER: Factual statutory information based on official Income Tax provisions.',
            human_review_required: false,
            refusal_or_limitation: null,
          };
        }

        if (lower.includes('87a') || lower.includes('rebate')) {
          return {
            answer: 'Under Section 87A of the Income Tax Act for FY 2025-26 under the new tax regime, resident individuals with total taxable income up to ₹7,00,000 are eligible for a full tax rebate of up to ₹25,000, resulting in zero net income tax liability.',
            intent: 'TAX_QUERY',
            risk_level: 'MEDIUM',
            confidence_score: 0.95,
            evidence: [
              {
                source_type: 'domain_knowledge',
                source_id: taxChunk.id,
                claim: taxChunk.headline,
              },
            ],
            missing_information: [],
            disclaimer_required: true,
            disclaimer: 'DISCLAIMER: Factual statutory information based on official Income Tax provisions.',
            human_review_required: false,
            refusal_or_limitation: null,
          };
        }

        return {
          answer: 'Under Section 115BAC default new tax regime for FY 2025-26, the statutory standard deduction for salaried individuals is ₹75,000 (increased from ₹50,000). Salaried employees can claim this deduction without submitting investment proofs.',
          intent: 'TAX_QUERY',
          risk_level: 'MEDIUM',
          confidence_score: 0.95,
          evidence: [
            {
              source_type: 'domain_knowledge',
              source_id: taxChunk.id,
              claim: taxChunk.headline,
            },
          ],
          missing_information: [],
          disclaimer_required: true,
          disclaimer: 'DISCLAIMER: Factual statutory information based on official Income Tax provisions.',
          human_review_required: false,
          refusal_or_limitation: null,
        };
      }

      // SEBI Regulatory Chunk
      const sebiChunk = evidenceChunks.find((c) => c.source.toLowerCase().includes('sebi') || c.content.toLowerCase().includes('investment adviser'));
      if (sebiChunk && (lower.includes('sebi') || lower.includes('adviser') || lower.includes('fee cap') || lower.includes('advisory'))) {
        return {
          answer: 'Under official SEBI regulations for investment advisers, the maximum annual advisory fee cap for individuals is ₹1,25,000 per annum or 2.5% of AUA per family across all services. SEBI strictly forbids promises of guaranteed returns.',
          intent: 'INVESTMENT_EDUCATION',
          risk_level: 'LOW',
          confidence_score: 0.95,
          evidence: [
            {
              source_type: 'domain_knowledge',
              source_id: sebiChunk.id,
              claim: sebiChunk.headline,
            },
          ],
          missing_information: [],
          disclaimer_required: true,
          disclaimer: 'DISCLAIMER: Educational information. The platform is not a SEBI-registered Investment Adviser.',
          human_review_required: false,
          refusal_or_limitation: null,
        };
      }

      // Behavioral Finance (Morgan Housel / Psychology of Money)
      const psychChunk = evidenceChunks.find((c) => c.source.toLowerCase().includes('psychology') || c.content.toLowerCase().includes('housel') || c.content.toLowerCase().includes('behavior'));
      if (psychChunk && (lower.includes('housel') || lower.includes('psychology of money') || lower.includes('premise'))) {
        return {
          answer: "According to Morgan Housel's framework in *The Psychology of Money*, doing well with money has a little to do with how smart you are and a lot to do with how you behave. Financial success is driven by emotional discipline, patience, and avoiding catastrophic mistakes rather than mathematical optimization.",
          intent: 'GENERAL_FINANCE',
          risk_level: 'LOW',
          confidence_score: 0.90,
          evidence: [
            {
              source_type: 'domain_knowledge',
              source_id: psychChunk.id,
              claim: psychChunk.headline,
            },
          ],
          missing_information: [],
          disclaimer_required: false,
          disclaimer: '',
          human_review_required: false,
          refusal_or_limitation: null,
        };
      }

      // RBI DICGC Deposit Insurance Chunk
      const rbiChunk = evidenceChunks.find((c) => c.source.toLowerCase().includes('rbi') || c.source.toLowerCase().includes('dicgc') || c.content.toLowerCase().includes('dicgc') || c.content.toLowerCase().includes('5,00,000'));
      if (rbiChunk && (lower.includes('dicgc') || lower.includes('deposit insurance') || lower.includes('protected') || lower.includes('bank fails') || lower.includes('limit per depositor'))) {
        return {
          answer: 'Under statutory Deposit Insurance and Credit Guarantee Corporation (DICGC) regulations overseen by the Reserve Bank of India (RBI), each depositor is insured up to a maximum limit of ₹5,00,000 (Rupees Five Lakhs) for both principal and interest across all accounts held in an insured commercial or cooperative bank.',
          intent: 'GENERAL_FINANCE',
          risk_level: 'LOW',
          confidence_score: 0.95,
          evidence: [
            {
              source_type: 'domain_knowledge',
              source_id: rbiChunk.id,
              claim: rbiChunk.headline,
            },
          ],
          missing_information: [],
          disclaimer_required: true,
          disclaimer: 'DISCLAIMER: Statutory deposit insurance information under RBI regulations.',
          human_review_required: false,
          refusal_or_limitation: null,
        };
      }

      // Indian Financial Ecosystem Regulators (RBI, SEBI, IRDAI)
      const ecoChunk = evidenceChunks.find(
        (c) =>
          c.source.toLowerCase().includes('financial system') ||
          c.source.toLowerCase().includes('ecosystem') ||
          c.id.includes('in-financial-ecosystem') ||
          c.content.toLowerCase().includes('reserve bank of india') ||
          c.content.toLowerCase().includes('securities and exchange')
      );
      if (
        ecoChunk &&
        (lower.includes('authorities') ||
          lower.includes('overseeing') ||
          lower.includes('regulators') ||
          lower.includes('regulatory') ||
          lower.includes('banking, securities'))
      ) {
        return {
          answer: 'In India, the primary financial regulatory authorities are: 1. The Reserve Bank of India (RBI) overseeing banking, currency, and monetary policy; 2. The Securities and Exchange Board of India (SEBI) regulating securities, stock exchanges, and mutual funds; and 3. The Insurance Regulatory and Development Authority of India (IRDAI) regulating the insurance industry.',
          intent: 'GENERAL_FINANCE',
          risk_level: 'LOW',
          confidence_score: 0.95,
          evidence: [
            {
              source_type: 'domain_knowledge',
              source_id: ecoChunk.id,
              claim: ecoChunk.headline,
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

    // 6. Tax Queries Fallback
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
