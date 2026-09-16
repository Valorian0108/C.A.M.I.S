import { Router, type IRouter } from "express";
import { z } from "zod";
import { qwenService } from "../lib/qwen-service";
import { fetchMarketResearch } from "../lib/bitget-signal-service";

const router: IRouter = Router();

// Schema for request validation
const MarginExplanationRequestSchema = z.object({
  token: z.string(),
  eventType: z.string(),
  beforeState: z.object({
    collateralValue: z.number(),
    adjustedEquity: z.number(),
    totalPositionValue: z.number(),
    leverage: z.number(),
    marginRatio: z.number(),
    liquidationDistance: z.number(),
    collateralRatio: z.number(),
  }),
  afterState: z.object({
    collateralValue: z.number(),
    adjustedEquity: z.number(),
    totalPositionValue: z.number(),
    leverage: z.number(),
    marginRatio: z.number(),
    liquidationDistance: z.number(),
    collateralRatio: z.number(),
  }),
  recommendedAction: z.string(),
  includeMarketResearch: z.boolean().optional().default(false),
});

router.post("/margin-explanation", async (req, res) => {
  try {
    // Validate request body
    const validatedData = MarginExplanationRequestSchema.parse(req.body);

    // Fetch market research if requested
    let marketResearch;
    let marketResearchSource = 'none';
    if (validatedData.includeMarketResearch) {
      const researchResponse = await fetchMarketResearch(validatedData.token);
      if (researchResponse.success && researchResponse.data) {
        marketResearch = researchResponse.data;
        marketResearchSource = researchResponse.source;
      }
    }

    // Generate explanation using Qwen with optional market research
    const explanationResult = await qwenService.generateExplanation({
      ...validatedData,
      marketResearch
    });

    res.json({
      success: true,
      explanation: explanationResult.explanation,
      explanationSource: explanationResult.source,
      explanationSourceDetail: explanationResult.sourceDetail,
      timestamp: new Date().toISOString(),
      marketResearchIncluded: !!marketResearch,
      marketResearchSource,
    });
  } catch (error) {
    console.error('Margin explanation error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate explanation',
    });
  }
});

export default router;
