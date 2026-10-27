import { useState } from "react";
import { Check, Loader2, Route, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { optimizeDayRoute } from "@/lib/api";
import type { Activity, RouteOptimization } from "@/lib/types";

function formatMinutes(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

/**
 * Previews the fastest order for a day's stops and applies it on confirmation.
 * Hidden when fewer than three stops have coordinates (nothing to reorder).
 */
export function RouteOptimizerBar({
  tripId,
  dayId,
  activities,
  onApplied,
}: {
  tripId: string;
  dayId: string;
  activities: Activity[];
  onApplied: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<RouteOptimization | null>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (activities.filter((a) => a.lat != null && a.lng != null).length < 3) return null;

  async function run(apply: boolean) {
    setBusy(apply ? "apply" : "preview");
    setError(null);
    try {
      const result = await optimizeDayRoute(tripId, dayId, apply);
      if (apply) {
        await onApplied();
        setPreview(null);
      } else {
        setPreview(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not optimize the route. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const mode = preview?.travel_mode === "WALK" ? "on foot" : "by car";
  const source = preview?.source === "google" ? "Travel times from Google Maps" : "Estimated from distance";
  const pct = preview && preview.before.seconds ? Math.round((preview.saved_seconds / preview.before.seconds) * 100) : 0;

  return (
    <div className="no-print mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      {!preview && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Route className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
            <div>
              <p className="text-sm font-medium text-neutral-950">Spend less time travelling</p>
              <p className="text-xs text-neutral-500">
                Find the fastest order for today’s stops. Morning, afternoon and evening stay in place.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => run(false)} disabled={busy !== null}>
            {busy === "preview" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Route className="h-3.5 w-3.5" />}
            {busy === "preview" ? "Checking routes…" : "Optimize route"}
          </Button>
        </div>
      )}

      {preview && !preview.changed && (
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-start gap-2 text-sm text-neutral-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>
              This day is already in the fastest order: about {formatMinutes(preview.before.seconds)} of travel {mode}.
              <span className="block text-xs text-neutral-500">{source}</span>
            </span>
          </p>
          <button
            type="button"
            onClick={() => setPreview(null)}
            aria-label="Dismiss"
            className="cursor-pointer rounded-full p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-950"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {preview?.changed && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-neutral-950">
              Save {formatMinutes(preview.saved_seconds)} of travel ({pct}% less)
            </p>
            <p className="text-xs text-neutral-500">
              {formatMinutes(preview.before.seconds)} → {formatMinutes(preview.after.seconds)} {mode} · {source}
              {Object.keys(preview.start_times).length > 0 && " · start times shift to match"}
              {preview.skipped > 0 && ` · ${preview.skipped} stop(s) without a location stay put`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPreview(null)} disabled={busy !== null}>
              Keep current
            </Button>
            <Button size="sm" onClick={() => run(true)} disabled={busy !== null}>
              {busy === "apply" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Apply new order
            </Button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-xs text-terracotta">{error}</p>}
    </div>
  );
}
