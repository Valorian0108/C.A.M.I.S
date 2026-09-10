export type EventKey = "rNVDA" | "rTSLA" | "rQQQ";
export type ScenarioKey = "hold" | "add" | "reduce";

export type MarginSnapshot = {
  collateralValue: number;
  leverage: number;
  liquidationDistance: number;
  collateralRatio: number;
};

export type EventModel = {
  key: EventKey;
  kind: string;
  state: "selected" | "queued";
  title: string;
  subtitle: string;
  countdown: string;
  summary: string;
  eventCopy: string;
  before: MarginSnapshot | null;
  after: MarginSnapshot | null;
};

export type ImpactResult = {
  collateralDelta: number;
  leverageDelta: number;
  liquidationDistanceDelta: number;
};

export const EVENT_MODELS: EventModel[] = [
  {
    key: "rNVDA",
    kind: "reverse split / adjustment",
    state: "selected",
    title: "NVIDIA reverse split",
    subtitle: "Collateral treatment under review",
    countdown: "18h 42m",
    summary:
      "The event changes the collateral representation, not the account’s maintenance threshold. Your account remains above maintenance, but the usable buffer gets thinner.",
    eventCopy:
      "rNVDA’s adjustment flows through the collateral ledger. The position is still recognized, but its collateral value is marked lower in this event path.",
    before: {
      collateralValue: 18420,
      leverage: 2.8,
      liquidationDistance: 24.6,
      collateralRatio: 0.95, // 95% as decimal
    },
    after: {
      collateralValue: 17912,
      leverage: 3.1,
      liquidationDistance: 18.2,
      collateralRatio: 0.95, // 95% as decimal
    },
  },
  {
    key: "rTSLA",
    kind: "corporate action",
    state: "queued",
    title: "Tesla adjustment",
    subtitle: "Event window not opened",
    countdown: "—",
    summary:
      "The Tesla event is queued for review. Its account-specific consequence is not modeled yet, so no risk number is inferred from another event.",
    eventCopy:
      "The event file exists in the queue, but the source inputs needed for a deterministic margin simulation have not been opened.",
    before: null,
    after: null,
  },
  {
    key: "rQQQ",
    kind: "corporate action",
    state: "queued",
    title: "Invesco QQQ adjustment",
    subtitle: "Event window not opened",
    countdown: "—",
    summary:
      "The QQQ event is queued for review. Its account-specific consequence is not modeled yet, so the desk keeps the impact state explicitly unknown.",
    eventCopy:
      "The event file exists in the queue, but the source inputs needed for a deterministic margin simulation have not been opened.",
    before: null,
    after: null,
  },
];

export function findEvent(key: EventKey): EventModel {
  return EVENT_MODELS.find((event) => event.key === key) ?? EVENT_MODELS[0];
}

export function calculateImpact(event: EventModel): ImpactResult | null {
  if (!event.before || !event.after) return null;

  return {
    collateralDelta: event.after.collateralValue - event.before.collateralValue,
    leverageDelta: event.after.leverage - event.before.leverage,
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
  return `${value > 0 ? "+" : "−"}${formatCurrency(value)}`;
}

export function formatSignedNumber(value: number, suffix: string): string {
  if (value === 0) return `0${suffix}`;
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}${suffix}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}