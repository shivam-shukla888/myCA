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
  return localStorage.getItem('personal_ca_auth_token');
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
