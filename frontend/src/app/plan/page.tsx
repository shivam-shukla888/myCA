'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  allocationApi,
  FinancialProfile,
  FinancialGoal,
  MonthlyAllocationPlan,
} from '../../lib/api';
import {
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
  Wallet,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
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
  const [history, setHistory] = useState<MonthlyAllocationPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }

  async function loadInitialData() {
    setLoading(true);
    setError(null);
    try {
      const [profRes, goalsRes, historyRes] = await Promise.all([
        allocationApi.getProfile(),
        allocationApi.listGoals(),
        allocationApi.listPlanHistory(),
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
      }

      setGoals(goalsRes || []);
      setHistory(historyRes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load allocation data');
    } finally {
      setLoading(false);
    }
  }

  async function loadOrGeneratePlan(month: string) {
    setPlanLoading(true);
    setError(null);
    try {
      // First check if an existing plan exists
      let plan: MonthlyAllocationPlan | null = null;
      try {
        plan = await allocationApi.getPlanForMonth(month);
      } catch {
        plan = null;
      }

      // If no plan, auto-generate deterministic plan
      if (!plan) {
        plan = await allocationApi.generatePlan(month);
      }

      setCurrentPlan(plan);
      const historyRes = await allocationApi.listPlanHistory();
      setHistory(historyRes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to compute monthly allocation plan');
    } finally {
      setPlanLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadOrGeneratePlan(currentMonth);
  }, [currentMonth]);

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

      // Regenerate plan for current month with updated profile
      const newPlan = await allocationApi.generatePlan(currentMonth);
      setCurrentPlan(newPlan);
      const historyRes = await allocationApi.listPlanHistory();
      setHistory(historyRes || []);
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

      const [goalsRes, newPlan, historyRes] = await Promise.all([
        allocationApi.listGoals(),
        allocationApi.generatePlan(currentMonth),
        allocationApi.listPlanHistory(),
      ]);

      setGoals(goalsRes || []);
      setCurrentPlan(newPlan);
      setHistory(historyRes || []);
    } catch (err: any) {
      alert(`Create goal failed: ${err.message}`);
    }
  }

  async function handleDeleteGoal(id: string, title: string) {
    if (!window.confirm(`Delete goal "${title}"?`)) return;
    try {
      await allocationApi.deleteGoal(id);
      const [goalsRes, newPlan, historyRes] = await Promise.all([
        allocationApi.listGoals(),
        allocationApi.generatePlan(currentMonth),
        allocationApi.listPlanHistory(),
      ]);
      setGoals(goalsRes || []);
      setCurrentPlan(newPlan);
      setHistory(historyRes || []);
    } catch (err: any) {
      alert(`Delete goal failed: ${err.message}`);
    }
  }

  const isDeficit = currentPlan?.is_deficit ?? false;
  const surplus = currentPlan?.monthly_surplus ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        padding: '24px',
        background: 'var(--canvas-surface)',
        border: '1px solid var(--border-hairline)'
      }}>
        <div>
          <div className="meta-tag" style={{ marginBottom: '6px' }}>
            Phase 3 • Savings Allocation & Financial Freedom Foundation
          </div>
          <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 600, letterSpacing: '-0.02em' }}>
            This Month's Money Plan
          </h1>
          <p style={{ color: 'var(--ink-secondary)', margin: '4px 0 0 0', fontSize: '13.5px' }}>
            Deterministic surplus assignment: <em>"₹X बचा है — अब इसका क्या करना चाहिए?"</em>
          </p>
        </div>

        {/* Month Selector Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--canvas-inset)',
            border: '1px solid var(--border-hairline)',
            padding: '4px'
          }}>
            <button
              onClick={() => changeMonth(-1)}
              className="action-link"
              title="Previous Month"
              style={{ padding: '6px 8px', display: 'flex', alignItems: 'center' }}
            >
              <ChevronLeft size={16} />
            </button>

            <div style={{ padding: '0 12px', textAlign: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '14px' }}>
                {monthDisplayLabel}
              </span>
            </div>

            <button
              onClick={() => changeMonth(1)}
              className="action-link"
              title="Next Month"
              style={{ padding: '6px 8px', display: 'flex', alignItems: 'center' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={() => loadOrGeneratePlan(currentMonth)}
            disabled={planLoading}
            className="instrument-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px' }}
            title="Recalculate plan based on latest ledger events and profile"
          >
            <RefreshCw size={14} className={planLoading ? 'spin' : ''} />
            <span>Recalculate</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '14px 18px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid var(--signal-alert)',
          color: 'var(--signal-alert)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px'
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* SECTION 1: THIS MONTH'S MONEY PLAN */}
      <div style={{
        background: 'var(--canvas-surface)',
        border: '1px solid var(--border-hairline)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* Month Financial Bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          padding: '16px 20px',
          background: 'var(--canvas-inset)',
          border: '1px solid var(--border-hairline)'
        }}>
          <div>
            <div className="meta-tag">MONTHLY INFLOW</div>
            <div style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--signal-forest)', marginTop: '4px' }}>
              ₹{(currentPlan?.monthly_income ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="meta-tag">MONTHLY OUTFLOW</div>
            <div style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--ink-primary)', marginTop: '4px' }}>
              ₹{(currentPlan?.monthly_expenses ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="meta-tag">{isDeficit ? 'MONTHLY DEFICIT' : 'AVAILABLE SURPLUS'}</div>
            <div style={{
              fontSize: '20px',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              color: isDeficit ? 'var(--signal-alert)' : 'var(--signal-forest)',
              marginTop: '4px'
            }}>
              {isDeficit ? '-' : '+'}₹{Math.abs(surplus).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="meta-tag">STATUS & RECONCILIATION</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink-primary)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isDeficit ? (
                <span style={{ color: 'var(--signal-alert)' }}>Allocation Halted (Deficit)</span>
              ) : (
                <>
                  <CheckCircle2 size={16} style={{ color: 'var(--signal-forest)' }} />
                  <span>100% Reconciled (₹{currentPlan?.allocations.total_allocated.toLocaleString('en-IN')})</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* If Deficit Alert */}
        {isDeficit ? (
          <div style={{
            padding: '20px',
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid var(--signal-alert)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--signal-alert)', fontWeight: 600 }}>
              <ShieldAlert size={18} />
              <span>DEFICIT WARNING: CAPITAL ALLOCATION PAUSED</span>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-primary)', lineHeight: 1.5 }}>
              {currentPlan?.explanation.primary_summary}
            </p>
            {currentPlan?.explanation.deficit_pressure_analysis && (
              <div style={{ fontSize: '12.5px', color: 'var(--ink-secondary)', display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '4px' }}>
                <div>• {currentPlan.explanation.deficit_pressure_analysis.spending_pressure}</div>
                <div>• Essential expenses absorb {currentPlan.explanation.deficit_pressure_analysis.essential_expense_ratio}% of current revenue.</div>
                <div>• Debt/EMI obligations absorb {currentPlan.explanation.deficit_pressure_analysis.debt_obligation_ratio}% of current revenue.</div>
                <div style={{ fontWeight: 600, color: 'var(--ink-primary)', marginTop: '4px' }}>
                  Action: {currentPlan.explanation.deficit_pressure_analysis.recommendation}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* If Positive Surplus: 4 Deterministic Priority Allocation Cards */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              {/* Priority 1: Emergency Fund */}
              <div style={{
                background: 'var(--canvas-inset)',
                border: '1px solid var(--border-hairline)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="meta-tag" style={{ color: 'var(--ink-tertiary)' }}>PRIORITY 1 • SAFETY</span>
                  <ShieldCheck size={16} style={{ color: currentPlan?.emergency_fund.is_complete ? 'var(--signal-forest)' : 'var(--ink-primary)' }} />
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Emergency Fund</div>
                <div style={{ fontSize: '26px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--signal-forest)' }}>
                  ₹{(currentPlan?.allocations.emergency_fund ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--ink-secondary)', marginTop: '4px' }}>
                  Target: ₹{currentPlan?.emergency_fund.emergency_fund_target.toLocaleString('en-IN')} ({currentPlan?.emergency_fund.target_months} mos)
                  <br />
                  Gap: ₹{currentPlan?.emergency_fund.emergency_fund_gap.toLocaleString('en-IN')} • Coverage: {currentPlan?.emergency_fund.coverage_months} mos
                </div>
              </div>

              {/* Priority 2: Goals */}
              <div style={{
                background: 'var(--canvas-inset)',
                border: '1px solid var(--border-hairline)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="meta-tag" style={{ color: 'var(--ink-tertiary)' }}>PRIORITY 2 • HORIZONS</span>
                  <Target size={16} style={{ color: 'var(--ink-primary)' }} />
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Near-Term Goals</div>
                <div style={{ fontSize: '26px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--signal-forest)' }}>
                  ₹{(currentPlan?.allocations.goals ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--ink-secondary)', marginTop: '4px' }}>
                  {goals.filter((g) => g.status === 'active').length} active goals configured
                  <br />
                  Channeled towards designated milestone targets
                </div>
              </div>

              {/* Priority 3: Long-Term Wealth */}
              <div style={{
                background: 'var(--canvas-inset)',
                border: '1px solid var(--border-hairline)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="meta-tag" style={{ color: 'var(--ink-tertiary)' }}>PRIORITY 3 • FREEDOM</span>
                  <TrendingUp size={16} style={{ color: 'var(--signal-forest)' }} />
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Long-Term Wealth</div>
                <div style={{ fontSize: '26px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--signal-forest)' }}>
                  ₹{(currentPlan?.allocations.long_term_wealth ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--ink-secondary)', marginTop: '4px' }}>
                  Foundation bucket for financial independence
                  <br />
                  *(No securities or stock picking advised)*
                </div>
              </div>

              {/* Priority 4: Flexible Buffer */}
              <div style={{
                background: 'var(--canvas-inset)',
                border: '1px solid var(--border-hairline)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="meta-tag" style={{ color: 'var(--ink-tertiary)' }}>PRIORITY 4 • LIQUIDITY</span>
                  <Wallet size={16} style={{ color: 'var(--ink-secondary)' }} />
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Flexible Buffer</div>
                <div style={{ fontSize: '26px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--ink-primary)' }}>
                  ₹{(currentPlan?.allocations.flexible_buffer ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--ink-secondary)', marginTop: '4px' }}>
                  Uncommitted cashflow margin
                  <br />
                  Protects against day-to-day spending variance
                </div>
              </div>
            </div>

            {/* Explanation & Rationale Card */}
            <div style={{
              background: 'var(--canvas-surface)',
              border: '1px solid var(--border-hairline)',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '12.5px',
              lineHeight: 1.5
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--ink-primary)' }}>
                <Sparkles size={14} />
                <span>Deterministic Allocation Rationale</span>
              </div>
              <div style={{ color: 'var(--ink-secondary)' }}>
                • <strong>Emergency Fund: </strong>{currentPlan?.explanation.emergency_fund_rationale}
              </div>
              <div style={{ color: 'var(--ink-secondary)' }}>
                • <strong>Milestone Goals: </strong>{currentPlan?.explanation.goals_rationale}
              </div>
              <div style={{ color: 'var(--ink-secondary)' }}>
                • <strong>Long-Term Wealth: </strong>{currentPlan?.explanation.long_term_wealth_rationale}
              </div>
              <div style={{ color: 'var(--ink-secondary)' }}>
                • <strong>Buffer: </strong>{currentPlan?.explanation.buffer_rationale}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: FINANCIAL FREEDOM FOUNDATION PROGRESS */}
      <div style={{
        background: 'var(--canvas-surface)',
        border: '1px solid var(--border-hairline)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="meta-tag">FINANCIAL FREEDOM FOUNDATION</div>
            <h2 style={{ fontSize: '18px', margin: '4px 0 0 0', fontWeight: 600 }}>
              Freedom Position & Real Knowns
            </h2>
          </div>
          <button
            onClick={() => setIsEditingProfile(!isEditingProfile)}
            className="instrument-btn"
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            <Edit2 size={13} />
            <span>{isEditingProfile ? 'Close Calibration' : 'Calibrate Profile'}</span>
          </button>
        </div>

        {/* Real Knowns Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px'
        }}>
          <div style={{ background: 'var(--canvas-inset)', padding: '16px', border: '1px solid var(--border-hairline)' }}>
            <div className="meta-tag">TOTAL SAVINGS + INVESTMENTS</div>
            <div style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
              ₹{(currentPlan?.financial_freedom.current_savings_investments ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-secondary)', marginTop: '4px' }}>
              Liquid: ₹{(profile?.existing_liquid_savings || 0).toLocaleString('en-IN')} • Invested: ₹{(profile?.existing_investments || 0).toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{ background: 'var(--canvas-inset)', padding: '16px', border: '1px solid var(--border-hairline)' }}>
            <div className="meta-tag">MONTHLY CASH SURPLUS</div>
            <div style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: isDeficit ? 'var(--signal-alert)' : 'var(--signal-forest)', marginTop: '4px' }}>
              {isDeficit ? '-' : '+'}₹{Math.abs(surplus).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-secondary)', marginTop: '4px' }}>
              Continuous fuel for compounding and freedom
            </div>
          </div>

          <div style={{ background: 'var(--canvas-inset)', padding: '16px', border: '1px solid var(--border-hairline)' }}>
            <div className="meta-tag">EMERGENCY SAFETY PROGRESS</div>
            <div style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
              {currentPlan?.financial_freedom.emergency_fund_progress_pct ?? 0}%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-secondary)', marginTop: '4px' }}>
              {currentPlan?.emergency_fund.coverage_months ?? 0} of {currentPlan?.emergency_fund.target_months ?? 6} target months covered
            </div>
          </div>

          <div style={{ background: 'var(--canvas-inset)', padding: '16px', border: '1px solid var(--border-hairline)' }}>
            <div className="meta-tag">FREEDOM TARGET CORPUS</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink-secondary)', marginTop: '8px' }}>
              {currentPlan?.financial_freedom.target_corpus_status || 'Target corpus not calculated yet'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-tertiary)', marginTop: '4px' }}>
              Requires actuarial inflation & return calibration in Phase 4
            </div>
          </div>
        </div>

        {/* Profile Calibration Drawer */}
        {isEditingProfile && (
          <form onSubmit={handleSaveProfile} style={{
            padding: '20px',
            background: 'var(--canvas-inset)',
            border: '1px solid var(--ink-primary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            marginTop: '8px'
          }}>
            <div className="meta-tag" style={{ color: 'var(--ink-primary)' }}>
              PROFILE CALIBRATION & PLANNING ASSUMPTIONS
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div>
                <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Current Age</label>
                <input
                  type="number"
                  min="18"
                  max="120"
                  value={formAge}
                  onChange={(e) => setFormAge(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', outline: 'none' }}
                />
              </div>

              <div>
                <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Essential Monthly Expenses (INR)</label>
                <input
                  type="number"
                  min="0"
                  value={formEssentialExpenses}
                  onChange={(e) => setFormEssentialExpenses(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', outline: 'none' }}
                />
              </div>

              <div>
                <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Existing Liquid Savings (INR)</label>
                <input
                  type="number"
                  min="0"
                  value={formLiquidSavings}
                  onChange={(e) => setFormLiquidSavings(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', outline: 'none' }}
                />
              </div>

              <div>
                <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Existing Investments (INR)</label>
                <input
                  type="number"
                  min="0"
                  value={formInvestments}
                  onChange={(e) => setFormInvestments(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', outline: 'none' }}
                />
              </div>

              <div>
                <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Emergency Target Months</label>
                <select
                  value={formTargetMonths}
                  onChange={(e) => setFormTargetMonths(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', outline: 'none' }}
                >
                  <option value="3">3 Months (Aggressive / Lean)</option>
                  <option value="6">6 Months (Standard Planning Assumption)</option>
                  <option value="9">9 Months (Conservative)</option>
                  <option value="12">12 Months (High Security / Freelancer)</option>
                </select>
              </div>

              <div>
                <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Monthly Debt/EMI (INR)</label>
                <input
                  type="number"
                  min="0"
                  value={formDebtObligations}
                  onChange={(e) => setFormDebtObligations(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', outline: 'none' }}
                />
              </div>

              <div>
                <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Desired Monthly Freedom Income</label>
                <input
                  type="number"
                  min="0"
                  value={formDesiredIncome}
                  onChange={(e) => setFormDesiredIncome(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', outline: 'none' }}
                />
              </div>

              <div>
                <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Target Retirement Age</label>
                <input
                  type="number"
                  min="18"
                  max="120"
                  value={formTargetAge}
                  onChange={(e) => setFormTargetAge(e.target.value)}
                  style={{ width: '100%', padding: '8px', background: 'var(--canvas-surface)', border: '1px solid var(--border-hairline)', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formHealthInsurance}
                  onChange={(e) => setFormHealthInsurance(e.target.checked)}
                />
                <span>Active Health Insurance Coverage</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formLifeInsurance}
                  onChange={(e) => setFormLifeInsurance(e.target.checked)}
                />
                <span>Active Term Life Insurance Coverage</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-hairline)', cursor: 'pointer', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button type="submit" className="instrument-btn" style={{ padding: '8px 18px' }}>
                Save Profile & Recalculate Plans
              </button>
            </div>
          </form>
        )}
      </div>

      {/* SECTION 3: MILESTONE GOALS */}
      <div style={{
        background: 'var(--canvas-surface)',
        border: '1px solid var(--border-hairline)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="meta-tag">FINANCIAL HORIZONS</div>
            <h2 style={{ fontSize: '18px', margin: '4px 0 0 0', fontWeight: 600 }}>
              Near-Term Goals
            </h2>
          </div>
          <button
            onClick={() => setIsGoalModalOpen(true)}
            className="instrument-btn"
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            <Plus size={13} />
            <span>Add Goal</span>
          </button>
        </div>

        {goals.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-secondary)', fontSize: '13px' }}>
            No near-term goals configured. Add a goal (e.g. Down Payment, Emergency Buffer) to assign priority surplus.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {goals.map((g) => {
              const progressPct = g.target_amount > 0 ? Math.min(Math.round(((g.current_amount || 0) / g.target_amount) * 100), 100) : 0;
              return (
                <div
                  key={g.id}
                  style={{
                    padding: '16px',
                    background: 'var(--canvas-inset)',
                    border: '1px solid var(--border-hairline)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{g.title}</span>
                    <button
                      onClick={() => handleDeleteGoal(g.id, g.title)}
                      className="action-link"
                      style={{ color: 'var(--signal-alert)', padding: '2px' }}
                      title="Delete goal"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                    <span>₹{g.current_amount.toLocaleString('en-IN')} / ₹{g.target_amount.toLocaleString('en-IN')}</span>
                    <span style={{ color: 'var(--signal-forest)' }}>{progressPct}%</span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--canvas-surface)', width: '100%', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--signal-forest)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Goal Add Modal */}
      {isGoalModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--canvas-surface)',
            border: '1px solid var(--ink-primary)',
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Create Near-Term Goal</h3>
            <form onSubmit={handleCreateGoal} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="meta-tag" style={{ display: 'block', marginBottom: '4px' }}>Title *</label>
                <input
                  type="text"
                  required
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  placeholder="e.g. Emergency Top-up, Down Payment"
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
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border-hairline)', cursor: 'pointer', fontSize: '12px' }}
                >
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

      {/* SECTION 4: REPRODUCIBLE MONTHLY ALLOCATION HISTORY */}
      <div style={{
        background: 'var(--canvas-surface)',
        border: '1px solid var(--border-hairline)',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-hairline)' }}>
          <div className="meta-tag">RECORD OF TEMPORAL ALLOCATIONS</div>
          <h2 style={{ fontSize: '16px', margin: '4px 0 0 0', fontWeight: 600 }}>
            Allocation History
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

        {history.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-secondary)', fontSize: '13px' }}>
            No historical allocation plans recorded yet. Plans are automatically archived when calculated.
          </div>
        ) : (
          history.map((h, idx) => (
            <div
              key={h.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 140px 130px 130px 130px 130px',
                padding: '12px 20px',
                borderBottom: idx < history.length - 1 ? '1px solid var(--border-hairline)' : 'none',
                alignItems: 'center',
                fontSize: '12.5px',
                fontFamily: 'var(--font-mono)'
              }}
            >
              <div style={{ fontWeight: 600 }}>{h.month}</div>
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
    </div>
  );
}
