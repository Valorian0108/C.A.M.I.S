import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  CircleCheck,
  Clock3,
  Command,
  FileText,
  PanelRight,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";

import "./_group.css";
import {
  applyLivePrice,
  calculateImpact,
  createLiveWatchEvent,
  EVENT_MODELS,
  findEvent,
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
  formatSignedNumber,
  type EventModel,
  type AccountInput,
  type MarginSnapshot,
  type EventKey,
  type ScenarioKey,
  type WatchEventKind,
} from "./simulator";
import { apiClient } from "@/lib/api-client";
import type { AccountSnapshot, DataSource, MarketData, SpotSymbol } from "@/lib/api-client";

const SCENARIOS: Array<{
  key: ScenarioKey;
  name: string;
  copy: string;
  result: string;
}> = [
  {
    key: "hold",
    name: "Hold",
    copy: "Keep current position through the adjustment.",
    result: "wait for the event to settle",
  },
  {
    key: "add",
    name: "Add collateral",
    copy: "Increase collateral before the event window.",
    result: "restore room before settlement",
  },
  {
    key: "reduce",
    name: "Reduce exposure",
    copy: "Trim the selected rToken before the event is applied.",
    result: "lower pressure before settlement",
  },
];

const SCENARIO_COPY: Record<ScenarioKey, string> = {
  hold: "Keep current position through the adjustment.",
  add: "Add $1,500 collateral before settlement.",
  reduce: "Reduce exposure by 8% before settlement.",
};

const LIVE_PAIR_SYMBOLS: Record<EventKey, string> = {
  rNVDA: "RNVDAUSDT",
  rTSLA: "RTSLAUSDT",
  rQQQ: "RQQQUSDT",
};

const DEFAULT_ACCOUNT_INPUTS: AccountInput = {
  tokenUnits: 100,
  cashBalance: 3000,
  totalPositionValue: 25000,
  maintenanceMarginRatio: 0.25,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundValue(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function pairToToken(symbol: string): string {
  const base = symbol.toUpperCase().endsWith("USDT") ? symbol.slice(0, -4) : symbol;
  return base.startsWith("R") ? `r${base.slice(1)}` : base;
}

function tokenToAccountCoin(token: string): string {
  return token.replace(/^r/, "R").toUpperCase();
}

function deriveAccountInputs(
  snapshot: AccountSnapshot | null,
  token: string,
  price?: number,
): Partial<AccountInput> | null {
  if (!snapshot || !price || price <= 0) return null;

  const selectedAsset = snapshot.assets.find((asset) => asset.coin.toUpperCase() === tokenToAccountCoin(token));
  const cashAsset = snapshot.assets.find((asset) => asset.coin.toUpperCase() === "USDT");
  const tokenUnits = selectedAsset?.balance ?? selectedAsset?.equity ?? 0;

  if (tokenUnits <= 0) return null;

  const tokenPositionValue = tokenUnits * price;
  const accountPositionValue = snapshot.positionValue > 0 ? snapshot.positionValue : tokenPositionValue;
  const effectiveEquity = snapshot.effectiveEquity > 0 ? snapshot.effectiveEquity : tokenPositionValue + (cashAsset?.available ?? 0);
  const maintenanceRatio =
    snapshot.positionValue > 0 && snapshot.maintenanceMargin > 0
      ? clamp(snapshot.maintenanceMargin / snapshot.positionValue, 0.01, 0.95)
      : undefined;

  return {
    tokenUnits,
    cashBalance: cashAsset?.available ?? 0,
    totalPositionValue: Math.max(1000, accountPositionValue || effectiveEquity || tokenPositionValue),
    maintenanceMarginRatio: maintenanceRatio,
  };
}

function buildSearchEvent(symbol: string): EventModel {
  const token = pairToToken(symbol);
  return {
    key: token as EventKey,
    kind: "live rToken watch",
    state: "queued",
    title: `${token} live watch`,
    subtitle: "Live Bitget spot pair",
    countdown: "not scheduled",
    dataSource: "live",
    summary:
      "This asset is opened from live Bitget search. No event scenario has been configured for it yet, so the page shows live market context before consequence modeling.",
    eventCopy:
      "No event case has been attached to this searched asset yet. Pin or configure an event to calculate before and after margin impact.",
    before: null,
    after: null,
    referencePrice: 1,
  };
}

function applyScenario(snapshot: MarginSnapshot | null, scenario: ScenarioKey): MarginSnapshot | null {
  if (!snapshot) return null;
  if (scenario === "hold") return snapshot;

  if (scenario === "add") {
    const adjustedEquity = snapshot.adjustedEquity + 1500;
    const marginRatio = adjustedEquity / snapshot.totalPositionValue;
    const maintenanceMarginRatio = marginRatio - (snapshot.liquidationDistance / 100) * snapshot.marginRatio;

    return {
      ...snapshot,
      collateralValue: roundValue(snapshot.collateralValue + 1500, 0),
      adjustedEquity: roundValue(adjustedEquity, 0),
      leverage: roundValue(snapshot.totalPositionValue / adjustedEquity, 2),
      marginRatio: roundValue(marginRatio, 3),
      liquidationDistance: roundValue(((marginRatio - maintenanceMarginRatio) / marginRatio) * 100, 1),
    };
  }

  const totalPositionValue = snapshot.totalPositionValue * 0.92;
  const marginRatio = snapshot.adjustedEquity / totalPositionValue;
  const maintenanceMarginRatio = snapshot.marginRatio - (snapshot.liquidationDistance / 100) * snapshot.marginRatio;

  return {
    ...snapshot,
    totalPositionValue: roundValue(totalPositionValue, 0),
    leverage: roundValue(totalPositionValue / snapshot.adjustedEquity, 2),
    marginRatio: roundValue(marginRatio, 3),
    liquidationDistance: roundValue(((marginRatio - maintenanceMarginRatio) / marginRatio) * 100, 1),
  };
}

function MetricRow({
  label,
  before,
  after,
  delta,
  risk,
  unavailable,
}: {
  label: string;
  before: string;
  after: string;
  delta: string;
  risk?: boolean;
  unavailable?: boolean;
}) {
  return (
    <div className="me-metric">
      <span className="me-metric-label">{label}</span>
      <span className={`me-metric-value${unavailable ? " muted" : ""}`}>{before}</span>
      <span className="me-metric-arrow" aria-hidden="true">
        →
      </span>
      <span className={`me-metric-value after${unavailable ? " muted" : ""}`}>{after}</span>
      <span className={`me-metric-delta${risk ? " risk" : ""}${unavailable ? " muted" : ""}`}>{delta}</span>
    </div>
  );
}

type LiveLayer = {
  label: string;
  source: DataSource;
  detail: string;
};

type CachedExplanation = {
  explanation: string;
  source: string;
};

function SourceBadge({ source }: { source: DataSource }) {
  return <span className={`me-source-badge is-${source}`}>{source}</span>;
}

function beforeSnapshotKey(
  token: string,
  eventType: string,
  scenario: ScenarioKey,
  before: MarginSnapshot | null,
  after: MarginSnapshot | null,
): string | null {
  if (!before || !after) return null;

  return [
    token,
    eventType,
    scenario,
    before.collateralValue,
    before.adjustedEquity,
    before.leverage,
    before.marginRatio,
    before.liquidationDistance,
    after.collateralValue,
    after.adjustedEquity,
    after.leverage,
    after.marginRatio,
    after.liquidationDistance,
  ].join('|');
}

export function Desk() {
  const [selectedKey, setSelectedKey] = useState<string>("rNVDA");
  const [searchedEvent, setSearchedEvent] = useState<EventModel | null>(null);
  const [scenario, setScenario] = useState<ScenarioKey>("hold");
  const [watchKind, setWatchKind] = useState<WatchEventKind>("collateral_reprice");
  const [accountInputs, setAccountInputs] = useState<AccountInput>(DEFAULT_ACCOUNT_INPUTS);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [spotResults, setSpotResults] = useState<SpotSymbol[]>([]);
  const [searchingSpot, setSearchingSpot] = useState(false);
  const [investigating, setInvestigating] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<string | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, MarketData>>({});
  const [priceDirections, setPriceDirections] = useState<Record<string, "up" | "down" | "flat">>({});
  const [lastPriceUpdate, setLastPriceUpdate] = useState<number | null>(null);
  const [accountSnapshot, setAccountSnapshot] = useState<AccountSnapshot | null>(null);
  const [accountSnapshotSource, setAccountSnapshotSource] = useState<string | null>(null);
  const explanationCache = useRef<Map<string, CachedExplanation>>(new Map());
  const prefetchingExplanation = useRef<Set<string>>(new Set());
  const [liveLayers, setLiveLayers] = useState<LiveLayer[]>([
    { label: "Account assets", source: "checking", detail: "Checking Bitget private account endpoint." },
    { label: "Corporate actions", source: "checking", detail: "Checking Alpaca corporate-action endpoint." },
    { label: "Market prices", source: "checking", detail: "Checking Bitget ticker endpoint." },
    { label: "Collateral ratios", source: "checking", detail: "Checking collateral source." },
    { label: "Market research", source: "checking", detail: "Checking Bitget Signal research source." },
  ]);

  const selectedEvent = searchedEvent ?? findEvent(selectedKey as EventKey);
  const selectedLivePair = searchedEvent
    ? `${String(selectedEvent.key).replace(/^r/, "R").toUpperCase()}USDT`
    : LIVE_PAIR_SYMBOLS[selectedEvent.key as EventKey];
  const selectedLivePrice = livePrices[selectedLivePair];
  const liveAccountInputs = deriveAccountInputs(accountSnapshot, selectedEvent.key, selectedLivePrice?.price);
  const effectiveAccountInputs = { ...accountInputs, ...liveAccountInputs };
  const accountBackedEvent =
    selectedLivePrice && liveAccountInputs
      ? createLiveWatchEvent(selectedEvent.key, selectedLivePrice.price, selectedEvent.after?.collateralRatio ?? 0.95, watchKind, effectiveAccountInputs)
      : selectedEvent;
  const liveEvent = selectedLivePrice
    ? applyLivePrice(accountBackedEvent, selectedLivePrice.price)
    : selectedEvent;
  const scenarioAfter = applyScenario(liveEvent.after, scenario);
  const scenarioEvent = { ...liveEvent, after: scenarioAfter };
  const impact = calculateImpact(scenarioEvent);
  const beforeSnapshot = liveEvent.before;
  const explanationCacheKey = beforeSnapshotKey(selectedEvent.key, selectedEvent.kind, scenario, beforeSnapshot, scenarioAfter);

  async function checkLiveData() {
    setLiveLayers([
      { label: "Account assets", source: "checking", detail: "Checking Bitget private account endpoint." },
      { label: "Corporate actions", source: "checking", detail: "Checking Alpaca corporate-action endpoint." },
      { label: "Market prices", source: "checking", detail: "Checking Bitget ticker endpoint." },
      { label: "Collateral ratios", source: "checking", detail: "Checking collateral source." },
      { label: "Market research", source: "checking", detail: "Checking Bitget Signal research source." },
    ]);

    apiClient.getAccountSnapshot()
      .then((response) => {
        setAccountSnapshot(response.data);
        setAccountSnapshotSource(response.sourceDetail ?? "Bitget account endpoint.");
        setLiveLayers((layers) =>
          layers.map((layer) =>
            layer.label === "Account assets"
              ? {
                  label: "Account assets",
                  source: response.source,
                  detail: `${response.data.assets.length} assets. ${response.sourceDetail ?? ""}`.trim(),
                }
              : layer,
          ),
        );
      })
      .catch((error) => {
        setLiveLayers((layers) =>
          layers.map((layer) =>
            layer.label === "Account assets"
              ? {
                  label: "Account assets",
                  source: "error",
                  detail: error instanceof Error ? error.message : "Request failed.",
                }
              : layer,
          ),
        );
      });

    const [actions, prices, collateral, research] = await Promise.allSettled([
      apiClient.getCorporateActions(["NVDA", "TSLA", "QQQ"]),
      apiClient.getMarketData(Object.values(LIVE_PAIR_SYMBOLS)),
      apiClient.getCollateralInfo(["rNVDA", "rTSLA", "rQQQ"]),
      apiClient.getMarketResearch(selectedLivePair),
    ]);

    setLiveLayers((layers) => [
      layers.find((layer) => layer.label === "Account assets") ?? {
        label: "Account assets",
        source: "checking",
        detail: "Checking Bitget private account endpoint.",
      },
      actions.status === "fulfilled"
        ? {
            label: "Corporate actions",
            source: actions.value.source,
            detail: `${actions.value.count ?? actions.value.data.length} records. ${actions.value.sourceDetail ?? ""}`.trim(),
          }
        : { label: "Corporate actions", source: "error", detail: actions.reason?.message ?? "Request failed." },
      prices.status === "fulfilled"
        ? {
            label: "Market prices",
            source: prices.value.source,
            detail: `${prices.value.count ?? prices.value.data.length} tickers. ${prices.value.sourceDetail ?? ""}`.trim(),
          }
        : { label: "Market prices", source: "error", detail: prices.reason?.message ?? "Request failed." },
      collateral.status === "fulfilled"
        ? {
            label: "Collateral ratios",
            source: collateral.value.source,
            detail: `${collateral.value.count ?? collateral.value.data.length} ratios. ${collateral.value.sourceDetail ?? ""}`.trim(),
          }
        : { label: "Collateral ratios", source: "error", detail: collateral.reason?.message ?? "Request failed." },
      research.status === "fulfilled"
        ? {
            label: "Market research",
            source: research.value.source,
            detail: research.value.error ?? "Bitget Signal research request completed.",
          }
        : { label: "Market research", source: "error", detail: research.reason?.message ?? "Request failed." },
    ]);

    if (prices.status === "fulfilled") {
      const nextPrices = Object.fromEntries(
        prices.value.data.map((price) => [price.symbol.toUpperCase(), price]),
      );
      setLivePrices((previous) => {
        const nextDirections: Record<string, "up" | "down" | "flat"> = {};
        for (const price of prices.value.data) {
          const previousPrice = previous[price.symbol.toUpperCase()]?.price;
          nextDirections[price.symbol.toUpperCase()] =
            previousPrice == null || price.price === previousPrice
              ? "flat"
              : price.price > previousPrice ? "up" : "down";
        }
        setPriceDirections(nextDirections);
        return nextPrices;
      });
      setLastPriceUpdate(Date.now());
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
      if (commandOpen) {
        const key = event.key.toLowerCase();
        if (key === "1" || key === "2" || key === "3") {
          event.preventDefault();
          chooseEvent(key === "1" ? "rNVDA" : key === "2" ? "rTSLA" : "rQQQ");
          setCommandOpen(false);
          setCommandQuery("");
        }
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandOpen]);

  useEffect(() => {
    let cancelled = false;

    async function runCheck() {
      try {
        await checkLiveData();
      } catch (error) {
        if (!cancelled) {
          setLiveLayers((layers) =>
            layers.map((layer) => ({
              ...layer,
              source: "error",
              detail: error instanceof Error ? error.message : "Live status check failed.",
            })),
          );
        }
      }
    }

    window.fetch?.('/api/healthz').catch(() => undefined);
    runCheck();
    const interval = window.setInterval(() => {
      apiClient.getMarketData(Object.values(LIVE_PAIR_SYMBOLS)).then((response) => {
        if (cancelled) return;
        const nextPrices = Object.fromEntries(
          response.data.map((price) => [price.symbol.toUpperCase(), price]),
        );
        setLivePrices((previous) => {
          const nextDirections: Record<string, "up" | "down" | "flat"> = {};
          for (const price of response.data) {
            const previousPrice = previous[price.symbol.toUpperCase()]?.price;
            nextDirections[price.symbol.toUpperCase()] =
              previousPrice == null || price.price === previousPrice
                ? "flat"
                : price.price > previousPrice ? "up" : "down";
          }
          setPriceDirections(nextDirections);
          return nextPrices;
        });
        setLastPriceUpdate(Date.now());
      }).catch(() => undefined);
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  function chooseEvent(key: EventKey) {
    setSelectedKey(key);
    setSearchedEvent(null);
    setScenario("hold");
    setWatchKind("collateral_reprice");
    setInvestigating(false);
    setAiExplanation(null);
    setAiSource(null);
  }

  function openSearchedPair(symbol: string) {
    const event = buildSearchEvent(symbol);
    setSelectedKey(event.key);
    setSearchedEvent(event);
    setScenario("hold");
    setInvestigating(false);
    setAiExplanation(null);
    setAiSource(null);
    apiClient.getMarketData([symbol]).then((response) => {
      const row = response.data[0];
      if (!row) return;
      const token = pairToToken(row.symbol);
      const liveInputs = deriveAccountInputs(accountSnapshot, token, row.price);
      const liveWatch = createLiveWatchEvent(token, row.price, 0.95, watchKind, { ...accountInputs, ...liveInputs });
      setSearchedEvent(liveWatch);
      setSelectedKey(liveWatch.key);
      setLivePrices((prices) => ({ ...prices, [row.symbol.toUpperCase()]: row }));
      setLastPriceUpdate(Date.now());
    }).catch(() => undefined);
    setCommandOpen(false);
    setCommandQuery("");
  }

  async function fetchAIExplanation(options: { prefetch?: boolean } = {}) {
    if (!beforeSnapshot || !scenarioAfter) return;
    if (options.prefetch && !explanationCacheKey) return;

    if (explanationCacheKey) {
      const cached = explanationCache.current.get(explanationCacheKey);
      if (cached) {
        if (!options.prefetch) {
          setAiExplanation(cached.explanation);
          setAiSource(cached.source);
        }
        return;
      }

      if (options.prefetch && prefetchingExplanation.current.has(explanationCacheKey)) return;
      if (options.prefetch) prefetchingExplanation.current.add(explanationCacheKey);
    }

    if (!options.prefetch) {
      setLoadingExplanation(true);
      setAiExplanation(null);
      setAiSource("analysis: preparing");
    }

    try {
      const response = await apiClient.getMarginExplanation({
        token: selectedEvent.key,
        eventType: selectedEvent.kind,
        beforeState: beforeSnapshot,
        afterState: scenarioAfter,
        recommendedAction: scenario,
        includeMarketResearch: true,
      });

      if (response.success) {
        const explanationSource = response.explanationSource ? `analysis: ${response.explanationSource}` : null;
        const researchSource = response.marketResearchSource ? `research: ${response.marketResearchSource}` : null;
        const source = [explanationSource, researchSource].filter(Boolean).join(" / ");

        if (explanationCacheKey) {
          explanationCache.current.set(explanationCacheKey, {
            explanation: response.explanation,
            source,
          });
        }

        if (!options.prefetch || investigating) {
          setAiExplanation(response.explanation);
          setAiSource(source);
        }
      }
    } catch (error) {
      console.error('Failed to fetch AI explanation:', error);
      if (!options.prefetch) {
        setAiExplanation('Live AI analysis is unavailable. Check the Qwen API connection, then try again.');
        setAiSource("analysis: unavailable");
      }
    } finally {
      if (explanationCacheKey) prefetchingExplanation.current.delete(explanationCacheKey);
      if (!options.prefetch) setLoadingExplanation(false);
    }
  }

  function openInvestigation() {
    if (investigating) {
      setInvestigating(false);
      return;
    }

    setInvestigating(true);
    fetchAIExplanation();
  }

  function runCommand(action: "investigate" | "hold" | "add" | "reduce" | EventKey) {
    if (action === "investigate") {
      setInvestigating(true);
      fetchAIExplanation();
    }
    if (action === "hold" || action === "add" || action === "reduce") {
      setScenario(action);
    }
    if (action === "rNVDA" || action === "rTSLA" || action === "rQQQ") {
      chooseEvent(action);
    }
    setCommandOpen(false);
    setCommandQuery("");
  }

  useEffect(() => {
    if (investigating) {
      fetchAIExplanation();
    }
  }, [explanationCacheKey]);

  useEffect(() => {
    if (!explanationCacheKey || investigating || !beforeSnapshot || !scenarioAfter) return;
    if (explanationCache.current.has(explanationCacheKey)) return;

    const timeout = window.setTimeout(() => {
      fetchAIExplanation({ prefetch: true });
    }, 1400);

    return () => window.clearTimeout(timeout);
  }, [explanationCacheKey, investigating, beforeSnapshot, scenarioAfter]);

  useEffect(() => {
    if (!searchedEvent || !selectedLivePrice) return;
    const token = pairToToken(selectedLivePair);
    const liveInputs = deriveAccountInputs(accountSnapshot, token, selectedLivePrice.price);
    setSearchedEvent(createLiveWatchEvent(token, selectedLivePrice.price, 0.95, watchKind, { ...accountInputs, ...liveInputs }));
    setScenario("hold");
    setAiExplanation(null);
    setAiSource(null);
  }, [watchKind, accountInputs, accountSnapshot, selectedLivePair, selectedLivePrice?.price]);

  function updateAccountInput(key: keyof AccountInput, value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const nextValue =
      key === "tokenUnits"
        ? clamp(parsed, 1, 1_000_000)
        : key === "cashBalance"
          ? clamp(parsed, 0, 100_000_000)
          : key === "totalPositionValue"
            ? clamp(parsed, 1000, 500_000_000)
            : clamp(parsed, 1, 95) / 100;

    setAccountInputs((inputs) => ({
      ...inputs,
      [key]: nextValue,
    }));
  }

  useEffect(() => {
    const query = commandQuery.trim();
    if (!commandOpen || query.length < 2) {
      setSpotResults([]);
      return;
    }

    let cancelled = false;
    setSearchingSpot(true);
    const timeout = window.setTimeout(() => {
      apiClient.searchSpotSymbols(query, 8).then((response) => {
        if (!cancelled) setSpotResults(response.data);
      }).catch(() => {
        if (!cancelled) setSpotResults([]);
      }).finally(() => {
        if (!cancelled) setSearchingSpot(false);
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [commandOpen, commandQuery]);

  const filteredCommands = [
    { label: "Investigate selected event", key: "investigate" as const, shortcut: "↵" },
    { label: "Open rNVDA live pair", key: "rNVDA" as const, shortcut: "1" },
    { label: "Open rTSLA live pair", key: "rTSLA" as const, shortcut: "2" },
    { label: "Open rQQQ live pair", key: "rQQQ" as const, shortcut: "3" },
    { label: "Compare hold scenario", key: "hold" as const, shortcut: "click" },
    { label: "Compare add collateral", key: "add" as const, shortcut: "click" },
    { label: "Compare reduce exposure", key: "reduce" as const, shortcut: "click" },
  ].filter((item) => item.label.toLowerCase().includes(commandQuery.toLowerCase()));

  const selectedDataSource = selectedLivePrice ? "live Bitget spot pair" : selectedEvent.dataSource;
  const selectedAccountCoin = tokenToAccountCoin(selectedEvent.key);
  const selectedAccountAsset = accountSnapshot?.assets.find(
    (asset) => asset.coin.toUpperCase() === selectedAccountCoin,
  );
  const selectedAssetProof = selectedAccountAsset
    ? `${selectedAccountAsset.coin} balance ${selectedAccountAsset.balance.toLocaleString("en-US", {
        maximumFractionDigits: 6,
      })}; available ${selectedAccountAsset.available.toLocaleString("en-US", { maximumFractionDigits: 6 })}.`
    : accountSnapshot
      ? `${selectedAccountCoin} not present in connected Classic account assets.`
      : "Waiting for Bitget account assets.";
  const accountInputSource = liveAccountInputs
    ? `Using live Bitget account assets for ${selectedEvent.key}.`
    : accountSnapshot
      ? `Bitget account connected (${accountSnapshot.assets.length} assets); this selected asset is using editable scenario sizing.`
      : "Using editable scenario sizing until the Bitget account snapshot loads.";
  const accountSourceDetail = accountSnapshotSource ?? "Bitget Classic account assets endpoint";
  const liveSourceCount = liveLayers.filter((layer) => layer.source === "live").length;
  const demoSteps = [
    {
      label: "Sources live",
      detail: `${liveSourceCount}/${liveLayers.length} checks live`,
      complete: liveSourceCount === liveLayers.length,
    },
    {
      label: "Asset selected",
      detail: selectedLivePair,
      complete: Boolean(selectedLivePrice),
    },
    {
      label: "Action compared",
      detail: scenario.toUpperCase(),
      complete: Boolean(impact),
    },
    {
      label: "AI analysis",
      detail: aiSource ?? "Open investigation",
      complete: Boolean(aiExplanation && !loadingExplanation && aiSource?.toLowerCase().includes("live")),
    },
  ];

  return (
    <main className="me-root">
      <div className="me-shell">
        <aside className="me-rail" aria-label="Event queue">
          <div className="me-brand">
            <div className="me-brand-mark">
              <span>//</span>
              CAMIS
            </div>
            <p>Corporate Action Margin Impact Simulator</p>
          </div>

          <p className="me-rail-label">Event queue / 03</p>
          <nav className="me-event-list" aria-label="Corporate action events">
            {EVENT_MODELS.map((event) => (
              <button
                className="me-event-row"
                key={event.key}
                type="button"
                aria-current={event.key === selectedKey}
                onClick={() => chooseEvent(event.key as EventKey)}
              >
                <span className="me-event-dot" aria-hidden="true" />
                <span>
                  <span className="me-event-name">{event.key}</span>
                  <span className="me-event-kind">{event.kind}</span>
                </span>
                <span className="me-event-state">{event.before && event.after ? event.countdown : event.state}</span>
              </button>
            ))}
          </nav>

          <div className="me-rail-bottom">
            <div className="me-legend">
              <i aria-hidden="true" />
              <span>consequence under review</span>
            </div>
            <button className="me-quiet-action" type="button" onClick={() => setCommandOpen(true)}>
              <Command size={13} strokeWidth={1.7} />
              Command surface
            </button>
          </div>
        </aside>

        <section className="me-main">
          <header className="me-topbar">
            <div className="me-topbar-left">
              <span className="me-crumb">Account / UTA / margin</span>
              <span className="me-slash">//</span>
              <span className="me-crumb">{selectedEvent.key} event file</span>
            </div>
            <div className="me-topbar-right">
              <span className="me-clock">
                <Clock3 size={13} strokeWidth={1.6} />
                live review
              </span>
              <button className="me-command-trigger" type="button" onClick={() => setCommandOpen(true)}>
                <Search size={13} strokeWidth={1.8} />
                <span>Command</span>
                <span className="me-key">⌘ K</span>
              </button>
            </div>
          </header>

          <section className="me-hero" aria-labelledby="event-title">
            <div>
              <p className="me-kicker">Live rToken price / modeled event file 07</p>
              <div className="me-title-line">
                <h1 className="me-title" id="event-title">
                  {selectedEvent.key}
                </h1>
                <span className="me-code">{selectedEvent.kind}</span>
                <span className="me-code muted">{selectedDataSource}</span>
              </div>
              {selectedLivePrice && (
                <p className={`me-live-price is-${priceDirections[selectedLivePair] ?? "flat"}`}>
                  {selectedLivePair}: {formatCurrency(selectedLivePrice.price)} · {selectedLivePrice.change24h.toFixed(2)}% 24h · live
                  {lastPriceUpdate && (
                    <span className="me-price-updated">
                      · updated {Math.max(0, Math.round((Date.now() - lastPriceUpdate) / 1000))}s ago
                    </span>
                  )}
                </p>
              )}
              <p className="me-hero-summary">
                 {selectedEvent.summary}
              </p>
            </div>
            <div className="me-countdown" aria-label="Time until event">
              <span className="me-countdown-label">scenario event window</span>
               <strong className="me-countdown-value">{selectedEvent.countdown}</strong>
              <span className="me-countdown-note">
                 {impact ? "modeled pressure before settlement" : "event data not opened"}
              </span>
            </div>
          </section>

          <section className="me-live-status" aria-label="Live data status">
            <div className="me-section-heading">
              <h2>Live data check</h2>
              <button className="me-inline-refresh" type="button" onClick={checkLiveData}>
                Refresh sources
              </button>
            </div>
            <div className="me-live-grid">
              {liveLayers.map((layer) => (
                <div className="me-live-card" key={layer.label}>
                  <div>
                    <strong>{layer.label}</strong>
                    <SourceBadge source={layer.source} />
                  </div>
                  <p>{layer.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="me-demo-flow" aria-label="Demo readiness">
            <div className="me-section-heading">
              <h2>Judge demo path</h2>
              <span>live proof / margin path</span>
            </div>
            <ol className="me-demo-steps">
              {demoSteps.map((step) => (
                <li className={step.complete ? "is-complete" : ""} key={step.label}>
                  <CircleCheck size={14} strokeWidth={1.8} aria-hidden="true" />
                  <strong>{step.label}</strong>
                  <span>{step.detail}</span>
                </li>
              ))}
            </ol>
          </section>

          {searchedEvent && (
            <section className="me-event-config" aria-label="Modeled event setup">
              <div className="me-section-heading">
                <h2>Event case</h2>
                <button className="me-inline-refresh" type="button" onClick={() => setAccountInputs(DEFAULT_ACCOUNT_INPUTS)}>
                  Reset inputs
                </button>
              </div>
              <div className="me-watch-options">
                {[
                  { key: "collateral_reprice" as const, label: "Collateral repricing", copy: "2% collateral-ratio haircut" },
                  { key: "cash_credit" as const, label: "Cash credit", copy: "small USDT credit and price mark" },
                  { key: "price_shock" as const, label: "Price shock", copy: "5% adverse move test" },
                ].map((item) => (
                  <button
                    className="me-watch-option"
                    key={item.key}
                    type="button"
                    aria-current={watchKind === item.key}
                    onClick={() => setWatchKind(item.key)}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.copy}</span>
                  </button>
                ))}
              </div>
              <div className="me-account-inputs">
                <label>
                  <span>Token units</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={accountInputs.tokenUnits}
                    onChange={(event) => updateAccountInput("tokenUnits", event.target.value)}
                  />
                </label>
                <label>
                  <span>Cash / collateral</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={accountInputs.cashBalance}
                    onChange={(event) => updateAccountInput("cashBalance", event.target.value)}
                  />
                </label>
                <label>
                  <span>Position value</span>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    value={accountInputs.totalPositionValue}
                    onChange={(event) => updateAccountInput("totalPositionValue", event.target.value)}
                  />
                </label>
                <label>
                  <span>Maintenance %</span>
                  <input
                    type="number"
                    min="1"
                    max="95"
                    step="1"
                    value={Math.round(accountInputs.maintenanceMarginRatio * 100)}
                    onChange={(event) => updateAccountInput("maintenanceMarginRatio", event.target.value)}
                  />
                </label>
              </div>
              <p className="me-input-note">
                {accountInputSource} Live price comes from Bitget; event terms remain scenario inputs.
              </p>
            </section>
          )}

          {investigating && (
            <div className="me-detail-strip" role="status">
              <strong>Investigation open.</strong> Live Bitget prices anchor the selected rToken pair. The event timing,
              event case and account path are scenario inputs; market prices and discount-rate collateral checks come
              from Bitget when available.
            </div>
          )}

           <section className={`me-impact${impact ? "" : " is-unavailable"}`} aria-labelledby="impact-heading">
            <div className="me-impact-table">
              <div className="me-section-heading">
                <h2 id="impact-heading">Account consequence</h2>
                <span>before → event-applied</span>
              </div>
              <div className={`me-account-source ${liveAccountInputs ? "is-live" : ""}`}>
                <strong>{liveAccountInputs ? "Live account linked" : "Scenario sizing"}</strong>
                <span>
                  {accountInputSource}
                  <em>{selectedAssetProof}</em>
                </span>
              </div>
               <MetricRow
                 label="Collateral value"
                 before={beforeSnapshot ? formatCurrency(beforeSnapshot.collateralValue) : "not modeled"}
                 after={scenarioAfter ? formatCurrency(scenarioAfter.collateralValue) : "not modeled"}
                 delta={impact ? formatSignedCurrency(impact.collateralDelta) : "awaiting inputs"}
                 risk={Boolean(impact && impact.collateralDelta < 0)}
                 unavailable={!impact}
               />
               <MetricRow
                 label="Adjusted equity"
                 before={beforeSnapshot ? formatCurrency(beforeSnapshot.adjustedEquity) : "not modeled"}
                 after={scenarioAfter ? formatCurrency(scenarioAfter.adjustedEquity) : "not modeled"}
                 delta={impact ? formatSignedCurrency(impact.adjustedEquityDelta) : "awaiting inputs"}
                 risk={Boolean(impact && impact.adjustedEquityDelta < 0)}
                 unavailable={!impact}
               />
               <MetricRow
                 label="Account leverage"
                 before={beforeSnapshot ? `${beforeSnapshot.leverage.toFixed(1)}x` : "not modeled"}
                 after={scenarioAfter ? `${scenarioAfter.leverage.toFixed(1)}x` : "not modeled"}
                 delta={impact ? formatSignedNumber(impact.leverageDelta, "x") : "awaiting inputs"}
                 risk={Boolean(impact && impact.leverageDelta > 0)}
                 unavailable={!impact}
               />
               <MetricRow
                 label="Margin ratio"
                 before={beforeSnapshot ? formatPercent(beforeSnapshot.marginRatio * 100) : "not modeled"}
                 after={scenarioAfter ? formatPercent(scenarioAfter.marginRatio * 100) : "not modeled"}
                 delta={impact && beforeSnapshot ? formatSignedNumber((scenarioAfter!.marginRatio - beforeSnapshot.marginRatio) * 100, " pts") : "awaiting inputs"}
                 risk={Boolean(impact && beforeSnapshot && scenarioAfter!.marginRatio < beforeSnapshot.marginRatio)}
                 unavailable={!impact}
               />
               <MetricRow
                 label="Liquidation distance"
                 before={beforeSnapshot ? formatPercent(beforeSnapshot.liquidationDistance) : "not modeled"}
                 after={scenarioAfter ? formatPercent(scenarioAfter.liquidationDistance) : "not modeled"}
                 delta={impact ? `${formatSignedNumber(impact.liquidationDistanceDelta, " pts")}` : "awaiting inputs"}
                 risk={Boolean(impact && impact.liquidationDistanceDelta < 0)}
                 unavailable={!impact}
               />
            </div>
            <div className="me-ratio-panel">
              <div className="me-ratio-top">
               <strong>{scenarioAfter ? `${(scenarioAfter.collateralRatio * 100).toFixed(0)}%` : "—"}</strong>
                <span>collateral ratio<br />maintenance line</span>
              </div>
               <div
                 className="me-ratio-bar"
                 aria-label={scenarioAfter ? `Collateral ratio: ${(scenarioAfter.collateralRatio * 100).toFixed(0)} percent` : "Collateral ratio not modeled"}
               >
                <span className="me-ratio-marker" aria-hidden="true" />
              </div>
              <p className="me-ratio-copy">
                 {impact ? (
                   <>
                     <ShieldAlert size={13} strokeWidth={1.7} /> Above maintenance. The event removes room to absorb
                     another move.
                   </>
                 ) : (
                   <>
                     <Activity size={13} strokeWidth={1.7} /> No account inputs loaded for this event yet.
                   </>
                 )}
              </p>
            </div>
          </section>

          <section className="me-evidence" aria-labelledby="evidence-heading">
            <div className="me-evidence-heading">
              <p className="me-kicker">Evidence trail / plain language</p>
              <h2 id="evidence-heading">What changes when the event hits?</h2>
              <p>
                 {selectedEvent.eventCopy}{" "}
                 {impact && <strong>Nothing is liquidated by this change alone.</strong>}
              </p>
              <button className="me-investigate" type="button" onClick={openInvestigation}>
                {investigating ? "Close investigation" : "Open investigation"}
                {investigating ? <X size={13} /> : <PanelRight size={13} />}
              </button>
            </div>

            {investigating && (
              <div className="me-ai-explanation">
                <div className="me-ai-header">
                  <FileText size={16} strokeWidth={1.7} />
                  <strong>AI Analysis</strong>
                  {aiSource && <span className="me-source-chip">{aiSource}</span>}
                  {loadingExplanation && <span className="me-loading">Loading...</span>}
                </div>
                {aiExplanation ? (
                  <div className="me-ai-content">
                    {aiExplanation.split('\n').map((line, index) => (
                      <p key={index}>{line}</p>
                    ))}
                  </div>
                ) : (
                  <p className="me-ai-placeholder">
                    {loadingExplanation ? 'Generating margin impact analysis...' : 'Click "Open investigation" to generate AI-powered explanation.'}
                  </p>
                )}
              </div>
            )}

            <div className="me-timeline" aria-label="Event evidence timeline">
              <div className="me-timeline-item">
                <span className="me-timeline-time">now</span>
                <div className="me-timeline-content">
                  <strong>Position held in account</strong>
                 <p>
                  {beforeSnapshot
                    ? `Collateral value is ${formatCurrency(beforeSnapshot.collateralValue)} and liquidation distance is ${formatPercent(beforeSnapshot.liquidationDistance)}.`
                     : "Account snapshot is waiting for the event data source."}
                 </p>
                </div>
              </div>
              <div className="me-timeline-item">
                <span className="me-timeline-time">T−18h42m</span>
                <div className="me-timeline-content">
                  <strong>Adjustment announced</strong>
                 <p>{selectedEvent.kind} is marked for the selected event file.</p>
                </div>
              </div>
              <div className="me-timeline-item future">
                <span className="me-timeline-time">event</span>
                <div className="me-timeline-content">
                  <strong>Collateral ledger updates</strong>
                 <p>
                   {selectedEvent.after
                     ? `Expected path: ${formatCurrency(scenarioAfter!.collateralValue)} collateral, ${scenarioAfter!.leverage.toFixed(1)}x leverage, ${formatPercent(scenarioAfter!.liquidationDistance)} distance.`
                     : "Expected path is not available until the event inputs are opened."}
                 </p>
                </div>
              </div>
            </div>
          </section>

          <section className="me-scenarios" aria-labelledby="scenario-heading">
            <div className="me-section-heading">
              <h2 id="scenario-heading">Next action comparison</h2>
              <span>same event / three paths</span>
            </div>
            <div className="me-scenario-grid">
              {SCENARIOS.map((item) => (
                <button
                  className="me-scenario"
                  key={item.key}
                  type="button"
                  aria-pressed={scenario === item.key}
                  onClick={() => setScenario(item.key)}
                >
                  <span>
                    <span className="me-scenario-name">{item.name}</span>
                    <span className="me-scenario-copy">{item.copy}</span>
                  </span>
                  <span className="me-scenario-result">
                     {scenario === item.key ? "selected · " : ""}
                     {impact ? (item.key === scenario ? `buffer now ${formatPercent(scenarioAfter!.liquidationDistance)}` : item.result) : "awaiting event inputs"}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <footer className="me-footer">
            <p className="me-source">
               Source trail: {selectedDataSource}; {accountSourceDetail}. {impact ? `The ${selectedEvent.key} path is calculated from ${liveAccountInputs ? "live account balance, live price" : "editable portfolio inputs, live price"}, event terms, Bitget discount-rate collateral data when available, adjusted equity, and account position value.` : "This event has no account fixture yet."} Calculations are deterministic and explainable; AI is used only as a plain-language narrator.
            </p>
            <span className="me-version">M//E 0.7 / desk</span>
          </footer>
        </section>
      </div>

      {commandOpen && (
        <div className="me-command-backdrop" role="presentation" onMouseDown={() => setCommandOpen(false)}>
          <div className="me-command" role="dialog" aria-modal="true" aria-label="Command surface" onMouseDown={(event) => event.stopPropagation()}>
            <div className="me-command-head">
              <Search size={15} strokeWidth={1.7} />
              <input
                autoFocus
                type="search"
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder="Find an action, scenario, or Bitget pair"
                aria-label="Find an action, scenario, or Bitget pair"
              />
              <button type="button" aria-label="Close command surface" onClick={() => setCommandOpen(false)}>
                <X size={15} strokeWidth={1.7} />
              </button>
            </div>
            <div className="me-command-items">
              {spotResults.length > 0 && (
                <div className="me-command-section">Live Bitget pairs</div>
              )}
              {spotResults.map((item) => (
                <button className="me-command-item" key={item.symbol} type="button" onClick={() => openSearchedPair(item.symbol)}>
                  <span className="me-command-label">
                    <Activity size={14} />
                    Open {item.symbol}
                    <span className={item.change24h >= 0 ? "me-command-price is-up" : "me-command-price is-down"}>
                      {formatCurrency(item.price)} · {item.change24h.toFixed(2)}%
                    </span>
                  </span>
                  <kbd>live</kbd>
                </button>
              ))}
              {searchingSpot && (
                <div className="me-command-item">
                  <span className="me-command-label">
                    <Activity size={14} />
                    Searching Bitget spot pairs
                  </span>
                </div>
              )}
              {spotResults.length > 0 && (
                <div className="me-command-section">Workbench actions</div>
              )}
              {filteredCommands.length > 0 ? (
                filteredCommands.map((item) => (
                  <button className="me-command-item" key={item.key} type="button" onClick={() => runCommand(item.key)}>
                    <span className="me-command-label">
                      {item.key === "investigate" ? <FileText size={14} /> : item.key === "hold" ? <CircleCheck size={14} /> : item.key === "add" ? <ArrowUpRight size={14} /> : item.key === "reduce" ? <ArrowDownRight size={14} /> : <Activity size={14} />}
                      {item.label}
                    </span>
                    <kbd>{item.shortcut}</kbd>
                  </button>
                ))
              ) : (
                <div className="me-command-item">
                  <span className="me-command-label">
                    <Activity size={14} />
                    No matching action
                  </span>
                </div>
              )}
            </div>
            <div className="me-command-label" style={{ borderTop: "1px solid var(--me-line)", padding: "10px 14px", color: "var(--me-ink-soft)", fontSize: "10px" }}>
              <ChevronRight size={13} />
              Type to search Bitget pairs, or click a scenario action
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
