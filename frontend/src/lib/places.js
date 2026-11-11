import { destinations } from "./destinations";

export async function searchPlaces(query, signal) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const lower = trimmed.toLowerCase();
  const results = [];
  const seenNames = new Set();

  // 1. Curated destination matches first (instant)
  for (const dest of destinations) {
    if (
      dest.name.toLowerCase().includes(lower) ||
      dest.country.toLowerCase().includes(lower)
    ) {
      results.push({
        id: `curated-${dest.name}`,
        name: dest.name,
        subtitle: `${dest.country} · ${dest.vibe}`,
        lat: dest.lat,
        lng: dest.lng,
        country: dest.country,
        isCurated: true,
      });
      seenNames.add(dest.name.toLowerCase());
    }
  }

  // 2. Query Photon Geocoding API (OpenStreetMap)
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=6`,
      {
        signal,
      },
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.features)) {
        for (const feature of data.features) {
          const props = feature.properties || {};
          const name = props.name;
          if (!name) continue;

          const nameKey = name.toLowerCase();
          if (seenNames.has(nameKey)) continue;

          const locationParts = [
            props.city,
            props.district,
            props.state,
            props.country,
          ]
            .filter(Boolean)
            .filter((part) => part.toLowerCase() !== nameKey);

          const uniqueParts = Array.from(new Set(locationParts));
          const subtitle = uniqueParts.slice(0, 2).join(", ");

          results.push({
            id: `osm-${props.osm_id ?? Math.random()}`,
            name,
            subtitle: subtitle || props.country || "Destination",
            lat: feature.geometry?.coordinates?.[1],
            lng: feature.geometry?.coordinates?.[0],
            country: props.country,
          });
          seenNames.add(nameKey);
        }
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    console.debug("Place search fallback to local:", err);
  }

  return results.slice(0, 6);
}
