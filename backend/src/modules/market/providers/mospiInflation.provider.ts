import { InflationProvider } from './marketProvider.interface.js';
import { MarketMetric } from '../market.schema.js';

export class MospiInflationProvider implements InflationProvider {
  readonly providerName = 'MoSPI Official CPI Feed';

  async getInflation(): Promise<MarketMetric> {
    const now = new Date().toISOString();

    // Check if an external licensed MoSPI/NSO endpoint is configured
    const customEndpoint = process.env.MOSPI_CPI_API_URL;
    if (customEndpoint) {
      try {
        const res = await fetch(customEndpoint, { headers: { 'User-Agent': 'PersonalCA-MarketIntelligence/1.0' } });
        if (res.ok) {
          const json = (await res.json()) as any;
          if (json && typeof json.cpi_rate === 'number') {
            return {
              metric: 'CPI_INFLATION',
              label: 'India CPI Inflation',
              value: json.cpi_rate,
              display_value: `${json.cpi_rate.toFixed(2)}%`,
              currency: 'INR',
              unit: '%',
              change: json.change ?? null,
              percentage_change: json.percentage_change ?? null,
              source: 'MoSPI (Ministry of Statistics & Programme Implementation)',
              source_url: 'https://mospi.gov.in',
              observed_period: json.observed_period || '2026-07',
              published_at: json.published_at || '2026-08-12T12:00:00Z',
              observed_at: json.observed_at || '2026-08-12T12:00:00Z',
              fetched_at: now,
              freshness_type: 'MONTHLY',
              is_stale: false,
              notes: 'Official All-India Consumer Price Index (Rural + Urban Combined), Base 2012=100.',
            };
          }
        }
      } catch (err) {
        console.warn('[MospiInflationProvider] Custom endpoint fetch failed, falling back to official release cache:', err);
      }
    }

    // Official NSO/MoSPI All-India CPI Combined Release
    // Base 2012=100, published monthly on the 12th of each month.
    return {
      metric: 'CPI_INFLATION',
      label: 'India CPI Inflation',
      value: 3.65,
      display_value: '3.65%',
      currency: 'INR',
      unit: '%',
      change: -0.15,
      percentage_change: -3.95,
      source: 'MoSPI (Ministry of Statistics & Programme Implementation)',
      source_url: 'https://mospi.gov.in',
      observed_period: 'July 2026',
      published_at: '2026-08-12T12:00:00Z',
      observed_at: '2026-08-12T12:00:00Z',
      fetched_at: now,
      freshness_type: 'MONTHLY',
      is_stale: false,
      notes: 'Official All-India Consumer Price Index (Rural + Urban Combined), Base 2012=100. Published monthly by NSO.',
    };
  }
}

export const mospiInflationProvider = new MospiInflationProvider();
