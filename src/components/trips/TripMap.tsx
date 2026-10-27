import { useState } from "react";
import GoogleTripMap from "./GoogleTripMap";
import LeafletTripMap, { type TripMapProps } from "./LeafletTripMap";
import PlaceDetailsCard from "./PlaceDetailsCard";
import type { Activity } from "@/lib/types";

const GOOGLE_MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();

/** Google Maps when VITE_GOOGLE_MAPS_API_KEY is set, otherwise the OpenStreetMap fallback. */
export default function TripMap(props: TripMapProps) {
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  const handleSelect = (activity: Activity) => {
    setSelectedActivity((prev) => (prev?.id === activity.id ? null : activity));
    props.onSelectActivity?.(activity);
  };

  const activeSelectedId = selectedActivity?.id ?? props.selectedId;

  return (
    <div className="relative w-full h-full">
      {GOOGLE_MAPS_API_KEY ? (
        <GoogleTripMap
          apiKey={GOOGLE_MAPS_API_KEY}
          {...props}
          selectedId={activeSelectedId}
          onSelectActivity={handleSelect}
        />
      ) : (
        <LeafletTripMap
          {...props}
          selectedId={activeSelectedId}
          onSelectActivity={handleSelect}
        />
      )}

      {selectedActivity && (
        <PlaceDetailsCard
          activity={selectedActivity}
          destination={props.destination}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </div>
  );
}

