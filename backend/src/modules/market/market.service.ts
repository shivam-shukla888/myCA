import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../../middleware/errorHandler.js';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import {
  AddWatchlistInput,
  MarketMetric,
  MarketSummaryResponse,
  WatchlistItem,
} from './market.schema.js';
import { mospiInflationProvider } from './providers/mospiInflation.provider.js';
import { referenceGoldProvider } from './providers/referenceGold.provider.js';
import { referenceFxProvider } from './providers/referenceFx.provider.js';
import { exchangeEquityProvider, getIndianMarketStatus } from './providers/exchangeEquity.provider.js';

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttlMs: number;
}

// In-memory caches for fast, reactive queries
let cachedSummary: CacheEntry<MarketSummaryResponse> | null = null;
const inMemoryWatchlist = new Map<string, WatchlistItem[]>();

const DEFAULT_USER_WATCHLIST_SYMBOLS = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK'];

export class MarketService {
  /**
   * Returns aggregated Live Market Intelligence:
   * - India CPI Inflation (MoSPI, Monthly freshness)
   * - Gold Rates (24K & 22K in ₹/10g)
   * - Foreign Exchange Pairs (USD, EUR, GBP, AED to INR)
   * - Market Indices (NIFTY 50, SENSEX, NIFTY BANK)
   */
  async getMarketSummary(forceRefresh = false): Promise<MarketSummaryResponse> {
    const nowMs = Date.now();
    const SUMMARY_TTL_MS = 3 * 60 * 1000; // 3 minutes cache TTL

    if (!forceRefresh && cachedSummary && nowMs - cachedSummary.cachedAt < cachedSummary.ttlMs) {
      return cachedSummary.data;
    }

    try {
      const [inflation, gold, fx, indices] = await Promise.all([
        mospiInflationProvider.getInflation(),
        referenceGoldProvider.getGoldRates(),
        referenceFxProvider.getFxRates(),
        exchangeEquityProvider.getIndices(),
      ]);

      const marketStatus = getIndianMarketStatus();
      const nowIso = new Date().toISOString();

      const summary: MarketSummaryResponse = {
        inflation,
        gold,
        fx,
        indices,
        market_status: marketStatus,
        last_updated: nowIso,
        sources: [
          {
            category: 'INFLATION',
            source: 'MoSPI (Ministry of Statistics and Programme Implementation)',
            source_url: 'https://mospi.gov.in',
            freshness: 'MONTHLY',
            description: 'Official CPI Combined headline rate. Released monthly on the 12th.',
          },
          {
            category: 'GOLD',
            source: 'IBJA / Bullion Reference Feed',
            source_url: 'https://www.ibja.co',
            freshness: 'DAILY',
            description: 'Domestic standard 24K and 22K reference bullion price per 10 grams.',
          },
          {
            category: 'FOREIGN EXCHANGE',
            source: 'RBI (Reserve Bank of India Reference Rate)',
            source_url: 'https://www.rbi.org.in',
            freshness: 'DAILY',
            description: 'Official RBI reference rates published on trading weekdays.',
          },
          {
            category: 'EQUITY INDICES',
            source: 'NSE / BSE Authorized Reference Feed',
            source_url: 'https://www.nseindia.com',
            freshness: 'DAILY',
            description: 'Benchmark indices tracking broader market performance.',
          },
        ],
        disclaimer:
          'STATUTORY DISCLAIMER: Market information is provided strictly for financial context and planning awareness. Personal CA does not provide stock recommendations, investment advice, or brokerage services. Market movements do not mutate your verified financial records.',
      };

      cachedSummary = {
        data: summary,
        cachedAt: nowMs,
        ttlMs: SUMMARY_TTL_MS,
      };

      // Asynchronously store metrics in global database cache
      this.persistMetricsToDb([inflation, ...gold, ...fx, ...indices]).catch((e) => {
        console.warn('[MarketService] Failed to persist market metrics to db cache:', e);
      });

      return summary;
    } catch (err: any) {
      // Graceful degradation: return previous cached value if available with STALE badge
      if (cachedSummary) {
        return {
          ...cachedSummary.data,
          last_updated: new Date(cachedSummary.cachedAt).toISOString(),
          inflation: { ...cachedSummary.data.inflation, is_stale: true, freshness_type: 'CACHED' },
          indices: cachedSummary.data.indices.map((i) => ({ ...i, is_stale: true, freshness_type: 'CACHED' })),
          gold: cachedSummary.data.gold.map((g) => ({ ...g, is_stale: true, freshness_type: 'CACHED' })),
          fx: cachedSummary.data.fx.map((f) => ({ ...f, is_stale: true, freshness_type: 'CACHED' })),
        };
      }

      throw new AppError(
        `Failed to fetch market intelligence: ${err.message || 'Data source unavailable'}`,
        503,
        'MARKET_DATA_SERVICE_UNAVAILABLE'
      );
    }
  }

  /**
   * Persists latest metrics to public.market_data_cache table
   */
  private async persistMetricsToDb(metrics: MarketMetric[]): Promise<void> {
    try {
      const supabase = getSupabaseAdminClient();
      const rows = metrics.map((m) => ({
        metric_key: m.metric,
        metric_type: m.metric.split('_')[0],
        symbol: m.metric.startsWith('STOCK_') ? m.metric.replace('STOCK_', '') : null,
        value: m.value,
        currency: m.currency,
        unit: m.unit,
        change: m.change ?? null,
        percentage_change: m.percentage_change ?? null,
        market_status: m.market_status || 'MARKET STATUS UNKNOWN',
        source: m.source,
        source_url: m.source_url || null,
        observed_period: m.observed_period || null,
        published_at: m.published_at || null,
        observed_at: m.observed_at,
        fetched_at: m.fetched_at,
        freshness_type: m.freshness_type,
        metadata: { notes: m.notes },
        updated_at: new Date().toISOString(),
      }));

      await supabase.from('market_data_cache').upsert(rows, { onConflict: 'metric_key' });
    } catch (e) {
      // Non-blocking write
    }
  }

  /**
   * Returns user's stock/index watchlist with live/benchmark quotes
   */
  async getWatchlist(userId: string): Promise<WatchlistItem[]> {
    if (!userId) {
      throw new AppError('User context required', 401, 'UNAUTHORIZED');
    }

    const isProduction = env.NODE_ENV === 'production';
    let userItems: WatchlistItem[] = [];

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('market_watchlist')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) {
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          // Table pending migration in remote DB: fallback to in-memory store
        } else if (isProduction) {
          throw new AppError(`Failed to fetch watchlist: ${error.message}`, 500, 'DATABASE_QUERY_FAILED');
        }
      } else if (data && data.length > 0) {
        userItems = data;
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Watchlist fetch failed in production', 500, 'DATABASE_QUERY_FAILED');
      }
    }

    // In-memory fallback if DB empty or non-production
    if (userItems.length === 0) {
      const existingInMem = inMemoryWatchlist.get(userId);
      if (existingInMem && existingInMem.length > 0) {
        userItems = existingInMem;
      } else {
        // Seed initial default blue-chip watchlist for new user
        const seeded: WatchlistItem[] = DEFAULT_USER_WATCHLIST_SYMBOLS.map((sym) => ({
          id: uuidv4(),
          user_id: userId,
          symbol: sym,
          exchange: 'NSE',
          asset_type: 'EQUITY',
          notes: 'NIFTY 50 Constituent',
          created_at: new Date().toISOString(),
        }));
        inMemoryWatchlist.set(userId, seeded);
        userItems = seeded;
      }
    }

    // Attach latest quote for each symbol
    const enriched = await Promise.all(
      userItems.map(async (item) => {
        const quote = await exchangeEquityProvider.getQuote(item.symbol);
        return {
          ...item,
          quote,
        };
      })
    );

    return enriched;
  }

  /**
   * Add a symbol to user's personal watchlist
   */
  async addWatchlistSymbol(userId: string, input: AddWatchlistInput): Promise<WatchlistItem> {
    if (!userId) {
      throw new AppError('User context required', 401, 'UNAUTHORIZED');
    }

    const isProduction = env.NODE_ENV === 'production';
    const symbol = input.symbol.toUpperCase().trim();
    const id = uuidv4();
    const now = new Date().toISOString();

    const newItem: WatchlistItem = {
      id,
      user_id: userId,
      symbol,
      exchange: input.exchange || 'NSE',
      asset_type: input.asset_type || 'EQUITY',
      notes: input.notes || null,
      created_at: now,
    };

    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from('market_watchlist')
        .insert({
          id: newItem.id,
          user_id: userId,
          symbol: newItem.symbol,
          exchange: newItem.exchange,
          asset_type: newItem.asset_type,
          notes: newItem.notes,
        })
        .select()
        .single();
      if (error) {
        if (error.code === '23505') {
          throw new AppError(`Symbol ${symbol} is already in your watchlist`, 409, 'WATCHLIST_SYMBOL_EXISTS');
        }
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          const list = inMemoryWatchlist.get(userId) || [];
          if (list.some((i) => i.symbol === symbol)) {
            throw new AppError(`Symbol ${symbol} is already in your watchlist`, 409, 'WATCHLIST_SYMBOL_EXISTS');
          }
          const quote = await exchangeEquityProvider.getQuote(newItem.symbol);
          const result: WatchlistItem = { ...newItem, quote };
          list.push(result);
          inMemoryWatchlist.set(userId, list);
          return result;
        }
        if (isProduction) {
          throw new AppError(`Failed to save watchlist symbol: ${error.message}`, 500, 'DATABASE_PERSISTENCE_FAILED');
        }
      } else if (data) {
        const quote = await exchangeEquityProvider.getQuote(data.symbol);
        const result: WatchlistItem = { ...data, quote };

        if (!isProduction) {
          const list = inMemoryWatchlist.get(userId) || [];
          list.push(result);
          inMemoryWatchlist.set(userId, list);
        }

        return result;
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Failed to save watchlist symbol in production', 500, 'DATABASE_PERSISTENCE_FAILED');
      }
    }

    // In-memory fallback
    const list = inMemoryWatchlist.get(userId) || [];
    if (list.some((i) => i.symbol === symbol)) {
      throw new AppError(`Symbol ${symbol} is already in your watchlist`, 409, 'WATCHLIST_SYMBOL_EXISTS');
    }

    const quote = await exchangeEquityProvider.getQuote(newItem.symbol);
    const result: WatchlistItem = { ...newItem, quote };
    list.push(result);
    inMemoryWatchlist.set(userId, list);
    return result;
  }

  /**
   * Remove a symbol from user's watchlist
   */
  async removeWatchlistSymbol(userId: string, symbol: string): Promise<{ success: boolean; symbol: string }> {
    if (!userId) {
      throw new AppError('User context required', 401, 'UNAUTHORIZED');
    }

    const isProduction = env.NODE_ENV === 'production';
    const upperSym = symbol.toUpperCase().trim();

    try {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase
        .from('market_watchlist')
        .delete()
        .eq('user_id', userId)
        .eq('symbol', upperSym);

      if (error) {
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          const list = inMemoryWatchlist.get(userId) || [];
          inMemoryWatchlist.set(
            userId,
            list.filter((i) => i.symbol !== upperSym)
          );
          return { success: true, symbol: upperSym };
        } else if (isProduction) {
          throw new AppError(`Failed to remove symbol: ${error.message}`, 500, 'DATABASE_PERSISTENCE_FAILED');
        }
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (isProduction) {
        throw new AppError('Failed to remove symbol in production', 500, 'DATABASE_PERSISTENCE_FAILED');
      }
    }

    const list = inMemoryWatchlist.get(userId) || [];
    inMemoryWatchlist.set(
      userId,
      list.filter((i) => i.symbol !== upperSym)
    );

    return { success: true, symbol: upperSym };
  }
}

export const marketService = new MarketService();
