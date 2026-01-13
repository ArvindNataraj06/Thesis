import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";

const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_API_KEY;

const SF_CENTER: [number, number] = [37.7749, -122.4194];

type Props = {
  events: any[];
};

const constructionIcon = new L.DivIcon({
  className: "",
  html: `
    <div style="
      width:0;height:0;
      border-left:10px solid transparent;
      border-right:10px solid transparent;
      border-bottom:18px solid #f59e0b;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,.35));
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 18],
});

function getLatLon(ev: any): [number, number] | null {
  // ✅ confirmed from your JSON: geography.coordinates = [lon, lat]
  const coords = ev?.geography?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const [lon, lat] = coords;
    if (typeof lat === "number" && typeof lon === "number") return [lat, lon];
  }
  return null;
}

export default function MapView({ events }: Props) {
  return (
    <MapContainer
      center={SF_CENTER}   // ✅ San Francisco
      zoom={11}            // Good city-level zoom
      minZoom={9}
      maxZoom={18}
      style={{ height: "100%", width: "100%" }}
    >
      {/* Base map */}
      <TileLayer
        attribution="© OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* ✅ Traffic flow overlay (green/yellow/red) */}
      <TileLayer
        attribution="© TomTom"
        url={`https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.png?key=${TOMTOM_KEY}`}
        opacity={0.85}
      />

      {/* ✅ 511 Event markers */}
      {Array.isArray(events) &&
        events.map((ev, idx) => {
          const pos = getLatLon(ev);
          if (!pos) return null;

          return (
            <Marker key={ev?.id ?? idx} position={pos} icon={constructionIcon}>
              <Popup maxWidth={420}>
                <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>
                    {ev?.headline || "Traffic Event"}
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <b>Type:</b> {ev?.event_type || "Unknown"}
                  </div>

                  {/* Optional: show first road entry if exists */}
                  {ev?.roads?.[0] && (
                    <div style={{ marginBottom: 6 }}>
                      <b>Road:</b> {ev.roads[0]?.name}{" "}
                      {ev.roads[0]?.direction ? `(${ev.roads[0].direction})` : ""}
                      {ev.roads[0]?.from ? `, from ${ev.roads[0].from}` : ""}
                    </div>
                  )}

                  {ev?.updated && (
                    <div style={{ marginTop: 10, color: "#666" }}>
                      Updated: {ev.updated}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
    </MapContainer>
  );
}
