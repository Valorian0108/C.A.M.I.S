import { useEffect, useState } from "react";
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
  calculateImpact,
  EVENT_MODELS,
  findEvent,
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
  formatSignedNumber,
  type EventKey,
  type ScenarioKey,
} from "./simulator";
import { apiClient } from "@/lib/api-client";

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
    copy: "Trim rNVDA before the event is applied.",
    result: "lower pressure before settlement",
  },
];

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

export function Desk() {
  const [selectedKey, setSelectedKey] = useState<EventKey>("rNVDA");
  const [scenario, setScenario] = useState<ScenarioKey>("hold");
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [investigating, setInvestigating] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  const selectedEvent = findEvent(selectedKey);
  const impact = calculateImpact(selectedEvent);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function chooseEvent(key: EventKey) {
    setSelectedKey(key);
    setScenario("hold");
    setInvestigating(false);
  }

  async function fetchAIExplanation() {
    if (!selectedEvent.before || !selectedEvent.after) return;

    setLoadingExplanation(true);
    try {
      const response = await apiClient.getMarginExplanation({
        token: selectedEvent.key,
        eventType: selectedEvent.kind,
        beforeState: selectedEvent.before,
        afterState: selectedEvent.after,
        recommendedAction: scenario,
      });

      if (response.success) {
        setAiExplanation(response.explanation);
      }
    } catch (error) {
      console.error('Failed to fetch AI explanation:', error);
      setAiExplanation(null);
    } finally {
      setLoadingExplanation(false);
    }
  }

  function runCommand(action: "investigate" | "hold" | "add" | "reduce") {
    if (action === "investigate") {
      setInvestigating(true);
      fetchAIExplanation();
    }
    if (action === "hold" || action === "add" || action === "reduce") {
      setScenario(action);
      if (investigating) {
        fetchAIExplanation();
      }
    }
    setCommandOpen(false);
    setCommandQuery("");
  }

  const filteredCommands = [
    { label: "Investigate selected event", key: "investigate" as const, shortcut: "↵" },
    { label: "Compare hold scenario", key: "hold" as const, shortcut: "H" },
    { label: "Compare add collateral", key: "add" as const, shortcut: "A" },
    { label: "Compare reduce exposure", key: "reduce" as const, shortcut: "R" },
  ].filter((item) => item.label.toLowerCase().includes(commandQuery.toLowerCase()));

  return (
    <main className="me-root">
      <div className="me-shell">
        <aside className="me-rail" aria-label="Event queue">
          <div className="me-brand">
            <div className="me-brand-mark">
              <span>//</span>
              MARGIN//EVENT
            </div>
            <p>Pre-event consequence workbench</p>
          </div>

          <p className="me-rail-label">Event queue / 03</p>
          <nav className="me-event-list" aria-label="Corporate action events">
            {EVENT_MODELS.map((event) => (
              <button
                className="me-event-row"
                key={event.key}
                type="button"
                aria-current={event.key === selectedKey}
                onClick={() => chooseEvent(event.key)}
              >
                <span className="me-event-dot" aria-hidden="true" />
                <span>
                  <span className="me-event-name">{event.key}</span>
                  <span className="me-event-kind">{event.kind}</span>
                </span>
                <span className="me-event-state">{event.key === "rNVDA" ? event.countdown : event.state}</span>
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
                <span>Search actions</span>
                <span className="me-key">⌘ K</span>
              </button>
            </div>
          </header>

          <section className="me-hero" aria-labelledby="event-title">
            <div>
              <p className="me-kicker">Selected corporate action / consequence file 07</p>
              <div className="me-title-line">
                <h1 className="me-title" id="event-title">
                  {selectedEvent.key}
                </h1>
                <span className="me-code">{selectedEvent.kind}</span>
              </div>
              <p className="me-hero-summary">
                 {selectedEvent.summary}
              </p>
            </div>
            <div className="me-countdown" aria-label="Time until event">
              <span className="me-countdown-label">adjustment arrives in</span>
               <strong className="me-countdown-value">{selectedEvent.countdown}</strong>
              <span className="me-countdown-note">
                 {impact ? "pressure is visible before settlement" : "event data not opened"}
              </span>
            </div>
          </section>

          {investigating && (
            <div className="me-detail-strip" role="status">
              <strong>Investigation open.</strong> The displayed movement is a deterministic consequence path:
              event adjustment → collateral repricing → leverage and distance update. No predictive model is used.
            </div>
          )}

           <section className={`me-impact${impact ? "" : " is-unavailable"}`} aria-labelledby="impact-heading">
            <div className="me-impact-table">
              <div className="me-section-heading">
                <h2 id="impact-heading">Account consequence</h2>
                <span>before → event-applied</span>
              </div>
               <MetricRow
                 label="Collateral value"
                 before={selectedEvent.before ? formatCurrency(selectedEvent.before.collateralValue) : "not modeled"}
                 after={selectedEvent.after ? formatCurrency(selectedEvent.after.collateralValue) : "not modeled"}
                 delta={impact ? formatSignedCurrency(impact.collateralDelta) : "awaiting inputs"}
                 risk={Boolean(impact && impact.collateralDelta < 0)}
                 unavailable={!impact}
               />
               <MetricRow
                 label="Account leverage"
                 before={selectedEvent.before ? `${selectedEvent.before.leverage.toFixed(1)}x` : "not modeled"}
                 after={selectedEvent.after ? `${selectedEvent.after.leverage.toFixed(1)}x` : "not modeled"}
                 delta={impact ? formatSignedNumber(impact.leverageDelta, "x") : "awaiting inputs"}
                 risk={Boolean(impact && impact.leverageDelta > 0)}
                 unavailable={!impact}
               />
               <MetricRow
                 label="Liquidation distance"
                 before={selectedEvent.before ? formatPercent(selectedEvent.before.liquidationDistance) : "not modeled"}
                 after={selectedEvent.after ? formatPercent(selectedEvent.after.liquidationDistance) : "not modeled"}
                 delta={impact ? `${formatSignedNumber(impact.liquidationDistanceDelta, " pts")}` : "awaiting inputs"}
                 risk={Boolean(impact && impact.liquidationDistanceDelta < 0)}
                 unavailable={!impact}
               />
            </div>
            <div className="me-ratio-panel">
              <div className="me-ratio-top">
               <strong>{selectedEvent.after ? `${(selectedEvent.after.collateralRatio * 100).toFixed(0)}%` : "—"}</strong>
                <span>collateral ratio<br />maintenance line</span>
              </div>
               <div
                 className="me-ratio-bar"
                 aria-label={selectedEvent.after ? `Collateral ratio: ${(selectedEvent.after.collateralRatio * 100).toFixed(0)} percent` : "Collateral ratio not modeled"}
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
              <button className="me-investigate" type="button" onClick={() => setInvestigating((open) => !open)}>
                {investigating ? "Close investigation" : "Open investigation"}
                {investigating ? <X size={13} /> : <PanelRight size={13} />}
              </button>
            </div>

            {investigating && (
              <div className="me-ai-explanation">
                <div className="me-ai-header">
                  <FileText size={16} strokeWidth={1.7} />
                  <strong>AI Analysis</strong>
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
                   {selectedEvent.before
                     ? `Collateral value is ${formatCurrency(selectedEvent.before.collateralValue)} and liquidation distance is ${formatPercent(selectedEvent.before.liquidationDistance)}.`
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
                     ? `Expected path: ${formatCurrency(selectedEvent.after.collateralValue)} collateral, ${selectedEvent.after.leverage.toFixed(1)}x leverage, ${formatPercent(selectedEvent.after.liquidationDistance)} distance.`
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
                     {impact ? (item.key === "hold" ? `buffer narrows to ${formatPercent(selectedEvent.after!.liquidationDistance)}` : item.result) : "awaiting event inputs"}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <footer className="me-footer">
            <p className="me-source">
               Source trail: simulated event data for prototype review. {impact ? "The rNVDA path is calculated from explicit before/after fixtures." : "This event has no account fixture yet."} Calculations are deterministic and explainable; AI is used only as a plain-language narrator. Context: UTA / rToken mechanics.
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
                placeholder="Find an action or comparison"
                aria-label="Find an action or comparison"
              />
              <button type="button" aria-label="Close command surface" onClick={() => setCommandOpen(false)}>
                <X size={15} strokeWidth={1.7} />
              </button>
            </div>
            <div className="me-command-items">
              {filteredCommands.length > 0 ? (
                filteredCommands.map((item) => (
                  <button className="me-command-item" key={item.key} type="button" onClick={() => runCommand(item.key)}>
                    <span className="me-command-label">
                      {item.key === "investigate" ? <FileText size={14} /> : item.key === "hold" ? <CircleCheck size={14} /> : item.key === "add" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
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
              Use H, A, or R to compare a path
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
