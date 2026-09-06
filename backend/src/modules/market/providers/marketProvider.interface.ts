import { MarketMetric } from '../market.schema.js';

export interface InflationProvider {
  readonly providerName: string;
  getInflation(): Promise<MarketMetric>;
}

export interface GoldProvider {
  readonly providerName: string;
  getGoldRates(): Promise<MarketMetric[]>;
}

export interface FxProvider {
  readonly providerName: string;
  getFxRates(): Promise<MarketMetric[]>;
}

export interface EquityMarketProvider {
  readonly providerName: string;
  getIndices(): Promise<MarketMetric[]>;
  getQuote(symbol: string): Promise<MarketMetric>;
}
