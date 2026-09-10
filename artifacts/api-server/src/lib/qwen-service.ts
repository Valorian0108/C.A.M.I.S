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

export class QwenService {
  private apiKey: string;
  private baseUrl: string;
  private modelName: string;

  constructor() {
    this.apiKey = process.env.BITGET_QWEN_API_KEY || '';
    this.baseUrl = process.env.BITGET_QWEN_BASE_URL || 'https://hackathon.bitgetops.com/v1';
    this.modelName = process.env.BITGET_QWEN_MODEL || 'qwen-plus';
    
    if (!this.apiKey) {
      throw new Error('BITGET_QWEN_API_KEY environment variable is required');
    }
  }

  async generateExplanation(simulationData: {
    token: string;
    eventType: string;
    beforeState: {
      collateralValue: number;
      leverage: number;
      marginRatio: number;
      liquidationDistance: number;
    };
    afterState: {
      collateralValue: number;
      leverage: number;
      marginRatio: number;
      liquidationDistance: number;
    };
    recommendedAction: string;
  }): Promise<string> {
    const systemPrompt = `You are a margin risk analyst for leveraged rToken traders. Explain corporate action impacts in clear, actionable language. Focus on:
1. What changed and why
2. Risk implications (liquidation distance, margin ratio)
3. Recommended action with reasoning
4. Key uncertainties or missing information
Be concise but thorough. Use financial terminology appropriately.`;

    const userPrompt = `Analyze this corporate action impact:

Token: ${simulationData.token}
Event Type: ${simulationData.eventType}

BEFORE:
- Collateral Value: $${simulationData.beforeState.collateralValue.toLocaleString()}
- Leverage: ${simulationData.beforeState.leverage}x
- Margin Ratio: ${(simulationData.beforeState.marginRatio * 100).toFixed(1)}%
- Liquidation Distance: ${simulationData.beforeState.liquidationDistance.toFixed(2)}%

AFTER:
- Collateral Value: $${simulationData.afterState.collateralValue.toLocaleString()}
- Leverage: ${simulationData.afterState.leverage}x
- Margin Ratio: ${(simulationData.afterState.marginRatio * 100).toFixed(1)}%
- Liquidation Distance: ${simulationData.afterState.liquidationDistance.toFixed(2)}%

Recommended Action: ${simulationData.recommendedAction}

Provide a clear explanation of what happened, the risk implications, and whether the recommended action is appropriate.`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
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
        console.warn(`Qwen API error: ${response.status} - ${errorText}, using fallback explanation`);
        return this.getFallbackExplanation(simulationData);
      }

      const data = await response.json() as QwenResponse;
      const explanation = data.choices?.[0]?.message?.content;

      if (!explanation) {
        console.warn('No explanation generated from Qwen API, using fallback');
        return this.getFallbackExplanation(simulationData);
      }

      return explanation;
    } catch (error) {
      console.error('Qwen API call failed:', error);
      return this.getFallbackExplanation(simulationData);
    }
  }

  private getFallbackExplanation(simulationData: {
    token: string;
    eventType: string;
    beforeState: any;
    afterState: any;
    recommendedAction: string;
  }): string {
    const collateralChange = simulationData.afterState.collateralValue - simulationData.beforeState.collateralValue;
    const collateralChangePercent = ((collateralChange / simulationData.beforeState.collateralValue) * 100).toFixed(1);
    const marginRatioChange = (simulationData.afterState.marginRatio - simulationData.beforeState.marginRatio) * 100;
    const liquidationDistanceChange = simulationData.afterState.liquidationDistance - simulationData.beforeState.liquidationDistance;

    let riskAssessment = 'LOW';
    if (Math.abs(marginRatioChange) > 5 || liquidationDistanceChange < -0.05) {
      riskAssessment = 'MODERATE';
    }
    if (Math.abs(marginRatioChange) > 10 || liquidationDistanceChange < -0.1) {
      riskAssessment = 'HIGH';
    }

    let recommendation = '';
    if (simulationData.recommendedAction === 'reduce_exposure') {
      recommendation = 'Consider reducing exposure. The decrease in liquidation distance indicates higher risk of liquidation if the market moves against your position.';
    } else if (simulationData.recommendedAction === 'add_collateral') {
      recommendation = 'Adding collateral would help restore your margin buffer and reduce liquidation risk.';
    } else {
      recommendation = 'Holding position is acceptable given current margin levels, but monitor closely.';
    }

    return `Corporate Action Impact Analysis

The ${simulationData.eventType} event for ${simulationData.token} has resulted in significant changes to your margin position:

Key Changes:
- Collateral Value: ${collateralChange >= 0 ? '+' : ''}$${collateralChange.toLocaleString()} (${collateralChangePercent}%)
- Margin Ratio: ${marginRatioChange >= 0 ? '+' : ''}${marginRatioChange.toFixed(1)} percentage points
- Liquidation Distance: ${liquidationDistanceChange >= 0 ? '+' : ''}${(liquidationDistanceChange * 100).toFixed(1)}%

Risk Assessment: ${riskAssessment}

Recommendation: ${recommendation}

Note: This analysis is based on deterministic margin calculations. Market conditions and additional factors may affect actual outcomes.`;
  }
}

export const qwenService = new QwenService();