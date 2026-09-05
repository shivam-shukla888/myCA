'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  allocationApi,
  freedomApi,
  actionApi,
  FinancialProfile,
  FinancialGoal,
  MonthlyAllocationPlan,
  ActionPlan,
  FreedomAnalysisResponse,
  UserActionOverride,
} from '../../lib/api';
import {
  Sliders,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Lock,
  RotateCcw,
  Check,
  Zap,
} from 'lucide-react';

export default function PlanPage() {
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  const [profile, setProfile] = useState<FinancialProfile | null>(null);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [currentPlan, setCurrentPlan] = useState<MonthlyAllocationPlan | null>(null);
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [actionHistory, setActionHistory] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // User Overrides State
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [overrideEmergency, setOverrideEmergency] = useState<string>('');
  const [overridePrioritizedGoal, setOverridePrioritizedGoal] = useState<string>('');
  const [overrideBuffer, setOverrideBuffer] = useState<string>('');
  const [pausedGoals, setPausedGoals] = useState<string[]>([]);

  // What-If Simulation State
  const [simSurplusDelta, setSimSurplusDelta] = useState<number>(0);
  const [simExpenseDelta, setSimExpenseDelta] = useState<number>(0);
  const [simEmergencyMonths, setSimEmergencyMonths] = useState<number>(6);
  const [simulatedPlan, setSimulatedPlan] = useState<ActionPlan | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Profile Form State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [formAge, setFormAge] = useState('30');
  const [formEssentialExpenses, setFormEssentialExpenses] = useState('35000');
  const [formLiquidSavings, setFormLiquidSavings] = useState('150000');
  const [formInvestments, setFormInvestments] = useState('300000');
  const [formDebtObligations, setFormDebtObligations] = useState('0');
  const [formDependents, setFormDependents] = useState('0');
  const [formHealthInsurance, setFormHealthInsurance] = useState(true);
  const [formLifeInsurance, setFormLifeInsurance] = useState(false);
  const [formTargetMonths, setFormTargetMonths] = useState('6');
  const [formTargetAge, setFormTargetAge] = useState('55');
  const [formDesiredIncome, setFormDesiredIncome] = useState('100000');

  // Phase 4: Freedom Calculator State
  const [freedomData, setFreedomData] = useState<FreedomAnalysisResponse | null>(null);

  // Goal Form State
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTargetAmount, setGoalTargetAmount] = useState('');
  const [goalCurrentAmount, setGoalCurrentAmount] = useState('0');
  const [goalType, setGoalType] = useState<FinancialGoal['goal_type']>('savings');
  const [goalPriority, setGoalPriority] = useState<FinancialGoal['priority']>('medium');

  const monthDisplayLabel = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, 1));
    return dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }, [currentMonth]);

  function changeMonth(delta: number) {
    const [year, month] = currentMonth.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    const newY = d.getUTCFullYear();
    const newM = String(d.getUTCMonth() + 1).padStart(2, '0');
    setCurrentMonth(`${newY}-${newM}`);
    setSimulatedPlan(null);
  }

  async function loadInitialData() {
    setLoading(true);
    setError(null);
    try {
      const [profRes, goalsRes, historyRes, actHistoryRes] = await Promise.all([
        allocationApi.getProfile(),
        allocationApi.listGoals(),
        allocationApi.listPlanHistory(),
        actionApi.getHistory().catch(() => []),
      ]);

      if (profRes) {
        setProfile(profRes);
        setFormAge(profRes.age ? String(profRes.age) : '30');
        setFormEssentialExpenses(String(profRes.monthly_essential_expenses || 0));
        setFormLiquidSavings(String(profRes.existing_liquid_savings || 0));
        setFormInvestments(String(profRes.existing_investments || 0));
        setFormDebtObligations(String(profRes.monthly_debt_obligations || 0));
        setFormDependents(String(profRes.dependents || 0));
        setFormHealthInsurance(Boolean(profRes.has_health_insurance));
        setFormLifeInsurance(Boolean(profRes.has_life_insurance));
        setFormTargetMonths(String(profRes.emergency_fund_target_months || 6));
        setFormTargetAge(profRes.target_retirement_age ? String(profRes.target_retirement_age) : '55');
        setFormDesiredIncome(String(profRes.desired_monthly_lifestyle_income || 0));
        setSimEmergencyMonths(profRes.emergency_fund_target_months || 6);
      }

      setGoals(goalsRes || []);
      setActionHistory(actHistoryRes || []);

      // Freedom Calculator status
      try {
        const freedomRes = await freedomApi.getStatus();
        setFreedomData(freedomRes);
      } catch {
        // Freedom unconfigured
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load allocation data');
    } finally {
      setLoading(false);
    }
  }

  async function loadOrGenerateActionPlan(month: string, overrides?: UserActionOverride) {
    setPlanLoading(true);
    setError(null);
    try {
      const plan = await actionApi.generatePlan(month, overrides);
      setActionPlan(plan);
      if (plan.user_overrides?.custom_emergency_allocation !== undefined) {
        setOverrideEmergency(String(plan.user_overrides.custom_emergency_allocation));
      }
      if (plan.user_overrides?.custom_buffer_amount !== undefined) {
        setOverrideBuffer(String(plan.user_overrides.custom_buffer_amount));
      }
      if (plan.user_overrides?.prioritized_goal_id) {
        setOverridePrioritizedGoal(plan.user_overrides.prioritized_goal_id);
      }
      if (plan.user_overrides?.paused_goal_ids) {
        setPausedGoals(plan.user_overrides.paused_goal_ids);
      }
      const actHistoryRes = await actionApi.getHistory().catch(() => []);
      setActionHistory(actHistoryRes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to compute action plan');
    } finally {
      setPlanLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadOrGenerateActionPlan(currentMonth);
  }, [currentMonth]);

  async function handleApplyOverrides() {
    const overrides: UserActionOverride = {};
    if (overrideEmergency !== '') {
      const val = parseFloat(overrideEmergency);
      if (!isNaN(val) && val >= 0) overrides.custom_emergency_allocation = val;
    }
    if (overrideBuffer !== '') {
      const val = parseFloat(overrideBuffer);
      if (!isNaN(val) && val >= 0) overrides.custom_buffer_amount = val;
    }
    if (overridePrioritizedGoal) {
      overrides.prioritized_goal_id = overridePrioritizedGoal;
    }
    if (pausedGoals.length > 0) {
      overrides.paused_goal_ids = pausedGoals;
    }

    await loadOrGenerateActionPlan(currentMonth, Object.keys(overrides).length > 0 ? overrides : undefined);
    setNotificationMsg('Custom priorities applied to action plan.');
    setTimeout(() => setNotificationMsg(null), 4000);
  }

  async function handleResetOverrides() {
    setOverrideEmergency('');
    setOverrideBuffer('');
    setOverridePrioritizedGoal('');
    setPausedGoals([]);
    await loadOrGenerateActionPlan(currentMonth);
    setNotificationMsg('Plan reset to deterministic priority baseline.');
    setTimeout(() => setNotificationMsg(null), 4000);
  }

  async function handleConfirmPlan() {
    setConfirmLoading(true);
    try {
      const confirmed = await actionApi.confirmPlan(currentMonth, actionPlan?.user_overrides);
      setActionPlan(confirmed);
      const actHistoryRes = await actionApi.getHistory().catch(() => []);
      setActionHistory(actHistoryRes || []);
      setNotificationMsg(`Action plan for ${currentMonth} locked into historical records.`);
      setTimeout(() => setNotificationMsg(null), 4000);
    } catch (err: any) {
      alert(`Confirm plan failed: ${err.message}`);
    } finally {
      setConfirmLoading(false);
    }
  }

  async function handleRunWhatIf() {
    setIsSimulating(true);
    try {
      const sim = await actionApi.simulate({
        month: currentMonth,
        surplus_delta: simSurplusDelta,
        expense_delta: simExpenseDelta,
        simulated_emergency_months: simEmergencyMonths,
        overrides: actionPlan?.user_overrides,
      });
      setSimulatedPlan(sim);
    } catch (err: any) {
      alert(`What-if simulation error: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload: Partial<FinancialProfile> = {
        age: parseInt(formAge, 10) || undefined,
        monthly_essential_expenses: parseFloat(formEssentialExpenses) || 0,
        existing_liquid_savings: parseFloat(formLiquidSavings) || 0,
        existing_investments: parseFloat(formInvestments) || 0,
        monthly_debt_obligations: parseFloat(formDebtObligations) || 0,
        dependents: parseInt(formDependents, 10) || 0,
        has_health_insurance: formHealthInsurance,
        has_life_insurance: formLifeInsurance,
        emergency_fund_target_months: parseInt(formTargetMonths, 10) || 6,
        target_retirement_age: parseInt(formTargetAge, 10) || undefined,
        desired_monthly_lifestyle_income: parseFloat(formDesiredIncome) || 0,
      };

      const updated = await allocationApi.saveProfile(payload);
      setProfile(updated);
      setIsEditingProfile(false);
      await loadOrGenerateActionPlan(currentMonth);
    } catch (err: any) {
      alert(`Save profile failed: ${err.message}`);
    }
  }

  async function handleCreateGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!goalTitle || !goalTargetAmount) return;

    try {
      await allocationApi.createGoal({
        title: goalTitle.trim(),
        target_amount: parseFloat(goalTargetAmount),
        current_amount: parseFloat(goalCurrentAmount) || 0,
        goal_type: goalType,
        priority: goalPriority,
      });

      setGoalTitle('');
      setGoalTargetAmount('');
      setGoalCurrentAmount('0');
      setIsGoalModalOpen(false);

      const goalsRes = await allocationApi.listGoals();
      setGoals(goalsRes || []);
      await loadOrGenerateActionPlan(currentMonth);
    } catch (err: any) {
      alert(`Create goal failed: ${err.message}`);
    }
  }

  const activePlanToDisplay = simulatedPlan || actionPlan;
  const isDeficit = activePlanToDisplay?.is_deficit ?? false;
  const surplus = activePlanToDisplay?.monthly_surplus ?? 0;

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="meta-tag" style={{ color: 'var(--signal-forest)' }}>PHASE 6 • FINANCIAL ACTION ENGINE</div>
          <h1 style={{ fontSize: '26px', fontWeight: 600, margin: '4px 0 0 0', letterSpacing: '-0.02em' }}>
            Financial Action Command Center
          </h1>
          <p style={{ color: 'var(--ink-secondary)', margin: '6px 0 0 0', fontSize: '13.5px' }}>
            Deterministic, priority-driven money execution plan answering: <em>&quot;I have ₹X left this month. What should I do with it?&quot;</em>
          </p>
        </div>

        {/* Month Selector Bar & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--canvas-inset)', border: '1px solid var(--border-hairline)', padding: '4px' }}>
            <button onClick={() => changeMonth(-1)} className="action-link" title="Previous Month" style={{ padding: '6px 8px', display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={16} />
            </button>
            <div style={{ padding: '0 12px', textAlign: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '14px' }}>
                {monthDisplayLabel}
              </span>
            </div>
            <button onClick={() => changeMonth(1)} className="action-link" title="Next Month" style={{ padding: '6px 8px', display: 'flex', alignItems: 'center' }}>
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={() => loadOrGenerateActionPlan(currentMonth)}
            disabled={planLoading}
            className="instrument-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px' }}
            title="Recalculate plan from deterministic services"
          >
            <RefreshCw size={14} className={planLoading ? 'spin' : ''} />
            <span>Recalculate</span>
          </button>

          <button
            onClick={handleConfirmPlan}
            disabled={confirmLoading || Boolean(actionPlan?.confirmed_at)}
            className="instrument-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              background: actionPlan?.confirmed_at ? 'rgba(34, 197, 94, 0.15)' : 'var(--signal-forest)',
              color: '#fff',
              border: 'none',
              cursor: actionPlan?.confirmed_at ? 'default' : 'pointer'
            }}
            title={actionPlan?.confirmed_at ? 'Plan locked in historical archive' : 'Confirm and lock this monthly plan'}
          >
            <Lock size={14} />
            <span>{actionPlan?.confirmed_at ? 'Plan Locked' : 'Confirm Plan'}</span>
          </button>
        </div>
      </div>

      {notificationMsg && (
        <div style={{ padding: '12px 18px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid var(--signal-forest)', color: 'var(--signal-forest)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
          <CheckCircle2 size={16} />
          <span>{notificationMsg}</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '14px 18px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--signal-alert)', color: 'var(--signal-alert)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* # THIS MONTH HERO BANNER */}
      <div style={{
        background: 'var(--canvas-surface)',
        border: '1px solid var(--border-hairline)',
        padding: '24px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div>
          <div className="meta-tag" style={{ color: 'var(--ink-secondary)' }}>
            # THIS MONTH • {monthDisplayLabel.toUpperCase()}
          </div>
          <div style={{ fontSize: '36px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: isDeficit ? 'var(--signal-alert)' : 'var(--signal-forest)', marginTop: '4px' }}>
            {isDeficit ? '-' : '+'}₹{Math.abs(surplus).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--ink-secondary)', marginTop: '4px' }}>
            {isDeficit
              ? 'MONTHLY DEFICIT DETECTED • CAPITAL ALLOCATION PAUSED'
              : 'AVAILABLE TO ALLOCATE ACROSS PRIORITIES'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div>
            <div className="meta-tag">INCOME</div>
            <div style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--ink-primary)', marginTop: '2px' }}>
              ₹{(activePlanToDisplay?.monthly_income ?? 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <div className="meta-tag">EXPENSES</div>
            <div style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--ink-primary)', marginTop: '2px' }}>
              ₹{(activePlanToDisplay?.monthly_expenses ?? 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div style={{ paddingLeft: '16px', borderLeft: '1px solid var(--border-hairline)' }}>
            <div className="meta-tag">INVARIANT INTEGRITY</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--signal-forest)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <CheckCircle2 size={16} />
              <span>100% Exact (₹{activePlanToDisplay?.allocations.total_allocated.toLocaleString('en-IN')})</span>
            </div>
          </div>
        </div>

        {actionPlan?.confirmed_at && (
          <div style={{ position: 'absolute', top: '12px', right: '16px', fontSize: '11px', color: 'var(--ink-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Lock size={12} />
            <span>Locked on {new Date(actionPlan.confirmed_at).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {/* ## YOUR ACTION PLAN */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>## YOUR ACTION PLAN</h2>
            <p style={{ color: 'var(--ink-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
              Priority-driven deterministic money allocations for {monthDisplayLabel}.
            </p>
          </div>
          {activePlanToDisplay?.user_override_applied && (
            <span style={{ fontSize: '12px', padding: '4px 10px', background: 'rgba(234, 179, 8, 0.15)', color: '#ca8a04', fontWeight: 600, borderRadius: '4px' }}>
              User Override Active
            </span>
          )}
        </div>

        {/* Action Item Cards */}
        {isDeficit ? (
          <div style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid var(--signal-alert)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--signal-alert)', fontWeight: 600 }}>
              <ShieldAlert size={20} />
              <span style={{ fontSize: '16px' }}>PRIORITY P0 • CASHFLOW DEFICIT RECOVERY</span>
            </div>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--ink-primary)' }}>
              {activePlanToDisplay?.primary_summary}
            </p>
            {activePlanToDisplay?.deficit_analysis && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--ink-secondary)', marginTop: '8px' }}>
                <div>• Monthly Deficit: ₹{activePlanToDisplay.deficit_analysis.monthly_deficit.toLocaleString('en-IN')}</div>
                <div>• Essential Expense Absorption: {activePlanToDisplay.deficit_analysis.essential_expense_ratio}% of income</div>
                <div>• Debt Pressure Ratio: {activePlanToDisplay.deficit_analysis.debt_pressure_ratio}% of income</div>
                {activePlanToDisplay.deficit_analysis.largest_spending_category && (
                  <div>• Largest Outflow Pressure: {activePlanToDisplay.deficit_analysis.largest_spending_category.category} (₹{activePlanToDisplay.deficit_analysis.largest_spending_category.amount.toLocaleString('en-IN')})</div>
                )}
                <div style={{ marginTop: '6px', fontWeight: 600, color: 'var(--ink-primary)' }}>
                  Recommended Immediate Steps:
                </div>
                {activePlanToDisplay.deficit_analysis.recommended_actions.map((act, i) => (
                  <div key={i}> {i + 1}. {act}</div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* 1. Emergency Fund */}
            <div style={{ background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="meta-tag" style={{ color: 'var(--signal-forest)' }}>PRIORITY 1 • SAFETY</span>
                <ShieldCheck size={18} style={{ color: 'var(--signal-forest)' }} />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>1. Emergency Fund</div>
              <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--signal-forest)' }}>
                ₹{(activePlanToDisplay?.allocations.emergency_fund ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
                {activePlanToDisplay?.actions.find((a) => a.category === 'emergency_fund')?.why_rationale}
              </p>
            </div>

            {/* 2. Goals */}
            <div style={{ background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="meta-tag" style={{ color: 'var(--ink-primary)' }}>PRIORITY 2 • GOALS</span>
                <Target size={18} style={{ color: 'var(--ink-primary)' }} />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>2. Near-Term Goals</div>
              <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--signal-forest)' }}>
                ₹{(activePlanToDisplay?.allocations.goals ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
                {activePlanToDisplay?.actions.find((a) => a.category === 'goals')?.why_rationale}
              </p>
              {activePlanToDisplay?.ranked_goals && activePlanToDisplay.ranked_goals.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', color: 'var(--ink-secondary)' }}>
                  {activePlanToDisplay.ranked_goals.map((g) => (
                    <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>#{g.priority_rank} {g.title}{g.is_paused ? ' (Paused)' : ''}:</span>
                      <span style={{ fontWeight: 600, color: 'var(--ink-primary)' }}>₹{g.allocated_amount.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Long-Term Wealth */}
            <div style={{ background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="meta-tag" style={{ color: 'var(--signal-forest)' }}>PRIORITY 3 • FREEDOM</span>
                <TrendingUp size={18} style={{ color: 'var(--signal-forest)' }} />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>3. Long-Term Wealth</div>
              <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--signal-forest)' }}>
                ₹{(activePlanToDisplay?.allocations.long_term_wealth ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
                {activePlanToDisplay?.actions.find((a) => a.category === 'long_term_wealth')?.why_rationale}
              </p>
              <div style={{ fontSize: '11px', color: 'var(--ink-tertiary)' }}>
                *(Abstract wealth allocation; no individual securities)*
              </div>
            </div>

            {/* 4. Flexible Buffer */}
            <div style={{ background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', padding: '22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="meta-tag" style={{ color: 'var(--ink-secondary)' }}>PRIORITY 4 • LIQUIDITY</span>
                <Wallet size={18} style={{ color: 'var(--ink-secondary)' }} />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>4. Flexible Buffer</div>
              <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--ink-primary)' }}>
                ₹{(activePlanToDisplay?.allocations.flexible_buffer ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
                {activePlanToDisplay?.actions.find((a) => a.category === 'flexible_buffer')?.why_rationale}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ## WHY (Deterministic Rationale) */}
      <div style={{ background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} style={{ color: 'var(--signal-forest)' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>## WHY</h2>
        </div>
        <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--ink-primary)', fontWeight: 500 }}>
          {activePlanToDisplay?.primary_summary}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', fontSize: '12.5px', marginTop: '4px' }}>
          {activePlanToDisplay?.actions.map((act, idx) => (
            <div key={idx} style={{ padding: '12px', background: 'var(--canvas-inset)', border: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span className="meta-tag">{act.priority_label}</span>
              <div style={{ fontWeight: 600 }}>{act.title} — ₹{act.allocated_amount.toLocaleString('en-IN')}</div>
              <div style={{ color: 'var(--ink-secondary)' }}>{act.why_rationale}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ## FINANCIAL FREEDOM */}
      <div style={{ background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>## FINANCIAL FREEDOM</h2>
          <p style={{ color: 'var(--ink-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Alignment between this month&apos;s allocation capacity and your actuarial independence target.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', padding: '16px', background: 'var(--canvas-inset)', border: '1px solid var(--border-hairline)' }}>
          <div>
            <div className="meta-tag">CURRENT MONTH CONTRIBUTION</div>
            <div style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--signal-forest)', marginTop: '4px' }}>
              ₹{(activePlanToDisplay?.financial_freedom.current_monthly_contribution ?? 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <div className="meta-tag">REQUIRED CONTRIBUTION</div>
            <div style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--ink-primary)', marginTop: '4px' }}>
              ₹{(activePlanToDisplay?.financial_freedom.required_monthly_contribution ?? 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <div className="meta-tag">FREEDOM CONTRIBUTION GAP</div>
            <div style={{
              fontSize: '20px',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              color: (activePlanToDisplay?.financial_freedom.contribution_gap ?? 0) > 0 ? 'var(--signal-alert)' : 'var(--signal-forest)',
              marginTop: '4px'
            }}>
              ₹{(activePlanToDisplay?.financial_freedom.contribution_gap ?? 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <div className="meta-tag">TARGET CORPUS</div>
            <div style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--ink-primary)', marginTop: '4px' }}>
              ₹{((activePlanToDisplay?.financial_freedom.target_corpus ?? 0) / 10000000).toFixed(2)} Cr
            </div>
          </div>
        </div>
      </div>

      {/* ## CHANGE THE PLAN (User Controls & Overrides) */}
      <div style={{ background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>## CHANGE THE PLAN</h2>
            <p style={{ color: 'var(--ink-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
              Adjust priorities explicitly without altering underlying financial profile records.
            </p>
          </div>
          <button
            onClick={() => setIsOverrideOpen(!isOverrideOpen)}
            className="instrument-btn"
            style={{ padding: '8px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Sliders size={14} />
            <span>{isOverrideOpen ? 'Hide Controls' : 'Adjust Priorities'}</span>
          </button>
        </div>

        {isOverrideOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', background: 'var(--canvas-inset)', border: '1px solid var(--border-hairline)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              {/* Emergency Reserve Override */}
              <div>
                <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>
                  Custom Emergency Reserve Allocation (INR)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Auto-calculated"
                  value={overrideEmergency}
                  onChange={(e) => setOverrideEmergency(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', outline: 'none', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              {/* Goal Priority Selection */}
              <div>
                <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>
                  Prioritize Specific Goal
                </label>
                <select
                  value={overridePrioritizedGoal}
                  onChange={(e) => setOverridePrioritizedGoal(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', outline: 'none' }}
                >
                  <option value="">-- Deterministic Deadline Order --</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title} (Target: ₹{g.target_amount.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Cash Buffer Override */}
              <div>
                <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>
                  Custom Cash Buffer Target (INR)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Auto-reconciled"
                  value={overrideBuffer}
                  onChange={(e) => setOverrideBuffer(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', outline: 'none', fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={handleApplyOverrides} className="instrument-btn" style={{ padding: '8px 16px', background: 'var(--signal-forest)', color: '#fff', border: 'none' }}>
                Apply Custom Priorities
              </button>
              <button onClick={handleResetOverrides} className="instrument-btn" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RotateCcw size={14} />
                <span>Reset to Recommended Baseline</span>
              </button>
            </div>
          </div>
        )}

        {/* WHAT-IF SIMULATIONS */}
        <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <Zap size={16} style={{ color: 'var(--signal-forest)' }} />
            <span>Interactive What-If Simulator</span>
            <span style={{ fontSize: '11.5px', color: 'var(--ink-secondary)', fontWeight: 400 }}>
              (Pure transient simulation • never alters live data)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>
                Extra Monthly Savings: +₹{simSurplusDelta.toLocaleString('en-IN')}
              </label>
              <input
                type="range"
                min="0"
                max="50000"
                step="1000"
                value={simSurplusDelta}
                onChange={(e) => setSimSurplusDelta(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>
                Expense Increase: +₹{simExpenseDelta.toLocaleString('en-IN')}
              </label>
              <input
                type="range"
                min="0"
                max="30000"
                step="1000"
                value={simExpenseDelta}
                onChange={(e) => setSimExpenseDelta(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>
                Emergency Target: {simEmergencyMonths} Months
              </label>
              <input
                type="range"
                min="3"
                max="18"
                step="1"
                value={simEmergencyMonths}
                onChange={(e) => setSimEmergencyMonths(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleRunWhatIf} disabled={isSimulating} className="instrument-btn" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={14} className={isSimulating ? 'spin' : ''} />
              <span>Simulate Scenario</span>
            </button>
            {simulatedPlan && (
              <button onClick={() => setSimulatedPlan(null)} className="instrument-btn" style={{ padding: '8px 16px' }}>
                Clear Simulation
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CONFIRMED ACTION PLAN HISTORY */}
      <div style={{ background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-hairline)' }}>
          <div className="meta-tag">RECORD OF CONFIRMED MONTHLY ACTION PLANS</div>
          <h2 style={{ fontSize: '16px', margin: '4px 0 0 0', fontWeight: 600 }}>
            Confirmed Monthly Action History
          </h2>
        </div>

        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '120px 140px 130px 130px 130px 130px',
          padding: '10px 20px',
          background: 'var(--canvas-inset)',
          borderBottom: '1px solid var(--border-hairline)',
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          fontWeight: 600,
          color: 'var(--ink-tertiary)'
        }}>
          <div>MONTH</div>
          <div style={{ textAlign: 'right' }}>SURPLUS</div>
          <div style={{ textAlign: 'right' }}>EMERGENCY</div>
          <div style={{ textAlign: 'right' }}>GOALS</div>
          <div style={{ textAlign: 'right' }}>WEALTH</div>
          <div style={{ textAlign: 'right' }}>BUFFER</div>
        </div>

        {actionHistory.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-secondary)', fontSize: '13px' }}>
            No confirmed action plans archived yet. Click &quot;Confirm Plan&quot; to permanently store this month&apos;s plan.
          </div>
        ) : (
          actionHistory.map((h, idx) => (
            <div
              key={h.id || idx}
              onClick={() => {
                setCurrentMonth(h.month);
                setActionPlan(h);
              }}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 140px 130px 130px 130px 130px',
                padding: '12px 20px',
                borderBottom: idx < actionHistory.length - 1 ? '1px solid var(--border-hairline)' : 'none',
                alignItems: 'center',
                fontSize: '12.5px',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                background: h.month === currentMonth ? 'rgba(34, 197, 94, 0.05)' : 'transparent'
              }}
              title="Click to view this confirmed monthly plan"
            >
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={12} style={{ color: 'var(--signal-forest)' }} />
                <span>{h.month}</span>
              </div>
              <div style={{ textAlign: 'right', color: h.is_deficit ? 'var(--signal-alert)' : 'var(--signal-forest)' }}>
                {h.is_deficit ? '-' : '+'}₹{Math.abs(h.monthly_surplus).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ textAlign: 'right' }}>₹{h.allocations.emergency_fund.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <div style={{ textAlign: 'right' }}>₹{h.allocations.goals.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <div style={{ textAlign: 'right' }}>₹{h.allocations.long_term_wealth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <div style={{ textAlign: 'right' }}>₹{h.allocations.flexible_buffer.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
          ))
        )}
      </div>

      {/* Goal Modal */}
      {isGoalModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: 'var(--canvas-surface)', border: '1px solid var(--ink-primary)', width: '100%', maxWidth: '460px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Create Near-Term Goal</h3>
            <form onSubmit={handleCreateGoal} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Title *</label>
                <input
                  type="text"
                  required
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  placeholder="e.g. Vacation, Down Payment"
                  style={{ width: '100%', padding: '8px', background: 'var(--canvas-inset)', border: '1px solid var(--border-hairline)', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Target (INR) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={goalTargetAmount}
                    onChange={(e) => setGoalTargetAmount(e.target.value)}
                    placeholder="100000"
                    style={{ width: '100%', padding: '8px', background: 'var(--canvas-inset)', border: '1px solid var(--border-hairline)', outline: 'none' }}
                  />
                </div>
                <div>
                  <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Current (INR)</label>
                  <input
                    type="number"
                    min="0"
                    value={goalCurrentAmount}
                    onChange={(e) => setGoalCurrentAmount(e.target.value)}
                    placeholder="0"
                    style={{ width: '100%', padding: '8px', background: 'var(--canvas-inset)', border: '1px solid var(--border-hairline)', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Goal Category</label>
                <select
                  value={goalType}
                  onChange={(e: any) => setGoalType(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--canvas-inset)', border: '1px solid var(--border-hairline)', outline: 'none' }}
                >
                  <option value="savings">Savings Milestone</option>
                  <option value="emergency_fund">Emergency Fund Top-up</option>
                  <option value="debt_reduction">Debt Reduction</option>
                  <option value="investment">Wealth Building</option>
                  <option value="custom">Custom Goal</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setIsGoalModalOpen(false)} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border-hairline)', cursor: 'pointer', fontSize: '12px' }}>
                  Cancel
                </button>
                <button type="submit" className="instrument-btn" style={{ padding: '8px 18px' }}>
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
