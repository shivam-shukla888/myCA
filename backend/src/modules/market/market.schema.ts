import { z } from 'zod';

export type FreshnessType =
  | 'REAL_TIME'
  | 'NEAR_REAL_TIME'
  | 'DAILY'
  | 'MONTHLY'
  | 'CACHED'
  | 'STALE'
  | 'UNKNOWN';

export type MarketStatus = 'MARKET OPEN' | 'MARKET CLOSED' | 'MARKET STATUS UNKNOWN';

export interface MarketMetric {
  metric: string;
  label: string;
  value: number;
  display_value: string;
  currency: string;
  unit: string;
  change?: number | null;
  percentage_change?: number | null;
  market_status?: MarketStatus;
  source: string;
  source_url?: string | null;
  observed_period?: string | null;
  published_at?: string | null;
  observed_at: string;
  fetched_at: string;
  freshness_type: FreshnessType;
  is_stale: boolean;
  notes?: string | null;
}

export interface MarketSummaryResponse {
  inflation: MarketMetric;
  gold: MarketMetric[];
  fx: MarketMetric[];
  indices: MarketMetric[];
  market_status: MarketStatus;
  last_updated: string;
  sources: Array<{
    category: string;
    source: string;
    source_url: string;
    freshness: FreshnessType;
    description: string;
  }>;
  disclaimer: string;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  symbol: string;
  exchange: string;
  asset_type: string;
  notes?: string | null;
  created_at: string;
  quote?: MarketMetric | null;
}

export const addWatchlistSchema = z.object({
  symbol: z
    .string()
    .min(1, 'Symbol is required')
    .max(20, 'Symbol too long')
    .transform((s) => s.toUpperCase().trim())
    .refine((s) => /^[A-Z0-9._&-]+$/.test(s), 'Symbol must contain only alphanumeric characters or standard delimiters'),
  exchange: z.enum(['NSE', 'BSE']).default('NSE'),
  asset_type: z.enum(['EQUITY', 'INDEX', 'COMMODITY']).default('EQUITY'),
  notes: z.string().max(255).optional(),
});

export const removeWatchlistParamSchema = z.object({
  symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase().trim()),
});

export type AddWatchlistInput = z.infer<typeof addWatchlistSchema>;
