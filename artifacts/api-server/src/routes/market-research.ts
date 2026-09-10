import { Router } from 'express';
import { z } from 'zod';
import {
  fetchMarketResearch,
  formatMarketResearchForPrompt,
  type MarketResearchResponse
} from '../lib/bitget-signal-service.js';

const router = Router();

/**
 * Query schema for market research endpoint
 */
const MarketResearchQuerySchema = z.object({
  symbol: z.string().optional()
});

/**
 * GET /api/market-research
 * 
 * Fetch market research data from Bitget's public MCP server
 * Provides context for margin impact analysis
 */
router.get('/market-research', async (req, res) => {
  try {
    const query = MarketResearchQuerySchema.parse(req.query);
    
    const response: MarketResearchResponse = await fetchMarketResearch(query.symbol);

    res.json(response);
  } catch (error) {
    console.error('Market research endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market research data',
      source: 'error'
    });
  }
});

export default router;
