import { useEffect, useMemo, useState } from "react";
import Container from "../../layout/Container";
import MapView from "./MapView";
import "./LiveMap.css";

type IncidentType = "Accidents" | "Construction" | "Heavy Congestion" | "Road Hazards";
type SeverityFilter = "All" | "Critical" | "Major" | "Minor";

export default function LiveMap() {
  const [types, setTypes] = useState<Record<IncidentType, boolean>>({
    Accidents: true,
    Construction: true,
    "Heavy Congestion": false,
    "Road Hazards": false,
  });

  const [severity, setSeverity] = useState<SeverityFilter>("All");
  const [horizon, setHorizon] = useState<number>(60);
  const [search, setSearch] = useState<string>("");

  const [events, setEvents] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const selectedTypesLabel = useMemo(() => {
    const active = Object.entries(types)
      .filter(([, isEnabled]) => isEnabled)
      .map(([name]) => name);
    return active.length ? active.join(", ") : "None";
  }, [types]);

  const activeIncidents = events.length || 42;
  const avgDelay = 8.4;
  const networkHealth = "Stable";

  const dataFreshnessText = useMemo(() => {
    if (!lastUpdated) return "Waiting for first refresh";
    const seconds = Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    return `Data updated ${seconds} seconds ago via Real-time API v4.2`;
  }, [lastUpdated]);

  const toggleType = (type: IncidentType) => {
    setTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const exportCsv = () => {
    if (!events.length) return;

    const header = ["headline", "event_type", "severity", "updated"];
    const rows = events.map((event) => {
      const headline = String(event?.headline || event?.description || "");
      const eventType = String(event?.event_type || event?.type || "");
      const eventSeverity = String(event?.severity || "");
      const updated = String(event?.updated || "");
      return [headline, eventType, eventSeverity, updated];
    });

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "live_traffic_events.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/live-events");
        const data = await res.json();
        setEvents(Array.isArray(data?.events) ? data.events : []);
        setLastUpdated(new Date());
      } catch (err) {
        console.error("Failed to load live events", err);
      }
    };

    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="lmPage">
      <Container size="wide">
        {/* Header row — SAME style pattern as Prediction */}
        <div className="lmHeader">
          <div>
            <h1 className="lmTitle">Live Traffic Network</h1>
            <p className="lmSubtitle">
              Real-time monitoring and incident visualization across the urban network.
            </p>
          </div>

          <div className="lmStatus">
            <span className="lmDot" />
            <div className="lmStatusLabel">MODEL STATUS</div>
            <div className="lmStatusValue">CatBoost</div>
            <div className="lmStatusDivider" />
            <div className="lmStatusAcc">98% Accuracy</div>
          </div>
        </div>

        <div className="lmGrid">
          {/* Left filters card — uses same `.card` concept */}
          <aside className="card lmFilters">
            <div className="lmCardHead">
              <div className="lmCardTitle">Incident Filters</div>
            </div>

            <div className="lmBlock">
              <div className="lmBlockTitle">INCIDENT TYPE</div>

              <label className="lmCheck">
                <input type="checkbox" checked={types.Accidents} onChange={() => toggleType("Accidents")} />
                <span>Accidents</span>
              </label>

              <label className="lmCheck">
                <input type="checkbox" checked={types.Construction} onChange={() => toggleType("Construction")} />
                <span>Construction</span>
              </label>

              <label className="lmCheck">
                <input
                  type="checkbox"
                  checked={types["Heavy Congestion"]}
                  onChange={() => toggleType("Heavy Congestion")}
                />
                <span>Heavy Congestion</span>
              </label>

              <label className="lmCheck">
                <input
                  type="checkbox"
                  checked={types["Road Hazards"]}
                  onChange={() => toggleType("Road Hazards")}
                />
                <span>Road Hazards</span>
              </label>

              <div className="lmHint">
                Selected: <strong>{selectedTypesLabel}</strong>
              </div>
            </div>

            <div className="lmBlock">
              <div className="lmBlockTitle">SEVERITY LEVEL</div>

              <div className="lmSeverityGrid">
                {(["All", "Critical", "Major", "Minor"] as SeverityFilter[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={severity === s ? "lmSegBtn lmSegBtnActive" : "lmSegBtn"}
                    onClick={() => setSeverity(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="lmBlock">
              <div className="lmBlockTitle">PREDICTION HORIZON</div>

              <div className="lmHorizonTop">
                <span>LIVE</span>
                <span>+{horizon} MIN</span>
              </div>

              <input
                className="lmRange"
                type="range"
                min={0}
                max={60}
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
              />

              <div className="lmChip">
                Current view: <span className="lmChipBlue">Real-time</span>
              </div>
            </div>

            <button className="lmExportBtn" type="button" onClick={exportCsv}>
              Export Data (CSV)
            </button>

            <div className="lmInfo">{dataFreshnessText}</div>
          </aside>

          {/* Right map card */}
          <section className="card lmMapCard">
            <div className="lmSearchRow">
              <input
                className="lmSearch"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search intersections..."
              />
            </div>

            <div className="lmMapWrap">
              <MapView events={events} />
            </div>

            <div className="lmStatsBar">
              <div className="lmStat">
                <div className="lmStatLabel">ACTIVE INCIDENTS</div>
                <div className="lmStatValue">{activeIncidents}</div>
              </div>

              <div className="lmStat">
                <div className="lmStatLabel">AVG. DELAY</div>
                <div className="lmStatValue">
                  {avgDelay} <span className="lmStatUnit">min</span>
                </div>
              </div>

              <div className="lmStat">
                <div className="lmStatLabel">NETWORK HEALTH</div>
                <div className="lmStatValue lmStatValueGreen">{networkHealth}</div>
              </div>
            </div>
          </section>
        </div>
      </Container>
    </div>
  );
}
