import { Router, type IRouter } from "express";
import { z } from "zod";
import { bitgetService } from "../lib/bitget-service";

const router: IRouter = Router();

// Schema for request validation
const MarketDataRequestSchema = z.object({
  symbols: z.array(z.string()).min(1).max(10),
});

router.get("/market-data", async (req, res) => {
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

    const validatedData = MarketDataRequestSchema.parse({ symbols });
    
    const result = await bitgetService.getMarketData(validatedData.symbols);

    res.json({
      success: true,
      data: result.data,
      count: result.data.length,
      source: result.source,
      sourceDetail: result.sourceDetail,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Market data error:', error);

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
      error: error instanceof Error ? error.message : 'Failed to fetch market data',
    });
  }
});

router.get("/collateral-info", async (req, res) => {
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

    const validatedData = MarketDataRequestSchema.parse({ symbols });
    
    const result = await bitgetService.getCollateralInfo(validatedData.symbols);

    res.json({
      success: true,
      data: result.data,
      count: result.data.length,
      source: result.source,
      sourceDetail: result.sourceDetail,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Collateral info error:', error);

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
      error: error instanceof Error ? error.message : 'Failed to fetch collateral info',
    });
  }
});

router.get("/rtoken-list", async (_req, res) => {
  try {
    const rtokenList = await bitgetService.getrTokenList();

    res.json({
      success: true,
      data: rtokenList,
      count: rtokenList.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('rToken list error:', error);

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch rToken list',
    });
  }
});

router.get("/spot-symbols", async (req, res) => {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query : '';
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 12;

    if (!query.trim()) {
      res.json({
        success: true,
        data: [],
        count: 0,
        source: 'live',
        sourceDetail: 'Bitget spot ticker search.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const data = await bitgetService.searchSpotSymbols(query, Number.isFinite(limit) ? limit : 12);

    res.json({
      success: true,
      data,
      count: data.length,
      source: 'live',
      sourceDetail: 'Bitget spot ticker search.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Spot symbol search error:', error);

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search Bitget spot symbols',
    });
  }
});

export default router;
