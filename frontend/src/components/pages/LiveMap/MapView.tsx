import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Fix default marker icon issue in Vite
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
const MAP_API_KEY = import.meta.env.VITE_MAP_API_KEY;

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

export default function MapView() {
  return (
    <MapContainer
      center={[40.7128, -74.006]} // New York (demo)
      zoom={12}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='© <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Example marker */}
      <Marker position={[40.7128, -74.006]}>
        <Popup>
          Predicted Incident Zone<br />
          Lane impact likely
        </Popup>
      </Marker>
    </MapContainer>
  );
}
