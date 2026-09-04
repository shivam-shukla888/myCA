const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  code: string;
  statusCode: number;
  details?: any;

  constructor(message: string, statusCode: number, code: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('personal_ca_auth_token');
  if (!token) return null;

  // Detect and purge expired JWTs to prevent persistent 401 crashes
  if (!token.startsWith('mock-test-token:')) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const payload = JSON.parse(jsonPayload);
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
          localStorage.removeItem('personal_ca_auth_token');
          if (process.env.NODE_ENV === 'development') {
            const devToken = 'mock-test-token:73422394-8b34-423d-8577-ff1c3c40614c:personal_ca_test_step4@gmail.com';
            localStorage.setItem('personal_ca_auth_token', devToken);
            return devToken;
          }
          return null;
        }
      }
    } catch {
      // Let backend handle malformed tokens
    }
  }

  return token;
}

export function setAuthToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem('personal_ca_auth_token', token);
  } else {
    localStorage.removeItem('personal_ca_auth_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401) {
        // Clear invalid/expired token immediately
        setAuthToken(null);
      }
      throw new ApiError(
        json.error?.message || `Request failed with status ${res.status}`,
        res.status,
        json.error?.code || 'UNKNOWN_ERROR',
        json.error?.details
      );
    }

    return json.data as T;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
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

export const chatApi = {
  sendMessage: async (message: string, conversationId?: string) => {
    return request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversation_id: conversationId }),
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
