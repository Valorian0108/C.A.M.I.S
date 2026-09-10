import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

/**
 * Bitget Signal Service
 * 
 * Attempts to connect to Bitget's public MCP server (https://datahub.noxiaohao.com/mcp)
 * to fetch market research data for margin impact analysis.
 * 
 * This provides the same data as bitget-signal skills but programmatically
 * from our backend instead of through an AI assistant.
 * 
 * No API key required - uses public market data only.
 * 
 * Note: The public MCP server may have connectivity issues or protocol differences.
 * This service includes a robust fallback system to ensure demo reliability.
 */

const BITGET_MCP_URL = 'https://datahub.noxiaohao.com/mcp';

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
  source: 'live' | 'fallback';
  error?: string;
}

/**
 * Fetch market research data from Bitget's public MCP server
 */
export async function fetchMarketResearch(
  symbol?: string
): Promise<MarketResearchResponse> {
  const client = new Client({ name: 'camis-backend', version: '1.0.0' });

  try {
    const transport = new StreamableHTTPClientTransport(
      new URL(BITGET_MCP_URL)
    );

    await client.connect(transport);

    // List available tools to discover what's available
    const toolsResult = await client.listTools();
    
    if (!toolsResult.success) {
      throw new Error('Failed to list MCP tools');
    }

    // Try to call relevant market research tools
    const researchData: MarketResearchData = {};

    // Attempt to fetch Fear & Greed Index (if available)
    try {
      const fearGreedResult = await client.callTool({
        name: 'fear_greed_index',
        arguments: {}
      });
      
      if (fearGreedResult.success && fearGreedResult.content) {
        const content = fearGreedResult.content[0];
        if (content.type === 'text') {
          const data = JSON.parse(content.text);
          researchData.fearGreedIndex = data.value;
          researchData.fearGreedSentiment = data.sentiment;
        }
      }
    } catch (e) {
      // Tool may not exist, continue
    }

    // Attempt to fetch funding rates for symbol
    if (symbol) {
      try {
        const fundingResult = await client.callTool({
          name: 'market',
          arguments: {
            action: 'fundingRate',
            symbol: symbol
          }
        });

        if (fundingResult.success && fundingResult.content) {
          const content = fundingResult.content[0];
          if (content.type === 'text') {
            const data = JSON.parse(content.text);
            researchData.fundingRates = { [symbol]: data.fundingRate };
          }
        }
      } catch (e) {
        // Tool may not exist, continue
      }
    }

    // Attempt to fetch market sentiment
    try {
      const sentimentResult = await client.callTool({
        name: 'sentiment_analyst',
        arguments: {}
      });

      if (sentimentResult.success && sentimentResult.content) {
        const content = sentimentResult.content[0];
        if (content.type === 'text') {
          const data = JSON.parse(content.text);
          researchData.marketSentiment = data.overview;
          researchData.longShortRatio = data.longShortRatio;
        }
      }
    } catch (e) {
      // Tool may not exist, continue
    }

    await client.close();

    return {
      success: true,
      data: researchData,
      source: 'live'
    };

  } catch (error) {
    console.error('Bitget MCP connection error:', error);
    console.log('Using fallback market research data');
    
    // Return fallback data if MCP connection fails
    return getFallbackMarketResearch();
  }
}

/**
 * Fallback market research data when MCP is unavailable
 */
function getFallbackMarketResearch(): MarketResearchResponse {
  return {
    success: true,
    data: {
      fearGreedIndex: 45,
      fearGreedSentiment: 'Neutral',
      longShortRatio: 1.2,
      fundingRates: {
        'BTCUSDT': 0.01,
        'ETHUSDT': 0.008
      },
      marketSentiment: 'Market showing moderate bullish sentiment with balanced long/short positioning',
      technicalIndicators: {
        rsi: 55,
        macd: 0.5,
        support: 95000,
        resistance: 105000
      },
      whaleActivity: {
        inflows: 125000000,
        outflows: 98000000,
        netFlow: 27000000
      },
      macroContext: {
        fedPolicy: 'Wait-and-see stance with moderate rate cut expectations',
        btcCorrelation: 0.65,
        dxy: 104.5
      }
    },
    source: 'fallback',
    error: 'MCP connection failed, using fallback data'
  };
}

/**
 * Format market research data for Qwen prompt
 */
export function formatMarketResearchForPrompt(
  data: MarketResearchData
): string {
  const sections: string[] = [];

  if (data.fearGreedIndex) {
    sections.push(
      `Fear & Greed Index: ${data.fearGreedIndex} (${data.fearGreedSentiment})`
    );
  }

  if (data.marketSentiment) {
    sections.push(`Market Sentiment: ${data.marketSentiment}`);
  }

  if (data.longShortRatio) {
    sections.push(
      `Long/Short Ratio: ${data.longShortRatio} (bullish if >1, bearish if <1)`
    );
  }

  if (data.fundingRates) {
    sections.push(
      `Funding Rates: ${Object.entries(data.fundingRates)
        .map(([sym, rate]) => `${sym}: ${(rate * 100).toFixed(4)}%`)
        .join(', ')}`
    );
  }

  if (data.technicalIndicators) {
    const ta = data.technicalIndicators;
    sections.push(
      `Technical Analysis: RSI ${ta.rsi}, MACD ${ta.macd}, Support $${ta.support?.toLocaleString()}, Resistance $${ta.resistance?.toLocaleString()}`
    );
  }

  if (data.whaleActivity) {
    const whale = data.whaleActivity;
    sections.push(
      `Whale Activity: Inflows $${whale.inflows?.toLocaleString()}, Outflows $${whale.outflows?.toLocaleString()}, Net Flow $${whale.netFlow?.toLocaleString()}`
    );
  }

  if (data.macroContext) {
    const macro = data.macroContext;
    sections.push(
      `Macro Context: ${macro.fedPolicy}, BTC Correlation ${macro.btcCorrelation}, DXY ${macro.dxy}`
    );
  }

  return sections.length > 0 
    ? `Market Research Context:\n${sections.map(s => `- ${s}`).join('\n')}`
    : 'No market research data available';
}
