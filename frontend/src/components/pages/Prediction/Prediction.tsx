import React, { useMemo, useState } from "react";
import "./Prediction.css";
import { TrafficApi, PredictResponse } from "../../../api/trafficApi";

type SeverityUI = "Low" | "Med" | "High" | "Critical";

const EVENT_TYPES = [
  "ACCIDENT",
  "CONSTRUCTION",
  "ROAD_HAZARD",
  "CONGESTION",
  "OTHER",
];

const EVENT_SUBTYPES = [
  "ACCIDENT",
  "LANE_CLOSURE",
  "ROAD_WORKS",
  "BROKEN_VEHICLE",
  "OTHER",
];

// Map your UI severity to dataset-like values (adjust if your dataset uses different labels)
function mapSeverity(ui: SeverityUI): string {
  // If your dataset has "MINOR/MODERATE/MAJOR", change mapping here.
  if (ui === "Low") return "LOW";
  if (ui === "Med") return "MEDIUM";
  if (ui === "High") return "HIGH";
  return "CRITICAL";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatPercent(x: number) {
  return `${(x * 100).toFixed(1)}%`;
}

export default function Prediction() {
  // ---------- Form State ----------
  const [eventType, setEventType] = useState<string>("");
  const [eventSubtype, setEventSubtype] = useState<string>("");
  const [severityUI, setSeverityUI] = useState<SeverityUI>("Med");

  // In our cleaned dataset we have lane_impact_binary (0/1).
  // UI shows lane impact "count" (0..3). We'll convert:
  // 0 => 0, >=1 => 1.
  const [laneImpactCount, setLaneImpactCount] = useState<number>(2);

  // time input "HH:MM"
  const [timeOfDay, setTimeOfDay] = useState<string>("08:30");
  const [isWeekend, setIsWeekend] = useState<boolean>(false);
  const [isNight, setIsNight] = useState<boolean>(false);

  const [plannedDurationHours, setPlannedDurationHours] = useState<number>(2);

  // model choice
  const [modelChoice, setModelChoice] = useState<"both" | "catboost" | "rf">("both");

  // ---------- Output State ----------
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<PredictResponse | null>(null);

  const createdHour = useMemo(() => {
    // timeOfDay "08:30" -> 8
    const h = parseInt(timeOfDay.split(":")[0] || "0", 10);
    return clamp(isNaN(h) ? 0 : h, 0, 23);
  }, [timeOfDay]);

  const laneImpactBinary = useMemo(() => (laneImpactCount >= 1 ? 1 : 0), [laneImpactCount]);

  const canRun = useMemo(() => {
    return !!eventType && !!eventSubtype;
  }, [eventType, eventSubtype]);

  // ---------- Derived Display ----------
  const catPred = result?.catboost?.predicted_lane_state || null;
  const rfPred = result?.rf?.predicted_lane_state || null;
  const probs = result?.catboost?.probabilities || {};

  const topConfidence = useMemo(() => {
    if (!catPred) return 0;
    const p = probs[catPred];
    return typeof p === "number" ? p : 0;
  }, [catPred, probs]);

  const confidencePct = Math.round(topConfidence * 100);

  const orderedProbs = useMemo(() => {
    const entries = Object.entries(probs);
    entries.sort((a, b) => b[1] - a[1]);
    return entries;
  }, [probs]);

  const explanationBullets = useMemo(() => {
    // simple deterministic explanation for demo (you can replace with SHAP/LLM later)
    const bullets: string[] = [];

    bullets.push(
      `Time of day (${createdHour}:00) influences lane-state probability due to recurring traffic patterns.`
    );

    bullets.push(
      `Lane impact indicates whether lanes are affected (binary=${laneImpactBinary}) which strongly impacts closure likelihood.`
    );

    bullets.push(
      `Planned duration (${plannedDurationHours}h) can shift the prediction towards longer disruptions.`
    );

    return bullets;
  }, [createdHour, laneImpactBinary, plannedDurationHours]);

  // ---------- Actions ----------
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

  // If no prediction yet, show a friendly default card
  const displayLaneState = catPred || "—";
  const displayConfidence = result ? confidencePct : 0;

  return (
    <div className="predPage">
      {/* Header row inside page (separate from global navbar if you want) */}
      <div className="predHeader">
        <div>
          <h1 className="predTitle">Traffic Prediction Interface</h1>
          <p className="predSubtitle">
            Academic Thesis: Multi-modal Deep Learning for Urban Traffic Incidents
          </p>
        </div>

        <div className="predHeaderRight">
          <button className="ghostBtn" onClick={reset}>
            ↻ Reset Form
          </button>
        </div>
      </div>

      {/* Main 2-column grid */}
      <div className="predGrid">
        {/* LEFT: Input Parameters */}
        <section className="card">
          <div className="cardHead">
            <div className="cardIcon">⛭</div>
            <div>
              <div className="cardTitle">Input Parameters</div>
              <div className="cardHint">Fill incident attributes and run prediction</div>
            </div>
          </div>

          <div className="formBlock">
            <label className="label">Event Type</label>
            <div className="selectWrap">
              <select
                className="select"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              >
                <option value="">Select incident type</option>
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span className="selectArrow">▾</span>
            </div>
          </div>

          <div className="formBlock">
            <label className="label">Event Subtype</label>
            <div className="selectWrap">
              <select
                className="select"
                value={eventSubtype}
                onChange={(e) => setEventSubtype(e.target.value)}
              >
                <option value="">Select subtype</option>
                {EVENT_SUBTYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span className="selectArrow">▾</span>
            </div>
          </div>

          <div className="formBlock">
            <label className="label">Severity Level</label>
            <div className="segmented">
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
          </div>

          <div className="formBlock">
            <label className="label">Lane Impact (Count)</label>
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
            <div className="smallNote">
              Converted to <b>lane_impact_binary</b>: {laneImpactBinary}
            </div>
          </div>

          <div className="formBlock">
            <label className="label">Time of Day</label>
            <div className="timeRow">
              <input
                className="timeInput"
                type="time"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
              />
              <span className="timeIcon">🕒</span>
            </div>
            <div className="toggles">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={isWeekend}
                  onChange={(e) => setIsWeekend(e.target.checked)}
                />
                <span>Weekend</span>
              </label>

              <label className="toggle">
                <input
                  type="checkbox"
                  checked={isNight}
                  onChange={(e) => setIsNight(e.target.checked)}
                />
                <span>Night</span>
              </label>
            </div>
          </div>

          <div className="formBlock">
            <label className="label">Planned Duration (hours)</label>
            <input
              className="textInput"
              type="number"
              min={0}
              step={0.5}
              value={plannedDurationHours}
              onChange={(e) => setPlannedDurationHours(Number(e.target.value))}
            />
          </div>

          <div className="formBlock">
            <label className="label">Model</label>
            <div className="segmented">
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
          </div>

          <button
            className="primaryBtn"
            onClick={runPrediction}
            disabled={!canRun || loading}
          >
            ⚡ {loading ? "Running..." : "Run Prediction Model"}
          </button>

          {error && <div className="errorBox">⚠ {error}</div>}
        </section>

        {/* RIGHT: Model Output */}
        <section className="card">
          <div className="outputTop">
            <div>
              <div className="outputLabel">MODEL OUTPUT</div>
              <div className="outputTitle">Predicted Lane State</div>
            </div>

            <div className="ringWrap">
              <ConfidenceRing value={displayConfidence} />
              <div className="ringCaption">Confidence Score</div>
            </div>
          </div>

          <div className="alertCard">
            <div className="alertIcon">⚠</div>
            <div>
              <div className="alertTitle">
                {result ? displayLaneState : "Waiting for prediction"}
              </div>
              <div className="alertSub">
                {result
                  ? `Highest probability class with ${confidencePct}% confidence.`
                  : "Run the model to view lane-state output and probability distribution."}
              </div>
            </div>
          </div>

          <div className="probSection">
            <div className="probTitle">CLASS PROBABILITIES</div>

            {result && orderedProbs.length > 0 ? (
              orderedProbs.slice(0, 6).map(([label, val]) => (
                <ProbabilityBar key={label} label={label} value={val} />
              ))
            ) : (
              <div className="emptyProbs">No probabilities yet.</div>
            )}
          </div>

          <div className="explainCard">
            <div className="explainHead">
              <span className="infoIcon">i</span>
              <span className="explainTitle">Model Explanation</span>
            </div>

            <ul className="explainList">
              {explanationBullets.map((b, idx) => (
                <li key={idx}>{b}</li>
              ))}
            </ul>

            <div className="explainNote">
              (This explanation is rule-based for demo. You can replace with SHAP/LLM later.)
            </div>
          </div>

          <div className="segmentCard">
            <div className="segmentBadge">SELECTED SEGMENT</div>
            <div className="segmentTitle">I-95 Northbound - Segment 402</div>
          </div>

          {/* Model comparison quick info */}
          <div className="compareRow">
            <div className="compareItem">
              <div className="compareLabel">CatBoost</div>
              <div className="compareValue">{catPred ?? "—"}</div>
            </div>
            <div className="compareItem">
              <div className="compareLabel">Random Forest</div>
              <div className="compareValue">{rfPred ?? "—"}</div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer hint line like in screenshot */}
      <div className="predFooterLine">
        © 2024 Academic Master’s Thesis • Department of Urban Engineering
      </div>
    </div>
  );
}

/* ---------- UI Components ---------- */

function ProbabilityBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 1000) / 10; // one decimal
  return (
    <div className="probRow">
      <div className="probTop">
        <span className="probLabel">{label}</span>
        <span className="probPct">{pct.toFixed(1)}%</span>
      </div>
      <div className="probBg">
        <div className="probFill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ConfidenceRing({ value }: { value: number }) {
  // value is 0..100
  const v = clamp(value, 0, 100);
  const dash = 2 * Math.PI * 34; // circumference if r=34
  const offset = dash - (dash * v) / 100;

  return (
    <div className="ring">
      <svg width="90" height="90" viewBox="0 0 90 90">
        <circle className="ringBg" cx="45" cy="45" r="34" />
        <circle
          className="ringFg"
          cx="45"
          cy="45"
          r="34"
          style={{
            strokeDasharray: `${dash}px`,
            strokeDashoffset: `${offset}px`,
          }}
        />
      </svg>
      <div className="ringText">{v}%</div>
    </div>
  );
}
