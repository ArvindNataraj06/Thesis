import React, { useMemo, useState, useEffect } from "react";
import "./LiveMap.css";
import MapView from "./MapView";

type IncidentType = "Accidents" | "Construction" | "Heavy Congestion" | "Road Hazards";

export default function LiveMap() {
  const [types, setTypes] = useState<Record<IncidentType, boolean>>({
    Accidents: true,
    Construction: true,
    "Heavy Congestion": false,
    "Road Hazards": false,
  });

  const [severity, setSeverity] = useState<string>("All Severities");
  const [horizon, setHorizon] = useState<number>(60); // 0..60 minutes
  const [search, setSearch] = useState<string>("");

  // Demo values (replace with live data later)
  const modelEngine = "CatBoost v2.4";
  const accuracy = "98.2%";
  const activeIncidents = 42;
  const avgDelay = 8.4;
  const modelConfidence = "High";

  const selectedTypesLabel = useMemo(() => {
    const active = Object.entries(types)
      .filter(([, v]) => v)
      .map(([k]) => k);
    return active.length ? active.join(", ") : "None";
  }, [types]);

  const toggleType = (t: IncidentType) => {
    setTypes((prev) => ({ ...prev, [t]: !prev[t] }));
  };

    // ✅ FETCH LIVE EVENTS (RUNS ONCE ON PAGE LOAD)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/live-events");
        const data = await res.json();
        console.log("Live events:", data);
      } catch (err) {
        console.error("Failed to load live events", err);
      }
    };

    load();
  }, []);
  
  return (
    <div className="lm">
      {/* Top Header */}
      <header className="lm__topbar">
        <div className="lm__brand">
          <div className="lm__brandLogo">▦</div>
          <div className="lm__brandText">
            <div className="lm__brandTitle">TrafficAI Dashboard</div>
            <div className="lm__brandSub">MASTER’S THESIS PROJECT</div>
          </div>
        </div>

        <nav className="lm__tabs">
          <button className="lm__tab lm__tab--active">Live Map</button>
          <button className="lm__tab">Historical Data</button>
          <button className="lm__tab">Analytics</button>
        </nav>

        <div className="lm__topRight">
          <div className="lm__pill">
            <div className="lm__pillLabel">MODEL ENGINE</div>
            <div className="lm__pillValue">{modelEngine}</div>
          </div>

          <div className="lm__pill lm__pill--blue">
            <div className="lm__pillLabel">ACCURACY</div>
            <div className="lm__pillValue">{accuracy}</div>
          </div>

          <div className="lm__avatar" title="Profile">
            👤
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="lm__body">
        {/* Left Filters */}
        <aside className="lm__left">
          <div className="lm__leftHeader">
            <span className="lm__leftIcon">≡</span>
            <span className="lm__leftTitle">INCIDENT FILTERS</span>
          </div>

          <div className="lm__section">
            <div className="lm__sectionTitle">INCIDENT TYPE</div>

            <label className="lm__checkRow">
              <input
                type="checkbox"
                checked={types.Accidents}
                onChange={() => toggleType("Accidents")}
              />
              <span>Accidents</span>
            </label>

            <label className="lm__checkRow">
              <input
                type="checkbox"
                checked={types.Construction}
                onChange={() => toggleType("Construction")}
              />
              <span>Construction</span>
            </label>

            <label className="lm__checkRow">
              <input
                type="checkbox"
                checked={types["Heavy Congestion"]}
                onChange={() => toggleType("Heavy Congestion")}
              />
              <span>Heavy Congestion</span>
            </label>

            <label className="lm__checkRow">
              <input
                type="checkbox"
                checked={types["Road Hazards"]}
                onChange={() => toggleType("Road Hazards")}
              />
              <span>Road Hazards</span>
            </label>

            <div className="lm__hint">
              Selected: <b>{selectedTypesLabel}</b>
            </div>
          </div>

          <div className="lm__section">
            <div className="lm__sectionTitle">SEVERITY LEVEL</div>
            <div className="lm__selectWrap">
              <select
                className="lm__select"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                <option>All Severities</option>
                <option>Low</option>
                <option>Moderate</option>
                <option>High</option>
                <option>Critical</option>
              </select>
              <span className="lm__selectArrow">▾</span>
            </div>
          </div>

          <div className="lm__section">
            <div className="lm__sectionTitle">PREDICTION HORIZON</div>

            <div className="lm__horizonRow">
              <span className="lm__smallLabel">LIVE</span>
              <span className="lm__smallLabel">+{horizon} MIN</span>
            </div>

            <input
              className="lm__range"
              type="range"
              min={0}
              max={60}
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
            />

            <div className="lm__pillMini">
              Currently showing: <b>Live View</b>
            </div>
          </div>

          <button className="lm__exportBtn">
            ⬇ Export Data (CSV)
          </button>

          <div className="lm__dataNote">
            Data updated 12 seconds ago via Real-time API
          </div>
        </aside>

        {/* Map Area */}
        <section className="lm__mapWrap">
          {/* Search bar overlay */}
          <div className="lm__search">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="lm__searchInput"
              placeholder="Search intersections or corridors..."
            />
          </div>

          {/* Right map controls */}
          <div className="lm__mapControls">
            <button className="lm__ctrlBtn" title="Zoom In">＋</button>
            <button className="lm__ctrlBtn" title="Zoom Out">－</button>
            <button className="lm__ctrlBtn" title="Locate">⌖</button>
          </div>

          {/* Map placeholder */}
          <div className="lm__map">
             <MapView />
          </div>

          {/* Legend card */}
          <div className="lm__legend">
            <div className="lm__legendTitle">TRAFFIC INTENSITY</div>
            <div className="lm__gradient" />
            <div className="lm__legendLabels">
              <span>FLUID</span>
              <span>CONGESTED</span>
            </div>

            <div className="lm__legendDots">
              <div className="lm__dotRow">
                <span className="lm__dot lm__dot--red" />
                <span>Critical Incident</span>
              </div>
              <div className="lm__dotRow">
                <span className="lm__dot lm__dot--blue" />
                <span>Predicted Event</span>
              </div>
            </div>
          </div>

          {/* Bottom stats */}
          <div className="lm__stats">
            <div className="lm__statCard">
              <div className="lm__statLabel">ACTIVE INCIDENTS</div>
              <div className="lm__statValue">{activeIncidents}</div>
            </div>

            <div className="lm__statCard">
              <div className="lm__statLabel">AVG. DELAY</div>
              <div className="lm__statValue">{avgDelay} <span className="lm__unit">min</span></div>
            </div>

            <div className="lm__statCard">
              <div className="lm__statLabel">MODEL CONFIDENCE</div>
              <div className="lm__statValue lm__statValue--green">
                {modelConfidence} <span className="lm__check">✔</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
