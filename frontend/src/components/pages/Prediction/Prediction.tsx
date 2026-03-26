import { ReactNode, useMemo, useState, useEffect, useCallback } from "react";
import { PredictResponse, TrafficApi } from "../../../api/trafficApi";
import Container from "../../layout/Container";
import "./Prediction.css";

/**
 * IMPORTANT:
 * Your model was trained on dataset labels like:
 * event_type: "INCIDENT" | "CONSTRUCTION"
 * event_subtype: "Traffic Collision", "Roadwork", "Long-term construction", ...
 * severity: "Unknown" | "Minor" | "Moderate" | "Major" | "Severe"
 *
 * So UI options must match these exact strings.
 */

type EventType = "" | "INCIDENT" | "CONSTRUCTION";
type SeverityLabel = "Unknown" | "Minor" | "Moderate" | "Major" | "Severe";

type PredictionHistoryItem = {
  id?: string;
  timestamp: string;
  selected_model: string;
  features_used: {
    event_type: string;
    event_subtype: string;
    severity: string;
    lane_impact_binary: number;
    created_hour: number;
    is_weekend: number;
    is_night: number;
    planned_duration_hours: number;
  };
  prediction?: string;
  catboost?: {
    predicted_lane_state?: string;
    probabilities?: Record<string, number>;
  };
  rf?: {
    predicted_lane_state?: string;
    probabilities?: Record<string, number>;
  };
  llm_explanation?: {
    explanation_paragraph?: string;
    risk_level?: string;
    _latency_ms?: number;
  };
  llm_latency_ms?: number;
};

const EVENT_TYPES: EventType[] = ["INCIDENT", "CONSTRUCTION"];

const SUBTYPES_BY_TYPE: Record<Exclude<EventType, "">, string[]> = {
  CONSTRUCTION: ["Roadwork", "Long-term construction", "Emergency construction", "Bridge work"],
  INCIDENT: ["Traffic Collision", "Traffic Collision with Injuries", "Disabled vehicle", "Traffic Hazard"],
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function Prediction() {
  const [eventType, setEventType] = useState<EventType>("");
  const [eventSubtype, setEventSubtype] = useState<string>("");

  // Use dataset severity labels directly (no mapping needed)
  const [severity, setSeverity] = useState<SeverityLabel>("Moderate");

  const [laneImpactCount, setLaneImpactCount] = useState<number>(2);
  const [timeOfDay, setTimeOfDay] = useState<string>("08:30");
  const [isWeekend, setIsWeekend] = useState<boolean>(false);
  const [isNight, setIsNight] = useState<boolean>(false);
  const [plannedDurationHours, setPlannedDurationHours] = useState<number>(2);

  const [modelChoice, setModelChoice] = useState<"both" | "catboost" | "rf">("both");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResponse | null>(null);

  const [history, setHistory] = useState<PredictionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const createdHour = useMemo(() => {
    const h = parseInt(timeOfDay.split(":")[0] || "0", 10);
    return clamp(isNaN(h) ? 0 : h, 0, 23);
  }, [timeOfDay]);

  const laneImpactBinary = useMemo(() => (laneImpactCount >= 1 ? 1 : 0), [laneImpactCount]);

  const subtypeOptions = useMemo(() => {
    if (!eventType) return [];
    return SUBTYPES_BY_TYPE[eventType] || [];
  }, [eventType]);

  // When event type changes, reset subtype (prevents invalid unseen categories)
  useEffect(() => {
    setEventSubtype("");
  }, [eventType]);

  // Optional: helpful defaults for duration when choosing subtype (UX stays same)
  useEffect(() => {
    if (!eventSubtype) return;

    if (eventSubtype === "Long-term construction") {
      setPlannedDurationHours((prev) => (prev < 48 ? 500 : prev));
    } else if (eventSubtype === "Emergency construction") {
      setPlannedDurationHours((prev) => (prev > 72 ? 12 : prev));
    } else if (eventSubtype === "Roadwork") {
      setPlannedDurationHours((prev) => (prev > 200 ? 24 : prev));
    } else if (eventSubtype === "Bridge work") {
      setPlannedDurationHours((prev) => (prev > 200 ? 72 : prev));
    }
  }, [eventSubtype]);

  const canRun = useMemo(() => !!eventType && !!eventSubtype, [eventType, eventSubtype]);

  const catPred = result?.catboost?.predicted_lane_state || null;
  const rfPred = result?.rf?.predicted_lane_state || null;
  const probs = result?.catboost?.probabilities || {};

  // LLM display
  const llm = result?.llm_explanation ?? (result as any)?.llm;
  const risk = (llm?.risk_level || "").toUpperCase();
  const explanation = llm?.explanation_paragraph || "";
  const llmLatency = result?.llm_latency_ms ?? llm?._latency_ms ?? null;
  const riskLabel = risk === "LOW" || risk === "MEDIUM" || risk === "HIGH" ? risk : "UNKNOWN";

  const topConfidence = useMemo(() => {
    if (!catPred) return 0;
    const p = (probs as any)[catPred];
    return typeof p === "number" ? p : 0;
  }, [catPred, probs]);

  const confidencePct = Math.round(topConfidence * 100);
  const confidenceBucket = Math.floor(clamp(confidencePct, 0, 99) / 10) * 10;

  const orderedProbs = useMemo(() => {
    const entries = Object.entries(probs as Record<string, number>);
    entries.sort((a, b) => b[1] - a[1]);
    return entries;
  }, [probs]);

  const explanationBullets = useMemo(() => {
    return [
      `Time (${createdHour}:00) shifts likely lane-state outcomes according to historical traffic patterns.`,
      `Lane impact binary (${laneImpactBinary}) strongly indicates closure probability.`,
      `Planned duration (${plannedDurationHours}h) increases risk of longer-lasting restrictions.`,
    ];
  }, [createdHour, laneImpactBinary, plannedDurationHours]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const res = await fetch("http://127.0.0.1:8000/history");
      if (!res.ok) {
        throw new Error("Failed to load prediction history");
      }

      const data = await res.json();
      setHistory(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setHistoryError(e?.message || "Could not load prediction history.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const deleteHistoryItem = async (id?: string) => {
  if (!id) {
    alert("This history item was created before IDs were added, so it cannot be deleted individually.");
    return;
  }

  try {
    const res = await fetch(`http://127.0.0.1:8000/history/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      throw new Error("Failed to delete history item");
    }

    await loadHistory();
  } catch (e: any) {
    alert(e?.message || "Could not delete history item.");
  }
};

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const reset = () => {
    setEventType("");
    setEventSubtype("");
    setSeverity("Moderate");
    setLaneImpactCount(2);
    setTimeOfDay("08:30");
    setIsWeekend(false);
    setIsNight(false);
    setPlannedDurationHours(2);
    setModelChoice("both");
    setResult(null);
    setError(null);
  };

  const runPrediction = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        model: modelChoice,
        event_type: eventType,
        event_subtype: eventSubtype,
        severity: severity,
        lane_impact_binary: laneImpactBinary,
        created_hour: createdHour,
        is_weekend: isWeekend ? 1 : 0,
        is_night: isNight ? 1 : 0,
        planned_duration_hours: Number(plannedDurationHours),
      };

      const data = await TrafficApi.predict(payload);
      setResult(data);
      await loadHistory();
      console.log("PREDICT RESPONSE:", data);
    } catch (e: any) {
      setError(e?.message || "Prediction failed. Check backend / CORS / payload.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="predPage">
      <Container size="wide">
        <div className="predHeader">
          <div>
            <h1 className="predTitle">Traffic Prediction Interface</h1>
            <p className="predSubtitle">Predict lane state using structured traffic event attributes.</p>
          </div>
          <button className="ghostBtn" onClick={reset}>
            Reset Form
          </button>
        </div>

        <div className="predGrid">
          <section className="card">
            <div className="cardHead">
              <div className="cardTitle">Input Parameters</div>
              <div className="cardHint">Fill required fields, then run the model.</div>
            </div>

            <Field label="Event Type">
              <select
                className="input"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
              >
                <option value="">Select incident type</option>
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Event Subtype">
              <select
                className="input"
                value={eventSubtype}
                onChange={(e) => setEventSubtype(e.target.value)}
                disabled={!eventType}
              >
                <option value="">{eventType ? "Select subtype" : "Select Event Type first"}</option>
                {subtypeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Severity">
              <div className="segmented segmented--four">
                {(["Unknown", "Minor", "Moderate", "Severe"] as const).map((s) => (
                  <button
                    key={s}
                    className={severity === s ? "segBtn active" : "segBtn"}
                    onClick={() => setSeverity(s)}
                    type="button"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Lane Impact (count)">
              <div className="rangeRow">
                <input
                  className="range"
                  type="range"
                  min={0}
                  max={3}
                  value={laneImpactCount}
                  onChange={(e) => setLaneImpactCount(Number(e.target.value))}
                />
                <div className="rangeValue">{laneImpactCount}</div>
              </div>
            </Field>

            <Field label="Time of Day">
              <input className="input" type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} />
              <div className="toggles">
                <label className="toggle">
                  <input type="checkbox" checked={isWeekend} onChange={(e) => setIsWeekend(e.target.checked)} />
                  <span>Weekend</span>
                </label>
                <label className="toggle">
                  <input type="checkbox" checked={isNight} onChange={(e) => setIsNight(e.target.checked)} />
                  <span>Night</span>
                </label>
              </div>
            </Field>

            <Field label="Planned Duration (hours)">
              <input
                className="input"
                type="number"
                min={0}
                step={0.5}
                value={plannedDurationHours}
                onChange={(e) => setPlannedDurationHours(Number(e.target.value))}
              />
            </Field>

            <Field label="Model">
              <div className="segmented segmented--three">
                {(["both", "catboost", "rf"] as const).map((m) => (
                  <button
                    key={m}
                    className={modelChoice === m ? "segBtn active" : "segBtn"}
                    onClick={() => setModelChoice(m)}
                    type="button"
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </Field>

            <button className="primaryBtn" onClick={runPrediction} disabled={!canRun || loading}>
              {loading ? "Running..." : "Run Prediction Model"}
            </button>

            {error && <div className="errorBox">{error}</div>}
          </section>

          <section className="card">
            <div className="outputTop">
              <div>
                <div className="outputLabel">MODEL OUTPUT</div>
                <div className="outputTitle">{catPred || "Waiting for prediction"}</div>
              </div>

              <div className="confidenceRingWrap">
                <div className={`confidenceRing confidenceRing--${confidenceBucket}`}>
                  <span>{result ? `${confidencePct}%` : "0%"}</span>
                </div>
                <div className="confidenceLabel">Confidence</div>
              </div>
            </div>

            <div className="probSection">
              <div className="probTitle">Class Probabilities</div>
              {result && orderedProbs.length > 0 ? (
                orderedProbs.map(([label, val]) => (
                  <ProbabilityBar key={label} label={label} value={Math.round(val * 100)} />
                ))
              ) : (
                <div className="emptyProbs">Run prediction to view probabilities.</div>
              )}
            </div>

            <div className="compareRow">
              <div className="compareItem">
                <div className="compareLabel">CatBoost</div>
                <div className="compareValue">{catPred ?? "-"}</div>
              </div>
              <div className="compareItem">
                <div className="compareLabel">Random Forest</div>
                <div className="compareValue">{rfPred ?? "-"}</div>
              </div>
            </div>

            <div className="explainCard">
              <div className="explainHead">
                <div className="explainTitle">LLM Guidance</div>

                {result ? (
                  <div className={`riskBadge riskBadge--${riskLabel.toLowerCase()}`}>
                    Risk: {riskLabel}
                    {typeof llmLatency === "number" ? <span className="riskLatency">• {llmLatency} ms</span> : null}
                  </div>
                ) : null}
              </div>

              {result ? (
                explanation ? (
                  <p className="llmParagraph">{explanation}</p>
                ) : (
                  <div className="llmEmpty">No LLM explanation returned.</div>
                )
              ) : (
                <div className="llmEmpty">Run prediction to see LLM guidance.</div>
              )}

              <div className="explainDivider" />

              <div className="explainTitle">Why the ML model predicted this</div>
              <ul className="explainList">
                {explanationBullets.map((b, idx) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <section className="card" style={{ marginTop: "24px" }}>
          <div className="cardHead">
            <div className="cardTitle">Prediction History</div>

          </div>

          {historyLoading ? (
            <div className="emptyProbs">Loading history...</div>
          ) : historyError ? (
            <div className="errorBox">{historyError}</div>
          ) : history.length === 0 ? (
            <div className="emptyProbs">No prediction history found yet.</div>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              {[...history].reverse().map((item, index) => (
                <div
                  key={`${item.timestamp}-${index}`}
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "16px",
                    padding: "16px",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "10px",
    alignItems: "center",
  }}
>
  <strong>{item.prediction || "No prediction"}</strong>

  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
    <span style={{ opacity: 0.8, fontSize: "14px" }}>
      {new Date(item.timestamp).toLocaleString()}
    </span>

    <button
      type="button"
      onClick={() => deleteHistoryItem(item.id)}
      style={{
        border: "none",
        borderRadius: "8px",
        padding: "6px 10px",
        cursor: "pointer",
        fontWeight: 600,
      }}
    >
      Delete
    </button>
  </div>
</div>
                  

                  <div style={{ display: "grid", gap: "6px", marginBottom: "10px" }}>
                    <div><strong>Model:</strong> {item.selected_model}</div>
                    <div><strong>Event Type:</strong> {item.features_used?.event_type}</div>
                    <div><strong>Subtype:</strong> {item.features_used?.event_subtype}</div>
                    <div><strong>Severity:</strong> {item.features_used?.severity}</div>
                    <div><strong>Risk:</strong> {item.llm_explanation?.risk_level || "UNKNOWN"}</div>
                  </div>

                  <div style={{ marginBottom: "10px" }}>
                    <strong>LLM Explanation:</strong>
                    <div style={{ marginTop: "6px", opacity: 0.9 }}>
                      {item.llm_explanation?.explanation_paragraph || "No explanation available."}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <strong>CatBoost:</strong> {item.catboost?.predicted_lane_state || "-"}
                    </div>
                    <div>
                      <strong>Random Forest:</strong> {item.rf?.predicted_lane_state || "-"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </Container>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="formBlock">
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function ProbabilityBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="probRow">
      <div className="probTop">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <progress className="probProgress" value={value} max={100} />
    </div>
  );
}