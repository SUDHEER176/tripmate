import { useState } from "react";
import {
  Navigation,
  ExternalLink,
  Share2,
  Bookmark,
  Check,
  MapPin,
  Clock,
  Coins,
  Star,
  X,
  Compass,
} from "lucide-react";
import type { Activity } from "@/lib/types";

type PlaceDetailsCardProps = {
  activity: Activity;
  destination: string;
  onClose: () => void;
};

function getPlaceImage(activity: Activity): string {
  const text = `${activity.name} ${activity.category} ${activity.description || ""}`.toLowerCase();
  if (text.includes("biryani") || text.includes("rice")) {
    return "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80";
  }
  if (text.includes("cafe") || text.includes("coffee") || text.includes("tea")) {
    return "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80";
  }
  if (text.includes("food") || text.includes("restaurant") || text.includes("dine") || activity.category === "food") {
    return "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80";
  }
  if (text.includes("beach") || text.includes("coast") || text.includes("sea")) {
    return "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80";
  }
  if (text.includes("temple") || text.includes("church") || text.includes("mosque") || text.includes("heritage")) {
    return "https://images.unsplash.com/photo-1609137144822-45e05c3080ff?auto=format&fit=crop&w=600&q=80";
  }
  if (text.includes("park") || text.includes("garden") || text.includes("waterfall") || text.includes("nature")) {
    return "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=600&q=80";
  }
  if (text.includes("shopping") || text.includes("market") || text.includes("bazaar") || activity.category === "shopping") {
    return "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=600&q=80";
  }
  if (text.includes("hotel") || text.includes("resort") || activity.category === "accommodation") {
    return "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80";
  }
  return "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=600&q=80";
}

function getCategoryLabel(category: string, name: string): string {
  const n = name.toLowerCase();
  if (n.includes("cafe") || n.includes("coffee")) return "Cafe & Coffee Shop";
  if (n.includes("biryani")) return "Biryani Restaurant";
  switch (category) {
    case "food":
      return "Restaurant & Dining";
    case "sightseeing":
      return "Tourist Attraction & Landmark";
    case "activity":
      return "Excursion & Activities";
    case "shopping":
      return "Shopping & Retail";
    case "nightlife":
      return "Nightlife & Entertainment";
    case "accommodation":
      return "Hotel & Lodging";
    case "transport":
      return "Transit & Transport";
    default:
      return "Points of Interest";
  }
}

export default function PlaceDetailsCard({ activity, destination, onClose }: PlaceDetailsCardProps) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const lat = activity.lat ?? 0;
  const lng = activity.lng ?? 0;
  const categoryLabel = getCategoryLabel(activity.category, activity.name);
  const image = getPlaceImage(activity);

  // Google Maps links
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${activity.name} ${activity.location_name || destination}`,
  )}`;

  function handleShare() {
    if (navigator.share) {
      navigator.share({
        title: activity.name,
        text: `Check out ${activity.name} in ${destination}!`,
        url: searchUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${activity.name} - ${searchUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const isFood = activity.category === "food" || activity.name.toLowerCase().includes("cafe");

  return (
    <div
      role="dialog"
      aria-label={activity.name}
      className="animate-fade-up absolute bottom-2 left-2 right-2 z-[1000] flex max-h-[85%] flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-white/95 shadow-2xl backdrop-blur-md sm:bottom-auto sm:left-4 sm:top-4 sm:right-auto sm:max-h-[calc(100%-2rem)] sm:w-[340px]"
    >
      {/* Header Bar with Search & Close */}
      <div className="flex items-center justify-between border-b border-neutral-100 bg-white px-3 py-2.5">
        <div className="flex items-center gap-2 overflow-hidden text-neutral-800">
          <Compass className="h-4 w-4 shrink-0 text-blue-600" />
          <span className="truncate text-xs font-semibold tracking-wide text-neutral-600">
            {activity.name}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="overflow-y-auto overscroll-contain">
        {/* Cover Photo */}
        <div className="relative h-40 w-full overflow-hidden bg-neutral-100">
          <img
            src={image}
            alt={activity.name}
            className="h-full w-full object-cover transition duration-300 hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-2 left-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
            📷 Place Photos
          </div>
          {activity.start_time && (
            <div className="absolute top-2 right-3 rounded-full bg-emerald-600/90 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm shadow-sm">
              Open • {activity.start_time}
            </div>
          )}
        </div>

        {/* Place Info */}
        <div className="p-4">
          <h3 className="font-display text-lg font-bold leading-tight text-neutral-950 sm:text-xl">
            {activity.name}
          </h3>

          {/* Rating and Price */}
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-neutral-600">
            <span className="font-semibold text-neutral-900">4.7</span>
            <div className="flex text-amber-500">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-amber-500" />
              ))}
            </div>
            <span className="text-neutral-400">(140+)</span>
            <span>•</span>
            <span className="font-medium text-neutral-700">
              {activity.estimated_cost > 0 ? `₹${activity.estimated_cost}` : "Free"}
            </span>
          </div>

          <p className="mt-0.5 text-xs text-neutral-500">{categoryLabel}</p>

          {/* Google Maps Action Buttons (Directions, Save, Maps, Share) */}
          <div className="mt-3.5 flex items-center justify-between border-y border-neutral-100 py-2.5">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col items-center gap-1 text-[11px] font-medium text-neutral-700 hover:text-blue-600 group"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white shadow-sm">
                <Navigation className="h-4 w-4" />
              </div>
              Directions
            </a>

            <button
              type="button"
              onClick={() => setSaved(!saved)}
              className="flex flex-col items-center gap-1 text-[11px] font-medium text-neutral-700 hover:text-blue-600 group"
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full transition shadow-sm ${
                  saved ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-600 group-hover:bg-neutral-200"
                }`}
              >
                <Bookmark className="h-4 w-4" />
              </div>
              {saved ? "Saved" : "Save"}
            </button>

            <a
              href={searchUrl}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col items-center gap-1 text-[11px] font-medium text-neutral-700 hover:text-blue-600 group"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition group-hover:bg-neutral-200 shadow-sm">
                <ExternalLink className="h-4 w-4" />
              </div>
              Maps
            </a>

            <button
              type="button"
              onClick={handleShare}
              className="flex flex-col items-center gap-1 text-[11px] font-medium text-neutral-700 hover:text-blue-600 group"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition group-hover:bg-neutral-200 shadow-sm">
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
              </div>
              {copied ? "Copied" : "Share"}
            </button>
          </div>

          {/* Quick Tags (like Dine-in · Takeaway in screenshot) */}
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-neutral-600">
            {isFood ? (
              <>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                  ✓ Dine-in
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                  ✓ Takeaway
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                  ✓ Popular
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                  ✓ Scenic Views
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                  ✓ Photography
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                  ✓ Must Visit
                </span>
              </>
            )}
          </div>

          {/* Location & Details List */}
          <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3 text-xs text-neutral-700">
            <div className="flex items-start gap-2.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-600 mt-0.5" />
              <span className="leading-snug">
                {activity.location_name || `${destination} coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)})`}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>
                {activity.start_time ? `Scheduled for ${activity.start_time}` : "Flexible schedule"}
                {activity.duration_minutes ? ` • ${activity.duration_minutes} min duration` : ""}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <Coins className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              <span>
                {activity.estimated_cost > 0
                  ? `₹${activity.estimated_cost} ${
                      activity.cost_basis === "per_person" ? "per traveler" : "total estimate"
                    }`
                  : "Free / Included in itinerary"}
              </span>
            </div>

            {activity.description && (
              <p className="mt-2 rounded-lg bg-neutral-50 p-2 text-[11px] leading-relaxed text-neutral-600">
                {activity.description}
              </p>
            )}
          </div>

          {/* Primary Action Button */}
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99]"
          >
            <Navigation className="h-3.5 w-3.5" />
            Open Directions in Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}
