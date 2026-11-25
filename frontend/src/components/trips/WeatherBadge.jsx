import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

/** Compact "☀ 31°" for the day tabs. */
export function WeatherChip({ day, className }) {
  if (!day) return null;
  const Icon = icons[day.icon] ?? Cloud;
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-[11px] font-medium tabular-nums", className)}
      title={`${day.label}${day.typical ? " (typical, based on last year)" : ""}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {Math.round(day.max)}°
    </span>
  );
}

/** Full line for the selected day: icon, label, high / low, rain chance. */
export function WeatherLine({ day }) {
  if (!day) return null;
  const Icon = icons[day.icon] ?? Cloud;
  return (
    <p className="mt-2 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">
      <Icon className="h-4 w-4 text-neutral-800" aria-hidden />
      <span className="font-medium text-neutral-800">{day.label}</span>
      <span className="tabular-nums">
        {Math.round(day.max)}° / {Math.round(day.min)}°C
      </span>
      {day.rain_chance != null && !day.typical && (
        <span className="tabular-nums">· {day.rain_chance}% rain</span>
      )}
      <span className="text-neutral-400">
        {day.typical ? "· typical (last year)" : "· forecast"}
      </span>
    </p>
  );
}
