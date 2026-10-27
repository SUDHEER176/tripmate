// OpenStreetMap fallback, used when no Google Maps API key is configured.
import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { Activity } from "@/lib/types";

function numberedPin(label: string, home = false, active = false) {
  const width = home ? 32 : active ? 34 : 28;
  const height = Math.round(width * (36 / 28));
  const variant = home ? " trip-pin-marker--home" : active ? " trip-pin-marker--active" : "";
  const fill = home ? "#ffffff" : "#0a0a0a";
  const stroke = home ? "#0a0a0a" : "#ffffff";
  const textColor = home ? "#0a0a0a" : "#ffffff";

  const svg = `<svg class="trip-pin-marker${variant}" width="${width}" height="${height}" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 36C14 36 27 21 27 13.5C27 6.04416 21.1797 0 14 0C6.8203 0 1 6.04416 1 13.5C1 21 14 36 14 36Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
    <text x="14" y="14" fill="${textColor}" font-size="12" font-family="system-ui, -apple-system, sans-serif" font-weight="700" text-anchor="middle" dominant-baseline="central">${label}</text>
  </svg>`;

  return L.divIcon({
    className: "trip-pin-container",
    html: svg,
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height],
  });
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const key = positions.map((p) => p.join(",")).join("|");

  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions), { padding: [28, 28], maxZoom: 15 });
    } else if (positions.length === 1) {
      map.setView(positions[0], 12);
    }
  }, [map, key]);

  return null;
}

export type TripMapProps = {
  lat: number;
  lng: number;
  destination: string;
  activities: Activity[];
  className?: string;
  /** Highlights the pin for this activity, e.g. while its row is hovered. */
  activeId?: string | null;
  /** Currently selected activity (opens place details card). */
  selectedId?: string | null;
  /** Called when a pointer is clicked. */
  onSelectActivity?: (activity: Activity) => void;
  /** Whether to show connecting route line between stops (default false). */
  showRouteLine?: boolean;
};

export default function LeafletTripMap({
  lat,
  lng,
  destination,
  activities,
  className = "h-[360px]",
  activeId,
  selectedId,
  onSelectActivity,
  showRouteLine = false,
}: TripMapProps) {
  const points = activities.filter((item) => item.lat != null && item.lng != null);
  const route = points.map((item) => [item.lat as number, item.lng as number] as [number, number]);
  const positions: [number, number][] = route.length ? route : [[lat, lng]];

  return (
    <MapContainer center={[lat, lng]} zoom={12} scrollWheelZoom={false} className={`${className} w-full`}>
      {/* Stadia "OSM Bright": a clean, ride-hailing-app style basemap. Works on localhost
          without setup; production domains need a free Stadia Maps account. */}
      <TileLayer
        attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png"
        maxZoom={20}
        className="trip-map-tiles"
      />
      <FitBounds positions={positions} />
      {showRouteLine && route.length > 1 && (
        <Polyline positions={route} pathOptions={{ color: "#0a0a0a", weight: 3, opacity: 0.85, dashArray: "6 6" }} />
      )}
      {!route.length && (
        <Marker position={[lat, lng]} icon={numberedPin("★", true)}>
          <Popup>{destination}</Popup>
        </Marker>
      )}
      {points.map((item, index) => {
        const isSelected = item.id === selectedId || item.id === activeId;
        return (
          <Marker
            key={item.id}
            position={[item.lat as number, item.lng as number]}
            icon={numberedPin(String(index + 1), false, isSelected)}
            zIndexOffset={isSelected ? 1000 : 0}
            eventHandlers={{
              click: () => {
                if (onSelectActivity) {
                  onSelectActivity(item);
                }
              },
            }}
          >
            {!onSelectActivity && (
              <Popup>
                <strong>{item.name}</strong>
                {item.start_time && <div>{item.start_time}</div>}
              </Popup>
            )}
          </Marker>
        );
      })}
    </MapContainer>
  );
}
