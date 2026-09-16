interface AlpacaCorporateAction {
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

interface AlpacaAnnouncement {
  id: string;
  corporate_action_type: string;
  symbol: string;
  declaration_date?: string;
  ex_date?: string;
  record_date?: string;
  payable_date?: string;
  cash_amount?: number;
  description?: string;
}

interface AlpacaResponse {
  corporate_actions?: AlpacaCorporateAction[];
  announcements?: AlpacaAnnouncement[];
  next_page_token?: string;
  [key: string]: unknown;
}

export interface AlpacaCorporateActionsResult {
  data: AlpacaCorporateAction[];
  source: 'live' | 'fallback';
  sourceDetail: string;
}

export class AlpacaService {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.ALPACA_API_KEY || '';
    this.apiSecret = process.env.ALPACA_API_SECRET || '';
    this.baseUrl = process.env.ALPACA_BASE_URL || 'https://data.alpaca.markets/v1';
    
    if (!this.apiKey || !this.apiSecret) {
      console.warn('Alpaca API credentials not provided - using mock data for demo');
    } else {
      console.log('Alpaca API credentials configured - using real data');
    }
  }

  private getAuthHeader(): string {
    return Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
  }

  private getCorporateActionsUrl(): string {
    try {
      const url = new URL(this.baseUrl);
      return `${url.origin}/v1/corporate-actions`;
    } catch {
      return 'https://data.alpaca.markets/v1/corporate-actions';
    }
  }

  private normalizeCorporateAction(raw: Record<string, unknown>, fallbackSymbol = ''): AlpacaCorporateAction {
    const type = String(raw.type || raw.corporate_action_type || raw.ca_type || 'corporate_action');
    const symbol = String(raw.symbol || raw.initiating_symbol || raw.target_symbol || fallbackSymbol);
    const exDate = String(raw.ex_date || raw.corporate_action_date || raw.process_date || raw.payable_date || '');

    return {
      id: String(raw.id || `${symbol}-${type}-${exDate}`),
      symbol,
      corporate_action_type: type,
      corporate_action_date: exDate,
      declaration_date: String(raw.declaration_date || ''),
      record_date: String(raw.record_date || ''),
      effective_date: String(raw.payable_date || raw.effective_date || exDate),
      cash_amount: Number(raw.cash || raw.cash_amount || raw.rate || 0),
      new_rate: Number(raw.new_rate || raw.new_shares_rate || 0),
      old_rate: Number(raw.old_rate || raw.old_shares_rate || 0),
      distribution_frequency: String(raw.frequency || raw.distribution_frequency || 'once'),
      description: String(raw.description || `${symbol} ${type}`),
    };
  }

  private extractCorporateActions(data: AlpacaResponse, symbols: string[]): AlpacaCorporateAction[] {
    if (Array.isArray(data.corporate_actions)) {
      return data.corporate_actions;
    }

    const actions: AlpacaCorporateAction[] = [];
    const supportedKeys = [
      'reverse_splits',
      'forward_splits',
      'unit_splits',
      'cash_dividends',
      'stock_dividends',
      'spin_offs',
      'cash_mergers',
      'stock_mergers',
      'stock_and_cash_mergers',
      'redemptions',
      'name_changes',
      'worthless_removals',
      'rights_distributions',
      'partial_calls',
      'reorganizations',
      'capital_gains_distributions',
    ];

    for (const key of supportedKeys) {
      const value = data[key];
      if (!Array.isArray(value)) continue;

      for (const item of value) {
        if (item && typeof item === 'object') {
          actions.push(this.normalizeCorporateAction(item as Record<string, unknown>));
        }
      }
    }

    return actions.filter((action) => symbols.includes(action.symbol));
  }

  async getCorporateActions(symbols: string[]): Promise<AlpacaCorporateActionsResult> {
    if (!this.apiKey || !this.apiSecret) {
      return {
        data: this.getMockCorporateActions(symbols),
        source: 'fallback',
        sourceDetail: 'Alpaca credentials missing; using demo corporate-action fixtures.',
      };
    }

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 90);
      const since = startDate.toISOString().split('T')[0];
      const until = endDate.toISOString().split('T')[0];
      
      const response = await fetch(
        `${this.getCorporateActionsUrl()}?symbols=${symbols.join(',')}&start=${since}&end=${until}&data_quality=all&limit=1000`,
        {
          method: 'GET',
          headers: {
            'APCA-API-KEY-ID': this.apiKey,
            'APCA-API-SECRET-KEY': this.apiSecret,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.warn(`Alpaca corporate-actions error: ${response.status}, using mock data`);
        return {
          data: this.getMockCorporateActions(symbols),
          source: 'fallback',
          sourceDetail: `Alpaca returned ${response.status}; using demo corporate-action fixtures.`,
        };
      }

      const data = await response.json() as AlpacaResponse;
      const actions = this.extractCorporateActions(data, symbols);
      
      return {
        data: actions,
        source: 'live',
        sourceDetail: actions.length > 0
          ? 'Alpaca v1 corporate-actions endpoint.'
          : 'Alpaca responded successfully; no matching corporate actions found in the requested window.',
      };
    } catch (error) {
      console.error('Error fetching corporate actions from Alpaca:', error);
      return {
        data: this.getMockCorporateActions(symbols),
        source: 'fallback',
        sourceDetail: 'Alpaca request failed; using demo corporate-action fixtures.',
      };
    }
  }

  private getMockCorporateActions(symbols: string[]): AlpacaCorporateAction[] {
    // Mock data for hackathon demo - represents realistic corporate actions
    const mockActions: AlpacaCorporateAction[] = [
      {
        id: 'ca_001',
        symbol: 'NVDA',
        corporate_action_type: 'reverse_split',
        corporate_action_date: '2026-09-15',
        declaration_date: '2026-09-01',
        record_date: '2026-09-10',
        effective_date: '2026-09-15',
        cash_amount: 0,
        new_rate: 10,
        old_rate: 1,
        distribution_frequency: 'once',
        description: 'NVIDIA Corporation 10-for-1 reverse stock split'
      },
      {
        id: 'ca_002',
        symbol: 'TSLA',
        corporate_action_type: 'cash_dividend',
        corporate_action_date: '2026-09-20',
        declaration_date: '2026-09-05',
        record_date: '2026-09-15',
        effective_date: '2026-09-25',
        cash_amount: 0.25,
        new_rate: 0,
        old_rate: 0,
        distribution_frequency: 'quarterly',
        description: 'Tesla Inc. quarterly cash dividend of $0.25 per share'
      },
      {
        id: 'ca_003',
        symbol: 'QQQ',
        corporate_action_type: 'cash_dividend',
        corporate_action_date: '2026-09-18',
        declaration_date: '2026-09-04',
        record_date: '2026-09-12',
        effective_date: '2026-09-20',
        cash_amount: 0.52,
        new_rate: 0,
        old_rate: 0,
        distribution_frequency: 'quarterly',
        description: 'Invesco QQQ Trust quarterly distribution of $0.52 per share'
      }
    ];

    // Filter by requested symbols
    return mockActions.filter(action => 
      symbols.some(s => s === action.symbol)
    );
  }

  async getCorporateActionById(id: string): Promise<AlpacaCorporateAction | null> {
    const result = await this.getCorporateActions(['NVDA', 'TSLA', 'QQQ']);
    return result.data.find(action => action.id === id) || null;
  }
}

export const alpacaService = new AlpacaService();
