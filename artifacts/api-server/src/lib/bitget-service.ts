interface BitgetMarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

interface BitgetCollateralInfo {
  symbol: string;
  collateralRatio: number;
  maxLeverage: number;
  isEligible: boolean;
}

export class BitgetService {
  private apiKey: string;
  private apiSecret: string;
  private passphrase: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.BITGET_API_KEY || '';
    this.apiSecret = process.env.BITGET_API_SECRET || '';
    this.passphrase = process.env.BITGET_PASSPHRASE || '';
    this.baseUrl = process.env.BITGET_BASE_URL || 'https://api.bitget.com';
    
    if (!this.apiKey || !this.apiSecret) {
      console.warn('Bitget API credentials not provided - using mock data for demo');
    } else {
      console.log('Bitget API credentials configured - using real data');
    }
  }

  async getMarketData(symbols: string[]): Promise<BitgetMarketData[]> {
    // If no credentials, return mock data for demo
    if (!this.apiKey || !this.apiSecret) {
      return this.getMockMarketData(symbols);
    }

    try {
      // Use the correct Bitget API v3 endpoint from documentation
      const results: BitgetMarketData[] = [];
      
      for (const symbol of symbols) {
        const response = await fetch(
          `${this.baseUrl}/api/v3/market/tickers?category=SPOT&symbol=${symbol}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          console.warn(`Failed to fetch market data for ${symbol}, status: ${response.status}`);
          continue;
        }

        const data = await response.json();
        if (data.code === '00000' && data.data && data.data.length > 0) {
          const ticker = data.data[0];
          results.push({
            symbol: ticker.symbol,
            price: parseFloat(ticker.lastPrice),
            change24h: parseFloat(ticker.price24hPcnt) * 100,
            volume24h: parseFloat(ticker.volume24h),
            high24h: parseFloat(ticker.highPrice24h),
            low24h: parseFloat(ticker.lowPrice24h),
            timestamp: Date.now(),
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error fetching market data from Bitget:', error);
      // Fallback to mock data for demo reliability
      return this.getMockMarketData(symbols);
    }
  }

  async getCollateralInfo(symbols: string[]): Promise<BitgetCollateralInfo[]> {
    // Mock collateral data for rTokens with realistic ratios
    const mockCollateralInfo: BitgetCollateralInfo[] = [
      {
        symbol: 'rNVDA',
        collateralRatio: 0.95, // 95% in decimal
        maxLeverage: 5,
        isEligible: true,
      },
      {
        symbol: 'rTSLA',
        collateralRatio: 0.90, // 90% in decimal
        maxLeverage: 4,
        isEligible: true,
      },
      {
        symbol: 'rQQQ',
        collateralRatio: 0.85, // 85% in decimal
        maxLeverage: 3,
        isEligible: true,
      },
    ];

    return mockCollateralInfo.filter(info => 
      symbols.some(s => s === info.symbol)
    );
  }

  private getMockMarketData(symbols: string[]): BitgetMarketData[] {
    // Mock market data for hackathon demo - using realistic rToken data
    const mockData: BitgetMarketData[] = [
      {
        symbol: 'rNVDA',
        price: 118.50,
        change24h: 2.3,
        volume24h: 125000000,
        high24h: 120.00,
        low24h: 115.00,
        timestamp: Date.now(),
      },
      {
        symbol: 'rTSLA',
        price: 245.75,
        change24h: -1.2,
        volume24h: 89000000,
        high24h: 250.00,
        low24h: 240.00,
        timestamp: Date.now(),
      },
      {
        symbol: 'rQQQ',
        price: 485.20,
        change24h: 0.8,
        volume24h: 156000000,
        high24h: 490.00,
        low24h: 480.00,
        timestamp: Date.now(),
      },
    ];

    return mockData.filter(data => 
      symbols.some(s => s === data.symbol)
    );
  }

  async getrTokenList(): Promise<string[]> {
    return ['rNVDA', 'rTSLA', 'rQQQ', 'rAAPL', 'rMSFT'];
  }
}

export const bitgetService = new BitgetService();