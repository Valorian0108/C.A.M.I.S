const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export interface MarginSnapshot {
  collateralValue: number;
  leverage: number;
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

export interface CollateralInfo {
  symbol: string;
  collateralRatio: number;
  maxLeverage: number;
  isEligible: boolean;
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

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
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
  }

  async getCorporateActions(symbols: string[]): Promise<{ success: boolean; data: CorporateAction[] }> {
    const symbolsParam = symbols.join(',');
    return this.request<{ success: boolean; data: CorporateAction[] }>(
      `/corporate-actions?symbols=${symbolsParam}`
    );
  }

  async getMarketData(symbols: string[]): Promise<{ success: boolean; data: MarketData[] }> {
    const symbolsParam = symbols.join(',');
    return this.request<{ success: boolean; data: MarketData[] }>(
      `/market-data?symbols=${symbolsParam}`
    );
  }

  async getCollateralInfo(symbols: string[]): Promise<{ success: boolean; data: CollateralInfo[] }> {
    const symbolsParam = symbols.join(',');
    return this.request<{ success: boolean; data: CollateralInfo[] }>(
      `/collateral-info?symbols=${symbolsParam}`
    );
  }

  async getMarginExplanation(data: {
    token: string;
    eventType: string;
    beforeState: MarginSnapshot;
    afterState: MarginSnapshot;
    recommendedAction: string;
    includeMarketResearch?: boolean;
  }): Promise<{ success: boolean; explanation: string; timestamp: string; marketResearchIncluded?: boolean; marketResearchSource?: string }> {
    return this.request<{ success: boolean; explanation: string; timestamp: string; marketResearchIncluded?: boolean; marketResearchSource?: string }>(
      '/margin-explanation',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async getMarketResearch(symbol?: string): Promise<{ success: boolean; data?: MarketResearchData; source: string; error?: string }> {
    const params = symbol ? `?symbol=${symbol}` : '';
    return this.request<{ success: boolean; data?: MarketResearchData; source: string; error?: string }>(
      `/market-research${params}`
    );
  }
}

export const apiClient = new ApiClient();