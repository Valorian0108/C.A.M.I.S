import {
  fetchMarketResearch,
  formatMarketResearchForPrompt,
  type MarketResearchData
} from './bitget-signal-service.js';

interface QwenMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface QwenRequest {
  model: string;
  messages: QwenMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

interface QwenResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface MarginSnapshot {
  collateralValue: number;
  adjustedEquity: number;
  totalPositionValue: number;
  leverage: number;
  marginRatio: number;
  liquidationDistance: number;
  collateralRatio: number;
}

interface SimulationData {
  token: string;
  eventType: string;
  beforeState: MarginSnapshot;
  afterState: MarginSnapshot;
  recommendedAction: string;
  marketResearch?: MarketResearchData;
}

export interface ExplanationResult {
  explanation: string;
  source: 'live';
  sourceDetail: string;
}

export class QwenService {
  private apiKey: string;
  private baseUrl: string;
  private modelName: string;

  constructor() {
    this.apiKey = process.env.BITGET_QWEN_API_KEY || '';
    this.baseUrl = process.env.BITGET_QWEN_BASE_URL || 'https://hackathon.bitgetops.com/v1';
    this.modelName = process.env.BITGET_QWEN_MODEL || 'qwen3.8-max';
    
    if (!this.apiKey) {
      console.warn('BITGET_QWEN_API_KEY not provided - live AI explanations are unavailable');
    }
  }

  async generateExplanation(simulationData: SimulationData): Promise<ExplanationResult> {
    const systemPrompt = 'You are a concise margin-risk analyst. Return 3 short paragraphs: change, risk, recommendation. Use only the supplied numbers. Round currency to whole dollars, leverage to 2 decimals, and percentages to 1 decimal. Treat account values as scenario inputs unless explicitly described as exchange-verified.';

    const userPrompt = [
      `Token ${simulationData.token}; event ${simulationData.eventType}; action ${simulationData.recommendedAction}.`,
      `Before: collateral $${simulationData.beforeState.collateralValue.toFixed(0)}; equity $${simulationData.beforeState.adjustedEquity.toFixed(0)}; leverage ${simulationData.beforeState.leverage.toFixed(2)}x; margin ${(simulationData.beforeState.marginRatio * 100).toFixed(1)}%; liquidation distance ${simulationData.beforeState.liquidationDistance.toFixed(1)}%.`,
      `After: collateral $${simulationData.afterState.collateralValue.toFixed(0)}; equity $${simulationData.afterState.adjustedEquity.toFixed(0)}; leverage ${simulationData.afterState.leverage.toFixed(2)}x; margin ${(simulationData.afterState.marginRatio * 100).toFixed(1)}%; liquidation distance ${simulationData.afterState.liquidationDistance.toFixed(1)}%.`,
      simulationData.marketResearch ? formatMarketResearchForPrompt(simulationData.marketResearch) : '',
      'Explain the change, risk, and whether the action is appropriate. Keep it under 120 words.',
    ].filter(Boolean).join('\n');

    try {
      if (!this.apiKey) {
        throw new Error('BITGET_QWEN_API_KEY is not configured');
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(30000),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 500,
          top_p: 1,
          stream: false
        } as QwenRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Qwen returned ${response.status}: ${errorText.slice(0, 240)}`);
      }

      const data = await response.json() as QwenResponse;
      const explanation = data.choices?.[0]?.message?.content;

      if (!explanation) {
        throw new Error('Qwen response did not include explanation text');
      }

      return {
        explanation,
        source: 'live',
        sourceDetail: `${this.modelName} via ${this.baseUrl}`,
      };
    } catch (error) {
      console.error('Qwen API call failed:', error);
      throw error instanceof Error ? error : new Error('Qwen request failed');
    }
  }
}

export const qwenService = new QwenService();
