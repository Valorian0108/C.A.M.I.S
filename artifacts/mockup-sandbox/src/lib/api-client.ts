const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface MarginSnapshot {
  collateralValue: number;
  adjustedEquity: number;
  totalPositionValue: number;
  leverage: number;
  marginRatio: number;
  liquidationDistance: number;
  collateralRatio: number;
}

export interface CorporateAction {
  id: string;
  symbol: string;
  corporate_action_type: string;
  corporate_action_date: string;
  declaration_date: string;
  record_date: string;
  effective_date: string;
  cash_amount: number;
  new_rate: number;
  old_rate: number;
  distribution_frequency: string;
  description: string;
}

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

export interface SpotSymbol {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
}

export interface CollateralInfo {
  symbol: string;
  collateralRatio: number;
  maxLeverage: number;
  isEligible: boolean;
}

export interface AccountSnapshot {
  accountEquity: number;
  effectiveEquity: number;
  usdtEquity: number;
  unrealisedPnl: number;
  maintenanceMargin: number;
  initialMargin: number;
  marginRatio: number;
  positionMarginRatio: number;
  positionValue: number;
  leverage: number;
  assets: Array<{
    coin: string;
    equity: number;
    usdValue: number;
    balance: number;
    available: number;
    debt: number;
    locked: number;
    bonus: number;
  }>;
}

export type DataSource = 'live' | 'fallback' | 'demo' | 'error' | 'checking';

export interface SourceResponse<T> {
  success: boolean;
  data: T;
  count?: number;
  source: DataSource;
  sourceDetail?: string;
  timestamp?: string;
}

export interface MarketResearchData {
  fearGreedIndex?: number;
  fearGreedSentiment?: string;
  longShortRatio?: number;
  fundingRates?: Record<string, number>;
  marketSentiment?: string;
  technicalIndicators?: {
    rsi?: number;
    macd?: number;
    support?: number;
    resistance?: number;
  };
  whaleActivity?: {
    inflows?: number;
    outflows?: number;
    netFlow?: number;
  };
  macroContext?: {
    fedPolicy?: string;
    btcCorrelation?: number;
    dxy?: number;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  private requestWithXHR<T>(url: string, options?: RequestInit): Promise<T> {
    return new Promise((resolve, reject) => {
      if (typeof XMLHttpRequest !== 'function') {
        reject(new Error('XMLHttpRequest is unavailable'));
        return;
      }

      const xhr = new XMLHttpRequest();
      xhr.open(options?.method || 'GET', url);
      xhr.setRequestHeader('Content-Type', 'application/json');

      if (options?.headers) {
        const headers = new Headers(options.headers);
        headers.forEach((value, key) => xhr.setRequestHeader(key, value));
      }

      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`API error: ${xhr.status} ${xhr.statusText}`));
          return;
        }

        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new Error('API returned invalid JSON'));
        }
      };

      xhr.onerror = () => reject(new Error('API request failed'));
      xhr.ontimeout = () => reject(new Error('API request timed out'));
      xhr.timeout = 45000;
      xhr.send(typeof options?.body === 'string' ? options.body : undefined);
    });
  }

  private async requestWithModuleFallback<T>(endpoint: string, options?: RequestInit): Promise<T> {
    if (options?.method && options.method !== 'GET') {
      throw new Error('API request failed');
    }

    const cacheKey = endpoint.includes('?') ? '&_' : '?_';
    const moduleUrl = `/api-module${endpoint}${cacheKey}${Date.now()}`;
    const moduleResult = await import(/* @vite-ignore */ moduleUrl) as { default: T & { success?: boolean; error?: string } };

    if (moduleResult.default?.success === false) {
      throw new Error(moduleResult.default.error || 'API request failed');
    }

    return moduleResult.default;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    if (typeof window.fetch !== 'function') {
      try {
        return await this.requestWithXHR<T>(url, options);
      } catch {
        return this.requestWithModuleFallback<T>(endpoint, options);
      }
    }

    try {
      const response = await window.fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.warn('Fetch API request failed; retrying with XMLHttpRequest.', error);
      try {
        return await this.requestWithXHR<T>(url, options);
      } catch {
        return this.requestWithModuleFallback<T>(endpoint, options);
      }
    }
  }

  async getCorporateActions(symbols: string[]): Promise<SourceResponse<CorporateAction[]>> {
    const symbolsParam = symbols.join(',');
    return this.request<SourceResponse<CorporateAction[]>>(
      `/corporate-actions?symbols=${symbolsParam}`
    );
  }

  async getMarketData(symbols: string[]): Promise<SourceResponse<MarketData[]>> {
    const symbolsParam = symbols.join(',');
    return this.request<SourceResponse<MarketData[]>>(
      `/market-data?symbols=${symbolsParam}`
    );
  }

  async searchSpotSymbols(query: string, limit = 12): Promise<SourceResponse<SpotSymbol[]>> {
    const params = new URLSearchParams({ query, limit: String(limit) });
    return this.request<SourceResponse<SpotSymbol[]>>(
      `/spot-symbols?${params.toString()}`
    );
  }

  async getCollateralInfo(symbols: string[]): Promise<SourceResponse<CollateralInfo[]>> {
    const symbolsParam = symbols.join(',');
    return this.request<SourceResponse<CollateralInfo[]>>(
      `/collateral-info?symbols=${symbolsParam}`
    );
  }

  async getAccountSnapshot(): Promise<SourceResponse<AccountSnapshot>> {
    return this.request<SourceResponse<AccountSnapshot>>('/account-snapshot');
  }

  async getMarginExplanation(data: {
    token: string;
    eventType: string;
    beforeState: MarginSnapshot;
    afterState: MarginSnapshot;
    recommendedAction: string;
    includeMarketResearch?: boolean;
  }): Promise<{ success: boolean; explanation: string; timestamp: string; explanationSource?: DataSource; explanationSourceDetail?: string; marketResearchIncluded?: boolean; marketResearchSource?: string }> {
    return this.request<{ success: boolean; explanation: string; timestamp: string; explanationSource?: DataSource; explanationSourceDetail?: string; marketResearchIncluded?: boolean; marketResearchSource?: string }>(
      '/margin-explanation',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async getMarketResearch(symbol?: string): Promise<{ success: boolean; data?: MarketResearchData; source: DataSource; error?: string }> {
    const params = symbol ? `?symbol=${symbol}` : '';
    return this.request<{ success: boolean; data?: MarketResearchData; source: DataSource; error?: string }>(
      `/market-research${params}`
    );
  }
}

export const apiClient = new ApiClient();
