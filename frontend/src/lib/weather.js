// Daily weather for a trip from Open-Meteo (free, no API key).
// Days within the 16-day forecast window get the forecast; other days show the
// same dates last year as a guide to typical weather.

import { useEffect, useState } from "react";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const FORECAST_DAYS = 16;

const DAY_MS = 86_400_000;
const toUtc = (iso) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms) => new Date(ms).toISOString().slice(0, 10);

/** WMO weather code → short label and icon name (lucide). */
export function describeWeather(code) {
  if (code === 0) return { label: "Clear", icon: "sun" };
  if (code <= 2) return { label: "Partly cloudy", icon: "cloud-sun" };
  if (code === 3) return { label: "Cloudy", icon: "cloud" };
  if (code === 45 || code === 48) return { label: "Fog", icon: "fog" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: "drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: "Rain", icon: "rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "Snow", icon: "snow" };
  if (code >= 95) return { label: "Thunderstorm", icon: "storm" };
  return { label: "Mixed", icon: "cloud" };
}

const isRainy = (day) =>
  (day.code >= 51 && day.code <= 67) || day.code >= 80 || (day.rain_chance ?? 0) >= 60;

async function fetchDaily(base, lat, lng, start, end, extra) {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    start_date: start,
    end_date: end,
    timezone: "auto",
    daily: ["weather_code", "temperature_2m_max", "temperature_2m_min", extra].join(","),
  });
  const res = await fetch(`${base}?${params}`);
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const { daily } = await res.json();
  return (daily?.time ?? []).map((date, i) => ({
    date,
    code: daily.weather_code?.[i],
    max: daily.temperature_2m_max?.[i],
    min: daily.temperature_2m_min?.[i],
    rain_chance: daily.precipitation_probability_max?.[i] ?? null,
    rain_mm: daily.precipitation_sum?.[i] ?? null,
  }));
}

/**
 * Returns { [isoDate]: { code, max, min, rain_chance, label, icon, typical } }
 * for each trip day it could find. `typical` means last year's weather.
 */
export async function getTripWeather(lat, lng, startDate, endDate) {
  if (lat == null || lng == null || !startDate || !endDate) return {};
  const today = toUtc(toIso(Date.now()));
  const lastForecast = today + (FORECAST_DAYS - 1) * DAY_MS;
  const start = toUtc(startDate);
  const end = toUtc(endDate);
  const result = {};
  const add = (rows, typical, shiftMs = 0) => {
    for (const row of rows) {
      if (row.code == null || row.max == null) continue;
      const date = toIso(toUtc(row.date) + shiftMs);
      result[date] = { ...row, date, typical, ...describeWeather(row.code) };
    }
  };

  const jobs = [];
  // Forecast for the part of the trip from today to 16 days ahead.
  const fStart = Math.max(start, today);
  const fEnd = Math.min(end, lastForecast);
  if (fStart <= fEnd) {
    jobs.push(
      fetchDaily(FORECAST_URL, lat, lng, toIso(fStart), toIso(fEnd), "precipitation_probability_max")
        .then((rows) => add(rows, false)),
    );
  }
  // Everything else: the same dates one year earlier (52 weeks keeps weekdays aligned).
  const year = 364 * DAY_MS;
  const others = [];
  for (let d = start; d <= end; d += DAY_MS) if (d < fStart || d > fEnd) others.push(d);
  if (others.length) {
    jobs.push(
      fetchDaily(ARCHIVE_URL, lat, lng, toIso(others[0] - year), toIso(others.at(-1) - year), "precipitation_sum")
        .then((rows) =>
          add(
            rows
              .filter((r) => others.includes(toUtc(r.date) + year))
              .map((r) => ({ ...r, rain_chance: r.rain_mm != null && r.rain_mm >= 2 ? 70 : r.rain_mm != null ? 10 : null })),
            true,
            year,
          ),
        ),
    );
  }
  await Promise.allSettled(jobs);
  return result;
}

/** A short hint for the packing list: coldest low, hottest high, rainy days. */
export function weatherHint(weather) {
  const days = Object.values(weather ?? {});
  if (!days.length) return null;
  return {
    min_temp: Math.min(...days.map((d) => d.min)),
    max_temp: Math.max(...days.map((d) => d.max)),
    rainy_days: days.filter(isRainy).length,
  };
}

const cache = new Map();

/** React hook: weather by date for a trip. Cached per trip location and dates. */
export function useTripWeather(lat, lng, startDate, endDate) {
  const key = [lat, lng, startDate, endDate].join("|");
  const [state, setState] = useState(() => cache.get(key) ?? null);
  useEffect(() => {
    let alive = true;
    if (cache.has(key)) {
      setState(cache.get(key));
      return;
    }
    setState(null);
    getTripWeather(lat, lng, startDate, endDate)
      .then((weather) => {
        cache.set(key, weather);
        if (alive) setState(weather);
      })
      .catch(() => alive && setState({}));
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}
