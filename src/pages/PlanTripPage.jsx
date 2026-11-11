import { useState } from "react";
import { AlertCircle, Gauge, Heart, Sparkles, Wallet } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TripForm } from "@/components/trips/TripForm";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { createTrip } from "@/lib/api";

const tips = [
  {
    icon: Gauge,
    title: "Pace matters",
    body: "Relaxed schedules 3 stops a day; Packed fits 5 for active explorers.",
  },
  {
    icon: Heart,
    title: "Pick 2–3 interests",
    body: "Food and culture together give a good balance of sightseeing and dining.",
  },
  {
    icon: Wallet,
    title: "Budget for everything",
    body: "Include flights and hotels in your total for realistic breakdowns.",
  },
];

export function PlanTripPage() {
  const [searchParams] = useSearchParams();
  const initialDestination = searchParams.get("destination") || "";
  const initialDays = Number(searchParams.get("days")) || undefined;
  const initialBudget = Number(searchParams.get("budget")) || undefined;
  const { user } = useAuth();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(values) {
    setSubmitting(true);
    setError(null);
    try {
      const activeUserId = user?.id || "guest-traveler-id";
      const trip = await createTrip(activeUserId, values);
      navigate(`/trips/${trip.id}`);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to generate itinerary. Please try again.";
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700">
          <Sparkles className="h-3.5 w-3.5" />
          AI itinerary engine
        </div>
        <h1 className="mt-3 font-display text-3xl tracking-tight text-neutral-950 sm:text-4xl">
          Where would you like to go?
        </h1>
        <p className="mt-2 text-sm text-neutral-500 sm:text-base">
          Set your destination, dates and budget. We’ll build daily stops, cost
          estimates and a map route.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
        <div>
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-xl border border-terracotta/20 bg-terracotta/5 p-4 text-sm text-terracotta"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Card className="p-6 sm:p-8">
            <TripForm
              initialDestination={initialDestination}
              initialDays={initialDays}
              initialBudget={initialBudget}
              submitting={submitting}
              onSubmit={handleSubmit}
            />
          </Card>
        </div>

        {/* Planning tips */}
        <aside className="space-y-3 lg:sticky lg:top-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
            Planning tips
          </p>
          {tips.map((tip) => (
            <div
              key={tip.title}
              className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-4"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
                <tip.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-neutral-950">
                  {tip.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
                  {tip.body}
                </p>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
