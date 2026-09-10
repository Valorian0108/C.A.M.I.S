import { Router, type IRouter } from "express";
import { z } from "zod";
import { qwenService } from "../lib/qwen-service";

const router: IRouter = Router();

// Schema for request validation
const MarginExplanationRequestSchema = z.object({
  token: z.string(),
  eventType: z.string(),
  beforeState: z.object({
    collateralValue: z.number(),
    leverage: z.number(),
    marginRatio: z.number(),
    liquidationDistance: z.number(),
  }),
  afterState: z.object({
    collateralValue: z.number(),
    leverage: z.number(),
    marginRatio: z.number(),
    liquidationDistance: z.number(),
  }),
  recommendedAction: z.string(),
});

router.post("/margin-explanation", async (req, res) => {
  try {
    // Validate request body
    const validatedData = MarginExplanationRequestSchema.parse(req.body);

    // Generate explanation using Qwen
    const explanation = await qwenService.generateExplanation(validatedData);

    res.json({
      success: true,
      explanation,
      timestamp: new Date().toISOString(),
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