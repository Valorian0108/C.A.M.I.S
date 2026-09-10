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

type EventKey = "rNVDA" | "rTSLA" | "rQQQ";
type ScenarioKey = "hold" | "add" | "reduce";

type EventRow = {
  key: EventKey;
  kind: string;
  state: string;
  title: string;
  subtitle: string;
  countdown: string;
};

const EVENTS: EventRow[] = [
  {
    key: "rNVDA",
    kind: "reverse split / adjustment",
    state: "selected",
    title: "NVIDIA reverse split",
    subtitle: "Collateral treatment under review",
    countdown: "18h 42m",
  },
  {
    key: "rTSLA",
    kind: "corporate action",
    state: "queued",
    title: "Tesla adjustment",
    subtitle: "Event window not opened",
    countdown: "—",
  },
  {
    key: "rQQQ",
    kind: "corporate action",
    state: "queued",
    title: "Invesco QQQ adjustment",
    subtitle: "Event window not opened",
    countdown: "—",
  },
];

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
    result: "buffer narrows to 18.2%",
  },
  {
    key: "add",
    name: "Add collateral",
    copy: "Increase collateral before the event window.",
    result: "distance preserved above 18.2%",
  },
  {
    key: "reduce",
    name: "Reduce exposure",
    copy: "Trim rNVDA before the event is applied.",
    result: "leverage pressure reduced",
  },
];

function MetricRow({
  label,
  before,
  after,
  delta,
  risk,
}: {
  label: string;
  before: string;
  after: string;
  delta: string;
  risk?: boolean;
}) {
  return (
    <div className="me-metric">
      <span className="me-metric-label">{label}</span>
      <span className="me-metric-value">{before}</span>
      <span className="me-metric-arrow" aria-hidden="true">
        →
      </span>
      <span className="me-metric-value after">{after}</span>
      <span className={`me-metric-delta${risk ? " risk" : ""}`}>{delta}</span>
    </div>
  );
}

export function Desk() {
  const [selectedKey, setSelectedKey] = useState<EventKey>("rNVDA");
  const [scenario, setScenario] = useState<ScenarioKey>("hold");
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [investigating, setInvestigating] = useState(false);

  const selectedEvent = EVENTS.find((event) => event.key === selectedKey) ?? EVENTS[0];

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

  function runCommand(action: "investigate" | "hold" | "add" | "reduce") {
    if (action === "investigate") setInvestigating(true);
    if (action === "hold" || action === "add" || action === "reduce") {
      setScenario(action);
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
            {EVENTS.map((event) => (
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
                The event changes the <strong>collateral representation</strong>, not the account’s maintenance
                threshold. Your account remains above maintenance, but the usable buffer gets thinner.
              </p>
            </div>
            <div className="me-countdown" aria-label="Time until event">
              <span className="me-countdown-label">adjustment arrives in</span>
              <strong className="me-countdown-value">{selectedEvent.key === "rNVDA" ? "18h 42m" : "—"}</strong>
              <span className="me-countdown-note">
                {selectedEvent.key === "rNVDA" ? "pressure is visible before settlement" : "event data not opened"}
              </span>
            </div>
          </section>

          {investigating && (
            <div className="me-detail-strip" role="status">
              <strong>Investigation open.</strong> The displayed movement is a deterministic consequence path:
              event adjustment → collateral repricing → leverage and distance update. No predictive model is used.
            </div>
          )}

          <section className="me-impact" aria-labelledby="impact-heading">
            <div className="me-impact-table">
              <div className="me-section-heading">
                <h2 id="impact-heading">Account consequence</h2>
                <span>before → event-applied</span>
              </div>
              <MetricRow label="Collateral value" before="$18,420" after="$17,912" delta="−$508" risk />
              <MetricRow label="Account leverage" before="2.8x" after="3.1x" delta="+0.3x" risk />
              <MetricRow label="Liquidation distance" before="24.6%" after="18.2%" delta="−6.4 pts" risk />
            </div>
            <div className="me-ratio-panel">
              <div className="me-ratio-top">
                <strong>95%</strong>
                <span>collateral ratio<br />maintenance line</span>
              </div>
              <div className="me-ratio-bar" aria-label="Collateral ratio: 95 percent">
                <span className="me-ratio-marker" aria-hidden="true" />
              </div>
              <p className="me-ratio-copy">
                <ShieldAlert size={13} strokeWidth={1.7} /> Above maintenance. The event removes room to absorb another
                move.
              </p>
            </div>
          </section>

          <section className="me-evidence" aria-labelledby="evidence-heading">
            <div className="me-evidence-heading">
              <p className="me-kicker">Evidence trail / plain language</p>
              <h2 id="evidence-heading">What changes when the event hits?</h2>
              <p>
                rNVDA’s adjustment flows through the collateral ledger. The position is still recognized, but its
                collateral value is marked lower in this event path. <strong>Nothing is liquidated by this change alone.</strong>
              </p>
              <button className="me-investigate" type="button" onClick={() => setInvestigating((open) => !open)}>
                {investigating ? "Close investigation" : "Open investigation"}
                {investigating ? <X size={13} /> : <PanelRight size={13} />}
              </button>
            </div>

            <div className="me-timeline" aria-label="Event evidence timeline">
              <div className="me-timeline-item">
                <span className="me-timeline-time">now</span>
                <div className="me-timeline-content">
                  <strong>Position held in account</strong>
                  <p>Collateral value is $18,420 and liquidation distance is 24.6%.</p>
                </div>
              </div>
              <div className="me-timeline-item">
                <span className="me-timeline-time">T−18h42m</span>
                <div className="me-timeline-content">
                  <strong>Adjustment announced</strong>
                  <p>Reverse split / rToken mechanics are marked for the selected event file.</p>
                </div>
              </div>
              <div className="me-timeline-item future">
                <span className="me-timeline-time">event</span>
                <div className="me-timeline-content">
                  <strong>Collateral ledger updates</strong>
                  <p>Expected path: $17,912 collateral, 3.1x leverage, 18.2% distance.</p>
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
                    {item.result}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <footer className="me-footer">
            <p className="me-source">
              Source trail: simulated event data for prototype review. Calculations are deterministic and explainable;
              AI is used only as a plain-language narrator. Context: UTA / rToken mechanics.
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
