import { Router, type IRouter } from "express";
import { bitgetService } from "../lib/bitget-service";

const router: IRouter = Router();

router.get("/account-snapshot", async (_req, res) => {
  try {
    const result = await bitgetService.getAccountSnapshot();

    res.json({
      success: true,
      data: result.data,
      source: result.source,
      sourceDetail: result.sourceDetail,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Account snapshot error:", error);

    res.status(500).json({
      success: false,
      source: "error",
      error: error instanceof Error ? error.message : "Failed to fetch Bitget account snapshot",
    });
  }
});

export default router;
