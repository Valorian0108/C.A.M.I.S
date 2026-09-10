import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marginExplanationRouter from "./margin-explanation";
import corporateActionsRouter from "./corporate-actions";
import marketDataRouter from "./market-data";
import marketResearchRouter from "./market-research";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marginExplanationRouter);
router.use(corporateActionsRouter);
router.use(marketDataRouter);
router.use(marketResearchRouter);

export default router;
