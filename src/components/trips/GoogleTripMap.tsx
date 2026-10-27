import { useEffect, useState } from "react";
import { AdvancedMarker, APIProvider, InfoWindow, Map, useMap } from "@vis.gl/react-google-maps";
import type { TripMapProps } from "./LeafletTripMap";

type LatLng = google.maps.LatLngLiteral;

// Advanced markers need a Map ID; Google's demo id works for development.
const MAP_ID = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "").trim() || "DEMO_MAP_ID";

function FitBounds({ positions }: { positions: LatLng[] }) {
  const map = useMap();
  const key = positions.map((p) => `${p.lat},${p.lng}`).join("|");

  useEffect(() => {
    if (!map) return;
    if (positions.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      positions.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, 28);
      // Keep a tight cluster of stops from zooming in to street level.
      const listener = google.maps.event.addListenerOnce(map, "idle", () => {
        if ((map.getZoom() ?? 0) > 15) map.setZoom(15);
      });
      return () => listener.remove();
    }
    if (positions.length === 1) {
      map.setCenter(positions[0]);
      map.setZoom(12);
    }
  }, [map, key]);

  return null;
}

/** Dashed line through the day's stops, in visit order. */
function RouteLine({ path }: { path: LatLng[] }) {
  const map = useMap();
  const key = path.map((p) => `${p.lat},${p.lng}`).join("|");

  useEffect(() => {
    if (!map || path.length < 2) return;
    const line = new google.maps.Polyline({
      map,
      path,
      strokeOpacity: 0,
      icons: [
        {
          icon: { path: "M 0,-1 0,1", strokeColor: "#0a0a0a", strokeOpacity: 0.85, strokeWeight: 3, scale: 3 },
          offset: "0",
          repeat: "12px",
        },
      ],
    });
    return () => line.setMap(null);
  }, [map, key]);

  return null;
}

function Pin({ label, home = false, active = false }: { label: string; home?: boolean; active?: boolean }) {
  const width = home ? 32 : active ? 34 : 28;
  const height = Math.round(width * (36 / 28));
  const variant = home ? " trip-pin-marker--home" : active ? " trip-pin-marker--active" : "";
  const fill = home ? "#ffffff" : "#0a0a0a";
  const stroke = home ? "#0a0a0a" : "#ffffff";
  const textColor = home ? "#0a0a0a" : "#ffffff";

  return (
    <div style={{ width, height }}>
      <svg
        className={`trip-pin-marker${variant}`}
        width={width}
        height={height}
        viewBox="0 0 28 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M14 36C14 36 27 21 27 13.5C27 6.04416 21.1797 0 14 0C6.8203 0 1 6.04416 1 13.5C1 21 14 36 14 36Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="2"
        />
        <text
          x="14"
          y="14"
          fill={textColor}
          fontSize="12"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="700"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {label}
        </text>
      </svg>
    </div>
  );
}

export default function GoogleTripMap({
  apiKey,
  lat,
  lng,
  destination,
  activities,
  className = "h-[360px]",
  activeId,
  selectedId,
  onSelectActivity,
  showRouteLine = false,
}: TripMapProps & { apiKey: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const points = activities.filter((item) => item.lat != null && item.lng != null);
  const route: LatLng[] = points.map((item) => ({ lat: item.lat as number, lng: item.lng as number }));
  const positions = route.length ? route : [{ lat, lng }];
  const open = points.find((item) => item.id === openId);

  return (
    <APIProvider apiKey={apiKey}>
      <div className={`trip-map ${className} w-full overflow-hidden rounded-2xl`}>
        <Map
          mapId={MAP_ID}
          defaultCenter={{ lat, lng }}
          defaultZoom={12}
          gestureHandling="cooperative"
          disableDefaultUI
          zoomControl
          fullscreenControl
          clickableIcons={false}
          style={{ width: "100%", height: "100%" }}
        >
          <FitBounds positions={positions} />
          {showRouteLine && <RouteLine path={route} />}

          {!route.length && (
            <AdvancedMarker position={{ lat, lng }} title={destination}>
              <Pin label="★" home />
            </AdvancedMarker>
          )}

          {points.map((item, index) => {
            const isSelected = item.id === activeId || item.id === selectedId;
            return (
              <AdvancedMarker
                key={item.id}
                position={{ lat: item.lat as number, lng: item.lng as number }}
                title={item.name}
                zIndex={isSelected ? 1000 : index}
                onClick={() => {
                  setOpenId(item.id);
                  if (onSelectActivity) {
                    onSelectActivity(item);
                  }
                }}
              >
                <Pin label={String(index + 1)} active={isSelected} />
              </AdvancedMarker>
            );
          })}

          {!onSelectActivity && open && (
            <InfoWindow
              position={{ lat: open.lat as number, lng: open.lng as number }}
              pixelOffset={[0, -32]}
              headerDisabled
              onCloseClick={() => setOpenId(null)}
            >
              <div className="text-sm">
                <strong>{open.name}</strong>
                {open.start_time && <div className="text-neutral-500">{open.start_time}</div>}
              </div>
            </InfoWindow>
          )}
        </Map>
      </div>
    </APIProvider>
  );
}
