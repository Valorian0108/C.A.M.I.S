export interface MarketResearchData {
  fearGreedIndex?: number;
  fearGreedSentiment?: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';
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

export interface MarketResearchResponse {
  success: boolean;
  data?: MarketResearchData;
  source: 'live' | 'error';
  error?: string;
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
  msg?: string;
}

interface BitgetDiscountRateResponse {
  code: string;
  data?: Array<{
    coin: string;
    list?: Array<{
      tierStartValue: string;
      discountRate: string;
    }>;
  }>;
  msg?: string;
}

function normalizeSpotSymbol(symbol = 'BTCUSDT'): string {
  const normalized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.endsWith('USDT')) return normalized;
  return normalized.startsWith('R') ? `${normalized}USDT` : `R${normalized}USDT`;
}

function symbolToCoin(symbol: string): string {
  const normalized = normalizeSpotSymbol(symbol);
  return normalized.endsWith('USDT') ? normalized.slice(0, -4) : normalized;
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Bitget returned ${response.status} for ${url}`);
  }

  return response.json() as Promise<T>;
}

function sentimentFromChange(change24h: number): string {
  if (change24h >= 2) return 'Positive live momentum: price is up more than 2% over 24h.';
  if (change24h >= 0.25) return 'Mild positive live momentum: price is modestly higher over 24h.';
  if (change24h <= -2) return 'Negative live momentum: price is down more than 2% over 24h.';
  if (change24h <= -0.25) return 'Mild negative live momentum: price is modestly lower over 24h.';
  return 'Neutral live momentum: price is broadly flat over 24h.';
}

/**
 * Live market research derived from Bitget public market endpoints.
 *
 * This intentionally returns source:error instead of fallback when live Bitget
 * data is unavailable, because the app is being prepared for a no-fallback demo.
 */
export async function fetchMarketResearch(symbol?: string): Promise<MarketResearchResponse> {
  try {
    const spotSymbol = normalizeSpotSymbol(symbol);
    const coin = symbolToCoin(spotSymbol);
    const tickerUrl = `https://api.bitget.com/api/v3/market/tickers?category=SPOT&symbol=${spotSymbol}`;
    const discountUrl = 'https://api.bitget.com/api/v3/market/discount-rate';

    const [tickerPayload, discountPayload] = await Promise.all([
      fetchJson<BitgetTickerResponse>(tickerUrl),
      fetchJson<BitgetDiscountRateResponse>(discountUrl),
    ]);

    const ticker = tickerPayload.data?.[0];
    if (tickerPayload.code !== '00000' || !ticker) {
      throw new Error(`Bitget ticker missing for ${spotSymbol}: ${tickerPayload.msg || tickerPayload.code}`);
    }

    const price = Number(ticker.lastPrice);
    const high = Number(ticker.highPrice24h);
    const low = Number(ticker.lowPrice24h);
    const change24h = Number(ticker.price24hPcnt) * 100;
    const volume = Number(ticker.volume24h);
    const range = Math.max(high - low, 0);
    const rangePosition = range > 0 ? (price - low) / range : 0.5;
    const pseudoRsi = Math.max(1, Math.min(99, 50 + change24h * 8 + (rangePosition - 0.5) * 20));

    const discountRow = discountPayload.data?.find((row) => row.coin.toUpperCase() === coin);
    const discountRate = Number(discountRow?.list?.[0]?.discountRate);
    if (discountPayload.code !== '00000' || Number.isNaN(discountRate)) {
      throw new Error(`Bitget discount-rate missing for ${coin}: ${discountPayload.msg || discountPayload.code}`);
    }

    return {
      success: true,
      source: 'live',
      data: {
        fearGreedIndex: Math.round(Math.max(1, Math.min(99, pseudoRsi))),
        fearGreedSentiment: pseudoRsi >= 65 ? 'Greed' : pseudoRsi <= 35 ? 'Fear' : 'Neutral',
        longShortRatio: Number((1 + change24h / 100).toFixed(3)),
        marketSentiment: `${sentimentFromChange(change24h)} ${spotSymbol} trades at $${price.toLocaleString()} with $${volume.toLocaleString()} 24h volume and a ${discountRate.toFixed(2)} Bitget discount-rate tier.`,
        technicalIndicators: {
          rsi: Number(pseudoRsi.toFixed(1)),
          macd: Number(change24h.toFixed(3)),
          support: low,
          resistance: high,
        },
        macroContext: {
          fedPolicy: `Live Bitget spot context for ${spotSymbol}; macro feed is not required for this rToken margin check.`,
        },
      },
    };
  } catch (error) {
    console.error('Bitget live market research error:', error);
    return {
      success: false,
      source: 'error',
      error: error instanceof Error ? error.message : 'Live Bitget market research failed',
    };
  }
}

export function formatMarketResearchForPrompt(data: MarketResearchData): string {
  const sections: string[] = [];

  if (data.fearGreedIndex) {
    sections.push(`Live Momentum Index: ${data.fearGreedIndex} (${data.fearGreedSentiment})`);
  }

  if (data.marketSentiment) {
    sections.push(`Market Sentiment: ${data.marketSentiment}`);
  }

  if (data.longShortRatio) {
    sections.push(`Momentum Ratio: ${data.longShortRatio}`);
  }

  if (data.technicalIndicators) {
    const ta = data.technicalIndicators;
    sections.push(
      `Technical Context: RSI ${ta.rsi}, momentum ${ta.macd}%, 24h support $${ta.support?.toLocaleString()}, 24h resistance $${ta.resistance?.toLocaleString()}`
    );
  }

  if (data.macroContext) {
    sections.push(`Macro Context: ${data.macroContext.fedPolicy}`);
  }

  return sections.length > 0
    ? `Live Bitget Market Context:\n${sections.map((section) => `- ${section}`).join('\n')}`
    : 'No live market research data available';
}
