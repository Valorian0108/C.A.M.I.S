export type EventKey = "rNVDA" | "rTSLA" | "rQQQ";
export type ScenarioKey = "hold" | "add" | "reduce";
export type WatchEventKind = "collateral_reprice" | "cash_credit" | "price_shock";

export type MarginSnapshot = {
  collateralValue: number;
  adjustedEquity: number;
  totalPositionValue: number;
  leverage: number;
  marginRatio: number;
  liquidationDistance: number;
  collateralRatio: number;
};

type PortfolioInput = {
  tokenUnits: number;
  tokenPrice: number;
  collateralRatio: number;
  cashBalance: number;
  otherCollateralValue: number;
  totalPositionValue: number;
  maintenanceMarginRatio: number;
};

export type AccountInput = {
  tokenUnits: number;
  cashBalance: number;
  totalPositionValue: number;
  maintenanceMarginRatio: number;
};

type CorporateActionInput =
  | {
      type: "split";
      ratio: number;
      postEventCollateralHaircut: number;
    }
  | {
      type: "cash_dividend";
      cashPerToken: number;
      postEventPriceAdjustment: number;
    }
  | {
      type: "distribution";
      cashPerToken: number;
      postEventPriceAdjustment: number;
      postEventCollateralHaircut: number;
    };

export type EventModel = {
  key: string;
  kind: string;
  state: "modeled" | "queued";
  title: string;
  subtitle: string;
  countdown: string;
  dataSource: "demo fixture" | "live" | "fallback";
  summary: string;
  eventCopy: string;
  before: MarginSnapshot | null;
  after: MarginSnapshot | null;
  referencePrice: number;
};

export type ImpactResult = {
  collateralDelta: number;
  adjustedEquityDelta: number;
  leverageDelta: number;
  marginRatioDelta: number;
  liquidationDistanceDelta: number;
};

type DemoEventInput = {
  key: EventKey;
  kind: string;
  title: string;
  subtitle: string;
  countdown: string;
  summary: string;
  eventCopy: string;
  portfolio: PortfolioInput;
  action: CorporateActionInput;
};

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function calculateSnapshot(portfolio: PortfolioInput): MarginSnapshot {
  const tokenMarketValue = portfolio.tokenUnits * portfolio.tokenPrice;
  const collateralValue = tokenMarketValue * portfolio.collateralRatio;
  const adjustedEquity =
    collateralValue + portfolio.cashBalance + portfolio.otherCollateralValue;
  const leverage = portfolio.totalPositionValue / adjustedEquity;
  const marginRatio = adjustedEquity / portfolio.totalPositionValue;
  const liquidationDistance =
    ((marginRatio - portfolio.maintenanceMarginRatio) / marginRatio) * 100;

  return {
    collateralValue: round(collateralValue, 0),
    adjustedEquity: round(adjustedEquity, 0),
    totalPositionValue: round(portfolio.totalPositionValue, 0),
    leverage: round(leverage, 2),
    marginRatio: round(marginRatio, 3),
    liquidationDistance: round(liquidationDistance, 1),
    collateralRatio: portfolio.collateralRatio,
  };
}

function applyCorporateAction(
  portfolio: PortfolioInput,
  action: CorporateActionInput,
): PortfolioInput {
  if (action.type === "split") {
    return {
      ...portfolio,
      tokenUnits: portfolio.tokenUnits * action.ratio,
      tokenPrice: portfolio.tokenPrice / action.ratio,
      collateralRatio: portfolio.collateralRatio * action.postEventCollateralHaircut,
    };
  }

  if (action.type === "cash_dividend") {
    return {
      ...portfolio,
      tokenPrice: portfolio.tokenPrice - action.postEventPriceAdjustment,
      cashBalance: portfolio.cashBalance + portfolio.tokenUnits * action.cashPerToken,
    };
  }

  return {
    ...portfolio,
    tokenPrice: portfolio.tokenPrice - action.postEventPriceAdjustment,
    cashBalance: portfolio.cashBalance + portfolio.tokenUnits * action.cashPerToken,
    collateralRatio: portfolio.collateralRatio * action.postEventCollateralHaircut,
  };
}

function buildEvent(input: DemoEventInput): EventModel {
  return {
    key: input.key,
    kind: input.kind,
    state: "modeled",
    title: input.title,
    subtitle: input.subtitle,
    countdown: input.countdown,
    dataSource: "demo fixture",
    summary: input.summary,
    eventCopy: input.eventCopy,
    before: calculateSnapshot(input.portfolio),
    after: calculateSnapshot(applyCorporateAction(input.portfolio, input.action)),
    referencePrice: input.portfolio.tokenPrice,
  };
}

export const EVENT_MODELS: EventModel[] = [
  buildEvent({
    key: "rNVDA",
    kind: "reverse split / adjustment",
    title: "NVIDIA reverse split",
    subtitle: "Collateral treatment modeled",
    countdown: "18h 42m",
    summary:
      "The event changes the collateral representation, not the account's maintenance threshold. Your account remains above maintenance, but the usable buffer gets thinner.",
    eventCopy:
      "rNVDA's adjustment flows through the collateral ledger. The position is still recognized, but its collateral value is marked lower in this event path.",
    portfolio: {
      tokenUnits: 164,
      tokenPrice: 118.5,
      collateralRatio: 0.95,
      cashBalance: 2140,
      otherCollateralValue: 0,
      totalPositionValue: 57500,
      maintenanceMarginRatio: 0.26,
    },
    action: {
      type: "split",
      ratio: 10,
      postEventCollateralHaircut: 0.973,
    },
  }),
  buildEvent({
    key: "rTSLA",
    kind: "cash dividend / USDT credit",
    title: "Tesla cash dividend",
    subtitle: "Collateral cash credit modeled",
    countdown: "2d 06h",
    summary:
      "The dividend credit improves adjusted equity slightly, but the position remains sensitive because leverage is already high before the event.",
    eventCopy:
      "rTSLA's dividend path converts the corporate action into a USDT credit. The model applies that credit to adjusted equity before comparing leverage and liquidation distance.",
    portfolio: {
      tokenUnits: 100,
      tokenPrice: 245.75,
      collateralRatio: 0.9,
      cashBalance: 3300,
      otherCollateralValue: 0,
      totalPositionValue: 106800,
      maintenanceMarginRatio: 0.2,
    },
    action: {
      type: "cash_dividend",
      cashPerToken: 0.25,
      postEventPriceAdjustment: 0.25,
    },
  }),
  buildEvent({
    key: "rQQQ",
    kind: "cash distribution / collateral repricing",
    title: "Invesco QQQ distribution",
    subtitle: "Portfolio buffer modeled",
    countdown: "3d 11h",
    summary:
      "The distribution is small, but the collateral ratio is lower than rNVDA. The account remains healthy, while the model flags a mild post-event buffer change.",
    eventCopy:
      "rQQQ's event combines a small cash distribution with a conservative collateral treatment. The simulator compares the account's usable collateral before and after settlement.",
    portfolio: {
      tokenUnits: 35,
      tokenPrice: 485.2,
      collateralRatio: 0.85,
      cashBalance: 4200,
      otherCollateralValue: 7800,
      totalPositionValue: 60300,
      maintenanceMarginRatio: 0.3,
    },
    action: {
      type: "distribution",
      cashPerToken: 0.52,
      postEventPriceAdjustment: 0.52,
      postEventCollateralHaircut: 0.995,
    },
  }),
];

export function findEvent(key: EventKey): EventModel {
  return EVENT_MODELS.find((event) => event.key === key) ?? EVENT_MODELS[0];
}

function repriceSnapshot(snapshot: MarginSnapshot, referencePrice: number, livePrice: number): MarginSnapshot {
  if (!Number.isFinite(livePrice) || livePrice <= 0 || referencePrice <= 0) return snapshot;

  const priceRatio = livePrice / referencePrice;
  const collateralValue = snapshot.collateralValue * priceRatio;
  const fixedEquity = snapshot.adjustedEquity - snapshot.collateralValue;
  const adjustedEquity = collateralValue + fixedEquity;
  const totalPositionValue = snapshot.totalPositionValue * priceRatio;
  const maintenanceMarginRatio =
    snapshot.marginRatio - (snapshot.liquidationDistance / 100) * snapshot.marginRatio;
  const marginRatio = adjustedEquity / totalPositionValue;
  const liquidationDistance =
    ((marginRatio - maintenanceMarginRatio) / marginRatio) * 100;

  return {
    ...snapshot,
    collateralValue: round(collateralValue, 0),
    adjustedEquity: round(adjustedEquity, 0),
    totalPositionValue: round(totalPositionValue, 0),
    leverage: round(totalPositionValue / adjustedEquity, 2),
    marginRatio: round(marginRatio, 3),
    liquidationDistance: round(liquidationDistance, 1),
  };
}

export function applyLivePrice(event: EventModel, livePrice: number): EventModel {
  return {
    ...event,
    before: event.before ? repriceSnapshot(event.before, event.referencePrice, livePrice) : null,
    after: event.after ? repriceSnapshot(event.after, event.referencePrice, livePrice) : null,
  };
}

export function createLiveWatchEvent(
  token: string,
  price: number,
  collateralRatio = 0.95,
  watchKind: WatchEventKind = "collateral_reprice",
  account?: Partial<AccountInput>,
): EventModel {
  const tokenUnits = account?.tokenUnits ?? 100;
  const positionValue = Math.max(1000, account?.totalPositionValue ?? price * tokenUnits);
  const beforePortfolio: PortfolioInput = {
    tokenUnits,
    tokenPrice: price,
    collateralRatio,
    cashBalance: account?.cashBalance ?? positionValue * 0.15,
    otherCollateralValue: 0,
    totalPositionValue: positionValue,
    maintenanceMarginRatio: account?.maintenanceMarginRatio ?? 0.25,
  };
  const eventPortfolio =
    watchKind === "cash_credit"
      ? {
          ...beforePortfolio,
          tokenPrice: price * 0.9975,
          cashBalance: beforePortfolio.cashBalance + beforePortfolio.tokenUnits * price * 0.0025,
        }
      : watchKind === "price_shock"
        ? {
            ...beforePortfolio,
            tokenPrice: price * 0.95,
          }
        : {
            ...beforePortfolio,
            collateralRatio: collateralRatio * 0.98,
          };
  const kind =
    watchKind === "cash_credit"
      ? "cash credit watch"
      : watchKind === "price_shock"
        ? "price shock watch"
        : "collateral repricing watch";
  const eventCopy =
    watchKind === "cash_credit"
      ? "The live price is from Bitget. This watch models a small cash credit and matching mark adjustment."
      : watchKind === "price_shock"
        ? "The live price is from Bitget. This watch models a 5% adverse price move against the current position."
        : "The live price is from Bitget. This watch models a 2% collateral-ratio haircut.";

  return {
    key: token,
    kind,
    state: "modeled",
    title: `${token} collateral watch`,
    subtitle: "Live Bitget pair / modeled event",
    countdown: "scenario",
    dataSource: "live",
    summary:
      "This live pair is using a configurable watch scenario so the consequence tools can be tested. Replace the watch inputs with a verified event before relying on the result.",
    eventCopy,
    before: calculateSnapshot(beforePortfolio),
    after: calculateSnapshot(eventPortfolio),
    referencePrice: price,
  };
}

export function calculateImpact(event: EventModel): ImpactResult | null {
  if (!event.before || !event.after) return null;

  return {
    collateralDelta: event.after.collateralValue - event.before.collateralValue,
    adjustedEquityDelta: event.after.adjustedEquity - event.before.adjustedEquity,
    leverageDelta: event.after.leverage - event.before.leverage,
    marginRatioDelta: event.after.marginRatio - event.before.marginRatio,
    liquidationDistanceDelta:
      event.after.liquidationDistance - event.before.liquidationDistance,
  };
}

export function formatCurrency(value: number): string {
  return `$${Math.abs(value).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

export function formatSignedCurrency(value: number): string {
  if (value === 0) return "$0";
  return `${value > 0 ? "+" : "-"}${formatCurrency(value)}`;
}

export function formatSignedNumber(value: number, suffix: string): string {
  if (value === 0) return `0${suffix}`;
  return `${value > 0 ? "+" : "-"}${Math.abs(value).toFixed(1)}${suffix}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
