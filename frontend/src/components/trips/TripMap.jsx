import { useState } from "react";
import GoogleTripMap from "./GoogleTripMap";
import LeafletTripMap from "./LeafletTripMap";
import PlaceDetailsCard from "./PlaceDetailsCard";

const GOOGLE_MAPS_API_KEY = (
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""
).trim();

/** Google Maps when VITE_GOOGLE_MAPS_API_KEY is set, otherwise the OpenStreetMap fallback. */
export default function TripMap(props) {
  const [selectedActivity, setSelectedActivity] = useState(null);

  const handleSelect = (activity) => {
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
