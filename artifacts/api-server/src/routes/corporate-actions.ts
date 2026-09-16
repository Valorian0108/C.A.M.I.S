import { Router, type IRouter } from "express";
import { z } from "zod";
import { alpacaService } from "../lib/alpaca-service";

const router: IRouter = Router();

// Schema for request validation
const CorporateActionsRequestSchema = z.object({
  symbols: z.array(z.string()).min(1).max(10),
});

router.get("/corporate-actions", async (req, res) => {
  try {
    // Handle both array and comma-separated string formats
    let symbols: string[];
    if (Array.isArray(req.query.symbols)) {
      symbols = req.query.symbols as string[];
    } else if (typeof req.query.symbols === 'string') {
      symbols = req.query.symbols.split(',');
    } else {
      throw new Error('Invalid symbols parameter');
    }

    const validatedData = CorporateActionsRequestSchema.parse({ symbols });
    
    const result = await alpacaService.getCorporateActions(validatedData.symbols);

    res.json({
      success: true,
      data: result.data,
      count: result.data.length,
      source: result.source,
      sourceDetail: result.sourceDetail,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Corporate actions error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch corporate actions',
    });
  }
});

router.get("/corporate-actions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const action = await alpacaService.getCorporateActionById(id);

    if (!action) {
      res.status(404).json({
        success: false,
        error: 'Corporate action not found',
      });
      return;
    }

    res.json({
      success: true,
      data: action,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Corporate action by ID error:', error);

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch corporate action',
    });
  }
});

export default router;
