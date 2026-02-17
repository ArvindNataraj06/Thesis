import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap
} from "react-leaflet";
import { useEffect } from "react";

type Props = {
  events: any[];
};

function getLatLon(ev: any): [number, number] | null {
  const coords = ev?.geography?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const [lon, lat] = coords;
    if (typeof lat === "number" && typeof lon === "number")
      return [lat, lon];
  }
  return null;
}

/* Auto-fit map to all markers */
function FitBounds({ events }: { events: any[] }) {
  const map = useMap();

  useEffect(() => {
    const positions = events
      .map(getLatLon)
      .filter(Boolean) as [number, number][];

    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [events, map]);

  return null;
}

/* Marker color logic */
function markerColor(ev: any) {
  const type = (ev?.event_type || "").toUpperCase();
  const sev = (ev?.severity || "").toUpperCase();

  if (type === "INCIDENT") {
    if (sev === "MAJOR") return "#dc2626";      // red
    if (sev === "MODERATE") return "#f59e0b";   // orange
    return "#f97316";                           // amber
  }

  if (type === "CONSTRUCTION") return "#2563eb"; // blue

  return "#6b7280"; // fallback gray
}

/* Marker style */
function markerIcon(color: string) {
  return new L.DivIcon({
    className: "",
    html: `
      <div style="
        width:14px;
        height:14px;
        background:${color};
        border-radius:50%;
        border:2px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,0.4);
      "></div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
}

export default function MapView({ events }: Props) {
  return (
    <MapContainer
      center={[37.7749, -122.4194]}   // initial only
      zoom={9}
      minZoom={3}
      maxZoom={18}
      style={{ height: "100%", width: "100%" }}
    >
      {/* Colorful free basemap */}
      <TileLayer
        attribution='&copy; OpenStreetMap contributors &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />

      <FitBounds events={events} />

      {Array.isArray(events) &&
        events.map((ev, idx) => {
          const pos = getLatLon(ev);
          if (!pos) return null;

          const icon = markerIcon(markerColor(ev));
          const road = ev?.roads?.[0];

          return (
            <Marker key={ev?.id ?? idx} position={pos} icon={icon}>
              <Popup maxWidth={520}>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>
                    {ev?.headline}
                  </div>

                  <div><b>Status:</b> {ev?.status}</div>
                  <div><b>Type:</b> {ev?.event_type}</div>
                  <div><b>Severity:</b> {ev?.severity}</div>

                  {Array.isArray(ev?.event_subtypes) && (
                    <div>
                      <b>Subtypes:</b> {ev.event_subtypes.join(", ")}
                    </div>
                  )}

                  {road && (
                    <>
                      <hr />
                      <div><b>Road:</b> {road?.name}</div>
                      <div><b>Direction:</b> {road?.direction}</div>
                      <div><b>Lane State:</b> {road?.state}</div>
                      <div><b>Lane Type:</b> {road?.["+lane_type"]}</div>
                      <div><b>Lane Status:</b> {road?.["+lane_status"]}</div>
                      <div><b>Advisory:</b> {road?.["+road_advisory"]}</div>
                    </>
                  )}

                  {ev?.schedule?.intervals?.[0] && (
                    <div>
                      <b>Schedule:</b> {ev.schedule.intervals[0]}
                    </div>
                  )}

                  <div style={{ marginTop: 8, fontSize: 11, color: "#666" }}>
                    Updated: {ev?.updated}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
    </MapContainer>
  );
}
