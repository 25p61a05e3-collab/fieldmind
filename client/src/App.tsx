import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Database,
  Gauge,
  History,
  Loader2,
  MapPin,
  Menu,
  OctagonAlert,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import type {
  AnalysisResponse,
  DemoScenario,
  DemoSession,
  IncidentInput,
  MemoryReference,
  MemoryStatus,
  Recommendation,
  ResolutionInput,
  ServiceStatus,
} from "@shared/types";
import { api } from "./lib/api";

const initialIncident: IncidentInput = {
  equipmentId: "P-204",
  equipmentType: "Centrifugal pump",
  location: "North process bay",
  reportedIssue:
    "Pump P-204 is vibrating heavily and shutting down after running for about 10 minutes.",
  symptoms:
    "High vibration at the drive end, audible rattling, and automatic shutdown after approximately ten minutes under normal production load.",
  severity: "high",
  operatingContext:
    "Issue began during a normal batch after the pump returned from routine maintenance.",
};

const initialResolution: ResolutionInput = {
  rootCause: "",
  actionsTaken: "",
  result: "resolved",
  resolved: true,
  technicianFeedback: "",
  notes: "",
};

const statusLabel: Record<string, string> = {
  connected: "Connected",
  empty: "No match",
  unavailable: "Unavailable",
  not_configured: "Not configured",
};

function formatDate(value?: string) {
  if (!value) return "Date not supplied";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function StatusDot({ status }: { status?: string }) {
  return (
    <span
      className={`status-dot ${status === "connected" ? "is-live" : status === "unavailable" ? "is-error" : "is-idle"}`}
      aria-hidden="true"
    />
  );
}

function ServiceChip({
  label,
  status,
  icon,
}: {
  label: string;
  status?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="service-chip">
      <StatusDot status={status} />
      <span className="service-chip-icon">{icon}</span>
      <span>{label}</span>
      <strong>{statusLabel[status ?? "not_configured"]}</strong>
    </div>
  );
}

function MemoryCard({ memory }: { memory: MemoryReference }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className={`memory-card ${expanded ? "is-expanded" : ""}`}>
      <button
        className="memory-card-trigger"
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded}
      >
        <span className="memory-icon">
          <BrainCircuit size={16} />
        </span>
        <span className="memory-card-copy">
          <span className="memory-card-meta">
            {memory.equipmentId ?? "Field experience"} <span>·</span>{" "}
            {memory.type}
          </span>
          <strong>{memory.text}</strong>
        </span>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      <div className="memory-relevance">
        <Sparkles size={13} /> {memory.relevanceReason}
      </div>
      {expanded && (
        <div className="memory-card-detail">
          <div>
            <span>What happened</span>
            <p>{memory.text}</p>
          </div>
          <div className="memory-detail-grid">
            <div>
              <span>Context</span>
              <p>{memory.context ?? "Not supplied by Hindsight"}</p>
            </div>
            <div>
              <span>When</span>
              <p>{formatDate(memory.occurredAt ?? memory.mentionedAt)}</p>
            </div>
            <div>
              <span>Document</span>
              <p className="mono-text">
                {memory.documentId ?? "Hindsight fact"}
              </p>
            </div>
            <div>
              <span>Tags</span>
              <p>{memory.tags.length ? memory.tags.join(", ") : "No tags"}</p>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function ProgressRail({
  demoSession,
  currentStep,
}: {
  demoSession?: DemoSession;
  currentStep?: number;
}) {
  const steps = [
    { number: 1, title: "First pass", caption: "Generic" },
    { number: 5, title: "Relevant recall", caption: "Evidence" },
    { number: 10, title: "Pattern", caption: "Cross-equipment" },
    { number: 20, title: "Experienced", caption: "Prioritized" },
  ];
  return (
    <div className="progress-rail">
      <div className="section-kicker">MEMORY EVOLUTION</div>
      <div className="progress-track">
        {steps.map((step, index) => {
          const active = currentStep === step.number;
          const done =
            demoSession?.completedSteps.includes(step.number) ||
            (currentStep ?? 0) > step.number;
          return (
            <div
              className={`progress-step ${active ? "is-active" : ""} ${done ? "is-done" : ""}`}
              key={step.number}
            >
              <div className="progress-step-marker">
                {done ? <Check size={13} /> : step.number}
              </div>
              <div>
                <strong>Interaction {step.number}</strong>
                <span>{step.title}</span>
                <small>{step.caption}</small>
              </div>
              {index < steps.length - 1 && <div className="progress-line" />}
            </div>
          );
        })}
      </div>
      <p className="muted-copy">
        Every retained resolution gives the next recommendation more context.
        Counts shown here come from this demo session, not fabricated confidence
        scores.
      </p>
    </div>
  );
}

function App() {
  const [incident, setIncident] = useState<IncidentInput>(initialIncident);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [resolution, setResolution] =
    useState<ResolutionInput>(initialResolution);
  const [retainedLearning, setRetainedLearning] = useState<string | null>(null);
  const [retainStatus, setRetainStatus] = useState<MemoryStatus | undefined>();
  const [demoSession, setDemoSession] = useState<DemoSession | undefined>();
  const [demoScenario, setDemoScenario] = useState<DemoScenario | undefined>();
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    mongo: "not_configured",
    hindsight: "not_configured",
    groq: "not_configured",
  });
  const [equipmentHistory, setEquipmentHistory] = useState<Awaited<
    ReturnType<typeof api.equipmentHistory>
  > | null>(null);
  const [openHistory, setOpenHistory] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [activeProgressStep, setActiveProgressStep] = useState<
    number | undefined
  >();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api
      .health()
      .then(result => setServiceStatus(result.serviceStatus))
      .catch(() =>
        setNotice(
          "The API is not reachable yet. Start the server or check the deployment URL."
        )
      );
  }, []);

  const memories = analysis?.memories ?? [];
  const recommendation = analysis?.recommendation;
  const currentStage = useMemo(
    () => demoSession?.interactionCount || analysis?.incident.interactionNumber,
    [analysis, demoSession]
  );

  function updateIncident<K extends keyof IncidentInput>(
    key: K,
    value: IncidentInput[K]
  ) {
    setIncident(current => ({ ...current, [key]: value }));
  }

  function applyScenario(scenario: DemoScenario) {
    setDemoScenario(scenario);
    setActiveProgressStep(scenario.step);
    setIncident({ ...scenario.incident, demoSessionId: demoSession?.id });
    setAnalysis(null);
    setRetainedLearning(null);
    setRetainStatus(undefined);
    setResolution(initialResolution);
    setError(null);
    setNotice(
      `Loaded ${scenario.label}. Analyze it through the real incident workflow.`
    );
  }

  async function startDemo() {
    setIsDemoLoading(true);
    setError(null);
    try {
      const result = await api.startDemo();
      setDemoSession(result.session);
      const scenario = result.session.scenarios[0];
      setDemoScenario(scenario);
      setActiveProgressStep(scenario.step);
      setIncident({ ...scenario.incident, demoSessionId: result.session.id });
      setAnalysis(null);
      setRetainedLearning(null);
      setRetainStatus(undefined);
      setResolution(initialResolution);
      setNotice(result.sourceNote);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not start Demo Mode"
      );
    } finally {
      setIsDemoLoading(false);
    }
  }

  async function loadDemoStage(step: 5 | 10 | 20) {
    if (!demoSession) return;
    setIsDemoLoading(true);
    setError(null);
    try {
      const advance = await api.advanceDemo(demoSession.id, step);
      setDemoSession(advance.session);
      const scenario = advance.session.scenarios.find(
        item => item.step === step
      );
      if (scenario) applyScenario(scenario);
      setNotice(advance.sourceNote);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not advance Demo Mode"
      );
    } finally {
      setIsDemoLoading(false);
    }
  }

  async function analyze() {
    setIsAnalyzing(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.analyzeIncident({
        ...incident,
        demoSessionId: demoSession?.id,
      });
      setAnalysis(result);
      setIncident(current => ({ ...current, demoSessionId: demoSession?.id }));
      setResolution(initialResolution);
      setRetainedLearning(null);
      setRetainStatus(undefined);
      setServiceStatus(current => ({
        ...current,
        hindsight:
          result.memoryStatus === "connected" || result.memoryStatus === "empty"
            ? "connected"
            : result.memoryStatus,
        groq: result.llmStatus,
      }));
      setNotice(result.sourceNote);
      if (demoSession)
        setDemoSession(current =>
          current
            ? {
                ...current,
                interactionCount: result.incident.interactionNumber,
                memoryStatus: result.memoryStatus,
              }
            : current
        );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incident analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function submitResolution() {
    if (!analysis) return;
    setIsResolving(true);
    setError(null);
    try {
      const result = await api.resolveIncident(
        analysis.incident.id,
        resolution
      );
      setAnalysis(current =>
        current ? { ...current, incident: result.incident } : current
      );
      setRetainedLearning(result.retainedLearning);
      setRetainStatus(result.retainStatus);
      setServiceStatus(current => ({
        ...current,
        hindsight:
          result.retainStatus === "connected"
            ? "connected"
            : result.retainStatus === "unavailable"
              ? "unavailable"
              : "not_configured",
      }));
      setNotice(result.sourceNote);
      if (demoSession)
        setDemoSession(current =>
          current
            ? {
                ...current,
                completedSteps: [
                  ...new Set([
                    ...current.completedSteps,
                    analysis.incident.interactionNumber,
                  ]),
                ],
              }
            : current
        );
      await loadEquipment(incident.equipmentId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not retain the resolution"
      );
    } finally {
      setIsResolving(false);
    }
  }

  async function loadEquipment(equipmentId: string) {
    try {
      setEquipmentHistory(await api.equipmentHistory(equipmentId));
    } catch {
      setEquipmentHistory(null);
    }
  }

  function setResolutionField<K extends keyof ResolutionInput>(
    key: K,
    value: ResolutionInput[K]
  ) {
    setResolution(current => ({ ...current, [key]: value }));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <span />
            <span />
            <i />
          </div>
          <div>
            <div className="brand-name">fieldmind</div>
            <div className="brand-tagline">
              Every solved issue becomes experience.
            </div>
          </div>
        </div>
        <div className="topbar-context">
          <span className="context-label">FIELD SERVICE WORKSPACE</span>
          <span className="context-divider" />
          <span className="technician-name">Alex Morgan · Technician</span>
        </div>
        <button
          className={`demo-toggle ${demoSession ? "is-active" : ""}`}
          onClick={startDemo}
          disabled={isDemoLoading}
        >
          <Activity size={15} />
          {isDemoLoading
            ? "Starting…"
            : demoSession
              ? "Restart Demo Mode"
              : "Demo Mode"}
        </button>
      </header>

      <main className="workspace">
        <aside className="left-rail">
          <div className="rail-heading">
            <div>
              <div className="section-kicker">INCIDENT CONSOLE</div>
              <h1>Investigate a recurring issue</h1>
            </div>
            <Menu size={18} className="mobile-menu-icon" />
          </div>
          <p className="rail-intro">
            Describe what the technician sees in the field. FieldMind will
            compare it with proven Hindsight experience before recommending a
            first action.
          </p>
          <form
            className="incident-form"
            onSubmit={event => {
              event.preventDefault();
              void analyze();
            }}
          >
            <label>
              Equipment ID
              <input
                value={incident.equipmentId}
                onChange={event =>
                  updateIncident("equipmentId", event.target.value)
                }
                placeholder="e.g. P-204"
                required
              />
            </label>
            <div className="form-grid">
              <label>
                Type
                <input
                  value={incident.equipmentType}
                  onChange={event =>
                    updateIncident("equipmentType", event.target.value)
                  }
                  required
                />
              </label>
              <label>
                Severity
                <select
                  value={incident.severity}
                  onChange={event =>
                    updateIncident(
                      "severity",
                      event.target.value as IncidentInput["severity"]
                    )
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
            </div>
            <label>
              Location
              <div className="input-with-icon">
                <MapPin size={14} />
                <input
                  value={incident.location}
                  onChange={event =>
                    updateIncident("location", event.target.value)
                  }
                  required
                />
              </div>
            </label>
            <label>
              Reported issue
              <textarea
                rows={3}
                value={incident.reportedIssue}
                onChange={event =>
                  updateIncident("reportedIssue", event.target.value)
                }
                required
              />
            </label>
            <label>
              Symptoms
              <textarea
                rows={4}
                value={incident.symptoms}
                onChange={event =>
                  updateIncident("symptoms", event.target.value)
                }
                required
              />
            </label>
            <label>
              Operating context
              <textarea
                rows={3}
                value={incident.operatingContext}
                onChange={event =>
                  updateIncident("operatingContext", event.target.value)
                }
                required
              />
            </label>
            <button
              className="primary-button analyze-button"
              type="submit"
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Analyzing incident…
                </>
              ) : (
                <>
                  <Search size={16} />
                  Analyze incident <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>
          <div className="workflow-cue">
            <div className="cue-icon">
              <ShieldCheck size={16} />
            </div>
            <div>
              <strong>Safety-first workflow</strong>
              <span>Isolate · Measure · Act · Retain</span>
            </div>
          </div>
        </aside>

        <section className="main-canvas">
          <div className="canvas-header">
            <div>
              <div className="section-kicker">
                LIVE CASE{" "}
                <span className="case-id">
                  {analysis?.incident.id
                    ? analysis.incident.id.slice(0, 8).toUpperCase()
                    : "READY"}
                </span>
              </div>
              <h2>
                {analysis
                  ? "Recommendation for the technician"
                  : "Ready for your next incident"}
              </h2>
            </div>
            <div className="service-status-row">
              <ServiceChip
                label="MongoDB"
                status={serviceStatus.mongo}
                icon={<Database size={13} />}
              />
              <ServiceChip
                label="Hindsight"
                status={serviceStatus.hindsight}
                icon={<BrainCircuit size={13} />}
              />
              <ServiceChip
                label="Groq"
                status={serviceStatus.groq}
                icon={<Sparkles size={13} />}
              />
            </div>
          </div>

          {(error || notice) && (
            <div className={`notice-banner ${error ? "is-error" : ""}`}>
              <span className="notice-icon">
                {error ? <X size={15} /> : <Check size={15} />}
              </span>
              <span>{error ?? notice}</span>
              {error && (
                <button
                  onClick={() => setError(null)}
                  aria-label="Dismiss error"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {!recommendation ? (
            <div className="empty-analysis">
              <div className="empty-orbit">
                <div className="brand-mark large">
                  <span />
                  <span />
                  <i />
                </div>
              </div>
              <div className="section-kicker">MEMORY-LED TROUBLESHOOTING</div>
              <h3>Start with the field signal.</h3>
              <p>
                Submit an incident to see whether Hindsight has a relevant
                precedent. The first interaction is intentionally generic;
                retained outcomes make later guidance more specific.
              </p>
              <div className="empty-steps">
                <span>
                  <b>01</b> Describe
                </span>
                <ArrowRight size={14} />
                <span>
                  <b>02</b> Recall
                </span>
                <ArrowRight size={14} />
                <span>
                  <b>03</b> Resolve
                </span>
                <ArrowRight size={14} />
                <span>
                  <b>04</b> Retain
                </span>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`recommendation-card ${recommendation.source === "fallback" ? "is-fallback" : ""}`}
              >
                <div className="recommendation-topline">
                  <span className="rec-label">
                    <Sparkles size={14} /> AGENT RECOMMENDATION
                  </span>
                  <span
                    className={`source-badge ${recommendation.source === "groq" ? "is-groq" : "is-fallback"}`}
                  >
                    {recommendation.source === "groq"
                      ? "Groq · evidence grounded"
                      : "Fallback checklist"}
                  </span>
                </div>
                <div className="recommendation-summary">
                  <h3>{recommendation.summary}</h3>
                  <div className="action-callout">
                    <div className="action-number">01</div>
                    <div>
                      <span>RECOMMENDED FIRST ACTION</span>
                      <strong>{recommendation.recommendedAction}</strong>
                    </div>
                  </div>
                </div>
                <div className="recommendation-grid">
                  <div>
                    <span className="detail-label">WHY THIS ACTION</span>
                    <p>{recommendation.why}</p>
                  </div>
                  <div>
                    <span className="detail-label">MEMORY INFLUENCE</span>
                    <p>{recommendation.memoryInfluence}</p>
                  </div>
                </div>
                <div className="sequence-block">
                  <span className="detail-label">SUGGESTED SEQUENCE</span>
                  <ol>
                    {recommendation.sequence.map((step, index) => (
                      <li key={`${step}-${index}`}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
                {recommendation.warnings.length > 0 && (
                  <div className="warning-block">
                    <AlertTriangle size={16} />
                    <div>
                      <span className="detail-label">IMPORTANT WARNINGS</span>
                      {recommendation.warnings.map(warning => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  </div>
                )}
                {recommendation.rootCauseHypotheses.length > 0 && (
                  <div className="hypotheses-row">
                    <span className="detail-label">CAUSES TO TEST</span>
                    <div>
                      {recommendation.rootCauseHypotheses.map(item => (
                        <span className="hypothesis-chip" key={item}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="resolution-card">
                <div className="card-heading">
                  <div>
                    <div className="section-kicker">CLOSE THE LOOP</div>
                    <h3>Record the resolution</h3>
                  </div>
                  <ClipboardCheck size={20} />
                </div>
                <p className="card-subtitle">
                  Capture what actually happened so this case can become useful
                  experience for the next technician.
                </p>
                <form
                  onSubmit={event => {
                    event.preventDefault();
                    void submitResolution();
                  }}
                >
                  <div className="form-grid">
                    <label>
                      Root cause
                      <input
                        value={resolution.rootCause}
                        onChange={event =>
                          setResolutionField("rootCause", event.target.value)
                        }
                        placeholder="What did you confirm?"
                        required
                      />
                    </label>
                    <label>
                      Result
                      <select
                        value={resolution.result}
                        onChange={event =>
                          setResolutionField(
                            "result",
                            event.target.value as ResolutionInput["result"]
                          )
                        }
                      >
                        <option value="resolved">Resolved</option>
                        <option value="partially_resolved">
                          Partially resolved
                        </option>
                        <option value="failed">Failed / returned</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Actions taken
                    <textarea
                      rows={2}
                      value={resolution.actionsTaken}
                      onChange={event =>
                        setResolutionField("actionsTaken", event.target.value)
                      }
                      placeholder="Repairs, adjustments, measurements…"
                      required
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Technician feedback
                      <textarea
                        rows={2}
                        value={resolution.technicianFeedback}
                        onChange={event =>
                          setResolutionField(
                            "technicianFeedback",
                            event.target.value
                          )
                        }
                        placeholder="What should the next technician know?"
                        required
                      />
                    </label>
                    <label>
                      Notes
                      <textarea
                        rows={2}
                        value={resolution.notes}
                        onChange={event =>
                          setResolutionField("notes", event.target.value)
                        }
                        placeholder="Optional field notes"
                      />
                    </label>
                  </div>
                  <div className="resolution-actions">
                    <label className="check-control">
                      <input
                        type="checkbox"
                        checked={resolution.resolved}
                        onChange={event =>
                          setResolutionField("resolved", event.target.checked)
                        }
                      />
                      <span>
                        <Check size={12} />
                      </span>
                      Issue resolved
                    </label>
                    <button
                      className="secondary-button"
                      type="submit"
                      disabled={isResolving || retainStatus !== undefined}
                    >
                      {isResolving ? (
                        <>
                          <Loader2 size={15} className="spin" />
                          Retaining…
                        </>
                      ) : retainStatus === "connected" ? (
                        <>
                          <Check size={15} />
                          Resolution retained
                        </>
                      ) : retainStatus === "not_configured" ? (
                        "Saved · memory not configured"
                      ) : retainStatus === "unavailable" ? (
                        "Saved · memory unavailable"
                      ) : (
                        <>
                          <Save size={15} />
                          Retain resolution
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
              {retainedLearning && (
                <div className="retained-banner">
                  <div className="retained-icon">
                    <BrainCircuit size={18} />
                  </div>
                  <div>
                    <span className="detail-label">RETAINED IN HINDSIGHT</span>
                    <strong>{retainedLearning}</strong>
                    <p>
                      This is the operational learning that will be available to
                      a future related incident.
                    </p>
                  </div>
                </div>
              )}
              {retainStatus && retainStatus !== "connected" && (
                <div className="retain-status-note">
                  <AlertTriangle size={15} />
                  <span>
                    The resolution was saved, but Hindsight did not retain this
                    learning. It will not influence future recall until the
                    memory service is configured and the resolution is submitted
                    through a live provider.
                  </span>
                </div>
              )}
            </>
          )}
        </section>

        <aside className="right-rail">
          <section className="memory-panel">
            <div className="panel-heading">
              <div>
                <div className="section-kicker">PERSISTENT MEMORY</div>
                <h3>Hindsight recall</h3>
              </div>
              <div className="hindsight-orb">
                <BrainCircuit size={17} />
              </div>
            </div>
            <div
              className={`memory-status ${analysis?.memoryStatus === "connected" ? "is-connected" : analysis?.memoryStatus === "unavailable" ? "is-unavailable" : ""}`}
            >
              <StatusDot
                status={analysis?.memoryStatus ?? serviceStatus.hindsight}
              />
              <span>
                {analysis
                  ? analysis.memoryStatus === "connected"
                    ? `${memories.length} relevant experience${memories.length === 1 ? "" : "s"} found`
                    : statusLabel[analysis.memoryStatus]
                  : "Waiting for an incident"}
              </span>
            </div>
            {analysis?.sourceNote && (
              <p className="memory-note">{analysis.sourceNote}</p>
            )}
            {memories.length > 0 ? (
              <div className="memory-list">
                {memories.map(memory => (
                  <MemoryCard memory={memory} key={memory.id} />
                ))}
              </div>
            ) : (
              <div className="memory-empty">
                <CircleHelp size={17} />
                <p>
                  {analysis
                    ? analysis.memoryStatus === "unavailable" ||
                      analysis.memoryStatus === "not_configured"
                      ? "Memory could not be retrieved. This recommendation did not pretend otherwise."
                      : "No relevant Hindsight experience was found for this incident."
                    : "Actual recalled experience will appear here after analysis."}
                </p>
              </div>
            )}
          </section>
          <ProgressRail
            demoSession={demoSession}
            currentStep={activeProgressStep ?? currentStage}
          />
          <section className="demo-panel">
            <div className="panel-heading">
              <div>
                <div className="section-kicker">JUDGE-READY WALKTHROUGH</div>
                <h3>Run the learning story</h3>
              </div>
              <Gauge size={18} />
            </div>
            <p>
              Use the same backend workflow to make memory visible before and
              after the resolution is retained. Stage buttons add clearly
              labeled synthetic Hindsight experiences; your technician
              resolution is entered and retained separately.
            </p>
            <button
              className="demo-start-button"
              onClick={startDemo}
              disabled={isDemoLoading}
            >
              <RotateCcw size={14} />
              {demoSession ? "Restart from Interaction 1" : "Start Demo Mode"}
            </button>
            {demoSession && (
              <div className="scenario-list">
                {demoSession.scenarios.map(scenario => (
                  <button
                    key={scenario.step}
                    className={`scenario-item ${activeProgressStep === scenario.step ? "is-active" : ""}`}
                    onClick={() =>
                      scenario.step === 1
                        ? applyScenario(scenario)
                        : void loadDemoStage(scenario.step as 5 | 10 | 20)
                    }
                    disabled={isDemoLoading}
                  >
                    <span className="scenario-number">{scenario.step}</span>
                    <span>
                      <strong>
                        {scenario.label.replace(/^Interaction \d+ · /, "")}
                      </strong>
                      <small>{scenario.helper}</small>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            )}
          </section>
          <section className="history-panel">
            <button
              className="history-toggle"
              onClick={() => {
                setOpenHistory(value => !value);
                if (!equipmentHistory) void loadEquipment(incident.equipmentId);
              }}
            >
              <span>
                <History size={16} /> Equipment history{" "}
                <small>{incident.equipmentId}</small>
              </span>
              {openHistory ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
            {openHistory && (
              <div className="history-content">
                {equipmentHistory ? (
                  <>
                    {equipmentHistory.incidents.length === 0 ? (
                      <p className="muted-copy">
                        No structured incidents have been recorded for{" "}
                        {incident.equipmentId} yet.
                      </p>
                    ) : (
                      equipmentHistory.incidents.slice(0, 4).map(item => (
                        <div className="history-item" key={item.id}>
                          <span
                            className={`history-status ${item.status === "resolved" ? "is-resolved" : ""}`}
                          />{" "}
                          <div>
                            <strong>{item.reportedIssue}</strong>
                            <small>
                              {formatDate(item.createdAt)} · {item.status}
                            </small>
                          </div>
                        </div>
                      ))
                    )}
                  </>
                ) : (
                  <Loader2 size={16} className="spin" />
                )}
              </div>
            )}
          </section>
        </aside>
      </main>
      <footer className="app-footer">
        <span>FIELDMIND / OPERATIONAL MEMORY</span>
        <span>
          Structured records in MongoDB · operational experience in Hindsight ·
          reasoning in Groq
        </span>
      </footer>
    </div>
  );
}

export default App;
