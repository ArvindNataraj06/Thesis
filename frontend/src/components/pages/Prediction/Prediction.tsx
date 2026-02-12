import { ReactNode, useMemo, useState } from "react";
import { PredictResponse, TrafficApi } from "../../../api/trafficApi";
import Container from "../../layout/Container";
import "./Prediction.css";

type SeverityUI = "Low" | "Med" | "High" | "Critical";

const EVENT_TYPES = ["ACCIDENT", "CONSTRUCTION", "ROAD_HAZARD", "CONGESTION", "OTHER"];
const EVENT_SUBTYPES = ["ACCIDENT", "LANE_CLOSURE", "ROAD_WORKS", "BROKEN_VEHICLE", "OTHER"];

function mapSeverity(ui: SeverityUI): string {
  if (ui === "Low") return "LOW";
  if (ui === "Med") return "MEDIUM";
  if (ui === "High") return "HIGH";
  return "CRITICAL";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function Prediction() {
  const [eventType, setEventType] = useState<string>("");
  const [eventSubtype, setEventSubtype] = useState<string>("");
  const [severityUI, setSeverityUI] = useState<SeverityUI>("Med");
  const [laneImpactCount, setLaneImpactCount] = useState<number>(2);
  const [timeOfDay, setTimeOfDay] = useState<string>("08:30");
  const [isWeekend, setIsWeekend] = useState<boolean>(false);
  const [isNight, setIsNight] = useState<boolean>(false);
  const [plannedDurationHours, setPlannedDurationHours] = useState<number>(2);
  const [modelChoice, setModelChoice] = useState<"both" | "catboost" | "rf">("both");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResponse | null>(null);

  const createdHour = useMemo(() => {
    const h = parseInt(timeOfDay.split(":")[0] || "0", 10);
    return clamp(isNaN(h) ? 0 : h, 0, 23);
  }, [timeOfDay]);

  const laneImpactBinary = useMemo(() => (laneImpactCount >= 1 ? 1 : 0), [laneImpactCount]);
  const canRun = useMemo(() => !!eventType && !!eventSubtype, [eventType, eventSubtype]);

  const catPred = result?.catboost?.predicted_lane_state || null;
  const rfPred = result?.rf?.predicted_lane_state || null;
  const probs = result?.catboost?.probabilities || {};

  const topConfidence = useMemo(() => {
    if (!catPred) return 0;
    const p = probs[catPred];
    return typeof p === "number" ? p : 0;
  }, [catPred, probs]);

  const confidencePct = Math.round(topConfidence * 100);
  const confidenceBucket = Math.floor(clamp(confidencePct, 0, 99) / 10) * 10;

  const orderedProbs = useMemo(() => {
    const entries = Object.entries(probs);
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

  const reset = () => {
    setEventType("");
    setEventSubtype("");
    setSeverityUI("Med");
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
        severity: mapSeverity(severityUI),
        lane_impact_binary: laneImpactBinary,
        created_hour: createdHour,
        is_weekend: isWeekend ? 1 : 0,
        is_night: isNight ? 1 : 0,
        planned_duration_hours: Number(plannedDurationHours),
      };

      const data = await TrafficApi.predict(payload);
      setResult(data);
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
              <select className="input" value={eventType} onChange={(e) => setEventType(e.target.value)}>
                <option value="">Select incident type</option>
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Event Subtype">
              <select className="input" value={eventSubtype} onChange={(e) => setEventSubtype(e.target.value)}>
                <option value="">Select subtype</option>
                {EVENT_SUBTYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Severity">
              <div className="segmented segmented--four">
                {(["Low", "Med", "High", "Critical"] as SeverityUI[]).map((s) => (
                  <button
                    key={s}
                    className={severityUI === s ? "segBtn active" : "segBtn"}
                    onClick={() => setSeverityUI(s)}
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
              <div className="explainTitle">Model Explanation</div>
              <ul className="explainList">
                {explanationBullets.map((b, idx) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
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
