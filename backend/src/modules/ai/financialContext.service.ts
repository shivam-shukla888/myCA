import { allocationService } from '../allocation/allocation.service.js';
import { freedomService } from '../freedom/freedom.service.js';
import { actionService } from '../action/action.service.js';
import { canonicalFinanceService } from '../finance/canonicalFinance.service.js';

export interface AffordabilityEvaluation {
  proposed_amount: number;
  item_description?: string;
  monthly_surplus: number;
  monthly_income: number;
  monthly_expenses: number;
  emergency_fund_status: 'funded' | 'gap_exists' | 'unknown';
  emergency_gap: number;
  verdict: 'comfortable' | 'caution_tight' | 'unaffordable_due_to_deficit_or_safety';
  months_of_surplus_needed: number;
  impact_on_goals: string;
  deterministic_notes: string;
}

export interface DeterministicFinancialContext {
  month: string;
  has_financial_profile: boolean;
  has_monthly_data: boolean;
  has_goals: boolean;
  has_allocation_plan: boolean;
  has_freedom_data: boolean;
  has_emergency_data: boolean;
  current_month: {
    income: number;
    expenses: number;
    surplus: number;
    savings_rate: number;
    top_expense_categories: Array<{ category: string; amount: number; percentage: number }>;
  };
  financial_profile?: {
    age?: number;
    monthly_income?: number;
    monthly_essential_expenses?: number;
    monthly_debt_obligations?: number;
    existing_liquid_savings?: number;
    existing_investments?: number;
    dependents?: number;
    has_health_insurance?: boolean;
    has_life_insurance?: boolean;
    emergency_fund_target_months?: number;
    target_retirement_age?: number;
    desired_monthly_lifestyle_income?: number;
    // Backward-compatibility aliases
    essential_expenses?: number;
    debt_obligations?: number;
    insurance_status?: {
      has_health_insurance: boolean;
      has_term_life_insurance: boolean;
    };
  };
  allocation?: {
    emergency_fund_target: number;
    emergency_fund_current: number;
    emergency_gap: number;
    current_monthly_allocation: {
      emergency_fund: number;
      goals: number;
      long_term: number;
      long_term_wealth?: number;
      buffer: number;
      flexible_buffer?: number;
      total_allocated?: number;
    };
    total_allocated?: number;
  };
  financial_freedom?: {
    current_wealth: number;
    indicative_target_corpus: number;
    projected_wealth: number;
    funding_gap: number;
    required_monthly_contribution: number;
    target_age: number;
    selected_scenario: string;
    assumptions: {
      expected_return_pct: number;
      inflation_rate_pct: number;
      withdrawal_rate_pct: number;
    };
    on_track: boolean;
  };
  goals: Array<{
    id: string;
    title: string;
    target_amount: number;
    current_amount: number;
    target_date?: string;
  }>;
  action_plan?: {
    surplus: number;
    actions: Array<{ priority: string; title: string; allocated_amount: number; why_rationale: string }>;
    total_allocated: number;
  };
  affordability?: AffordabilityEvaluation;
  missing_data_reasons: string[];
}

export class FinancialContextService {
  /**
   * Deterministically pulls verified data from Phase 2, 3, and 4 engines
   * and Canonical Finance Service without exposing secrets or PII.
   */
  async buildDeterministicContext(
    userId: string,
    targetMonth?: string
  ): Promise<DeterministicFinancialContext> {
    // 0. Fetch Canonical Financial State
    let canonicalState: any = null;
    try {
      canonicalState = await canonicalFinanceService.getCanonicalFinancialState(userId, targetMonth);
    } catch {
      canonicalState = null;
    }

    let month = canonicalState?.month || targetMonth;
    if (!month) {
      const now = new Date();
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    const missing_data_reasons: string[] = [];

    // 1. Authoritative Financial State from Canonical Finance Service
    const has_monthly_data = Boolean(canonicalState?.data_status.has_observed_transactions);
    const income = canonicalState?.income.monthly_net_income ?? 0;
    const expenses = canonicalState?.expenses.total_monthly_expenses ?? 0;
    const surplus = canonicalState?.cashflow.actual_monthly_surplus ?? (income - expenses);
    const savingsRate = canonicalState?.cashflow.savings_rate ?? (income > 0 ? Math.max(0, Math.round(((surplus / income) * 100) * 100) / 100) : 0);

    const topCategories = (canonicalState?.expenses.top_categories || []).slice(0, 5).map((c: any) => ({
      category: c.category || 'Uncategorized',
      amount: Number(c.amount) || 0,
      percentage: Number(c.percentage) || 0,
    }));

    if (!has_monthly_data && canonicalState?.data_status.income_source === 'missing') {
      missing_data_reasons.push(`No recorded transaction summary found for month ${month}.`);
    }

    if (canonicalState?.missing_fields?.length > 0) {
      for (const field of canonicalState.missing_fields) {
        if (!missing_data_reasons.some((r) => r.includes(field))) {
          missing_data_reasons.push(`Missing profile or ledger field: ${field}`);
        }
      }
    }

    // 2. Financial Profile (Phase 3)
    let profile: any = null;
    try {
      profile = await allocationService.getProfile(userId);
    } catch {
      // Profile not configured yet
    }

    const has_financial_profile = Boolean(profile);
    if (!has_financial_profile) {
      missing_data_reasons.push('Financial profile (essential expenses, age, existing liquid savings) is not set up.');
    }

    // 3. Goals (Phase 3)
    let goalsList: any[] = [];
    try {
      goalsList = await allocationService.listGoals(userId);
    } catch {
      // Goals not yet recorded
    }

    const has_goals = goalsList.length > 0;
    if (!has_goals) {
      missing_data_reasons.push('No active savings goals recorded.');
    }

    const sanitizedGoals = goalsList.map((g) => ({
      id: g.id,
      title: g.title,
      target_amount: Number(g.target_amount) || 0,
      current_amount: Number(g.current_amount) || 0,
      target_date: g.target_date || undefined,
    }));

    // 4. Monthly Allocation Plan (Phase 3)
    let allocationPlan: any = null;
    try {
      allocationPlan = await allocationService.getPlanForMonth(userId, month);
      if (!allocationPlan && has_financial_profile) {
        // Auto-generate deterministic plan if profile exists
        allocationPlan = await allocationService.generatePlanForMonth(userId, month);
      }
    } catch {
      // Allocation plan unavailable
    }

    const has_allocation_plan = Boolean(allocationPlan);
    const has_emergency_data = Boolean(
      profile?.existing_liquid_savings !== undefined || allocationPlan?.emergency_fund
    );

    if (!has_emergency_data) {
      missing_data_reasons.push('Emergency fund target or current liquid balance is not configured.');
    }

    // 5. Financial Freedom Status (Phase 4)
    let freedomStatus: any = null;
    try {
      freedomStatus = await freedomService.getFreedomStatus(userId, month);
    } catch {
      // Freedom engine unavailable
    }

    const has_freedom_data = Boolean(freedomStatus?.active_scenario && freedomStatus.active_scenario.indicative_target_corpus > 0);
    if (!has_freedom_data) {
      missing_data_reasons.push('Financial freedom timeline and target corpus have not been calculated.');
    }

    // Assemble deterministic context
    const context: DeterministicFinancialContext = {
      month,
      has_financial_profile,
      has_monthly_data,
      has_goals,
      has_allocation_plan,
      has_freedom_data,
      has_emergency_data,
      current_month: {
        income,
        expenses,
        surplus,
        savings_rate: savingsRate,
        top_expense_categories: topCategories,
      },
      goals: sanitizedGoals,
      missing_data_reasons,
    };

    if (profile) {
      context.financial_profile = {
        age: profile.age,
        monthly_income: Number(profile.monthly_income) || 0,
        monthly_essential_expenses: Number(profile.monthly_essential_expenses) || 0,
        monthly_debt_obligations: Number(profile.monthly_debt_obligations) || 0,
        existing_liquid_savings: Number(profile.existing_liquid_savings) || 0,
        existing_investments: Number(profile.existing_investments) || 0,
        dependents: profile.dependents ?? 0,
        has_health_insurance: Boolean(profile.has_health_insurance),
        has_life_insurance: Boolean(profile.has_life_insurance),
        emergency_fund_target_months: profile.emergency_fund_target_months ?? 6,
        target_retirement_age: profile.target_retirement_age,
        desired_monthly_lifestyle_income: Number(profile.desired_monthly_lifestyle_income) || 0,
        // Legacy backward-compatibility aliases
        essential_expenses: Number(profile.monthly_essential_expenses) || 0,
        debt_obligations: Number(profile.monthly_debt_obligations) || 0,
        insurance_status: {
          has_health_insurance: Boolean(profile.has_health_insurance),
          has_term_life_insurance: Boolean(profile.has_life_insurance),
        },
      };
    }

    if (allocationPlan?.emergency_fund) {
      const efAlloc = Number(allocationPlan.allocations?.emergency_fund) || 0;
      const goalsAlloc = Number(allocationPlan.allocations?.goals) || 0;
      const ltAlloc = Number(allocationPlan.allocations?.long_term_wealth) || 0;
      const bufAlloc = Number(allocationPlan.allocations?.flexible_buffer) || 0;
      const totalAlloc = Number(allocationPlan.allocations?.total_allocated) || (efAlloc + goalsAlloc + ltAlloc + bufAlloc);

      context.allocation = {
        emergency_fund_target: Number(allocationPlan.emergency_fund.emergency_fund_target) || 0,
        emergency_fund_current: Number(allocationPlan.emergency_fund.existing_liquid_savings) || 0,
        emergency_gap: Number(allocationPlan.emergency_fund.emergency_fund_gap) || 0,
        current_monthly_allocation: {
          emergency_fund: efAlloc,
          goals: goalsAlloc,
          long_term: ltAlloc,
          long_term_wealth: ltAlloc,
          buffer: bufAlloc,
          flexible_buffer: bufAlloc,
          total_allocated: totalAlloc,
        },
        total_allocated: totalAlloc,
      };
    } else if (profile || canonicalState?.capital_and_savings?.emergency_fund_target != null) {
      const target = canonicalState?.capital_and_savings?.emergency_fund_target ??
        ((Number(profile?.monthly_essential_expenses) || expenses) * (Number(profile?.emergency_fund_target_months) || 6));
      const current = canonicalState?.capital_and_savings?.liquid_savings ?? (Number(profile?.existing_liquid_savings) || 0);
      const gap = Math.max(0, target - current);
      const efAlloc = Math.min(surplus > 0 ? surplus : 0, gap);
      context.allocation = {
        emergency_fund_target: target,
        emergency_fund_current: current,
        emergency_gap: gap,
        current_monthly_allocation: {
          emergency_fund: efAlloc,
          goals: 0,
          long_term: 0,
          long_term_wealth: 0,
          buffer: 0,
          flexible_buffer: 0,
          total_allocated: efAlloc,
        },
        total_allocated: efAlloc,
      };
    }

    if (freedomStatus && freedomStatus.active_scenario) {
      const active = freedomStatus.active_scenario;
      context.financial_freedom = {
        current_wealth:
          freedomStatus.initial_investable_wealth ??
          Number(freedomStatus.existing_liquid_savings || 0) + Number(freedomStatus.existing_investments || 0),
        indicative_target_corpus: active.indicative_target_corpus,
        projected_wealth: active.projected_wealth_at_target_age,
        funding_gap: active.funding_gap,
        required_monthly_contribution: active.required_monthly_contribution,
        target_age: freedomStatus.target_age,
        selected_scenario: freedomStatus.active_scenario_name,
        assumptions: {
          expected_return_pct: active.expected_return_pct,
          inflation_rate_pct: active.inflation_rate_pct,
          withdrawal_rate_pct: active.withdrawal_rate_pct,
        },
        on_track: active.status === 'On Track' || active.status === 'Ahead of Target',
      };
    }

    // 5. Phase 6 Action Engine Plan
    try {
      const plan = await actionService.getActionPlanForMonth(userId, month);
      if (plan) {
        context.action_plan = {
          surplus: plan.monthly_surplus,
          actions: plan.actions.map((a) => ({
            priority: a.priority,
            title: a.title,
            allocated_amount: a.allocated_amount,
            why_rationale: a.why_rationale,
          })),
          total_allocated: plan.allocations.total_allocated,
        };
      }
    } catch {
      // Action plan unavailable
    }

    return context;
  }

  /**
   * Deterministically parses a user query to extract affordability purchase intent
   */
  parseAffordabilityQuery(query: string): {
    isAffordabilityQuery: boolean;
    amount?: number;
    itemDescription?: string;
  } {
    const normalized = query.trim().toLowerCase();
    const affordabilityTrigger =
      /\b(can\s+i\s+(afford|buy|purchase|spend|get)|should\s+i\s+(buy|purchase|spend)|afford\s+(a|an)?|affordability)\b/i.test(
        normalized
      );

    if (!affordabilityTrigger) {
      return { isAffordabilityQuery: false };
    }

    // Match currency amounts: ₹20,000 / Rs. 20000 / 20000 INR / 20000 rupees / plain numbers after triggers
    const amountRegex =
      /(?:₹|rs\.?|inr)?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+(?:\.[0-9]+)?)\s*(?:₹|rs\.?|inr|rupees)?/gi;

    let amount: number | undefined;
    let match: RegExpExecArray | null;

    // Scan for numbers in proximity to keywords
    while ((match = amountRegex.exec(normalized)) !== null) {
      const rawNum = match[1].replace(/,/g, '');
      const parsed = parseFloat(rawNum);
      // Filter out small numbers like years (2025) or month counts unless explicit
      if (!isNaN(parsed) && parsed > 50 && parsed !== 2024 && parsed !== 2025 && parsed !== 2026) {
        amount = parsed;
        break;
      }
    }

    // Extract item description if present
    const itemRegex =
      /(?:afford|buy|purchase|spend|get)\s+(?:a|an)?\s*(?:₹|rs\.?|inr)?\s*[\d,]*\s*(?:on|for)?\s*(?:a|an)?\s*([a-z0-9\s-]{2,30}?)(?:\?|$|\.|\,)/i;
    const itemMatch = normalized.match(itemRegex);
    const itemDescription = itemMatch ? itemMatch[1].trim() : undefined;

    return {
      isAffordabilityQuery: true,
      amount,
      itemDescription,
    };
  }

  /**
   * Evaluates affordability deterministically against surplus, emergency fund status, and goals.
   * Absolutely NO recommendation of loans, EMIs, or financing products.
   */
  evaluateAffordability(
    context: DeterministicFinancialContext,
    amount: number,
    itemDescription?: string
  ): AffordabilityEvaluation {
    const surplus = context.current_month.surplus;
    const income = context.current_month.income;
    const expenses = context.current_month.expenses;
    const emergencyGap = context.allocation?.emergency_gap ?? 0;
    const emergencyFundStatus = !context.has_emergency_data
      ? 'unknown'
      : emergencyGap === 0
      ? 'funded'
      : 'gap_exists';

    let verdict: AffordabilityEvaluation['verdict'] = 'comfortable';
    let monthsNeeded = 1;
    let deterministicNotes = '';
    let impactOnGoals = 'None directly if covered from surplus.';

    if (surplus <= 0) {
      verdict = 'unaffordable_due_to_deficit_or_safety';
      monthsNeeded = Infinity;
      deterministicNotes = `Current monthly cash flow is in deficit or zero surplus (Income: ₹${income.toLocaleString('en-IN')}, Expenses: ₹${expenses.toLocaleString('en-IN')}, Surplus: ₹${surplus.toLocaleString('en-IN')}). Discretionary one-time purchases will cause or expand debt.`;
      impactOnGoals = 'High risk: Discretionary expenditure under cash deficit diverts essentials or triggers high-interest borrowing.';
    } else if (emergencyGap > 0) {
      // Emergency reserve is underfunded
      if (amount > surplus) {
        verdict = 'unaffordable_due_to_deficit_or_safety';
        monthsNeeded = Math.ceil(amount / surplus);
        deterministicNotes = `The proposed purchase of ₹${amount.toLocaleString('en-IN')} exceeds your monthly surplus of ₹${surplus.toLocaleString('en-IN')}, while your emergency fund is still underfunded with a gap of ₹${emergencyGap.toLocaleString('en-IN')}. Emergency liquidity takes strict priority.`;
        impactOnGoals = `Delays emergency cushion by at least ${monthsNeeded} months.`;
      } else {
        verdict = 'caution_tight';
        monthsNeeded = 1;
        deterministicNotes = `The proposed purchase of ₹${amount.toLocaleString('en-IN')} fits within this month's surplus of ₹${surplus.toLocaleString('en-IN')}, but your emergency fund still has a deficit of ₹${emergencyGap.toLocaleString('en-IN')}. Allocating surplus here will slow down building your emergency safety cushion.`;
        impactOnGoals = `Slows emergency reserve replenishment by ₹${amount.toLocaleString('en-IN')}.`;
      }
    } else {
      // Emergency fund fully funded
      if (amount <= surplus) {
        verdict = 'comfortable';
        monthsNeeded = 1;
        deterministicNotes = `Emergency reserve is fully funded and the purchase of ₹${amount.toLocaleString('en-IN')} is completely covered within your monthly surplus of ₹${surplus.toLocaleString('en-IN')}. Can be absorbed without touching long-term capital or incurring debt.`;
        impactOnGoals = 'No adverse impact on emergency reserve or existing long-term allocations.';
      } else {
        verdict = 'caution_tight';
        monthsNeeded = Math.ceil(amount / surplus);
        deterministicNotes = `Emergency reserve is protected, but ₹${amount.toLocaleString('en-IN')} exceeds a single month's surplus of ₹${surplus.toLocaleString('en-IN')}. It is affordable by saving surplus across ${monthsNeeded} months, without taking on high-cost loans or dipping into emergency reserves.`;
        impactOnGoals = `Requires dedicating full monthly surplus for ${monthsNeeded} months.`;
      }
    }

    return {
      proposed_amount: amount,
      item_description: itemDescription,
      monthly_surplus: surplus,
      monthly_income: income,
      monthly_expenses: expenses,
      emergency_fund_status: emergencyFundStatus,
      emergency_gap: emergencyGap,
      verdict,
      months_of_surplus_needed: monthsNeeded,
      impact_on_goals: impactOnGoals,
      deterministic_notes: deterministicNotes,
    };
  }
}

export const financialContextService = new FinancialContextService();
