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
  declaration_date: string;
  ex_date: string;
  record_date: string;
  payable_date: string;
  cash_amount: number;
  description: string;
}

interface AlpacaResponse {
  corporate_actions?: AlpacaCorporateAction[];
  announcements?: AlpacaAnnouncement[];
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

  async getCorporateActions(symbols: string[]): Promise<AlpacaCorporateAction[]> {
    // If no credentials, return mock data for demo
    if (!this.apiKey || !this.apiSecret) {
      return this.getMockCorporateActions(symbols);
    }

    try {
      // Try the announcements endpoint first (more commonly accessible)
      const symbolParams = symbols.map(s => `symbol=${s}`).join('&');
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days
      const endDate = new Date();
      const since = startDate.toISOString().split('T')[0];
      const until = endDate.toISOString().split('T')[0];
      
      const response = await fetch(
        `https://data.alpaca.markets/v2/corporate-actions/announcements?${symbolParams}&since=${since}&until=${until}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${this.getAuthHeader()}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.warn(`Alpaca API error: ${response.status}, trying corporate-actions endpoint`);
        
        // Fallback to corporate-actions endpoint
        const corpResponse = await fetch(
          `https://data.alpaca.markets/v2/corporate-actions?symbols=${symbols.join(',')}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${this.getAuthHeader()}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!corpResponse.ok) {
          console.warn(`Alpaca corporate-actions error: ${corpResponse.status}, using mock data`);
          return this.getMockCorporateActions(symbols);
        }

        const corpData: AlpacaResponse = await corpResponse.json();
        return corpData.corporate_actions || [];
      }

      const data: AlpacaResponse = await response.json();
      
      // Handle both corporate_actions and announcements responses
      if (data.corporate_actions) {
        return data.corporate_actions;
      }
      
      if (data.announcements) {
        // Convert announcements to our corporate action format
        return data.announcements.map(announcement => ({
          id: announcement.id,
          symbol: announcement.symbol,
          corporate_action_type: announcement.corporate_action_type,
          corporate_action_date: announcement.ex_date || announcement.corporate_action_date,
          declaration_date: announcement.declaration_date,
          record_date: announcement.record_date,
          effective_date: announcement.payable_date || announcement.effective_date,
          cash_amount: announcement.cash_amount,
          new_rate: 0,
          old_rate: 0,
          distribution_frequency: 'once',
          description: announcement.description
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching corporate actions from Alpaca:', error);
      // Fallback to mock data for demo reliability
      return this.getMockCorporateActions(symbols);
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
    const allActions = await this.getCorporateActions(['NVDA', 'TSLA', 'QQQ']);
    return allActions.find(action => action.id === id) || null;
  }
}

export const alpacaService = new AlpacaService();