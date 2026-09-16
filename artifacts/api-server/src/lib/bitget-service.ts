import { execFile } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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

interface BitgetTicker {
  symbol: string;
  lastPrice: string;
  price24hPcnt: string;
  volume24h: string;
  highPrice24h: string;
  lowPrice24h: string;
}

interface BitgetTickerResponse {
  code: string;
  data?: BitgetTicker[];
}

export interface BitgetSpotSymbol {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
}

interface BitgetDiscountRateTier {
  tierStartValue: string;
  discountRate: string;
}

interface BitgetDiscountRate {
  coin: string;
  list?: BitgetDiscountRateTier[];
}

interface BitgetDiscountRateResponse {
  code: string;
  data?: BitgetDiscountRate[];
}

interface BitgetAccountAsset {
  coin: string;
  equity: string;
  usdValue: string;
  balance: string;
  available: string;
  debt: string;
  locked: string;
  bonus: string;
}

interface BitgetAccountAssetsPayload {
  accountEquity: string;
  usdtEquity: string;
  btcEquity: string;
  unrealisedPnl: string;
  usdtUnrealisedPnl: string;
  btcUnrealizedPnl: string;
  effEquity: string;
  mmr: string;
  imr: string;
  mgnRatio: string;
  positionMgnRatio: string;
  positionValue: string;
  leverage: string;
  assets: BitgetAccountAsset[];
}

interface BitgetAccountAssetsResponse {
  code: string;
  msg?: string;
  data?: BitgetAccountAssetsPayload;
}

interface BitgetClassicSpotAsset {
  coin?: string;
  coinName?: string;
  coinDisplayName?: string;
  equity?: string;
  available?: string;
  frozen?: string;
  lock?: string;
  locked?: string;
}

interface BitgetClassicSpotAssetsResponse {
  code: string;
  msg?: string;
  message?: string;
  data?: BitgetClassicSpotAsset[];
}

interface BgcResponse<T> {
  ok?: boolean;
  data?: T;
  error?: {
    type?: string;
    category?: string;
    message?: string;
    suggestion?: string;
    endpoint?: string;
  };
}

interface ExecFailure extends Error {
  killed?: boolean;
  signal?: string;
  stderr?: string;
  stdout?: string;
}

export interface BitgetMarketDataResult {
  data: BitgetMarketData[];
  source: 'live';
  sourceDetail: string;
}

export interface BitgetCollateralInfoResult {
  data: BitgetCollateralInfo[];
  source: 'live';
  sourceDetail: string;
}

export interface BitgetAccountSnapshot {
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

export interface BitgetAccountSnapshotResult {
  data: BitgetAccountSnapshot;
  source: 'live';
  sourceDetail: string;
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
      console.warn('Bitget API credentials not provided - authenticated Bitget features may be unavailable');
    } else {
      console.log('Bitget API credentials configured - using real data');
    }
  }

  private getBgcCommand(): { executable: string; baseArgs: string[] } {
    if (process.env.BITGET_BGC_BIN) {
      return { executable: process.env.BITGET_BGC_BIN, baseArgs: [] };
    }

    if (process.platform === 'win32') {
      const appData = process.env.APPDATA;
      if (appData) {
        const bgcEntry = join(appData, 'npm', 'node_modules', '@bitget-ai', 'bitget-agent-cli', 'lib', 'index.js');
        if (existsSync(bgcEntry)) {
          return { executable: process.execPath, baseArgs: [bgcEntry] };
        }
      }
    }

    return { executable: 'bgc', baseArgs: [] };
  }

  private normalizeTicker(ticker: Partial<BitgetTicker> & Record<string, unknown>): BitgetMarketData | null {
    const symbol = typeof ticker.symbol === 'string' ? ticker.symbol : '';
    const lastPrice = Number(ticker.lastPrice ?? ticker.close ?? ticker.price);

    if (!symbol || Number.isNaN(lastPrice)) {
      return null;
    }

    return {
      symbol,
      price: lastPrice,
      change24h: Number(ticker.price24hPcnt ?? ticker.change24h ?? 0) * 100,
      volume24h: Number(ticker.volume24h ?? ticker.baseVolume ?? 0),
      high24h: Number(ticker.highPrice24h ?? ticker.high24h ?? lastPrice),
      low24h: Number(ticker.lowPrice24h ?? ticker.low24h ?? lastPrice),
      timestamp: Date.now(),
    };
  }

  private describeFailure(error: unknown): string {
    if (!(error instanceof Error)) return 'Unknown error';

    const execError = error as ExecFailure;
    const stderr = execError.stderr?.trim();
    const stdout = execError.stdout?.trim();

    if (execError.killed || execError.signal === 'SIGTERM') {
      return 'request timed out before Bitget returned data';
    }

    if (stderr) return stderr.slice(0, 240);
    if (stdout) return stdout.slice(0, 240);

    return error.message;
  }

  private describeRestFailure(error: unknown): string {
    if (!(error instanceof Error)) return 'Unknown REST error';

    const cause = error.cause as { code?: string; hostname?: string } | undefined;
    if (cause?.code === 'ENOTFOUND' && cause.hostname) {
      return `DNS lookup failed for ${cause.hostname}`;
    }

    return error.message;
  }

  private hasPrivateCredentials(): boolean {
    return Boolean(this.apiKey && this.apiSecret && this.passphrase);
  }

  private signRequest(timestamp: string, method: 'GET' | 'POST', path: string, queryString = '', body = ''): string {
    const queryPart = queryString ? `?${queryString}` : '';
    const payload = `${timestamp}${method}${path}${queryPart}${body}`;
    return createHmac('sha256', this.apiSecret).update(payload).digest('base64');
  }

  private async signedGet<T>(path: string, queryString = ''): Promise<T> {
    if (!this.hasPrivateCredentials()) {
      throw new Error('Bitget private credentials are not fully configured');
    }

    const timestamp = String(Date.now());
    const sign = this.signRequest(timestamp, 'GET', path, queryString);
    const url = `${this.baseUrl}${path}${queryString ? `?${queryString}` : ''}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'ACCESS-KEY': this.apiKey,
        'ACCESS-SIGN': sign,
        'ACCESS-TIMESTAMP': timestamp,
        'ACCESS-PASSPHRASE': this.passphrase,
        'Content-Type': 'application/json',
        locale: 'en-US',
      },
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Bitget private endpoint returned ${response.status}: ${text.slice(0, 240)}`);
    }

    return JSON.parse(text) as T;
  }

  private toNumber(value: string | number | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private async getMarketDataFromBgc(symbols: string[]): Promise<BitgetMarketDataResult | null> {
    const results: BitgetMarketData[] = [];

    for (const symbol of symbols) {
      const bgc = this.getBgcCommand();
      const { stdout } = await execFileAsync(
        bgc.executable,
        [...bgc.baseArgs, 'market', '--action', 'tickers', '--category', 'SPOT', '--symbol', symbol, '--view', 'summary'],
        {
          timeout: 8000,
          env: {
            ...process.env,
            BITGET_API_KEY: this.apiKey,
            BITGET_SECRET_KEY: this.apiSecret,
            BITGET_API_SECRET: this.apiSecret,
            BITGET_PASSPHRASE: this.passphrase,
          },
        }
      );
      const parsed = JSON.parse(stdout) as BgcResponse<unknown>;

      if (parsed.ok === false) {
        throw new Error(parsed.error?.message || `bgc market failed for ${symbol}`);
      }

      const rows = Array.isArray(parsed.data)
        ? parsed.data
        : parsed.data && typeof parsed.data === 'object' && Array.isArray((parsed.data as { list?: unknown[] }).list)
          ? (parsed.data as { list: unknown[] }).list
          : parsed.data
            ? [parsed.data]
            : [];

      for (const row of rows) {
        if (row && typeof row === 'object') {
          const normalized = this.normalizeTicker(row as Partial<BitgetTicker> & Record<string, unknown>);
          if (normalized) results.push(normalized);
        }
      }
    }

    if (results.length === 0) return null;

    return {
      data: results,
      source: 'live',
      sourceDetail: 'Bitget Agent Hub bgc market tickers.',
    };
  }

  private toCollateralCoin(symbol: string): string {
    const normalized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalized.endsWith('USDT')) return normalized.slice(0, -4);
    return normalized.startsWith('R') ? normalized : `R${normalized}`;
  }

  private getFallbackCollateralInfo(symbols: string[]): BitgetCollateralInfo[] {
    const mockCollateralInfo: BitgetCollateralInfo[] = [
      {
        symbol: 'rNVDA',
        collateralRatio: 0.95,
        maxLeverage: 5,
        isEligible: true,
      },
      {
        symbol: 'rTSLA',
        collateralRatio: 0.90,
        maxLeverage: 4,
        isEligible: true,
      },
      {
        symbol: 'rQQQ',
        collateralRatio: 0.85,
        maxLeverage: 3,
        isEligible: true,
      },
    ];

    const requested = new Set(symbols.map((symbol) => symbol.toLowerCase()));
    return mockCollateralInfo.filter((info) => requested.has(info.symbol.toLowerCase()));
  }

  async getMarketData(symbols: string[]): Promise<BitgetMarketDataResult> {
    let bgcFailure = '';

    try {
      const bgcResult = await this.getMarketDataFromBgc(symbols);
      if (bgcResult) return bgcResult;
    } catch (error) {
      bgcFailure = this.describeFailure(error);
      console.warn('Bitget Agent Hub bgc market call failed:', error);
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

        const data = await response.json() as BitgetTickerResponse;
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

      if (results.length === 0) {
        throw new Error(`Bitget returned no matching live ticker rows for: ${symbols.join(', ')}`);
      }

      return {
        data: results,
        source: 'live',
        sourceDetail: 'Bitget market ticker endpoint.',
      };
    } catch (error) {
      const restFailure = this.describeRestFailure(error);
      console.error('Error fetching market data from Bitget:', error);
      throw new Error(`Bitget live market requests failed. Agent Hub: ${bgcFailure || 'no live rows returned'}. REST: ${restFailure}.`);
    }
  }

  async searchSpotSymbols(query: string, limit = 12): Promise<BitgetSpotSymbol[]> {
    const normalizedQuery = query.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalizedQuery.length < 1) return [];

    const response = await fetch(`${this.baseUrl}/api/v3/market/tickers?category=SPOT`, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Bitget spot search returned ${response.status}`);
    }

    const payload = await response.json() as BitgetTickerResponse;
    if (payload.code !== '00000' || !Array.isArray(payload.data)) {
      throw new Error(`Bitget spot search returned code ${payload.code || 'unknown'}`);
    }

    return payload.data
      .filter((ticker) => ticker.symbol.toUpperCase().includes(normalizedQuery))
      .sort((a, b) => {
        const aSymbol = a.symbol.toUpperCase();
        const bSymbol = b.symbol.toUpperCase();
        const aStarts = aSymbol.startsWith(normalizedQuery) ? 0 : 1;
        const bStarts = bSymbol.startsWith(normalizedQuery) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return Number(b.volume24h) - Number(a.volume24h);
      })
      .slice(0, limit)
      .map((ticker) => ({
        symbol: ticker.symbol,
        price: Number(ticker.lastPrice),
        change24h: Number(ticker.price24hPcnt) * 100,
        volume24h: Number(ticker.volume24h),
      }));
  }

  async getCollateralInfo(symbols: string[]): Promise<BitgetCollateralInfoResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v3/market/discount-rate`, {
        signal: AbortSignal.timeout(7000),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Bitget discount-rate returned ${response.status}`);
      }

      const payload = await response.json() as BitgetDiscountRateResponse;
      if (payload.code !== '00000' || !Array.isArray(payload.data)) {
        throw new Error(`Bitget discount-rate returned code ${payload.code || 'unknown'}`);
      }

      const discountByCoin = new Map(
        payload.data.map((row) => [row.coin.toUpperCase(), row])
      );
      const liveRows = symbols.flatMap((symbol) => {
        const coin = this.toCollateralCoin(symbol);
        const row = discountByCoin.get(coin);
        const tier = row?.list?.[0];
        const discountRate = Number(tier?.discountRate);

        if (!row || Number.isNaN(discountRate)) return [];

        return [{
          symbol,
          collateralRatio: discountRate,
          maxLeverage: Math.max(1, Math.floor(1 / Math.max(0.1, 1 - discountRate))),
          isEligible: discountRate > 0,
        }];
      });

      if (liveRows.length === symbols.length) {
        return {
          data: liveRows,
          source: 'live',
          sourceDetail: 'Bitget public market discount-rate endpoint. First tier discountRate is used as collateral ratio.',
        };
      }

      throw new Error(`Bitget discount-rate did not return live coverage for: ${symbols.join(', ')}`);
    } catch (error) {
      console.warn('Bitget discount-rate collateral lookup failed:', error);
      throw error instanceof Error ? error : new Error('Bitget collateral lookup failed');
    }
  }

  async getAccountSnapshot(): Promise<BitgetAccountSnapshotResult> {
    try {
      return await this.getClassicSpotAccountSnapshot();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';

      if (message.toLowerCase().includes('classic spot assets')) {
        console.warn('Bitget Classic spot assets unavailable; trying UTA account assets.');
        return this.getUnifiedAccountSnapshot();
      }

      throw error;
    }
  }

  private async getUnifiedAccountSnapshot(): Promise<BitgetAccountSnapshotResult> {
    const payload = await this.signedGet<BitgetAccountAssetsResponse>('/api/v3/account/assets');

    if (payload.code !== '00000' || !payload.data) {
      throw new Error(`Bitget account assets returned code ${payload.code || 'unknown'}: ${payload.msg || 'no message'}`);
    }

    const data = payload.data;

    return {
      source: 'live',
      sourceDetail: 'Bitget UTA account assets endpoint.',
      data: {
        accountEquity: this.toNumber(data.accountEquity),
        effectiveEquity: this.toNumber(data.effEquity),
        usdtEquity: this.toNumber(data.usdtEquity),
        unrealisedPnl: this.toNumber(data.unrealisedPnl),
        maintenanceMargin: this.toNumber(data.mmr),
        initialMargin: this.toNumber(data.imr),
        marginRatio: this.toNumber(data.mgnRatio),
        positionMarginRatio: this.toNumber(data.positionMgnRatio),
        positionValue: this.toNumber(data.positionValue),
        leverage: this.toNumber(data.leverage),
        assets: (data.assets || []).map((asset) => ({
          coin: asset.coin,
          equity: this.toNumber(asset.equity),
          usdValue: this.toNumber(asset.usdValue),
          balance: this.toNumber(asset.balance),
          available: this.toNumber(asset.available),
          debt: this.toNumber(asset.debt),
          locked: this.toNumber(asset.locked),
          bonus: this.toNumber(asset.bonus),
        })),
      },
    };
  }

  private async getClassicSpotAccountSnapshot(): Promise<BitgetAccountSnapshotResult> {
    const payload = await this.signedGet<BitgetClassicSpotAssetsResponse>('/api/v2/spot/account/assets');

    if (payload.code !== '00000' || !Array.isArray(payload.data)) {
      throw new Error(`Bitget Classic spot assets returned code ${payload.code || 'unknown'}: ${payload.msg || payload.message || 'no message'}`);
    }

    const assets = payload.data
      .map((asset) => {
        const coin = asset.coin ?? asset.coinName ?? asset.coinDisplayName ?? '';
        const available = this.toNumber(asset.available);
        const locked = this.toNumber(asset.locked ?? asset.lock);
        const frozen = this.toNumber(asset.frozen);
        const equity = this.toNumber(asset.equity) || available + locked + frozen;

        return {
          coin: coin.toUpperCase(),
          equity,
          usdValue: coin.toUpperCase() === 'USDT' ? equity : 0,
          balance: equity,
          available,
          debt: 0,
          locked: locked + frozen,
          bonus: 0,
        };
      })
      .filter((asset) => asset.coin && (asset.equity > 0 || asset.available > 0 || asset.locked > 0));

    const usdtEquity = assets.find((asset) => asset.coin === 'USDT')?.equity ?? 0;
    const visibleUsdValue = assets.reduce((sum, asset) => sum + asset.usdValue, 0);

    return {
      source: 'live',
      sourceDetail: 'Bitget Classic spot account assets endpoint. Non-USDT spot assets need live mark pricing before USD account equity is complete.',
      data: {
        accountEquity: visibleUsdValue,
        effectiveEquity: visibleUsdValue,
        usdtEquity,
        unrealisedPnl: 0,
        maintenanceMargin: 0,
        initialMargin: 0,
        marginRatio: 0,
        positionMarginRatio: 0,
        positionValue: 0,
        leverage: 1,
        assets,
      },
    };
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
      {
        symbol: 'BTCUSDT',
        price: 113800,
        change24h: 1.1,
        volume24h: 2150000000,
        high24h: 115200,
        low24h: 111900,
        timestamp: Date.now(),
      },
      {
        symbol: 'ETHUSDT',
        price: 4380,
        change24h: 0.6,
        volume24h: 1260000000,
        high24h: 4450,
        low24h: 4280,
        timestamp: Date.now(),
      },
      {
        symbol: 'SOLUSDT',
        price: 238,
        change24h: 2.4,
        volume24h: 540000000,
        high24h: 244,
        low24h: 229,
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
