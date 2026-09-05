function getApiUrl(): string {
  // Use explicit API URL if set
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // Browser environment: enforce explicit config in production
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('NEXT_PUBLIC_API_URL must be set in production environment');
      }
      // Fallback to Render backend for non‑production remote hosts
      return 'https://myca-backend.onrender.com/api/v1';
    }
  }

  // Default to local development server
  return 'http://localhost:4000/api/v1';
}
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal) {
      // In production, require explicit API URL to avoid fallback to localhost
      if (process.env.NODE_ENV === 'production') {
        throw new Error('NEXT_PUBLIC_API_URL must be set in production environment');
      }
      return 'https://myca-backend.onrender.com/api/v1';
    }
  }
  return 'http://localhost:4000/api/v1';
}
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal) {
      return 'https://myca-backend.onrender.com/api/v1';
    }
  }
  return 'http://localhost:4000/api/v1';
}

const API_URL = getApiUrl();

export class ApiError extends Error {
  code: string;
  statusCode: number;
  requestId?: string;
  details?: any;

  constructor(message: string, statusCode: number, code: string, details?: any, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('personal_ca_auth_token');
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('personal_ca_refresh_token');
}

export function setAuthToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem('personal_ca_auth_token', token);
  } else {
    localStorage.removeItem('personal_ca_auth_token');
    localStorage.removeItem('personal_ca_refresh_token');
  }
}

export function setAuthSession(accessToken: string | null, refreshToken?: string | null) {
  if (typeof window === 'undefined') return;
  if (accessToken) {
    localStorage.setItem('personal_ca_auth_token', accessToken);
    if (refreshToken) {
      localStorage.setItem('personal_ca_refresh_token', refreshToken);
    }
  } else {
    localStorage.removeItem('personal_ca_auth_token');
    localStorage.removeItem('personal_ca_refresh_token');
  }
}

let isRefreshing = false;

async function refreshAuthSession(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken || isRefreshing) return null;

  isRefreshing = true;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      setAuthSession(null);
      return null;
    }

    const json = await res.json();
    const newAccessToken = json.data?.session?.access_token;
    const newRefreshToken = json.data?.session?.refresh_token || refreshToken;

    if (newAccessToken) {
      setAuthSession(newAccessToken, newRefreshToken);
      return newAccessToken;
    }
    return null;
  } catch {
    setAuthSession(null);
    return null;
  } finally {
    isRefreshing = false;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_URL}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // Bounded 15s timeout

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      // If 401 and refresh token available, attempt single retry
      if (res.status === 401 && !isRetry && getRefreshToken()) {
        const refreshedToken = await refreshAuthSession();
        if (refreshedToken) {
          return request<T>(endpoint, options, true);
        }
      }

      const errorObj = json.error || {};
      const requestId = res.headers.get('x-request-id') || errorObj.request_id || 'unknown';

      if (res.status === 401) {
        setAuthSession(null);
      }

      throw new ApiError(
        errorObj.message || `Request failed with status ${res.status}`,
        res.status,
        errorObj.code || 'UNKNOWN_ERROR',
        errorObj.details,
        requestId
      );
    }

    return json.data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err instanceof ApiError) throw err;
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out after 15 seconds', 408, 'REQUEST_TIMEOUT');
    }
    throw new ApiError(err.message || 'Network request failed', 500, 'NETWORK_ERROR');
  }
}

// 1. Authentication APIs
export const authApi = {
  login: async (credentials: { email: string; password: string }) => {
    return request<{
      user: { id: string; email: string; role: 'USER' | 'ADMIN' };
      session: { access_token: string; refresh_token: string };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },
  refresh: async (refreshToken: string) => {
    return request<{
      user: { id: string; email: string };
      session: { access_token: string; refresh_token: string };
    }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },
  signup: async (data: { email: string; password: string; full_name?: string }) => {
    return request<{
      user: { id: string; email: string; role: string };
      session?: { access_token: string; refresh_token: string } | null;
      message: string;
    }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  magicLink: async (data: { email: string; redirect_to?: string }) => {
    return request<{ success: boolean; message: string; email: string }>('/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getMe: async () => {
    return request<{
      id: string;
      full_name: string;
      role: 'USER' | 'ADMIN';
      business_type: string;
      preferred_language: string;
      financial_year_start: number;
      created_at: string;
    }>('/auth/me');
  },
};

// 2. Transaction APIs
export type TransactionType = 'income' | 'expense' | 'transfer' | 'credit' | 'debit';

export interface Transaction {
  id: string;
  user_id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: TransactionType;
  category?: string;
  subcategory?: string;
  merchant_name?: string;
  account?: string;
  is_tax_relevant: boolean;
  tax_category?: string;
  gst_applicable: boolean;
  gst_amount?: number;
  confidence_score?: number;
  user_verified?: boolean;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface MonthlyCategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

export interface MonthlyFinancialSummary {
  month: string;
  total_income: number;
  total_expenses: number;
  monthly_surplus: number;
  savings_rate: number;
  total_transfers: number;
  currency: string;
  categories: MonthlyCategoryBreakdown[];
  largest_expense_category: MonthlyCategoryBreakdown | null;
  transaction_count: {
    income: number;
    expenses: number;
    transfers: number;
    total: number;
  };
}

export const transactionApi = {
  list: async (params?: {
    limit?: number;
    offset?: number;
    is_tax_relevant?: boolean;
    type?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.is_tax_relevant !== undefined) query.set('is_tax_relevant', String(params.is_tax_relevant));
    if (params?.type) query.set('type', params.type);
    if (params?.start_date) query.set('start_date', params.start_date);
    if (params?.end_date) query.set('end_date', params.end_date);

    return request<{ transactions: Transaction[]; total: number }>(`/transactions?${query.toString()}`);
  },
  create: async (data: Partial<Transaction>) => {
    return request<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  update: async (id: string, data: Partial<Transaction>) => {
    return request<Transaction>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  delete: async (id: string) => {
    return request<{ success: boolean; id: string }>(`/transactions/${id}`, {
      method: 'DELETE',
    });
  },
  getMonthlySummary: async (month: string) => {
    return request<MonthlyFinancialSummary>(`/transactions/summary/monthly?month=${encodeURIComponent(month)}`);
  },
};

// 3. Document / Evidence APIs
export interface DocumentItem {
  id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  mime_type: string;
  document_type: string;
  financial_year?: string;
  extraction_status: 'pending' | 'processing' | 'completed' | 'failed';
  uploaded_at: string;
}

export const documentApi = {
  list: async (params?: { limit?: number; offset?: number; document_type?: string }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.document_type) query.set('document_type', params.document_type);

    return request<{ documents: DocumentItem[]; total: number }>(`/documents?${query.toString()}`);
  },
  create: async (data: {
    file_name: string;
    file_type: string;
    file_size_bytes: number;
    mime_type: string;
    document_type: string;
    financial_year?: string;
  }) => {
    return request<DocumentItem>('/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getDownloadUrl: async (id: string) => {
    return request<{ download_url: string; expires_in_seconds: number }>(`/documents/${id}/download-url`);
  },
};

// 4. AI Intelligence APIs
export interface EvidenceSource {
  source_type: 'transaction' | 'goal' | 'document' | 'calculation' | 'domain_knowledge';
  source_id?: string;
  claim: string;
}

export interface ChatResponse {
  answer: string;
  intent: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence_score: number;
  evidence: EvidenceSource[];
  missing_information: string[];
  disclaimer_required: boolean;
  disclaimer: string;
  human_review_required: boolean;
  refusal_or_limitation: string | null;
  conversation_id: string;
}

export interface MonthlyReviewResponse extends ChatResponse {
  deterministic_context?: {
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
    allocation?: {
      emergency_fund_target: number;
      emergency_fund_current: number;
      emergency_gap: number;
      current_monthly_allocation: {
        emergency_fund: number;
        goals: number;
        long_term: number;
        buffer: number;
      };
    };
    financial_freedom?: {
      current_wealth: number;
      indicative_target_corpus: number;
      projected_wealth: number;
      funding_gap: number;
      required_monthly_contribution: number;
      target_age: number;
      selected_scenario: string;
      on_track: boolean;
    };
    goals: Array<{
      id: string;
      title: string;
      target_amount: number;
      current_amount: number;
    }>;
  };
}

export const chatApi = {
  sendMessage: async (message: string, conversationId?: string) => {
    return request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversation_id: conversationId }),
    });
  },
  getMonthlyReview: async (month?: string, conversationId?: string) => {
    return request<MonthlyReviewResponse>('/chat/review', {
      method: 'POST',
      body: JSON.stringify({ month, conversation_id: conversationId }),
    });
  },
};

// 5. Reports APIs
export const reportApi = {
  generate: async (reportType: string, financialYear = '2025-26') => {
    return request<{
      report_type: string;
      financial_year: string;
      generated_at: string;
      currency: string;
      summary: {
        total_income: number;
        total_expenses: number;
        net_surplus: number;
        total_tax_deductions_claimed: number;
        estimated_taxable_income: number;
        transaction_count: number;
      };
      deductions_breakdown: Array<{ category: string; amount: number }>;
    }>('/reports/generate', {
      method: 'POST',
      body: JSON.stringify({ report_type: reportType, financial_year: financialYear }),
    });
  },
};

// 6. Admin APIs
export const adminApi = {
  getAuditLogs: async () => {
    return request<
      Array<{
        id: string;
        user_id: string;
        query: string;
        response: string;
        model_used: string;
        confidence_score: number;
        confidence_level: string;
        topic_category: string;
        disclaimer_shown: boolean;
        reviewed_by_human: boolean;
        created_at: string;
      }>
    >('/admin/audit-logs');
  },
};

// 7. Allocation & Financial Freedom APIs
export interface FinancialProfile {
  user_id: string;
  age?: number;
  monthly_income: number;
  existing_liquid_savings: number;
  existing_investments: number;
  monthly_essential_expenses: number;
  monthly_debt_obligations: number;
  dependents: number;
  has_health_insurance: boolean;
  has_life_insurance: boolean;
  emergency_fund_target_months: number;
  target_retirement_age?: number;
  desired_monthly_lifestyle_income: number;
  created_at: string;
  updated_at: string;
}

export interface FinancialGoal {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  goal_type: 'savings' | 'investment' | 'tax_planning' | 'debt_reduction' | 'emergency_fund' | 'retirement' | 'custom';
  target_amount: number;
  current_amount: number;
  currency: string;
  target_date?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  created_at: string;
  updated_at: string;
}

export interface EmergencyFundCalculation {
  essential_monthly_expenses: number;
  target_months: number;
  emergency_fund_target: number;
  existing_liquid_savings: number;
  emergency_fund_gap: number;
  coverage_months: number;
  is_complete: boolean;
}

export interface AllocationBuckets {
  emergency_fund: number;
  goals: number;
  long_term_wealth: number;
  flexible_buffer: number;
  total_allocated: number;
}

export interface MonthlyAllocationPlan {
  id: string;
  user_id: string;
  month: string;
  monthly_income: number;
  monthly_expenses: number;
  monthly_surplus: number;
  is_deficit: boolean;
  emergency_fund: EmergencyFundCalculation;
  allocations: AllocationBuckets;
  explanation: {
    primary_summary: string;
    priority_order: string[];
    emergency_fund_rationale: string;
    goals_rationale: string;
    long_term_wealth_rationale: string;
    buffer_rationale: string;
    deficit_pressure_analysis?: {
      spending_pressure: string;
      essential_expense_ratio: number;
      debt_obligation_ratio: number;
      recommendation: string;
    };
  };
  financial_freedom: {
    current_savings_investments: number;
    monthly_surplus: number;
    emergency_fund_progress_pct: number;
    target_corpus_status: string;
    desired_monthly_lifestyle_income: number;
    target_age: number | null;
    current_age: number | null;
  };
  created_at: string;
  updated_at: string;
}

export const allocationApi = {
  getProfile: async () => {
    return request<FinancialProfile | null>('/allocation/profile');
  },
  saveProfile: async (data: Partial<FinancialProfile>) => {
    return request<FinancialProfile>('/allocation/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  listGoals: async () => {
    return request<FinancialGoal[]>('/allocation/goals');
  },
  createGoal: async (data: Partial<FinancialGoal>) => {
    return request<FinancialGoal>('/allocation/goals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updateGoal: async (id: string, data: Partial<FinancialGoal>) => {
    return request<FinancialGoal>(`/allocation/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  deleteGoal: async (id: string) => {
    return request<{ success: boolean; id: string }>(`/allocation/goals/${id}`, {
      method: 'DELETE',
    });
  },
  generatePlan: async (month: string) => {
    return request<MonthlyAllocationPlan>('/allocation/plans/generate', {
      method: 'POST',
      body: JSON.stringify({ month }),
    });
  },
  getPlanForMonth: async (month: string) => {
    return request<MonthlyAllocationPlan>(`/allocation/plans/${month}`);
  },
  listPlanHistory: async () => {
    return request<MonthlyAllocationPlan[]>('/allocation/plans/history');
  },
};

// 8. Financial Freedom Calculator APIs
export interface FreedomScenarioResult {
  scenario_name: 'conservative' | 'base' | 'optimistic';
  expected_return_pct: number;
  inflation_rate_pct: number;
  withdrawal_rate_pct: number;
  future_monthly_lifestyle_need: number;
  future_annual_lifestyle_need: number;
  indicative_target_corpus: number;
  initial_investable_wealth: number;
  projected_wealth_at_target_age: number;
  funding_gap: number;
  funding_surplus: number;
  required_monthly_contribution: number;
  current_monthly_contribution: number;
  status: 'Ahead of Target' | 'On Track' | 'Behind Target';
  explanation: string;
}

export interface FreedomAnalysisResponse {
  current_age: number;
  target_age: number;
  years_to_freedom: number;
  months_to_freedom: number;
  current_monthly_surplus: number;
  existing_liquid_savings: number;
  existing_investments: number;
  emergency_fund_target: number;
  emergency_fund_reserve: number;
  initial_investable_wealth: number;
  active_scenario_name: 'conservative' | 'base' | 'optimistic';
  active_scenario: FreedomScenarioResult;
  scenarios: {
    conservative: FreedomScenarioResult;
    base: FreedomScenarioResult;
    optimistic: FreedomScenarioResult;
  };
  formula_transparency: {
    future_expense_formula: string;
    target_corpus_formula: string;
    future_wealth_formula: string;
    required_contribution_formula: string;
  };
  assumptions_disclaimer: string;
}

export interface FreedomSimulationInput {
  current_age?: number;
  target_age?: number;
  desired_monthly_lifestyle_income?: number;
  monthly_contribution?: number;
  existing_liquid_savings?: number;
  existing_investments?: number;
  emergency_fund_target?: number;
  inflation_rate?: number;
  expected_return?: number;
  withdrawal_rate?: number;
  scenario?: 'conservative' | 'base' | 'optimistic';
}

export const freedomApi = {
  getStatus: async () => {
    return request<FreedomAnalysisResponse>('/freedom/status');
  },
  simulate: async (data: FreedomSimulationInput) => {
    return request<FreedomAnalysisResponse>('/freedom/simulate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  saveAssumptions: async (data: {
    planning_inflation_rate: number;
    planning_expected_return: number;
    planning_withdrawal_rate: number;
    planning_scenario: 'conservative' | 'base' | 'optimistic';
  }) => {
    return request<{ message: string; profile: any }>('/freedom/assumptions', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// 9. Financial Action Engine APIs
export interface ActionItem {
  priority: 'P0_DEFICIT' | 'P1_EMERGENCY_FUND' | 'P2_DEBT' | 'P3_GOALS' | 'P4_WEALTH' | 'P5_BUFFER';
  priority_label: string;
  category: 'emergency_fund' | 'debt' | 'goals' | 'long_term_wealth' | 'flexible_buffer' | 'deficit_stabilization';
  title: string;
  allocated_amount: number;
  required_amount: number;
  target_gap: number;
  why_rationale: string;
  is_funded: boolean;
  metadata?: Record<string, any>;
}

export interface RankedGoalActionItem {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  remaining_amount: number;
  target_date: string | null;
  months_remaining: number;
  required_monthly_contribution: number;
  priority_rank: number;
  allocated_amount: number;
  ranking_rationale: string;
  is_user_prioritized: boolean;
  is_paused: boolean;
}

export interface UserActionOverride {
  custom_emergency_allocation?: number;
  prioritized_goal_id?: string;
  goal_priority_order?: string[];
  paused_goal_ids?: string[];
  custom_buffer_amount?: number;
  custom_wealth_allocation?: number;
}

export interface DeficitAnalysis {
  is_deficit: boolean;
  monthly_deficit: number;
  essential_expense_ratio: number;
  debt_pressure_ratio: number;
  largest_spending_category?: {
    category: string;
    amount: number;
    percentage: number;
  };
  recommended_actions: string[];
}

export interface ActionFreedomComparison {
  current_monthly_contribution: number;
  required_monthly_contribution: number;
  contribution_gap: number;
  on_track: boolean;
  target_corpus: number;
  projected_wealth: number;
  target_age: number;
  selected_scenario: string;
  assumption_disclaimer: string;
}

export interface ActionPlan {
  id?: string;
  user_id?: string;
  month: string;
  monthly_income: number;
  monthly_expenses: number;
  monthly_surplus: number;
  is_deficit: boolean;
  actions: ActionItem[];
  ranked_goals: RankedGoalActionItem[];
  allocations: {
    emergency_fund: number;
    goals: number;
    long_term_wealth: number;
    flexible_buffer: number;
    total_allocated: number;
  };
  invariant_verified: boolean;
  deficit_analysis?: DeficitAnalysis;
  financial_freedom: ActionFreedomComparison;
  user_override_applied: boolean;
  user_overrides?: UserActionOverride;
  baseline_plan?: Omit<ActionPlan, 'baseline_plan'>;
  primary_summary: string;
  confirmed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SimulateActionPlanInput {
  month?: string;
  surplus_delta?: number;
  expense_delta?: number;
  simulated_emergency_months?: number;
  overrides?: UserActionOverride;
}

export const actionApi = {
  getPlan: async (month?: string) => {
    const query = month ? `?month=${encodeURIComponent(month)}` : '';
    return request<ActionPlan>(`/action/plan${query}`);
  },
  generatePlan: async (month?: string, overrides?: UserActionOverride) => {
    return request<ActionPlan>('/action/plan', {
      method: 'POST',
      body: JSON.stringify({ month, overrides }),
    });
  },
  confirmPlan: async (month: string, overrides?: UserActionOverride) => {
    return request<ActionPlan>('/action/confirm', {
      method: 'POST',
      body: JSON.stringify({ month, overrides }),
    });
  },
  simulate: async (data: SimulateActionPlanInput) => {
    return request<ActionPlan>('/action/simulate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getHistory: async () => {
    return request<ActionPlan[]>('/action/history');
  },
};

export interface ExtractedFieldEvidence {
  field_name: string;
  value: any;
  confidence: number;
  raw_text: string;
  page_number?: number;
  section?: string;
}

export interface ExtractionResult {
  document_id: string;
  document_type: string;
  extraction_status: 'draft_ready' | 'needs_review' | 'extraction_failed' | 'confirmed';
  confidence_score: number;
  extracted_data: Record<string, any>;
  evidence: ExtractedFieldEvidence[];
  missing_information: string[];
  validation_errors: string[];
  warnings: string[];
  is_mock?: boolean;
  confirmed_at?: string;
  imported_record_ids?: string[];
}

export interface ConfirmDocumentInput {
  document_id: string;
  reviewed_data: Record<string, any>;
  import_target: 'transactions' | 'profile' | 'archive_only';
}

export const ocrApi = {
  extract: async (documentId: string) => {
    return request<ExtractionResult>(`/ocr/extract/${documentId}`, {
      method: 'POST',
    });
  },
  getDraft: async (documentId: string) => {
    return request<ExtractionResult>(`/ocr/draft/${documentId}`);
  },
  confirm: async (data: ConfirmDocumentInput) => {
    return request<{
      success: boolean;
      message: string;
      document_id: string;
      imported_count: number;
      imported_record_ids: string[];
      status: string;
    }>('/ocr/confirm', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

